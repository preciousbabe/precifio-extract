// netlify/functions/batch-extract.js

import Busboy from 'busboy';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import { processBatch, calculateZipCredits } from '../../services/batchProcessor.js';
import { deductCredits, addCredits } from '../../services/creditEngine.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// HELPERS
// ============================================

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: {
        'content-type':
          event.headers['content-type'] ||
          event.headers['Content-Type']
      }
    });

    const result = { files: [], fields: {} };

    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        result.files.push({
          fieldname,
          filename,
          mimetype: mimeType,
          buffer: Buffer.concat(chunks)
        });
      });
    });

    busboy.on('field', (fieldname, value) => {
      result.fields[fieldname] = value;
    });

    busboy.on('close', () => resolve(result));
    busboy.on('error', reject);

    busboy.write(
      Buffer.from(
        event.body,
        event.isBase64Encoded ? 'base64' : 'utf8'
      )
    );
    busboy.end();
  });
}

async function authenticateUser(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ============================================
// BACKGROUND SAVER — Fire and forget, never blocks response
// ============================================

function saveBatchResultsBackground(userId, results, documentType, creditEstimate, eventHeaders) {
  // Process each result in parallel, no awaiting in main thread
  const savePromises = results.map(async (result) => {
    if (!result.success) return null;

    const docId = uuidv4();
    const dbStatus = result.dbStatus || (
      result.status === 'REVIEW_REQUIRED' ? 'review_required' :
      result.status === 'AUTO_APPROVED' ? 'completed' :
      'review_required'
    );
    const detectedDocType = result.extraction?.document_type || documentType;

    // 1. Insert document (fire and forget internally)
    const { error: docError } = await supabase.from('documents').insert({
      id: docId,
      user_id: userId,
      file_name: result.fileName,
      file_type: result.mimeType,
      file_size: null,
      document_type: detectedDocType,
      status: dbStatus,
      processing_method: result.processingMethod || 'gpt-only',
      page_count: result.pageCount || 1,
      credits_used: 1,
      storage_path: null
    });

    if (docError) {
      console.error('Background batch: document insert failed for', result.fileName, ':', docError.message);
      return null;
    }

    // 2. Save extraction (parallel, don't block on it)
    supabase.from('extractions').insert({
      id: uuidv4(),
      document_id: docId,
      version: 1,
      raw_data: result.rawExtraction || result.extraction || {},
      extracted_data: result.extraction || {},
      validation_flags: result.validation || { isValid: false, flags: [], requiresReview: true },
      confidence_scores: result.confidence || { overall: 0, breakdown: {}, flags: { low_confidence_fields: [] }, status: 'LOW', requiresReview: true }
    }).then(({ error }) => {
      if (error) console.error('Background batch: extraction save failed for', result.fileName, ':', error.message);
    });

    // Attach saved ID to result object for potential response enrichment
    result.documentId = docId;
    return docId;
  });

  // Fire all document saves in parallel, log when done
  Promise.allSettled(savePromises)
    .then((results) => {
      const saved = results.filter(r => r.status === 'fulfilled' && r.value).length;
      console.log(`Background batch: ${saved}/${results.length} documents saved`);
    })
    .catch(err => console.error('Background batch: unexpected error:', err.message));

  // Audit log (completely non-blocking)
  supabase.from('audit_log').insert({
    user_id: userId || null,
    action: 'batch_extraction_completed',
    resource_type: 'batch',
    resource_id: null,
    user_agent: eventHeaders['user-agent'] || null,
    details: {
      total_documents: results.length,
      processed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      review_required: results.filter(r => r.status === 'REVIEW_REQUIRED').length,
      credits_used: creditEstimate?.creditsRequired || 0
    }
  }).catch(err => console.error('Background batch: audit log failed:', err.message));
}

// ============================================
// HANDLER — Only blocks on batch processing, never on saves
// ============================================

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let user = null;
  let creditEstimate = null;
  let creditResult = null;

  try {
    //-------------------------------------------------
    // Auth
    //-------------------------------------------------
    user = await authenticateUser(
      event.headers.authorization || event.headers.Authorization
    );

    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    //-------------------------------------------------
    // Parse Upload
    //-------------------------------------------------
    const parsed = await parseMultipart(event);
    const file = parsed.files[0];

    if (!file) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No ZIP uploaded' })
      };
    }

    if (
      file.mimetype !== 'application/zip' &&
      file.mimetype !== 'application/x-zip-compressed'
    ) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Only ZIP files allowed' })
      };
    }

    //-------------------------------------------------
    // Credit Check
    //-------------------------------------------------
    creditEstimate = await calculateZipCredits(file.buffer);
    creditResult = await deductCredits(user.id, creditEstimate.creditsRequired);

    if (!creditResult.success) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: `Insufficient credits. Need ${creditEstimate.creditsRequired}, have ${creditResult.available}`,
          code: 'INSUFFICIENT_CREDITS',
          required: creditEstimate.creditsRequired,
          available: creditResult.available
        })
      };
    }

    //-------------------------------------------------
    // Process Batch — THIS IS THE ONLY BLOCKING WORK
    //-------------------------------------------------
    const result = await processBatch({
      zipBuffer: file.buffer,
      documentType: parsed.fields.documentType || 'mixed'
    });

    //-------------------------------------------------
    // BACKGROUND: All Supabase writes fire-and-forget
    //-------------------------------------------------
    saveBatchResultsBackground(
      user.id,
      result.results,
      parsed.fields.documentType || 'mixed',
      creditEstimate,
      event.headers
    );

    //-------------------------------------------------
    // RETURN IMMEDIATELY — user gets results NOW
    //-------------------------------------------------
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        source: 'batch',
        totalDocuments: result.totalDocuments,
        totalPages: result.totalPages,
        creditsUsed: creditEstimate.creditsRequired,
        creditsRemaining: creditResult.newBalance,
        processedCount: result.processedCount,
        failedCount: result.failedCount,
        reviewRequiredCount: result.reviewRequiredCount,
        results: result.results
      })
    };

  } catch (error) {
    console.error('BATCH EXTRACT ERROR:', error);

    // Refund credits on failure
    if (creditEstimate?.creditsRequired && user?.id) {
      await addCredits(user.id, creditEstimate.creditsRequired, 'batch_refund');
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        creditsRefunded: creditEstimate?.creditsRequired || 0
      })
    };
  }
}
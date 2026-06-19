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
// HELPERS (defined before use)
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

    const result = {
      files: [],
      fields: {}
    };

    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;

      const chunks = [];

      file.on('data', (data) => {
        chunks.push(data);
      });

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

async function auditLog(userId, action, resourceType, resourceId, details = {}, reqHeaders = {}) {
  try {
    await supabase.from('audit_log').insert({
      user_id: userId || null,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      user_agent: reqHeaders['user-agent'] || null,
      details
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

async function saveBatchDocument(userId, result, documentType) {
  const docId = uuidv4();

  // FIX: Use dbStatus from pipeline result, or map from status
  const dbStatus = result.dbStatus || (
    result.status === 'REVIEW_REQUIRED' ? 'review_required' :
    result.status === 'AUTO_APPROVED' ? 'completed' :
    'review_required'
  );

  // FIX: Use GPT-detected document type if available
  const detectedDocType = result.extraction?.document_type || documentType;

  const { error: docError } = await supabase.from('documents').insert({
    id: docId,
    user_id: userId,
    file_name: result.fileName,
    file_type: result.mimeType,
    file_size: null,
    document_type: detectedDocType,  // Use GPT-detected type
    status: dbStatus,                // Use DB-compatible status
    processing_method: result.processingMethod || 'gpt-only',
    page_count: result.pageCount || 1,
    credits_used: 1,
    storage_path: null
  });

  if (docError) {
    console.error('Failed to insert batch document:', docError.message);
    return null;
  }

  // FIX: Save full extraction data including validation and confidence
  const { error: extError } = await supabase.from('extractions').insert({
    id: uuidv4(),
    document_id: docId,
    version: 1,
    raw_data: result.rawExtraction || result.extraction || {},
    extracted_data: result.extraction || {},
    validation_flags: result.validation || { isValid: false, flags: [], requiresReview: true },
    confidence_scores: result.confidence || { overall: 0, breakdown: {}, flags: { low_confidence_fields: [] }, status: 'LOW', requiresReview: true }
  });

  if (extError) {
    console.error('Failed to insert batch extraction:', extError.message);
  }

  return docId;
}

async function authenticateUser(authHeader) {
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');

  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;

  return user;
}

// ============================================
// HANDLER
// ============================================

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization',
    'Access-Control-Allow-Methods':
      'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: 'Method not allowed'
      })
    };
  }

  // Declare variables here so catch block can access them
  let user = null;
  let creditEstimate = null;
  let creditResult = null;

  try {
    //-------------------------------------------------
    // Auth
    //-------------------------------------------------

    user = await authenticateUser(
      event.headers.authorization ||
        event.headers.Authorization
    );

    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'Unauthorized'
        })
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
        body: JSON.stringify({
          error: 'No ZIP uploaded'
        })
      };
    }

    if (
      file.mimetype !== 'application/zip' &&
      file.mimetype !== 'application/x-zip-compressed'
    ) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Only ZIP files allowed'
        })
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
    // Process Batch
    //-------------------------------------------------

    const result = await processBatch({
      zipBuffer: file.buffer,
      // FIX: Default to 'mixed' for auto-detection
      documentType: parsed.fields.documentType || 'mixed'
    });

    //-------------------------------------------------
    // Save batch results to Supabase
    //-------------------------------------------------

    const documentType = parsed.fields.documentType || 'mixed';

    for (const r of result.results) {
      if (r.success) {
        const savedDocId = await saveBatchDocument(user.id, r, documentType);
        if (savedDocId) {
          r.documentId = savedDocId;
        }
      }
    }

    await auditLog(user.id, 'batch_extraction_completed', 'batch', null, {
      total_documents: result.totalDocuments,
      processed: result.processedCount,
      failed: result.failedCount,
      review_required: result.reviewRequiredCount,
      credits_used: creditEstimate.creditsRequired
    }, event.headers);

    //-------------------------------------------------
    // Response
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
    if (creditEstimate && creditEstimate.creditsRequired && user && user.id) {
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
import {
  countPages
} from '../../services/documentProcessor.js';

import { runExtractionPipeline }
  from '../../services/extractionPipeline.js';
import { deductCredits, addCredits } from '../../services/creditEngine.js';
import { v4 as uuidv4 } from 'uuid';
import Busboy from 'busboy';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] }
    });
    const result = { files: [], fields: {} };
    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        result.files.push({ fieldname, filename, mimetype: mimeType, buffer: Buffer.concat(chunks) });
      });
    });
    busboy.on('field', (fieldname, value) => { result.fields[fieldname] = value; });
    busboy.on('close', () => resolve(result));
    busboy.on('error', reject);
    busboy.write(Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8'));
    busboy.end();
  });
}

const requestCounts = new Map();
function checkRateLimit(key, maxRequests = 50, windowMs = 60000) {
  const now = Date.now();
  if (!requestCounts.has(key)) {
    requestCounts.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }
  const record = requestCounts.get(key);
  if (now > record.resetTime) { record.count = 1; record.resetTime = now + windowMs; return { allowed: true }; }
  if (record.count >= maxRequests) return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  record.count++;
  return { allowed: true };
}

// ============================================
// BACKGROUND HELPERS — Fire and forget, never block
// ============================================

async function saveToSupabaseBackground(
    userId,
    docId,
    file,
    pageCount,
    extractionResult,
    eventHeaders
) {
  const { parsedSchema, validation, dbStatus, processingMethod, rawExtraction } = extractionResult;
  
  try {
    // 1. Insert document record with full metadata
    const { error: docError } = await supabase.from('documents').insert({
      id: docId,
      user_id: userId,
      file_name: file.filename,
      file_type: file.mimetype,
      file_size: file.buffer.length,
      document_type: parsedSchema.document_type,
      status: dbStatus,
      processing_method: processingMethod,
      page_count: pageCount,
      credits_used: pageCount
    });

    if (docError) {
      console.error('Background: document insert failed:', docError.message);
      return; // Stop here if doc insert fails
    }

    // 2. Upload to storage (awaited — must succeed before extraction insert)
    const storagePath = `${userId}/${docId}/${file.filename}`;
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (storageError) {
      console.error('Background: storage upload failed:', storageError.message);
    } else {
      // Update document with storage path
      const { error: updateError } = await supabase
        .from('documents')
        .update({ storage_path: storagePath })
        .eq('id', docId);
      
      if (updateError) {
        console.error('Background: storage path update failed:', updateError.message);
      }
    }

    // 3. Save extraction + audit logs in parallel (independent of each other)
    const extractionPayload = {
      id: uuidv4(),
      document_id: docId,
      version: 1,
      raw_data: rawExtraction || {},
      extracted_data: rawExtraction || {},
      validation_flags: validation,
      confidence_scores: parsedSchema.confidence_scores || {}
    };

    const auditUpload = {
      user_id: userId || null,
      action: 'document_uploaded',
      resource_type: 'document',
      resource_id: docId,
      user_agent: eventHeaders['user-agent'] || null,
      details: {
        file_name: file.filename,
        page_count: pageCount,
        credits_used: pageCount
      }
    };

    const auditExtract = {
      user_id: userId || null,
      action: 'extraction_completed',
      resource_type: 'document',
      resource_id: docId,
      user_agent: eventHeaders['user-agent'] || null,
      details: {
        document_id: docId,
        status: dbStatus,
        confidence: parsedSchema.confidence_scores?.overall || 0
      }
    };

    const results = await Promise.allSettled([
      supabase.from('extractions').insert(extractionPayload),
      supabase.from('audit_log').insert(auditUpload),
      supabase.from('audit_log').insert(auditExtract)
    ]);

    results.forEach((result, index) => {
      if (result.status === 'rejected' || result.value?.error) {
        const names = ['extraction', 'audit_upload', 'audit_extract'];
        const err = result.status === 'rejected' ? result.reason : result.value.error;
        console.error(`Background: ${names[index]} save failed:`, err?.message || err);
      }
    });

    console.log('Background: all saves completed for doc', docId);

  } catch (err) {
    console.error('Background: unexpected error saving doc', docId, ':', err.message);
  }
}

async function authenticateUser(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function handler(event, context) {
  const requestStart = performance.now(); 
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const user = await authenticateUser(event.headers.authorization || event.headers.Authorization);
  const userId = user?.id;

  const rateKey = userId || event.headers['client-ip'] || 'anonymous';
  const rateCheck = checkRateLimit(rateKey, 50, 60000);
  if (!rateCheck.allowed) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Rate limit exceeded', retry_after: rateCheck.retryAfter }) };
  }

  let parsed;
  try { parsed = await parseMultipart(event); }
  catch (err) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Failed to parse upload' }) }; }

  const file = parsed.files[0];

  if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'ZIP uploads must use /batch-extract endpoint' })
    };
  }

  if (!file) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No document uploaded' }) };

  const documentType = parsed.fields.documentType || 'mixed';
  const docId = uuidv4();
  let creditsDeducted = 0;
  let pageCount = 1;

  try {
     pageCount = await countPages(file.buffer, file.mimetype);

    if (pageCount > 250) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Document exceeds maximum page limit' }) };
    }

    const creditResult = await deductCredits(userId, pageCount);

    if (!creditResult.success) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: `Insufficient credits. Need ${pageCount}, have ${creditResult.available}`, code: 'INSUFFICIENT_CREDITS', required: pageCount, available: creditResult.available }) };
    }
    creditsDeducted = pageCount;

    // ============================================
    // ONLY BLOCK ON EXTRACTION — the actual value
    // ============================================
    console.log('=== EXTRACTION PIPELINE START ===');
    const pipelineStart = performance.now();

    const extractionResult = await runExtractionPipeline({
      fileBuffer: file.buffer,
      mimeType: file.mimetype,
      documentType,
      fileName: file.filename
    });

    console.log('TOTAL PIPELINE TIME:', ((performance.now() - pipelineStart) / 1000).toFixed(2), 'seconds');
    console.log(`TOTAL REQUEST ${(performance.now() - pipelineStart).toFixed(0)} ms`);

    const parsedSchema = extractionResult.extraction;
    const validation = extractionResult.validation;
    const confidence = extractionResult.confidence;
    const dbStatus = extractionResult.dbStatus;
    const pipelineStatus = extractionResult.status;
    const processingMethod = extractionResult.processingMethod;
    const rawExtraction = extractionResult.rawExtraction;

    // ============================================
    // BACKGROUND: All Supabase writes fire-and-forget via setImmediate
    // ============================================
    setImmediate(() => {
      saveToSupabaseBackground(
        userId,
        docId,
        file,
        pageCount,
        { parsedSchema, validation, dbStatus, processingMethod, rawExtraction },
        event.headers
      ).catch(err => {
        console.error('Background save failed:', err);
      });
    });

    // ============================================
    // RETURN IMMEDIATELY — user gets their data NOW
    // ============================================
    const storagePath = `${userId}/${docId}/${file.filename}`;
    
    const responsePayload = {
      success: true,
      documentId: docId,
      extractionId: docId,
      extraction: parsedSchema,
      validation,
      confidence,        // TODO: remove in future — extraction already has confidence_scores
      storagePath,       // Frontend knows where file will exist once background upload completes
      pageCount,
      creditsUsed: pageCount,
      creditsRemaining: creditResult.newBalance,
      status: pipelineStatus
    };

    console.log('=== EXTRACT: SUCCESS ===');
    console.log('Doc Type:', parsedSchema.document_type, '| Vendor:', parsedSchema.vendor_name, '| Total:', parsedSchema.total_amount, '| Status:', dbStatus);
    console.log('TOTAL REQUEST TIME:', ((performance.now() - requestStart) / 1000).toFixed(2), 'seconds'); 
    return { statusCode: 200, headers, body: JSON.stringify(responsePayload) };

  } catch (error) {
    // Only refund credits if it's NOT a parser error (GPT already ran = expensive)
    console.log('TOTAL REQUEST TIME (FAILED):', ((performance.now() - requestStart) / 1000).toFixed(2), 'seconds');
    if (error.name !== 'ZodError' && creditsDeducted > 0 && userId) {
      await addCredits(userId, creditsDeducted, 'refund');
    }
    
    // Even on failure, save error state in background (detached, fire-and-forget)
    void supabase.from('documents').insert({
      id: docId,
      user_id: userId,
      file_name: file.filename,
      file_type: file.mimetype,
      file_size: file.buffer.length,
      document_type: documentType,
      status: 'failed',
      page_count: pageCount || 1,
      credits_used: 0
    }).then(() => {}).catch(console.error);

    console.error('=== EXTRACT: FAILED ===', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message, creditsRefunded: error.name !== 'ZodError' ? creditsDeducted : 0 }) };
  }
}
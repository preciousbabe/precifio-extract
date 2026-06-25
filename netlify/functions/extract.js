// Polyfill DOMMatrix for Node.js environment
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      if (typeof init === 'string') {
        this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      } else if (Array.isArray(init)) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      } else {
        this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      }
    }
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    skewX() { return this; }
    skewY() { return this; }
    inverse() { return this; }
    transformPoint() { return { x: 0, y: 0 }; }
    toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; }
  };
}

import {
  processDocument,
  countPages,
  SUPPORTED_TYPES
} from '../../services/documentProcessor.js';

import { runExtractionPipeline }
  from '../../services/extractionPipeline.js';
import { getUserCredits, deductCredits, addCredits } from '../../services/creditEngine.js';
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

async function auditLog(userId, action, resourceType, resourceId, details = {}, reqHeaders = {}) {
  try {
    await supabase.from('audit_log').insert({
      user_id: userId || null, action, resource_type: resourceType, resource_id: resourceId,
      user_agent: reqHeaders['user-agent'] || null, details
    });
  } catch (err) { console.error('Audit log failed:', err.message); }
}

async function authenticateUser(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function handler(event, context) {
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

  if (
    file.mimetype === 'application/zip' ||
    file.mimetype === 'application/x-zip-compressed'
  ) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'ZIP uploads must use /batch-extract endpoint'
      })
    };
  }

  if (!file) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No document uploaded' }) };

  // FIX: Default to 'mixed' so GPT auto-detects document type
  const documentType = parsed.fields.documentType || 'mixed';
  const docId = uuidv4();
  let creditsDeducted = 0;

  try {
    const pageCount = await countPages(file.buffer, file.mimetype);

    if (pageCount > 250) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Document exceeds maximum page limit' })
      };
    }

    const creditResult = await deductCredits(userId, pageCount);

    if (!creditResult.success) {
      await auditLog(userId, 'credit_check_failed', 'document', null, { required: pageCount, available: creditResult.available }, event.headers);
      return { statusCode: 403, headers, body: JSON.stringify({ error: `Insufficient credits. Need ${pageCount}, have ${creditResult.available}`, code: 'INSUFFICIENT_CREDITS', required: pageCount, available: creditResult.available }) };
    }
    creditsDeducted = pageCount;

    const { error: docError } = await supabase.from('documents').insert({
      id: docId,
      user_id: userId,
      file_name: file.filename,
      file_type: file.mimetype,
      file_size: file.buffer.length,
      document_type: documentType,
      status: 'processing',
      page_count: pageCount,
      credits_used: pageCount
    });
    if (docError) throw docError;

    let storagePath = null;
    try {
      storagePath = `${userId}/${docId}/${file.filename}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
      if (!uploadError) {
        await supabase.from('documents').update({ storage_path: storagePath }).eq('id', docId);
      }
    } catch (e) { console.error('Storage failed:', e.message); storagePath = null; }

    await auditLog(userId, 'document_uploaded', 'document', docId, { file_name: file.filename, page_count: pageCount, credits_used: pageCount }, event.headers);

    console.log('=== EXTRACTION PIPELINE START ===');
    

const pipelineStart = Date.now();

const extractionResult = await runExtractionPipeline({
  fileBuffer: file.buffer,
  mimeType: file.mimetype,
  documentType,
  fileName: file.filename
});

console.log(
  'TOTAL PIPELINE TIME:',
  ((Date.now() - pipelineStart) / 1000).toFixed(2),
  'seconds'
);


    const parsedSchema = extractionResult.extraction;
    const validation = extractionResult.validation;
    const confidence = extractionResult.confidence;

    // FIX: Use dbStatus for database, status for response
    const dbStatus = extractionResult.dbStatus;
    const pipelineStatus = extractionResult.status;

    // FIX: Update document with dbStatus (compatible with DocumentList)
    await supabase.from('documents').update({
      status: dbStatus,
      document_type: parsedSchema.document_type,  // Update with GPT-detected type
      processing_method: extractionResult.processingMethod
    }).eq('id', docId);

    // FIX: Save extraction with full data
    await supabase.from('extractions').insert({
      id: uuidv4(),
      document_id: docId,
      version: 1,
      raw_data: extractionResult.rawExtraction || {},
      extracted_data: parsedSchema,
      validation_flags: validation,
      confidence_scores: confidence
    });

    await auditLog(
      userId,
      'extraction_completed',
      'document',
      docId,
      { document_id: docId, status: dbStatus, confidence: confidence.overall },
      event.headers
    );

    const responsePayload = {
      success: true,
      documentId: docId,
      extractionId: docId,
      extraction: parsedSchema,
      validation,
      confidence,
      storagePath,
      pageCount,
      creditsUsed: pageCount,
      creditsRemaining: creditResult.newBalance,
      status: pipelineStatus  // 'REVIEW_REQUIRED' or 'AUTO_APPROVED' for frontend
    };

    console.log('=== EXTRACT: SUCCESS ===');
    console.log('Doc Type:', parsedSchema.document_type, '| Vendor:', parsedSchema.vendor_name, '| Total:', parsedSchema.total_amount, '| Status:', dbStatus);

    responsePayload.source = 'single';
    return { statusCode: 200, headers, body: JSON.stringify(responsePayload) };

  } catch (error) {
    if (creditsDeducted > 0 && userId) await addCredits(userId, creditsDeducted, 'refund');
    await supabase.from('documents').update({ status: 'failed' }).eq('id', docId);
    await auditLog(userId, 'extraction_failed', 'document', docId, { error: error.message, credits_refunded: creditsDeducted }, event.headers);
    console.error('=== EXTRACT: FAILED ===', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message, creditsRefunded: creditsDeducted }) };
  }
}
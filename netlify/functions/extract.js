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

import { processDocument, countPages, SUPPORTED_TYPES } from '../../services/documentProcessor.js';
import { extractWithAWS, isAwsConfigured } from '../../services/awsTextract.js';
import { extractWithGPT, normalizeExtraction } from '../../services/gptExtractor.js';
import { validateExtraction } from '../../services/validator.js';
import { InvoiceSchema } from '../../schemas/invoice.schema.js';
import { calculateConfidence } from '../../services/confidenceEngine.js';
import { mergeExtraction } from '../../services/mergeEngine.js';
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
  if (!file) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No document uploaded' }) };

  const documentType = parsed.fields.documentType || 'invoice';
  const docId = uuidv4();
  let creditsDeducted = 0;

  try {
    const pageCount = await countPages(file.buffer, file.mimetype);
    const creditResult = await deductCredits(userId, pageCount);

    if (!creditResult.success) {
      await auditLog(userId, 'credit_check_failed', 'document', null, { required: pageCount, available: creditResult.available }, event.headers);
      return { statusCode: 403, headers, body: JSON.stringify({ error: `Insufficient credits. Need ${pageCount}, have ${creditResult.available}`, code: 'INSUFFICIENT_CREDITS', required: pageCount, available: creditResult.available }) };
    }
    creditsDeducted = pageCount;

    const { error: docError } = await supabase.from('documents').insert({
      id: docId, user_id: userId, file_name: file.filename, file_type: file.mimetype,
      document_type: documentType, status: 'processing', page_count: pageCount, credits_used: pageCount
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

    console.log('=== EXTRACT: Processing document ===');
    const processedDoc = await processDocument(file.buffer, file.mimetype);
    console.log('Processed type:', processedDoc.type, '| Content length:', processedDoc.content?.length);

    if (processedDoc.type === 'batch') throw new Error('ZIP files require batch processing endpoint');

    let awsResult = null;
    if (isAwsConfigured()) {
      try { awsResult = await extractWithAWS(file.buffer, documentType); }
      catch (e) { console.warn('AWS failed:', e.message); }
    }

    console.log('=== EXTRACT: Calling GPT ===');
    const rawGpt = await extractWithGPT(processedDoc);
    console.log('GPT raw - vendor:', rawGpt?.vendor_name, '| total:', rawGpt?.total_amount, '| items:', rawGpt?.line_items?.length);

    const gptResult = normalizeExtraction(rawGpt);
    console.log('Normalized - vendor:', gptResult.vendor_name, '| total:', gptResult.total_amount);

    const extractionData = mergeExtraction({ aws: awsResult?.extracted ?? null, gpt: gptResult });
    if (!Array.isArray(extractionData.line_items)) extractionData.line_items = [];

    const parsedSchema = InvoiceSchema.parse(extractionData);
    const validation = validateExtraction(parsedSchema);
    const confidence = calculateConfidence(parsedSchema);

    const { data: dbExtraction } = await supabase.from('extractions').insert({
      document_id: docId, raw_data: extractionData, extracted_data: parsedSchema,
      validation_flags: validation.flags, confidence_scores: confidence, version: 1
    }).select().single();

    const finalStatus = validation.requiresReview ? 'review_required' : 'completed';
    await supabase.from('documents').update({ status: finalStatus, processing_method: awsResult ? 'aws-textract' : 'gpt-only' }).eq('id', docId);

    await auditLog(userId, 'extraction_completed', 'extraction', dbExtraction?.id, { document_id: docId, status: finalStatus, confidence: confidence.overall }, event.headers);

    const responsePayload = {
      success: true, documentId: docId, extractionId: dbExtraction?.id,
      extraction: parsedSchema, validation, confidence,
      pageCount, creditsUsed: pageCount, creditsRemaining: creditResult.newBalance,
      status: finalStatus === 'review_required' ? 'REVIEW_REQUIRED' : 'AUTO_APPROVED'
    };

    console.log('=== EXTRACT: SUCCESS ===');
    console.log('Vendor:', parsedSchema.vendor_name, '| Total:', parsedSchema.total_amount, '| Status:', finalStatus);

    return { statusCode: 200, headers, body: JSON.stringify(responsePayload) };

  } catch (error) {
    if (creditsDeducted > 0 && userId) await addCredits(userId, creditsDeducted, 'refund');
    await supabase.from('documents').update({ status: 'failed' }).eq('id', docId);
    await auditLog(userId, 'extraction_failed', 'document', docId, { error: error.message, credits_refunded: creditsDeducted }, event.headers);
    console.error('=== EXTRACT: FAILED ===', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message, creditsRefunded: creditsDeducted }) };
  }
}
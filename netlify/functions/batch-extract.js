import { processDocument, countPages } from '../../services/documentProcessor.js';
import { extractWithAWS, isAwsConfigured } from '../../services/awsTextract.js';
import { extractWithGPT, normalizeExtraction } from '../../services/gptExtractor.js';
import { validateExtraction } from '../../services/validator.js';
import { InvoiceSchema } from '../../schemas/invoice.schema.js';
import { calculateConfidence } from '../../services/confidenceEngine.js';
import { mergeExtraction } from '../../services/mergeEngine.js';
import { deductCredits, addCredits } from '../../services/creditEngine.js';
import { v4 as uuidv4 } from 'uuid';
import Busboy from 'busboy';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ... parseMultipart, auth, rate limit same as extract.js ...

export async function handler(event, context) {
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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const user = await authenticateUser(event.headers.authorization || event.headers.Authorization);
  const userId = user?.id;

  // Parse multipart
  let parsed;
  try {
    parsed = await parseMultipart(event);
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Failed to parse upload' }) };
  }

  const file = parsed.files[0];
  if (!file) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No archive uploaded' }) };
  }

  const documentType = parsed.fields.documentType || 'invoice';
  const jobName = parsed.fields.jobName || `Batch ${new Date().toLocaleDateString()}`;
  const batchId = uuidv4();

  try {
    // Process ZIP to get batch
    const processedZip = await processDocument(file.buffer, file.mimetype);
    
    if (processedZip.type !== 'batch') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Expected ZIP archive' }) };
    }

    const totalPages = processedZip.documents.reduce((sum, doc) => sum + (doc.pageCount || 1), 0);
    const fileCount = processedZip.documents.length;

    // Check credits
    const creditResult = await deductCredits(userId, totalPages);
    if (!creditResult.success) {
      return { 
        statusCode: 403, 
        headers, 
        body: JSON.stringify({
          error: `Insufficient credits for batch. Need ${totalPages}, have ${creditResult.available}`,
          code: 'INSUFFICIENT_CREDITS'
        }) 
      };
    }

    // Create batch job
    await supabase.from('batch_jobs').insert({
      id: batchId,
      user_id: userId,
      job_name: jobName,
      source: 'upload',
      total_documents: fileCount,
      total_pages: totalPages,
      status: 'processing',
      credits_used: totalPages
    });

    // Process each document
    const results = [];
    for (const doc of processedZip.documents) {
      const docId = uuidv4();
      const result = await processBatchDocument(docId, doc, userId, batchId, documentType);
      results.push(result);
    }

    // Update batch status
    const processedCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    const reviewCount = results.filter(r => r.status === 'review_required').length;

    await supabase.from('batch_jobs').update({
      status: failedCount === 0 ? 'completed' : (processedCount > 0 ? 'partial' : 'failed'),
      processed_count: processedCount,
      failed_count: failedCount,
      review_required_count: reviewCount,
      completed_at: new Date().toISOString()
    }).eq('id', batchId);

    // Refund failed pages
    if (failedCount > 0) {
      const failedPages = results.filter(r => !r.success).reduce((sum, r) => sum + (r.pageCount || 1), 0);
      await addCredits(userId, failedPages, 'batch_refund');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        batchId,
        totalPages,
        creditsUsed: totalPages,
        creditsRefunded: failedCount,
        creditsRemaining: creditResult.newBalance - totalPages + failedCount,
        summary: {
          total: results.length,
          processed: processedCount,
          failed: failedCount,
          reviewRequired: reviewCount
        },
        results
      })
    };

  } catch (error) {
    await supabase.from('batch_jobs').update({
      status: 'failed',
      error_log: error.message
    }).eq('id', batchId);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        batchId
      })
    };
  }
}

async function processBatchDocument(docId, doc, userId, batchId, documentType) {
  try {
    // Save document
    await supabase.from('documents').insert({
      id: docId,
      user_id: userId,
      batch_job_id: batchId,
      file_name: doc.fileName,
      file_type: doc.type === 'image' ? 'image/jpeg' : 'application/pdf',
      status: 'processing',
      page_count: doc.pageCount || 1
    });

    // Extract
    let awsResult = null;
    if (isAwsConfigured() && doc.buffer) {
      try {
        awsResult = await extractWithAWS(doc.buffer, documentType);
      } catch (e) {
        console.warn('AWS batch failed:', e.message);
      }
    }

    const rawGpt = await extractWithGPT(doc);
    const gptResult = normalizeExtraction(rawGpt);

    const extractionData = mergeExtraction({
      aws: awsResult?.extracted ?? null,
      gpt: gptResult
    });

    if (!Array.isArray(extractionData.line_items)) {
      extractionData.line_items = [];
    }

    const parsed = InvoiceSchema.parse(extractionData);
    const validation = validateExtraction(parsed);
    const confidence = calculateConfidence(parsed);

    // Save extraction
    await supabase.from('extractions').insert({
      document_id: docId,
      raw_data: extractionData,
      extracted_data: parsed,
      validation_flags: validation.flags,
      confidence_scores: confidence,
      version: 1
    });

    const status = validation.requiresReview ? 'review_required' : 'completed';
    
    await supabase.from('documents').update({
      status,
      processing_method: awsResult ? 'aws-textract' : 'gpt-only'
    }).eq('id', docId);

    return {
      success: true,
      documentId: docId,
      fileName: doc.fileName,
      status,
      confidence: confidence.overall,
      pageCount: doc.pageCount || 1
    };

  } catch (error) {
    await supabase.from('documents').update({ status: 'failed' }).eq('id', docId);
    return {
      success: false,
      documentId: docId,
      fileName: doc.fileName,
      error: error.message,
      pageCount: doc.pageCount || 1
    };
  }
}
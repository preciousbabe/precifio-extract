import { createClient } from '@supabase/supabase-js';
import { processDocument, countPages } from '../../services/documentProcessor.js';
import { extractWithAWS, isAwsConfigured } from '../../services/awsTextract.js';
import { extractWithGPT, normalizeExtraction } from '../../services/gptExtractor.js';
import { validateExtraction } from '../../services/validator.js';
import { InvoiceSchema } from '../../schemas/invoice.schema.js';
import { calculateConfidence } from '../../services/confidenceEngine.js';
import { mergeExtraction } from '../../services/mergeEngine.js';
import { deductCredits, addCredits } from '../../services/creditEngine.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function authenticateUser(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export const handler = async (event, context) => {
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
  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const { documentId } = JSON.parse(event.body);

    console.log('=== RETRY START ===');
  console.log('documentId:', documentId);
  console.log('user.id:', user.id);

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  console.log('DB query error:', docError);
  console.log('DB query doc:', doc ? { id: doc.id, storage_path: doc.storage_path, file_name: doc.file_name, status: doc.status } : 'NOT FOUND');

  if (docError || !doc) {
    console.log('Document not found, returning 404');
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Document not found' }) };
  }

  console.log('doc.storage_path value:', doc.storage_path);
  console.log('doc.storage_path type:', typeof doc.storage_path);
  console.log('doc.storage_path truthy?:', !!doc.storage_path);

  if (!doc.storage_path) {
    console.log('storage_path is empty/null, trying to construct fallback path');
    const fallbackPath = `${user.id}/${documentId}/${doc.file_name}`;
    console.log('Fallback path:', fallbackPath);
    
    // Check if file exists at fallback path
    const { data: listData, error: listError } = await supabase.storage.from('documents').list(`${user.id}/${documentId}`);
    console.log('Storage list result:', listData);
    console.log('Storage list error:', listError);
    
    if (listData && listData.length > 0) {
      console.log('Found files at fallback location:', listData.map(f => f.name));
      doc.storage_path = fallbackPath;
    } else {
      console.log('No files found at fallback location, returning 400');
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Original file not available for retry' }) };
    }
  }

  console.log('Final storage_path to use:', doc.storage_path);


  let creditsDeducted = 0;

  try {
       console.log('Attempting download from:', doc.storage_path);
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path);
    
    console.log('Download error:', downloadError);
    console.log('Download data exists?:', !!fileData);
    
    if (downloadError) {
      console.error('Download FAILED:', downloadError.message, downloadError);
      throw new Error('Failed to download original file: ' + downloadError.message);
    }
    
    console.log('Download SUCCESS');

    

    if (downloadError) {
      throw new Error('Failed to download original file: ' + downloadError.message);
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());

    const pageCount = await countPages(fileBuffer, doc.file_type);

    const creditResult = await deductCredits(user.id, pageCount);
    if (!creditResult.success) {
      return { 
        statusCode: 403, 
        headers, 
        body: JSON.stringify({
          error: `Insufficient credits. Need ${pageCount}, have ${creditResult.available}`,
          code: 'INSUFFICIENT_CREDITS'
        }) 
      };
    }
    creditsDeducted = pageCount;

    await supabase.from('documents').update({ 
      status: 'processing',
      page_count: pageCount,
      credits_used: pageCount
    }).eq('id', documentId);

    const processedDoc = await processDocument(fileBuffer, doc.file_type);

    let awsResult = null;
    if (isAwsConfigured()) {
      try {
        awsResult = await extractWithAWS(fileBuffer, doc.document_type);
      } catch (e) {
        console.warn('AWS failed:', e.message);
      }
    }

    const rawGpt = await extractWithGPT(processedDoc);
    const gptResult = normalizeExtraction(rawGpt);

    const extractionData = mergeExtraction({
      aws: awsResult?.extracted ?? null,
      gpt: gptResult
    });

    if (!Array.isArray(extractionData.line_items)) {
      extractionData.line_items = [];
    }

    const parsedSchema = InvoiceSchema.parse(extractionData);
    const validation = validateExtraction(parsedSchema);
    const confidence = calculateConfidence(parsedSchema);

    await supabase
      .from('extractions')
      .upsert({
        document_id: documentId,
        raw_data: extractionData,
        extracted_data: parsedSchema,
        validation_flags: validation.flags,
        confidence_scores: confidence,
        version: doc.extractions?.[0]?.version ? doc.extractions[0].version + 1 : 1
      });

    const finalStatus = validation.requiresReview ? 'review_required' : 'completed';

    if (finalStatus === 'completed') {
      await supabase.storage.from('documents').remove([doc.storage_path]);
      await supabase.from('documents').update({ storage_path: null }).eq('id', documentId);
    }

    await supabase.from('documents').update({
      status: finalStatus,
      processing_method: awsResult ? 'aws-textract' : 'gpt-only'
    }).eq('id', documentId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: finalStatus,
        extraction: parsedSchema,
        creditsUsed: pageCount,
        creditsRemaining: creditResult.newBalance
      })
    };

  } catch (error) {
    if (creditsDeducted > 0) {
      await addCredits(user.id, creditsDeducted, 'retry_refund');
    }

    await supabase.from('documents').update({ status: 'failed' }).eq('id', documentId);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        creditsRefunded: creditsDeducted
      })
    };
  }
};
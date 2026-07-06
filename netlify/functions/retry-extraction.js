import { createClient } from '@supabase/supabase-js';
import { processDocument, countPages } from '../../services/documentProcessor.js';
import { extractWithAWS, isAwsConfigured } from '../../services/awsTextract.js';
import { extractWithGPT, normalizeExtraction } from '../../services/gptExtractor.js';
import { validateExtraction } from '../../services/validator.js';
import { FlexibleDocumentSchema } from '../../schemas/document.schema.js';
import { mergeExtraction } from '../../services/mergeEngine.js';
import { preprocessDocument } from '../../services/documentPreprocessor.js';
import { postProcessExtraction } from '../../services/documentPostprocessor.js';
import { sanitizeForZod, sanitizeSections, sanitizeParty } from '../../services/dataSanitizer.js';
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

  // Fetch document WITH existing extraction for version tracking
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select(`*, extractions (id, version, extracted_data, validation_flags, confidence_scores)`)
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  console.log('DB query error:', docError);
  console.log('DB query doc:', doc ? { 
    id: doc.id, 
    storage_path: doc.storage_path, 
    file_name: doc.file_name, 
    status: doc.status,
    extractions_count: doc.extractions?.length || 0
  } : 'NOT FOUND');

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

    // Update document to processing status
    await supabase.from('documents').update({ 
      status: 'processing',
      page_count: pageCount,
      credits_used: (doc.credits_used || 0) + pageCount
    }).eq('id', documentId);

    // === NEW PIPELINE (same as extractionPipeline.js) ===

    // STEP 1: Process document
    const processedDoc = await processDocument(fileBuffer, doc.file_type);
    console.log('Processed document type:', processedDoc.type);

    // STEP 2: Pre-process
    console.log('=== PRE-PROCESSOR START ===');
    const preprocessed = await preprocessDocument(
      fileBuffer,
      doc.file_type,
      doc.file_name,
      processedDoc.text || ''
    );
    console.log('Detected type:', preprocessed.detectedType);
    console.log('=== PRE-PROCESSOR END ===');

    const effectiveType = (doc.document_type === 'mixed' || doc.document_type === 'unknown') 
      ? preprocessed.detectedType 
      : doc.document_type;

    // STEP 3: AWS (optional)
    let awsResult = null;
    if (isAwsConfigured() && process.env.ENABLE_AWS === 'true') {
      try {
        console.log('AWS Textract Processing...');
        awsResult = await Promise.race([
          extractWithAWS(fileBuffer, effectiveType),
          new Promise((_, reject) => setTimeout(() => reject(new Error('AWS_TIMEOUT')), 5000))
        ]);
        console.log('AWS Success:', !!awsResult?.extracted);
      } catch (err) {
        console.warn('AWS Textract Failed:', err.message);
        awsResult = null;
      }
    } else {
      console.log('AWS Textract: Skipped (GPT-only mode)');
    }

    // STEP 4: GPT EXTRACTION
    console.log('=== GPT EXTRACTION START ===');
    const gptStart = Date.now();

    const rawGpt = await extractWithGPT(processedDoc, doc.file_name, effectiveType);

    console.log('GPT TOTAL:', ((Date.now() - gptStart) / 1000).toFixed(2), 'seconds');
    console.log('=== GPT EXTRACTION END ===');

    // STEP 5: Post-process (includes confidence calculation)
    console.log('POST-PROCESSOR START');
    const normalizedGpt = normalizeExtraction(rawGpt);
    const postProcessed = postProcessExtraction(normalizedGpt, effectiveType);
    console.log('Post-processed type:', postProcessed.document_type);
    console.log('Post-processed category:', postProcessed.document_category);
    console.log('POST-PROCESSOR END');

    // STEP 6: Merge
    const extractionData = mergeExtraction({
      aws: awsResult?.extracted ?? null,
      gpt: postProcessed || buildFailedExtraction('GPT returned no extraction')
    });

    // STEP 7: Sanitize (registry-driven, zero hardcoding)
    console.log('=== UNIVERSAL SANITIZATION START ===');
    const sanitizedData = sanitizeForZod(extractionData, effectiveType);

    if (Array.isArray(sanitizedData.sections)) {
      sanitizedData.sections = sanitizeSections(sanitizedData.sections, effectiveType);
    }

    sanitizedData.issuer = sanitizeParty(sanitizedData.issuer);
    sanitizedData.recipient = sanitizeParty(sanitizedData.recipient);
    if (sanitizedData.buyer) sanitizedData.buyer = sanitizeParty(sanitizedData.buyer);
    if (sanitizedData.seller) sanitizedData.seller = sanitizeParty(sanitizedData.seller);
    if (sanitizedData.customer) sanitizedData.customer = sanitizeParty(sanitizedData.customer);
    if (sanitizedData.supplier) sanitizedData.supplier = sanitizeParty(sanitizedData.supplier);

    console.log('Sanitized sections:', sanitizedData.sections?.length || 0);
    console.log('=== UNIVERSAL SANITIZATION END ===');

    // STEP 8: Validate schema
    console.log('Schema validation starting...');
    let parsedSchema;

    try {
      parsedSchema = FlexibleDocumentSchema.parse(sanitizedData);
      console.log('Schema validation: PASSED');
    } catch (err) {
      console.error('Schema validation failed');
      console.error('Zod errors:', err.issues?.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));

      const fixed = applySchemaDefaults(sanitizedData, err.issues);
      try {
        parsedSchema = FlexibleDocumentSchema.parse(fixed);
        console.log('Schema validation: FIXED AND PASSED');
      } catch (err2) {
        console.error('Schema validation failed again, using fallback');
        parsedSchema = FlexibleDocumentSchema.parse(buildFailedExtraction(err2.message));
      }
    }

    console.log('Schema validation complete.');

    // STEP 9: Validate flags
    const validation = validateExtraction(parsedSchema);

    // STEP 10: CONFIDENCE — use post-processor's calculation (single source of truth)
    const confidence = postProcessed.confidence_scores;

    // STEP 11: Final status
    const needsReview = confidence.requiresReview;
    const pipelineStatus = needsReview ? 'REVIEW_REQUIRED' : 'AUTO_APPROVED';
    const dbStatus = needsReview ? 'review_required' : 'completed';

    // STEP 12: Version tracking
    const existingExtraction = doc.extractions?.[0];
    const nextVersion = existingExtraction?.version
      ? existingExtraction.version + 1
      : 1;

    // STEP 13: Save extraction
    if (existingExtraction?.id) {
      const { error: updateError } = await supabase
        .from('extractions')
        .update({
          raw_data: extractionData,
          extracted_data: parsedSchema,
          validation_flags: validation,
          confidence_scores: confidence,
          version: nextVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingExtraction.id);

      if (updateError) {
        console.error('Failed to update extraction:', updateError.message);
        throw updateError;
      }
    } else {
      const { error: insertError } = await supabase
        .from('extractions')
        .insert({
          document_id: documentId,
          raw_data: extractionData,
          extracted_data: parsedSchema,
          validation_flags: validation,
          confidence_scores: confidence,
          version: nextVersion
        });

      if (insertError) {
        console.error('Failed to insert extraction:', insertError.message);
        throw insertError;
      }
    }

    // STEP 14: Update document
    await supabase.from('documents').update({
      status: dbStatus,
      document_type: parsedSchema.document_type,
      processing_method: awsResult ? 'aws-textract' : 'gpt-only'
    }).eq('id', documentId);

    // Storage cleanup
    if (dbStatus === 'completed') {
      console.log('Auto-approved, cleaning up storage...');
      try {
        await supabase.storage.from('documents').remove([doc.storage_path]);
        await supabase.from('documents').update({ storage_path: null }).eq('id', documentId);
      } catch (e) {
        console.warn('Storage cleanup failed (non-critical):', e.message);
      }
    }

    console.log('=== RETRY SUCCESS ===');
    console.log('Doc Type:', parsedSchema.document_type, '| Status:', dbStatus, '| Confidence:', confidence.overall);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: pipelineStatus,
        dbStatus: dbStatus,
        extraction: parsedSchema,
        validation,
        confidence,
        creditsUsed: pageCount,
        creditsRemaining: creditResult.newBalance
      })
    };

  } catch (error) {
    console.error('=== RETRY FAILED ===', error.message);

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

// === HELPERS (same as extractionPipeline.js) ===

function applySchemaDefaults(data, issues) {
  const fixed = JSON.parse(JSON.stringify(data));

  for (const issue of issues) {
    const path = issue.path;
    if (path.length === 0) continue;

    let current = fixed;
    for (let i = 0; i < path.length - 1; i++) {
      if (current === null || current === undefined) break;
      current = current[path[i]];
    }
    const field = path[path.length - 1];

    if (issue.code === 'invalid_type') {
      if (issue.expected === 'object') {
        current[field] = {};
      } else if (issue.expected === 'array') {
        current[field] = [];
      } else if (issue.expected === 'string') {
        current[field] = '';
      } else if (issue.expected === 'number') {
        current[field] = null;
      }
    }
  }

  return fixed;
}

function buildFailedExtraction(notes) {
  return {
    document_type: 'unknown',
    document_category: 'other',
    notes: typeof notes === 'string' ? notes : JSON.stringify(notes),
    confidence_scores: {
      overall: 0,
      status: 'LOW',
      requiresReview: true,
      reviewReason: 'Extraction failed',
      flags: {
        low_confidence_fields: [],
        missing_required_fields: [],
        invalid_dates: [],
        math_issue: false,
        balance_mismatch: false
      }
    },
    _schema_version: 'v8-flexible',
    _source: { aws: false, gpt: false },
    issuer: { name: null, address: null, tax_id: null, email: null, phone: null, website: null, registration_number: null, id_number: null },
    recipient: { name: null, address: null, tax_id: null, email: null, id_number: null, date_of_birth: null },
    sections: [],
    specific_fields: {}
  };
}
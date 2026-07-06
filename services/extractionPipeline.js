import { processDocument } from './documentProcessor.js';
import { extractWithAWS, isAwsConfigured } from './awsTextract.js';
import { extractWithGPT, normalizeExtraction } from './gptExtractor.js';
import { validateExtraction } from './validator.js';
import { FlexibleDocumentSchema } from '../schemas/document.schema.js';
import { mergeExtraction } from './mergeEngine.js';
import { mapToLegacyFormat } from '../schemas/schemaMapper.js';
import { isLegacyType } from '../schemas/documentRegistry.js';
import { preprocessDocument } from './documentPreprocessor.js';
import { postProcessExtraction } from './documentPostprocessor.js';
import { sanitizeForZod, sanitizeSections, sanitizeParty } from './dataSanitizer.js';

export async function runExtractionPipeline({
  fileBuffer,
  mimetype,
  mimeType,
  documentType = 'mixed',
  fileName = ''
}) {
  mimetype = mimetype || mimeType;
  const pipelineStart = performance.now();
  
  console.log('====================================');
  console.log('EXTRACTION PIPELINE START');
  console.log('Document Type:', documentType);
  console.log('Mime Type:', mimetype);
  console.log('File Name:', fileName);
  console.log('====================================');

  // STEP 1: processDocument
  const t1 = performance.now();
  const processedDoc = await processDocument(fileBuffer, mimetype);
  console.log('[TIMER] processDocument:', ((performance.now() - t1) / 1000).toFixed(2), 's | type:', processedDoc.type);

  if (processedDoc.type === 'batch') {
    throw new Error('ZIP files must be processed through batch processor');
  }

  // STEP 2: preprocessDocument
  const t2 = performance.now();
  const preprocessed = await preprocessDocument(fileBuffer, mimetype, fileName, processedDoc.text || '');
  console.log('[TIMER] preprocessDocument:', ((performance.now() - t2) / 1000).toFixed(2), 's | detected:', preprocessed.detectedType);

  const effectiveType = (documentType === 'mixed' || documentType === 'unknown') 
    ? preprocessed.detectedType 
    : documentType;

  // STEP 3: AWS (optional)
  const t3 = performance.now();
  let awsResult = null;
  const useAws = isAwsConfigured() && process.env.ENABLE_AWS === 'true';
  if (useAws) {
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
  console.log('[TIMER] AWS step:', ((performance.now() - t3) / 1000).toFixed(2), 's');

  // STEP 4: GPT EXTRACTION
  console.log('====================================');
  console.log('GPT EXTRACTION START');
  const gptStart = performance.now();

  const rawGpt = await extractWithGPT(processedDoc, fileName, effectiveType);

  const gptElapsed = (performance.now() - gptStart) / 1000;
  console.log('[TIMER] extractWithGPT TOTAL:', gptElapsed.toFixed(2), 'seconds');
  console.log('====================================');

  // STEP 5: normalizeExtraction
  const t5a = performance.now();
  const normalizedGpt = normalizeExtraction(rawGpt);
  console.log('[TIMER] normalizeExtraction:', ((performance.now() - t5a) / 1000).toFixed(3), 's');

  // STEP 6: postProcessExtraction
  const t5b = performance.now();
  const postProcessed = postProcessExtraction(normalizedGpt, effectiveType);
  console.log('[TIMER] postProcessExtraction:', ((performance.now() - t5b) / 1000).toFixed(3), 's');
  console.log('Post-processed type:', postProcessed.document_type);
  console.log('Post-processed category:', postProcessed.document_category);

  // STEP 7: mergeExtraction
  const t6 = performance.now();
  const extractionData = mergeExtraction({
    aws: awsResult?.extracted || null,
    gpt: postProcessed || buildFailedExtraction('GPT returned no extraction')
  });
  console.log('[TIMER] mergeExtraction:', ((performance.now() - t6) / 1000).toFixed(3), 's');

  // STEP 8: sanitizeForZod
  console.log('====================================');
  console.log('UNIVERSAL SANITIZATION START');
  const t7 = performance.now();
  
  const sanitizedData = sanitizeForZod(extractionData, effectiveType);
  console.log('[TIMER] sanitizeForZod:', ((performance.now() - t7) / 1000).toFixed(3), 's');

  const t7b = performance.now();
  if (Array.isArray(sanitizedData.sections)) {
    sanitizedData.sections = sanitizeSections(sanitizedData.sections, effectiveType);
  }
  console.log('[TIMER] sanitizeSections:', ((performance.now() - t7b) / 1000).toFixed(3), 's');

  const t7c = performance.now();
  sanitizedData.issuer = sanitizeParty(sanitizedData.issuer);
  sanitizedData.recipient = sanitizeParty(sanitizedData.recipient);
  if (sanitizedData.buyer) sanitizedData.buyer = sanitizeParty(sanitizedData.buyer);
  if (sanitizedData.seller) sanitizedData.seller = sanitizeParty(sanitizedData.seller);
  if (sanitizedData.customer) sanitizedData.customer = sanitizeParty(sanitizedData.customer);
  if (sanitizedData.supplier) sanitizedData.supplier = sanitizeParty(sanitizedData.supplier);
  console.log('[TIMER] sanitizeParty (all):', ((performance.now() - t7c) / 1000).toFixed(3), 's');

  console.log('Sanitized sections:', sanitizedData.sections?.length || 0);
  console.log('Sanitized fields:', Object.keys(sanitizedData).length);
  console.log('UNIVERSAL SANITIZATION END');
  console.log('====================================');

  // STEP 9: Schema validation
  console.log('Schema validation starting...');
  const t8 = performance.now();
  let parsedSchema;
  try {
    parsedSchema = FlexibleDocumentSchema.parse(sanitizedData);
    console.log('[TIMER] Schema parse (pass):', ((performance.now() - t8) / 1000).toFixed(3), 's');
    console.log('Schema validation: PASSED');
  } catch (err) {
    console.error('Schema validation failed');
    console.error('Zod errors:', err.issues?.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
    const t8fix = performance.now();
    const fixed = applySchemaDefaults(sanitizedData, err.issues);
    try {
      parsedSchema = FlexibleDocumentSchema.parse(fixed);
      console.log('[TIMER] Schema parse (fixed):', ((performance.now() - t8fix) / 1000).toFixed(3), 's');
      console.log('Schema validation: FIXED AND PASSED');
    } catch (err2) {
      console.error('Schema validation failed again, using fallback');
      parsedSchema = FlexibleDocumentSchema.parse(buildFailedExtraction(err2.message));
      console.log('[TIMER] Schema parse (fallback):', ((performance.now() - t8fix) / 1000).toFixed(3), 's');
    }
  }

  // STEP 10: validation flags
  const t9 = performance.now();
  const validation = validateExtraction(parsedSchema);
  console.log('[TIMER] validateExtraction:', ((performance.now() - t9) / 1000).toFixed(3), 's');

  const confidence = postProcessed.confidence_scores;

  // STEP 11: final assembly
  const t10 = performance.now();
  const needsReview = confidence.requiresReview;
  const pipelineStatus = needsReview ? 'REVIEW_REQUIRED' : 'AUTO_APPROVED';
  const dbStatus = needsReview ? 'review_required' : 'completed';
  const finalExtraction = { ...parsedSchema, confidence_scores: confidence };
  console.log('[TIMER] final assembly:', ((performance.now() - t10) / 1000).toFixed(3), 's');

  const totalTime = (performance.now() - pipelineStart) / 1000;
  console.log('====================================');
  console.log('PIPELINE COMPLETE');
  console.log('Total pipeline time:', totalTime.toFixed(2), 's');
  console.log('Status:', pipelineStatus);
  console.log('Processing:', awsResult ? 'aws-textract' : 'gpt-only');
  console.log('====================================');

  return buildPipelineResult(finalExtraction, validation, confidence, awsResult, awsResult ? 'aws-textract' : 'gpt-only', processedDoc, pipelineStatus, dbStatus);
}


// Generic fallback — applies defaults based on Zod schema shape, no hardcoding
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

function buildPipelineResult(extraction, validation, confidence, awsResult, processingMethod, processedDoc, status = 'REVIEW_REQUIRED', dbStatus = 'review_required') {
  return {
    processedDoc,
    awsResult,
    rawExtraction: extraction,
    extraction,
    validation,
    confidence,
    status,
    dbStatus,
    processingMethod
  };
}
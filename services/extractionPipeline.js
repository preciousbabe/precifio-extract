import { processDocument } from './documentProcessor.js';
import { extractWithAWS, isAwsConfigured } from './awsTextract.js';
import { extractWithGPT, normalizeExtraction } from './gptExtractor.js';
import { validateExtraction } from './validator.js';
import { DocumentSchema } from '../schemas/document.schema.js';
import { calculateConfidence } from './confidenceEngine.js';
import { mergeExtraction } from './mergeEngine.js';

export async function runExtractionPipeline({
  fileBuffer,
  mimetype,
  mimeType,
  documentType = 'mixed'
}) {

  mimetype = mimetype || mimeType;
  console.log('Resolved MimeType:', mimetype);
  console.log('====================================');
  console.log('EXTRACTION PIPELINE START');
  console.log('Document Type:', documentType);
  console.log('Mime Type:', mimetype);
  console.log('====================================');

  // ------------------------------------
  // STEP 1: PREPROCESS DOCUMENT
  // ------------------------------------
  const processedDoc = await processDocument(
    fileBuffer,
    mimetype
  );

  if (processedDoc.type === 'batch') {
    throw new Error(
      'ZIP files must be processed through batch processor'
    );
  }

  // ------------------------------------
  // STEP 2: AWS TEXTRACT
  // ------------------------------------
  let awsResult = null;

  if (isAwsConfigured()) {
    try {
      console.log('AWS Textract Processing...');

      awsResult = await extractWithAWS(
        fileBuffer,
        documentType
      );

      console.log(
        'AWS Success:',
        !!awsResult?.extracted
      );
    } catch (err) {
      console.warn(
        'AWS Textract Failed:',
        err.message
      );
    }
  }

  // ------------------------------------
  // STEP 3: GPT EXTRACTION
  // ------------------------------------
  console.log('GPT Extraction Starting...');

  const rawGpt = await extractWithGPT(
    processedDoc
  );

  const gptResult = normalizeExtraction(
    rawGpt
  );

  console.log(
    'GPT Doc Type:',
    gptResult.document_type
  );

  console.log(
    'GPT Vendor:',
    gptResult.vendor_name
  );

  console.log(
    'GPT Total:',
    gptResult.total_amount
  );

  console.log(
    'GPT Category:',
    gptResult.category
  );

  console.log(
    'GPT Extracted Fields:',
    Object.entries(gptResult)
      .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !k.startsWith('_'))
      .map(([k]) => k)
      .join(', ')
  );

  // ------------------------------------
  // STEP 4: MERGE RESULTS
  // ------------------------------------
  const extractionData = mergeExtraction({
    aws: awsResult?.extracted ?? null,
    gpt: gptResult
  });

  if (!Array.isArray(extractionData.line_items)) {
    extractionData.line_items = [];
  }

  // ------------------------------------
  // STEP 5: VALIDATE SCHEMA
  // ------------------------------------
  const parsedSchema =
    DocumentSchema.parse(extractionData);

  // ------------------------------------
  // STEP 6: VALIDATION FLAGS
  // ------------------------------------
  const validation =
    validateExtraction(parsedSchema);

  // ------------------------------------
  // STEP 7: CONFIDENCE SCORE
  // ------------------------------------
  const confidence =
    calculateConfidence(parsedSchema);

  // ------------------------------------
  // STEP 8: FINAL STATUS
  // ------------------------------------

  // NEW LOGIC: 
  // - confidence.requiresReview = true when: too few fields, low confidence on extracted fields, 
  //   missing critical type-specific data (e.g., bank statement with no transactions)
  // - validation.requiresReview = true when: CRITICAL or WARNING flags exist
  // 
  // INFO flags alone do NOT trigger review

  const needsReview = confidence.requiresReview || validation.requiresReview;

  const pipelineStatus = needsReview ? 'REVIEW_REQUIRED' : 'AUTO_APPROVED';

  const dbStatus = needsReview ? 'review_required' : 'completed';

  console.log(
    'Pipeline Status:',
    pipelineStatus
  );

  console.log(
    'DB Status:',
    dbStatus
  );

  console.log(
    'Confidence:',
    confidence.overall,
    '| Status:',
    confidence.status,
    '| Extracted Fields:',
    confidence.extractedFieldCount,
    '/',
    confidence.totalPossibleFields
  );

  console.log(
    'Validation:',
    validation.severity,
    '| Flags:',
    validation.flags?.length || 0,
    '| Warnings:',
    validation.warningFlags?.length || 0,
    '| Info:',
    validation.informationalFlags?.length || 0
  );

  if (confidence.reviewReason) {
    console.log('Review Reason:', confidence.reviewReason);
  }

  console.log('====================================');
  console.log('EXTRACTION PIPELINE COMPLETE');
  console.log('====================================');

  return {
    processedDoc,
    awsResult,
    rawExtraction: extractionData,
    extraction: parsedSchema,
    validation,
    confidence,
    status: pipelineStatus,        
    dbStatus,                      
    processingMethod:
      awsResult
        ? 'aws-textract'
        : 'gpt-only'
  };
}
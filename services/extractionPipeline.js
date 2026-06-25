import { processDocument } from './documentProcessor.js';
import { extractWithAWS, isAwsConfigured } from './awsTextract.js';
import { extractWithGPT, normalizeExtraction } from './gptExtractor.js';
import { validateExtraction } from './validator.js';
import { FlexibleDocumentSchema } from '../schemas/document.schema.js';
import { calculateConfidence } from './confidenceEngine.js';
import { mergeExtraction } from './mergeEngine.js';
import { mapToLegacyFormat } from '../schemas/schemaMapper.js';
import { isLegacyType } from '../schemas/documentRegistry.js';

export async function runExtractionPipeline({
  fileBuffer,
  mimetype,
  mimeType,
  documentType = 'mixed',
  fileName = ''
}) {
  mimetype = mimetype || mimeType;
  console.log('====================================');
  console.log('EXTRACTION PIPELINE START');
  console.log('Document Type:', documentType);
  console.log('Mime Type:', mimetype);
  console.log('File Name:', fileName);
  console.log('====================================');

  // STEP 1: PREPROCESS DOCUMENT
const processStart = Date.now();

const processedDoc = await processDocument(
  fileBuffer,
  mimetype
);

console.log(
  'PROCESS DOC TIME:',
  ((Date.now() - processStart) / 1000).toFixed(2),
  'seconds'
);

if (processedDoc.type === 'batch') {
  throw new Error('ZIP files must be processed through batch processor');
}

  // STEP 1b: CHECK FOR PDF EXTRACTION FAILURE
  if (processedDoc.type === 'text' && 
      processedDoc.content &&
      (processedDoc.content.startsWith('[PDF Document') || processedDoc.content.startsWith('[UNREADABLE PDF')) &&
      processedDoc.content.length < 100) {
    
    console.log('PDF text extraction failed — document may be image-based, scanned, or corrupted');
    
    const failedExtraction = buildFailedExtraction('Text extraction failed — document may be image-based, scanned, or corrupted');
    
    const validation = validateExtraction(failedExtraction);
    const confidence = calculateConfidence(failedExtraction);

    console.log('Pipeline Status: REVIEW_REQUIRED');
    console.log('DB Status: review_required');
    console.log('Review Reason: PDF text extraction failed');

    return buildPipelineResult(failedExtraction, validation, confidence, null, 'extraction-failed', processedDoc);
  }

   // STEP 2 & 3: AWS (optional) + GPT (primary)
  let awsResult = null;
  
  // Only attempt AWS if explicitly enabled and configured
  const useAws = isAwsConfigured() && process.env.ENABLE_AWS === 'true';
  
  if (useAws) {
    try {
      console.log('AWS Textract Processing...');
      awsResult = await Promise.race([
        extractWithAWS(fileBuffer, documentType),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AWS_TIMEOUT')), 5000)
        )
      ]);
      console.log('AWS Success:', !!awsResult?.extracted);
    } catch (err) {
      console.warn('AWS Textract Failed:', err.message);
      awsResult = null;
    }
  } else {
    console.log('AWS Textract: Skipped (GPT-only mode)');
  }

 // STEP 3: GPT EXTRACTION (always runs, never blocked by AWS)
console.log('GPT Extraction Starting...');

const gptStart = Date.now();

const rawGpt = await extractWithGPT(
  processedDoc,
  fileName
);

console.log(
  'GPT TIME:',
  ((Date.now() - gptStart) / 1000).toFixed(2),
  'seconds'
);

const gptResult = normalizeExtraction(rawGpt);
  
  console.log('GPT Doc Type:', gptResult.document_type);
  console.log('GPT Category:', gptResult.document_category);
  console.log('GPT Issuer:', gptResult.issuer?.name);
  console.log('GPT Total:', gptResult.total_amount);
  console.log('GPT Sections:', gptResult.sections?.map(s => s.section_type).join(', '));

  // STEP 4: MERGE RESULTS
  const extractionData = mergeExtraction({
    aws: awsResult?.extracted ?? null,
    gpt: gptResult
  });

  // STEP 5: VALIDATE SCHEMA
  console.log('BEFORE SCHEMA:', JSON.stringify(extractionData, null, 2));
  const parsedSchema = FlexibleDocumentSchema.parse(extractionData);
  console.log('AFTER SCHEMA:', JSON.stringify(parsedSchema, null, 2));

  // STEP 6: VALIDATION FLAGS
  const validation = validateExtraction(parsedSchema);

     // STEP 7: CONFIDENCE SCORE
  const confidence = calculateConfidence(parsedSchema);

  // SAFETY: Warn if confidence seems misaligned with actual data
  if (confidence.overall === 0 && parsedSchema.issuer?.name) {
    console.warn('WARNING: Confidence is 0 but document has issuer name — check fieldWeights in documentRegistry.js for type:', parsedSchema.document_type);
  }

  // STEP 8: FINAL STATUS
  const needsReview = confidence.requiresReview || validation.requiresReview;
  const pipelineStatus = needsReview ? 'REVIEW_REQUIRED' : 'AUTO_APPROVED';
  const dbStatus = needsReview ? 'review_required' : 'completed';

  // === FIX: Inject confidence into schema, stripping old defaults ===
  const { confidence_scores: _, ...schemaWithoutConfidence } = parsedSchema;
  
  const finalExtraction = {
    ...schemaWithoutConfidence,
    confidence_scores: {
      overall: confidence.overall,
      completeness: confidence.completeness,
      breakdown: confidence.breakdown,
      status: confidence.status,
      requiresReview: confidence.requiresReview,
      reviewReason: confidence.reviewReason,
      extractedFieldCount: confidence.extractedFieldCount,
      totalPossibleFields: confidence.totalPossibleFields,
      flags: confidence.flags
    }
  };

  
  console.log('Pipeline Status:', pipelineStatus);
  console.log('DB Status:', dbStatus);
  console.log('Confidence:', confidence.overall, '| Status:', confidence.status);
  if (confidence.reviewReason) console.log('Review Reason:', confidence.reviewReason);

  return buildPipelineResult(finalExtraction, validation, confidence, awsResult, awsResult ? 'aws-textract' : 'gpt-only', processedDoc, pipelineStatus, dbStatus);
}

function buildFailedExtraction(notes) {
  return {
    document_type: 'unknown',
    document_category: 'other',
    issuer: {},
    recipient: {},
    issue_date: null,
    effective_date: null,
    expiry_date: null,
    total_amount: null,
    currency: 'USD',
    sections: [],
    specific_fields: {},
    vendor_name: null,
    vendor_address: null,
    vendor_tax_id: null,
    vendor_email: null,
    vendor_phone: null,
    vendor_website: null,
    vendor_registration_number: null,
    date: null,
    notes,
    document_source: null,
    document_id: null,
    document_title: null,
    created_date: null,
    updated_date: null,
    country: null,
    state: null,
    language: null,
    invoice_number: null,
    po_number: null,
    reference_number: null,
    buyer_name: null,
    buyer_address: null,
    buyer_tax_id: null,
    buyer_email: null,
    invoice_date: null,
    due_date: null,
    payment_date: null,
    line_items: [],
    subtotal: null,
    discount_amount: 0,
    tax_amount: 0,
    tax_details: [],
    shipping_amount: 0,
    amount_due: null,
    amount_paid: 0,
    payment_status: null,
    payment_method: null,
    payment_terms: null,
    purchase_order_reference: null,
    service_period: { from: null, to: null },
    late_fee: null,
    invoice_status: null,
    receipt_number: null,
    items: [],
    change_given: 0,
    cashier_name: null,
    store_location: null,
    terminal_id: null,
    account_number: null,
    statement_period: { from: null, to: null },
    opening_balance: null,
    closing_balance: null,
    transactions: [],
    account_name: null,
    bank_name: null,
    branch_name: null,
    routing_number: null,
    swift_code: null,
    iban: null,
    account_type: null,
    bill_number: null,
    usage_amount: null,
    usage_period: { from: null, to: null },
    previous_balance: 0,
    current_charges: 0,
    meter_number: null,
    customer_number: null,
    tariff_plan: null,
    units_consumed: null,
    order_date: null,
    delivery_date: null,
    ship_to: null,
    buyer_company: null,
    supplier_name: null,
    supplier_contact: null,
    expected_total: null,
    contract_number: null,
    contract_type: null,
    counterparty: null,
    expiration_date: null,
    renewal_date: null,
    contract_value: null,
    category: 'Uncategorized',
    confidence_scores: {
      overall: 0,
      breakdown: {},
      flags: {
        low_confidence_fields: [],
        missing_required_fields: [],
        invalid_dates: [],
        math_issue: false,
        balance_mismatch: false
      },
      status: 'LOW',
      requiresReview: true
    },
    _schema_version: 'v7-flexible',
    _source: { aws: false, gpt: false }
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
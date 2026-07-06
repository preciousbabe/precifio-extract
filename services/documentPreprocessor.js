// ============================================================
// PRE-PROCESSOR — Document type detection + content preparation
// ============================================================

import { 
  detectDocumentCategory,
  getDocumentTypeInfo,
  getAllDocumentTypes,
  DOCUMENT_CATEGORIES,
  matchFieldName,
  getFieldAliases
} from '../schemas/documentRegistry.js';


export async function preprocessDocument(fileBuffer, mimeType, fileName = '', textContent = '') {
  console.log('=== PREPROCESSOR START ===');
  const preStart = performance.now();

  // Step 1: Detect document category and type from filename + content
  const detectedCategory = detectDocumentCategory(fileName, textContent);
  const detectedType = detectDocumentType(fileName, textContent, detectedCategory);

  console.log('Detected category:', detectedCategory);
  console.log('Detected type:', detectedType);

  // Step 2: Get type-specific preprocessing rules
  const typeInfo = getDocumentTypeInfo(detectedType);
  const preprocessRules = getPreprocessRules(detectedType);

  // Step 3: Clean and prepare text content
  const cleanedText = preprocessRules.cleanText ? preprocessRules.cleanText(textContent) : textContent;

  // Step 4: Extract early signals (account numbers, invoice numbers, etc.)
  const earlySignals = extractEarlySignals(cleanedText, detectedType);

  console.log('Early signals:', Object.keys(earlySignals).filter(k => k !== 'confidence'));
  console.log('PRE-PROCESSOR TIME:', ((performance.now() - preStart) / 1000).toFixed(2), 'seconds');  // ← ADD
  console.log('=== PREPROCESSOR END ===');

  return {
    detectedType,
    detectedCategory: detectedCategory || typeInfo.category,
    confidence: earlySignals.confidence || 0,
    cleanedText,
    earlySignals,
    preprocessRules,
    // Pass these to GPT as hints
    typeHint: detectedType,
    categoryHint: detectedCategory,
    expectedSections: typeInfo.sections || [],
    requiredFields: typeInfo.requiredFields || [],
    fieldAliases: typeInfo.fieldAliases || {}
  };
}

/**
 * Detects specific document type from filename and content.
 * Uses a multi-pass approach: filename keywords first, then content keywords.
 */
function detectDocumentType(fileName, content, category) {
  const name = fileName.toLowerCase();
  const text = content.slice(0, 2000).toLowerCase(); 

  // === PASS 1: Filename-based fast detection (highest confidence) ===
  const filenamePatterns = [
    { type: 'utility-bill', patterns: ['utility', 'electric', 'electricity', 'water', 'gas', 'kwh', 'phcn', 'ikedc', 'ekedc', 'aedc', 'energy', 'power'] },
    { type: 'invoice', patterns: ['invoice', 'inv'] },
    { type: 'receipt', patterns: ['receipt', 'reciept'] },
    { type: 'bank-statement', patterns: ['bank', 'statement', 'account'] },
    { type: 'credit-card-statement', patterns: ['credit', 'card'] },
    { type: 'purchase-order', patterns: ['purchase', 'po_'] },
    { type: 'expense-report', patterns: ['expense', 'reimbursement'] },
    { type: 'tax-form', patterns: ['tax', '1040', 'w2', 'w-2', '1099'] },
    { type: 'payroll-report', patterns: ['payroll', 'payslip'] },
    { type: 'contract', patterns: ['contract', 'agreement'] },
    { type: 'lease-agreement', patterns: ['lease', 'rental'] },
    { type: 'nda', patterns: ['nda', 'non-disclosure'] },
    { type: 'service-agreement', patterns: ['service', 'sow'] },
    { type: 'court-document', patterns: ['court', 'legal'] },
    { type: 'property-deed', patterns: ['deed', 'title'] },
    { type: 'resume', patterns: ['resume', 'cv', 'curriculum'] },
    { type: 'employment-contract', patterns: ['employment', 'offer'] },
    { type: 'medical-report', patterns: ['medical', 'health'] },
    { type: 'lab-result', patterns: ['lab', 'test result'] },
    { type: 'prescription', patterns: ['prescription', 'rx'] },
    { type: 'insurance-claim', patterns: ['insurance', 'claim'] },
    { type: 'passport', patterns: ['passport'] },
    { type: 'drivers-license', patterns: ['driver', 'license'] },
    { type: 'transcript', patterns: ['transcript', 'academic'] }
  ];

  for (const { type, patterns } of filenamePatterns) {
    for (const pattern of patterns) {
      if (name.includes(pattern)) {
        console.log(`Filename match: "${pattern}" → ${type}`);
        return type;
      }
    }
  }

  // === PASS 2: Content-based detection with SCORING (not first-match) ===
  // Type-specific patterns with weights (content keywords)
  const contentPatterns = [
    // Financial - ordered by specificity (most specific first)
    { type: 'utility-bill', patterns: ['kwh', 'kilowatt', 'units consumed', 'meter reading', 'tariff', 'phcn', 'ikedc', 'ekedc', 'aedc', 'electricity distribution', 'energy charge', 'demand charge'], weight: 2 },
    { type: 'invoice', patterns: ['invoice number', 'inv no', 'bill to', 'ship to', 'vat reg', 'tin no', 'due date', 'payment terms'], weight: 2 },
    { type: 'receipt', patterns: ['cashier', 'pos terminal', 'change due', 'thank you for shopping', 'transaction id'], weight: 2 },
    { type: 'bank-statement', patterns: ['statement of account', 'opening balance', 'closing balance', 'transaction history', 'account summary', 'debit', 'credit'], weight: 2 },
    { type: 'credit-card-statement', patterns: ['credit card statement', 'statement balance', 'minimum payment due', 'credit limit', 'apr', 'cash advance'], weight: 2 },
    { type: 'purchase-order', patterns: ['purchase order', 'po number', 'ordered by', 'delivery date', 'ship to'], weight: 2 },
    { type: 'expense-report', patterns: ['expense report', 'reimbursement', 'business expense', 'per diem', 'mileage'], weight: 2 },
    { type: 'tax-form', patterns: ['form 1040', 'w-2', 'w2', '1099', 'taxable income', 'irs', 'filing status'], weight: 2 },
    { type: 'payroll-report', patterns: ['payroll', 'gross pay', 'net pay', 'fica', 'social security', 'withholding'], weight: 2 },

    // Legal
    { type: 'contract', patterns: ['agreement', 'terms and conditions', 'party a', 'party b', 'counterparty', 'governing law'], weight: 2 },
    { type: 'lease-agreement', patterns: ['lease agreement', 'lessor', 'lessee', 'security deposit', 'monthly rent', 'premises'], weight: 2 },
    { type: 'nda', patterns: ['non-disclosure', 'confidential information', 'disclosing party', 'receiving party'], weight: 2 },
    { type: 'service-agreement', patterns: ['service agreement', 'scope of work', 'sla', 'deliverables', 'service provider'], weight: 2 },
    { type: 'court-document', patterns: ['court', 'case no', 'docket', 'plaintiff', 'defendant', 'motion', 'judgment'], weight: 2 },
    { type: 'property-deed', patterns: ['deed', 'grantor', 'grantee', 'recording date', 'legal description', 'quitclaim'], weight: 2 },

    // HR
    { type: 'resume', patterns: ['curriculum vitae', 'cv', 'professional experience', 'education', 'skills', 'references'], weight: 2 },
    { type: 'employment-contract', patterns: ['employment contract', 'position', 'salary', 'probation', 'termination notice'], weight: 2 },
    { type: 'offer-letter', patterns: ['offer of employment', 'congratulations', 'joining date', 'reporting to', 'acceptance'], weight: 2 },
    { type: 'employee-record', patterns: ['employee id', 'personnel file', 'hire date', 'department', 'job classification'], weight: 2 },
    { type: 'performance-review', patterns: ['performance review', 'annual review', 'goals', 'objectives', 'competencies', 'rating'], weight: 2 },

    // Healthcare
    { type: 'medical-report', patterns: ['medical report', 'diagnosis', 'treatment plan', 'chief complaint', 'vital signs'], weight: 2 },
    { type: 'lab-result', patterns: ['laboratory result', 'reference range', 'specimen', 'test result', 'pathology'], weight: 2 },
    { type: 'prescription', patterns: ['prescription', 'rx', 'dosage', 'sig', 'refills', 'dispense', 'pharmacy'], weight: 2 },
    { type: 'patient-intake', patterns: ['patient intake', 'medical history', 'allergies', 'insurance card', 'emergency contact'], weight: 2 },

    // Insurance
    { type: 'insurance-claim', patterns: ['insurance claim', 'claim number', 'policy number', 'incident report', 'damage assessment'], weight: 2 },

    // Logistics
    { type: 'bill-of-lading', patterns: ['bill of lading', 'shipper', 'consignee', 'vessel', 'port of loading', 'freight'], weight: 2 },
    { type: 'shipping-manifest', patterns: ['manifest', 'cargo manifest', 'imo number', 'voyage', 'container'], weight: 2 },
    { type: 'delivery-note', patterns: ['delivery note', 'delivered to', 'proof of delivery', 'consignment', 'items delivered'], weight: 2 },
    { type: 'customs-document', patterns: ['customs declaration', 'hs code', 'harmonized', 'country of origin', 'dutiable value'], weight: 2 },

    // Real Estate
    { type: 'property-valuation', patterns: ['appraisal', 'valuation', 'comparable sales', 'market value', 'cap rate'], weight: 2 },
    { type: 'inspection-report', patterns: ['inspection report', 'home inspection', 'deficiencies', 'structural', 'hvac'], weight: 2 },
    { type: 'mortgage-document', patterns: ['mortgage', 'deed of trust', 'promissory note', 'loan amount', 'interest rate', 'escrow'], weight: 2 },
    { type: 'land-registry', patterns: ['land registry', 'title deed', 'cadastral', 'parcel number', 'encumbrance'], weight: 2 },

    // Education
    { type: 'transcript', patterns: ['transcript', 'academic record', 'gpa', 'credit hours', 'semester', 'course code'], weight: 2 },
    { type: 'certificate', patterns: ['certificate', 'certification', 'continuing education', 'ceu', 'accredited'], weight: 2 },
    { type: 'diploma', patterns: ['diploma', 'bachelor', 'master', 'doctorate', 'cum laude', 'conferred'], weight: 2 },
    { type: 'student-record', patterns: ['student record', 'enrollment', 'attendance', 'disciplinary', 'advisor'], weight: 2 },

    // Government
    { type: 'passport', patterns: ['passport', 'nationality', 'place of birth', 'issuing authority', 'mrz'], weight: 2 },
    { type: 'drivers-license', patterns: ['driver license', 'dl number', 'class', 'endorsement', 'restriction', 'dmv'], weight: 2 },
    { type: 'national-id', patterns: ['national id', 'identity card', 'nin', 'ssn', 'citizen'], weight: 2 },
    { type: 'permit', patterns: ['permit', 'authorization', 'building permit', 'work permit', 'issuing authority'], weight: 2 },
    { type: 'license', patterns: ['license', 'business license', 'professional license', 'renewal', 'accredited'], weight: 2 }
  ];

  // Score each type
  const scores = {};
  for (const { type, patterns, weight } of contentPatterns) {
    scores[type] = 0;
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        scores[type] += weight;
      }
    }
  }

  // Find best match
  let bestType = 'unknown';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // If no strong match but category detected, use category default
  if (bestScore < 2 && category) {
    const categoryDefaults = {
      [DOCUMENT_CATEGORIES.FINANCIAL]: 'invoice',
      [DOCUMENT_CATEGORIES.LEGAL]: 'contract',
      [DOCUMENT_CATEGORIES.HR]: 'resume',
      [DOCUMENT_CATEGORIES.HEALTHCARE]: 'medical-report',
      [DOCUMENT_CATEGORIES.INSURANCE]: 'insurance-claim',
      [DOCUMENT_CATEGORIES.LOGISTICS]: 'bill-of-lading',
      [DOCUMENT_CATEGORIES.REAL_ESTATE]: 'property-valuation',
      [DOCUMENT_CATEGORIES.EDUCATION]: 'transcript',
      [DOCUMENT_CATEGORIES.GOVERNMENT]: 'passport'
    };
    return categoryDefaults[category] || 'unknown';
  }

  return bestType;
}

/**
 * Extracts early signals from text before GPT processing
 */
function extractEarlySignals(text, docType) {
  const signals = { confidence: 0 };
  const typeInfo = getDocumentTypeInfo(docType);

  // Extract potential field values using regex patterns
  const patterns = {
    invoice_number: /(?:invoice|inv)\s*(?:#|no|number)?[:\s]*(\w+[-\w]*)/i,
    po_number: /(?:po|purchase order)\s*(?:#|no|number)[:\s]*(\w+[-\w]*)/i,
    account_number: /(?:account|acct)\s*(?:#|no|number)[:\s]*(\d[\d\s-]+)/i,
    total_amount: /(?:total|amount due|balance due)[:\s]*[₦$€£]?\s*([\d,]+\.?\d*)/i,
    date: /(?:date|dated)[:\s]*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    units_consumed: /(\d+[\d,]*\.?\d*)\s*(?:kwh|kwhr|kilowatt|units)/i,
    meter_number: /(?:meter|meter no)[:\s]*(\w+)/i,
    customer_number: /(?:customer|cust)\s*(?:#|id|number)[:\s]*(\w+)/i,
    bill_number: /(?:bill|statement)\s*(?:#|no|number)[:\s]*(\w+)/i,
    amount_due: /(?:amount due|total due|balance due)[:\s]*[₦$€£]?\s*([\d,]+\.?\d*)/i
  };

  for (const [field, regex] of Object.entries(patterns)) {
    const match = text.match(regex);
    if (match) {
      signals[field] = match[1].trim();
    }
  }

  // Calculate confidence based on signal density
  const signalCount = Object.keys(signals).length - 1; // exclude 'confidence' key
  const requiredFields = typeInfo.requiredFields || [];
  signals.confidence = requiredFields.length > 0 
    ? Math.min(1, signalCount / requiredFields.length) 
    : signalCount > 0 ? 0.5 : 0;

  return signals;
}

/**
 * Gets document-type-specific preprocessing rules
 */
function getPreprocessRules(docType) {
  const defaultRules = {
    cleanText: (text) => text,
    preserveFields: [],
    unitFields: {}
  };

  const rules = {
    'utility-bill': {
      cleanText: (text) => {
        // Preserve meter readings and units
        return text
          .replace(/(\d+)\s*(kwh|kwhr|units)/gi, '$1 $2')  // Normalize spacing
          .replace(/(\d),(\d)/g, '$1$2');  // Remove thousand separators in numbers
      },
      preserveFields: ['units_consumed', 'meter_number', 'tariff_plan', 'current_charges'],
      unitFields: {
        units_consumed: { unit: 'kWh', type: 'number' },
        usage_amount: { unit: 'kWh', type: 'number' }
      }
    },
    'medical-report': {
      cleanText: (text) => text,
      preserveFields: ['blood_pressure', 'heart_rate', 'temperature', 'respiratory_rate'],
      unitFields: {
        blood_pressure: { unit: 'mmHg', type: 'string' },
        heart_rate: { unit: 'bpm', type: 'number' },
        temperature: { unit: '°C', type: 'number' },
        respiratory_rate: { unit: 'breaths/min', type: 'number' }
      }
    },
    'lab-result': {
      cleanText: (text) => text,
      preserveFields: ['results', 'reference_ranges'],
      unitFields: {
        results: { type: 'array' }
      }
    },
    'prescription': {
      cleanText: (text) => text,
      preserveFields: ['dosage', 'quantity', 'refills'],
      unitFields: {
        dosage: { type: 'string' },
        quantity: { type: 'number' }
      }
    },
    'property-valuation': {
      cleanText: (text) => text,
      preserveFields: ['square_footage', 'lot_size', 'cap_rate'],
      unitFields: {
        square_footage: { unit: 'sq ft', type: 'number' },
        lot_size: { unit: 'acres', type: 'string' },
        cap_rate: { unit: '%', type: 'number' }
      }
    }
  };

  return rules[docType] || defaultRules;
}

export default { preprocessDocument };
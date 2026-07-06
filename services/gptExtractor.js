import OpenAI from 'openai';
import { 
  getDocumentTypeInfo, 
  detectDocumentCategory,
  isLegacyType,
  getFieldAliases,
  matchFieldName,
  DOCUMENT_REGISTRY,
  DOCUMENT_CATEGORIES,
  getAllDocumentTypes
} from '../schemas/documentRegistry.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function stripHtml(html) {
  if (!html || typeof html !== 'string') return html;
  return html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSystemPrompt(docTypeHint = null) {
  // MINIMAL type list — only what the model needs to distinguish
  const MINIMAL_TYPES = {
    invoice: ['invoice', 'receipt', 'purchase-order', 'unknown'],
    receipt: ['receipt', 'invoice', 'unknown'],
    'purchase-order': ['purchase-order', 'invoice', 'unknown'],
    'bank-statement': ['bank-statement', 'credit-card-statement', 'unknown'],
    'credit-card-statement': ['credit-card-statement', 'bank-statement', 'unknown'],
    'expense-report': ['expense-report', 'invoice', 'unknown'],
    'tax-form': ['tax-form', 'invoice', 'unknown'],
    'payroll-report': ['payroll-report', 'bank-statement', 'unknown'],
    'utility-bill': ['utility-bill', 'invoice', 'unknown'],
    contract: ['contract', 'nda', 'service-agreement', 'lease-agreement', 'unknown'],
    'lease-agreement': ['lease-agreement', 'contract', 'unknown'],
    nda: ['nda', 'contract', 'unknown'],
    'service-agreement': ['service-agreement', 'contract', 'unknown'],
    'court-document': ['court-document', 'contract', 'unknown'],
    'property-deed': ['property-deed', 'contract', 'unknown'],
    resume: ['resume', 'employment-contract', 'unknown'],
    'employment-contract': ['employment-contract', 'contract', 'unknown'],
    'offer-letter': ['offer-letter', 'employment-contract', 'unknown'],
    'employee-record': ['employee-record', 'resume', 'unknown'],
    'performance-review': ['performance-review', 'employee-record', 'unknown'],
    'medical-report': ['medical-report', 'lab-result', 'prescription', 'unknown'],
    'lab-result': ['lab-result', 'medical-report', 'unknown'],
    prescription: ['prescription', 'medical-report', 'unknown'],
    'patient-intake': ['patient-intake', 'medical-report', 'unknown'],
    'bill-of-lading': ['bill-of-lading', 'shipping-manifest', 'unknown'],
    'shipping-manifest': ['shipping-manifest', 'bill-of-lading', 'unknown'],
    'delivery-note': ['delivery-note', 'bill-of-lading', 'unknown'],
    'customs-document': ['customs-document', 'bill-of-lading', 'unknown'],
    'property-valuation': ['property-valuation', 'inspection-report', 'unknown'],
    'inspection-report': ['inspection-report', 'property-valuation', 'unknown'],
    'mortgage-document': ['mortgage-document', 'property-deed', 'unknown'],
    'land-registry': ['land-registry', 'property-deed', 'unknown'],
    transcript: ['transcript', 'certificate', 'unknown'],
    certificate: ['certificate', 'diploma', 'unknown'],
    diploma: ['diploma', 'certificate', 'unknown'],
    'student-record': ['student-record', 'transcript', 'unknown'],
    passport: ['passport', 'drivers-license', 'national-id', 'unknown'],
    'drivers-license': ['drivers-license', 'passport', 'national-id', 'unknown'],
    'national-id': ['national-id', 'passport', 'drivers-license', 'unknown'],
    permit: ['permit', 'license', 'unknown'],
    license: ['license', 'permit', 'unknown'],
    'insurance-claim': ['insurance-claim', 'insurance-claim-report', 'unknown'],
    'insurance-claim-report': ['insurance-claim-report', 'insurance-claim', 'unknown'],
    unknown: ['invoice', 'receipt', 'bank-statement', 'contract', 'resume', 'medical-report', 'utility-bill', 'unknown']
  };

  const typesToInclude = MINIMAL_TYPES[docTypeHint] || MINIMAL_TYPES.unknown;

  // Build descriptions ONLY for included types
  const typeDescriptions = typesToInclude.map(type => {
    const info = getDocumentTypeInfo(type);
    return `- ${type}: ${info.displayName || type}. Sections: [${info.sections?.join(', ') || 'general'}].`;
  }).join('\n');

  // Only add type-specific fields for the HINTED type
  let extraFields = [];
  if (docTypeHint && docTypeHint !== 'unknown' && docTypeHint !== 'mixed') {
    const info = getDocumentTypeInfo(docTypeHint);
    const fieldTypes = info.fieldTypes || {};
    for (const [field, type] of Object.entries(fieldTypes)) {
      if (['issuer', 'recipient'].includes(field)) continue;
      let example;
      switch (type) {
        case 'period': example = `{ "from": null, "to": null }`; break;
        case 'array': example = `[]`; break;
        case 'record': example = `{}`; break;
        case 'party': example = `{ "name": null, "address": null, "tax_id": null }`; break;
        case 'number': example = `null`; break;
        case 'boolean': example = `null`; break;
        default: example = `null`;
      }
      extraFields.push(`"${field}": ${example}`);
    }
  }

  return `Extract structured data from documents.

Types:
${typeDescriptions}

Rules:
- Use ONLY these document_type values: ${typesToInclude.join(', ')}
- Detect the EXACT document type from the available types above
- Extract ALL visible data into structured sections — NEVER leave structured data in plain text notes
- Dates: ISO 8601 (YYYY-MM-DD)
- Amounts: numbers only, strip symbols. ₦4,709,875.00 → 4709875.00
- Currency: 3-letter code (USD, NGN, EUR, GBP)
- Use null for genuinely missing fields, NEVER guess or fabricate
- Arrays must always be arrays (empty [] if none)
- Objects must always be objects (with null fields if missing), NEVER return null for object fields
- NEVER calculate totals — extract what's printed
- NEVER return placeholder text as values. If you see "Vendor Name", "TBD", "N/A" → treat as null

Output JSON:
{
  "document_type": "one-of-the-exact-types-above",
  "document_category": "financial|legal|hr|healthcare|insurance|logistics|real_estate|education|government|other",
  "issuer": { "name": null, "address": null, "tax_id": null, "email": null, "phone": null, "website": null, "registration_number": null, "id_number": null },
  "recipient": { "name": null, "address": null, "tax_id": null, "email": null, "id_number": null, "date_of_birth": null },
  "issue_date": null,
  "effective_date": null,
  "expiry_date": null,
  "total_amount": null,
  "currency": null,
  "tax_amount": null,
  "sections": [ { "section_type": "...", "section_title": "...", "fields": {}, "items": [], "text": "" } ],
  "specific_fields": {},
  "category": null,
  "language": null,
  "country": null${extraFields.length ? ',\n  ' + extraFields.join(',\n  ') : ''}
}

specific_fields usage (CRITICAL):
- After extracting all known fields and sections above, if ANY additional fields exist in the document that don't match known fields or section types, place them in specific_fields
- specific_fields is a flat key-value object: { "field_name": value }
- Arrays and objects ARE allowed as values in specific_fields
- Do NOT omit data — if it exists in the document, it must appear either in a known field, a section, or specific_fields
- Example: if an invoice has "po_number" or "project_code" or "swift_code" and these aren't top-level known fields, put them in specific_fields
- Example: if a bank statement has "routing_number" or "account_type", put them in specific_fields
- Example: if a shipping document has "container_seal" or "vessel_name", put them in specific_fields
- Example: if a medical report has "blood_group" or "allergies", put them in specific_fields

Sections:
- Use section_type values from the registry for this document type
- Put ALL structured data in fields objects, not text
- Use items array for lists (line items, transactions, courses, etc.)
- Use text ONLY for truly unstructured prose

Top-level arrays (populate when visible):
- line_items: for invoices, purchase orders
- items: for receipts
- transactions: for bank statements, credit card statements
- These MUST be arrays of complete objects at the top level`;
}

function buildUserPrompt(processedDoc, fileName = '', typeHint = null) {
  // Strip HTML if present
  let docContent = processedDoc.content || processedDoc.text || '';
  if (processedDoc.mimeType === 'text/html' || processedDoc.mimetype === 'text/html' || 
      (typeof docContent === 'string' && docContent.trim().startsWith('<'))) {
    docContent = stripHtml(docContent);
  }
  
  const isEmpty = !docContent || docContent.trim().length === 0;

  if (isEmpty && processedDoc.type !== 'image') {
    return `The document could not be parsed or has no extractable text. 
Return document_type: "unknown", document_category: "other", and include "No extractable content" in the notes field. 
Return empty sections []. Return null for all other fields.`;
  }

  let prompt = '';

  if (typeHint) {
    const info = getDocumentTypeInfo(typeHint);
    if (info.displayName !== 'Unknown Document') {
      prompt += `HINT: This appears to be a ${info.displayName} (${info.category} document).\n`;
      prompt += `Expected sections: ${info.sections?.join(', ') || 'general'}.\n`;
      prompt += `Required fields: ${info.requiredFields?.join(', ') || 'none'}.\n`;
      if (info.promptHints?.length) {
        prompt += `Look for these indicators: ${info.promptHints.join(', ')}.\n`;
      }
      prompt += '\n';
    }
  }

  const categoryHint = detectDocumentCategory(fileName, docContent);
  if (categoryHint && !typeHint) {
    const categoryName = categoryHint.replace('_', ' ');
    prompt += `HINT: This appears to be a ${categoryName} document based on filename/content.\n\n`;
  }

  if (processedDoc.type === 'image') {
    const supplementalText = processedDoc.text || processedDoc.textContent || '';
    prompt += `Extract structured data from this image.${supplementalText ? ' Additional extracted text: ' + supplementalText.substring(0, 2000) : ''} Return ONLY valid JSON matching the schema above.`;
  } else {
    prompt += `Extract all structured data from this ${processedDoc.type || 'document'}. First detect the document type from the available types, then extract all relevant fields into sections.\n\nDOCUMENT TEXT:\n${docContent.substring(0, 8000)}`;
  }

  return prompt;
}

export async function extractWithGPT(processedDoc, fileName = '', documentType = null) {
  console.log('=== GPT EXTRACT: Building messages ===');
  const buildStart = performance.now();
  
  const content = processedDoc.content || processedDoc.text || '';
  const strippedLength = stripHtml(content).length;
  console.log('Input type:', processedDoc.type);
  console.log('Content length (raw):', content.length);
  console.log('Content length (stripped):', strippedLength);

  const validatedType = documentType && getDocumentTypeInfo(documentType).displayName !== 'Unknown Document' 
    ? documentType 
    : null;

  const userContent = processedDoc.type === 'image'
    ? [
        { type: 'text', text: buildUserPrompt(processedDoc, fileName, validatedType) },
        {
          type: 'image_url',
          image_url: { 
            url: `data:image/jpeg;base64,${processedDoc.content}`, 
            detail: processedDoc.pageCount && processedDoc.pageCount > 1 ? 'high' : 'low'
          }
        }
      ]
    : buildUserPrompt(processedDoc, fileName, validatedType);

  const messages = [
    { role: 'system', content: buildSystemPrompt(validatedType) },
    { role: 'user', content: userContent }
  ];

  console.log('[TIMER] Message build:', ((performance.now() - buildStart) / 1000).toFixed(3), 's');
  console.log('System prompt length:', messages[0].content.length, 'chars');
  console.log('User prompt length:', typeof messages[1].content === 'string' ? messages[1].content.length : 'multi-modal', 'chars');

  console.log('=== GPT EXTRACT: Calling OpenAI ===');
  const apiStart = performance.now();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    response_format: { type: 'json_object' },
    max_tokens: 4000,
    temperature: 0
  });

  const apiElapsed = (performance.now() - apiStart) / 1000;
  console.log(`=== GPT EXTRACT: Response in ${(apiElapsed * 1000).toFixed(0)} ms ===`);
  console.log('Tokens - prompt:', response.usage?.prompt_tokens, 'completion:', response.usage?.completion_tokens);
  console.log('Completion tokens / max_tokens ratio:', ((response.usage?.completion_tokens || 0) / 2000).toFixed(2));

  const parseStart = performance.now();
    const responseContent = response.choices[0].message.content;
  if (!responseContent) throw new Error('Empty GPT response');

  // FIX: Detect truncation and try to salvage
  if (response.choices[0].finish_reason === 'length') {
    console.warn('GPT response truncated due to max_tokens limit. Attempting to salvage...');
    // Try to close the JSON by finding the last valid object and appending }
    const lastBrace = responseContent.lastIndexOf('}');
    const lastBracket = responseContent.lastIndexOf(']');
    const cutAt = Math.max(lastBrace, lastBracket);
    if (cutAt > 0) {
      const salvaged = responseContent.slice(0, cutAt + 1);
      try {
        const parsed = JSON.parse(salvaged);
        console.log('Salvaged truncated JSON successfully');
        console.log('=== GPT EXTRACT: Parsed (salvaged) ===');
        console.log('Doc type:', parsed.document_type);
        console.log('Category:', parsed.document_category);
        console.log('Issuer:', parsed.issuer?.name);
        console.log('Sections:', parsed.sections?.map(s => s.section_type).join(', '));
        return parsed;
      } catch {
        // Fall through to normal error
      }
    }
  }

  try {
    const parsed = JSON.parse(responseContent);
    console.log('=== GPT EXTRACT: Parsed ===');
    console.log('Doc type:', parsed.document_type);
    console.log('Category:', parsed.document_category);
    console.log('Issuer:', parsed.issuer?.name);
    console.log('Sections:', parsed.sections?.map(s => s.section_type).join(', '));
    return parsed;
  } catch (err) {
    console.error('JSON parse failed:', err.message);
    console.error('Raw response (first 500 chars):', responseContent.slice(0, 500));
    console.error('Raw response (last 500 chars):', responseContent.slice(-500));
    throw new Error('GPT returned invalid JSON');
  }
}



// ============================================================
// DYNAMIC NORMALIZATION — Uses registry, zero hardcoding
// ============================================================

/**
 * Main normalization entry point. Routes to appropriate handler.
 */
export function normalizeExtraction(data = {}) {
  const isNewFormat = data.sections !== undefined || data.issuer !== undefined;
  return isNewFormat ? normalizeFlexibleFormat(data) : normalizeLegacyFormat(data);
}

const CLEANERS = {
  string: (val, strict = false) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') {
      const t = val.trim();
      if (!t.length) return null;
      if (strict && isPlaceholder(t)) return null;
      return t;
    }
    if (typeof val === 'number') return String(val);
    return null;
  },
  
  number: (val) => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (typeof val === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return null;
      if (/^\d{1,2}:\d{2}/.test(val)) return null;
      if (/[a-zA-Z]/.test(val) && !/^[₦,$€£\s\d.,-]+$/.test(val)) return null;
      const cleaned = val.replace(/[₦,$€£\s,%]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  },
  
  date: (val) => {
    if (!val) return null;
    if (typeof val === 'string') {
      const s = val.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split('T')[0];
      const patterns = [
        /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/,
        /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/
      ];
      for (const pattern of patterns) {
        const match = s.match(pattern);
        if (match) {
          const [_, a, b, c] = match;
          if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
          if (parseInt(a) > 12) return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
          return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
        }
      }
      if (/^\d{4}$/.test(s)) return null;
      return s;
    }
    if (typeof val === 'number') {
      if (val > 1900 && val < 2100) return null;
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return null;
    }
    return null;
  },
  
  period: (val) => {
    if (!val || typeof val !== 'object') return { from: null, to: null };
    return {
      from: CLEANERS.date(val.from),
      to: CLEANERS.date(val.to)
    };
  },
  
  status: (val, validValues) => {
    const s = (val || '').toString().trim().toUpperCase();
    return validValues.includes(s) ? s : null;
  },

  array: (val) => {
    if (!Array.isArray(val)) return [];
    return val.filter(item => item !== null && item !== undefined);
  }
};


function isPlaceholder(val) {
  if (typeof val !== 'string') return false;
  const normalized = val.trim().toLowerCase();
  const placeholders = [
  'vendor name', 'company name', 'buyer name', 'customer name',
  'supplier name', 'counterparty name', 'your company', 'company',
  'vendor', 'supplier', 'client', 'customer',
  'not applicable', 'n/a', 'tbd', 'to be determined',
  'placeholder', 'example', 'sample', 'test', 'demo',
  'unknown vendor', 'unknown company', 'full name',
  'enter name', 'your name here'
];
  return placeholders.includes(normalized) || /^\[.*\]$/.test(val.trim());
}

function hasValue(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string' && val.trim() === '') return false;
  if (typeof val === 'string' && ['UNKNOWN', 'unknown', 'Uncategorized'].includes(val)) return false;
  if (Array.isArray(val) && val.length === 0) return false;
  if (typeof val === 'object' && !Array.isArray(val)) {
    const values = Object.values(val);
    if (values.length === 0 || values.every(v => v === null || v === undefined || v === '')) return false;
  }
  return true;
}

/**
 * Resolves field aliases using the registry for a specific document type
 */
function resolveAliasesInData(data, docType) {
  const info = getDocumentTypeInfo(docType);
  if (!info.fieldAliases) return data;
  
  const resolved = { ...data };
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    
    // Check if this key is an alias
    for (const [canonical, aliases] of Object.entries(info.fieldAliases)) {
      if (aliases.includes(key) && !(canonical in resolved)) {
        resolved[canonical] = value;
        break;
      }
    }
  }
  
  return resolved;
}

/**
 * Extracts fields from sections using registry alias resolution
 */
function extractFromSections(sections, docType) {
  const extracted = {};
  const info = getDocumentTypeInfo(docType);
  
  for (const section of sections || []) {
    // Extract fields with alias resolution
    for (const [rawKey, value] of Object.entries(section.fields || {})) {
      if (!hasValue(value)) continue;
      
      const canonical = matchFieldName(rawKey, docType);
      const key = canonical || rawKey;
      
      if (!(key in extracted) || !hasValue(extracted[key])) {
        extracted[key] = value;
      }
    }
    
    // Extract items with type inference
    if (section.items?.length > 0) {
      const itemType = inferItemType(section.section_type, docType);
      if (itemType && !extracted[itemType]) {
        extracted[itemType] = section.items;
      }
    }
  }
  
  return extracted;
}

/**
 * Infers the legacy array field name from section type using registry
 */
function inferItemType(sectionType, docType) {
  const info = getDocumentTypeInfo(docType);
  const sectionFields = info.sections || [];
  
  // Map section names to likely array fields based on registry expectedFields
  const mappings = {
    line_items: ['line_items'],
    items: ['items', 'line_items'],
    transactions: ['transactions'],
    expenses: ['expense_items'],
    courses: ['courses'],
    grades: ['grades'],
    employee_earnings: ['employees'],
    cargo_list: ['cargo_items'],
    cargo_details: ['cargo_items'],
    items_delivered: ['items_delivered'],
    experience: ['experience'],
    education: ['education'],
    skills: ['skills'],
    certifications: ['certifications'],
    findings: ['findings'],
    recommendations: ['recommendations'],
    results: ['results'],
    medications: ['medications'],
    allergies: ['allergies'],
    diagnosis: ['diagnosis'],
    treatment: ['treatment_plan']
  };
  
  const possible = mappings[sectionType];
  if (!possible) return null;
  
  // Check which one is a known field for this type
  const expected = info.expectedFields || [];
  for (const field of possible) {
    if (expected.includes(field)) return field;
  }
  
  return possible[0];
}

/**
 * Gets all known fields for a document type from registry
 */
function getKnownFieldsForType(docType) {
  const info = getDocumentTypeInfo(docType);
  const fields = new Set([
    ...(info.requiredFields || []),
    ...(info.expectedFields || []),
    ...(info.fieldWeights ? Object.keys(info.fieldWeights) : []),
    ...(info.fieldAliases ? Object.keys(info.fieldAliases) : []),
    ...(info.fieldAliases ? Object.values(info.fieldAliases).flat() : [])
  ]);
  return fields;
}

/**
 * Main flexible format normalizer — registry-driven, no hardcoded types
 */
function normalizeFlexibleFormat(data) {
  const docType = CLEANERS.string(data.document_type) || 'unknown';
  const info = getDocumentTypeInfo(docType);
  const isLegacy = isLegacyType(docType);
  
  // Step 1: Resolve aliases in raw data
  const aliasResolved = resolveAliasesInData(data, docType);
  
  // Step 2: Extract from sections
  const sectionFields = extractFromSections(data.sections, docType);
  
     // Step 3: Merge data sources (priority: aliasResolved > sectionFields > data)
  const merged = { ...data, ...sectionFields, ...aliasResolved };

  // Step 4: Get all known fields for this type (MOVED UP — needed for Step 3a)
  const knownFields = getKnownFieldsForType(docType);

  // Step 3a: Collect unknown fields from sections into specific_fields
  const unknownSectionFields = {};
  for (const section of data.sections || []) {
    for (const [key, value] of Object.entries(section.fields || {})) {
      const canonical = matchFieldName(key, docType) || key;
      if (!knownFields.has(canonical) && hasValue(value) && !key.startsWith('_')) {
        unknownSectionFields[canonical] = value;
      }
    }
  }

  // Step 3b: Extract tax_details from sections if not already at top level
  if (!merged.tax_details || merged.tax_details.length === 0) {
    const taxSection = data.sections?.find(s => 
      s.section_type === 'tax_breakdown' || 
      s.section_type === 'tax_details' ||
      s.section_title?.toLowerCase().includes('tax')
    );
    if (taxSection?.items?.length > 0) {
      merged.tax_details = taxSection.items.map(item => ({
        type: item.type || item.tax_type || 'Unknown',
        rate: CLEANERS.number(item.rate || item.tax_rate),
        amount: CLEANERS.number(item.amount || item.tax_amount) || 0
      })).filter(item => item.amount !== null);
    } else if (taxSection?.fields) {
      // Single tax entry from fields
      const taxAmount = CLEANERS.number(taxSection.fields.tax_amount || taxSection.fields.amount);
      if (taxAmount !== null) {
        merged.tax_details = [{
          type: CLEANERS.string(taxSection.fields.tax_type || taxSection.fields.type) || 'Unknown',
          rate: CLEANERS.number(taxSection.fields.tax_rate || taxSection.fields.rate),
          amount: taxAmount
        }];
      }
    }
  }
  
  
  // Step 5: Build normalized output dynamically
  const result = {
  document_type: docType,
  document_subtype: CLEANERS.string(data.document_subtype),
  document_category: CLEANERS.string(data.document_category) || info.category || 'other',
  
  issuer: normalizeParty(data.issuer, merged, 'issuer'),
  recipient: normalizeParty(data.recipient, merged, 'recipient'),
  
  // NEW: Add buyer, seller, customer, supplier from raw data
  buyer: normalizeGenericParty(data.buyer, merged, ['buyer_name', 'buyer_company', 'purchaser']),
  seller: normalizeGenericParty(data.seller, merged, ['seller_name', 'vendor_name', 'merchant']),
  customer: normalizeGenericParty(data.customer, merged, ['customer_name', 'client_name']),
  supplier: normalizeGenericParty(data.supplier, merged, ['supplier_name', 'vendor_name', 'provider']),
  
    issue_date: CLEANERS.date(merged.issue_date || merged.date),
    effective_date: CLEANERS.date(merged.effective_date),
    expiry_date: CLEANERS.date(merged.expiration_date || merged.expiry_date),
    
    total_amount: CLEANERS.number(merged.total_amount),
    currency: CLEANERS.string(merged.currency) || 'USD',
    tax_amount: CLEANERS.number(merged.tax_amount) || 0,
    
    sections: normalizeSections(data.sections, docType),
        specific_fields: {
      ...normalizeSpecificFields(merged, knownFields),
      ...unknownSectionFields
    },
    
    // Dynamically populate ALL known fields for this type
    ...extractKnownFields(merged, knownFields),
    
    category: mapCategory(CLEANERS.string(merged.category)) || 'Uncategorized',
    
    _schema_version: 'v8-flexible',
    _source: { aws: false, gpt: true }
  };
 
  
  // -----------------------------
// Flatten issuer → vendor_*
// -----------------------------
if (result.issuer) {
  result.vendor_name ??= result.issuer.name;
  result.vendor_address ??= result.issuer.address;
  result.vendor_tax_id ??= result.issuer.tax_id;
  result.vendor_email ??= result.issuer.email;
  result.vendor_phone ??= result.issuer.phone;
  result.vendor_website ??= result.issuer.website;
  result.vendor_registration_number ??= result.issuer.registration_number;
}

// -----------------------------
// Flatten recipient → buyer_*
// -----------------------------
if (result.recipient) {
  result.buyer_name ??= result.recipient.name;
  result.buyer_address ??= result.recipient.address;
  result.buyer_tax_id ??= result.recipient.tax_id;
  result.buyer_email ??= result.recipient.email;
  result.buyer_phone ??= result.recipient.phone;
}

  return result;
}

function normalizeParty(partyData, mergedData, partyType) {
  const base = partyData || {};
  const docType = mergedData.document_type || 'unknown';
  const info = getDocumentTypeInfo(docType);  
  const buildAliasList = (canonicalFields) => {
    const aliases = new Set();
    if (!info.fieldAliases) return canonicalFields;
    for (const canonical of canonicalFields) {
      const fieldAliases = getFieldAliases(docType, canonical);
      fieldAliases.forEach(a => aliases.add(a));
    }
    return Array.from(aliases);
  };


  
  const fieldMap = partyType === 'issuer' ? {
    name: buildAliasList(['vendor_name', 'bank_name', 'company_name', 'employer_name', 'provider_name', 
           'institution_name', 'issuing_authority', 'shipper', 'lessor', 'grantor']),
    address: buildAliasList(['vendor_address', 'address']),
    tax_id: buildAliasList(['vendor_tax_id', 'tax_id']),
    email: buildAliasList(['vendor_email', 'email']),
    phone: buildAliasList(['vendor_phone', 'phone']),
    website: buildAliasList(['vendor_website', 'website']),
    registration_number: buildAliasList(['vendor_registration_number', 'registration_number']),
    id_number: buildAliasList(['vendor_id_number', 'id_number'])
  } : {
    name: buildAliasList(['buyer_name', 'counterparty', 'account_name', 'employee_name', 'patient_name',
           'student_name', 'claimant_name', 'cardholder_name', 'consignee', 'lessee', 'grantee']),
    address: buildAliasList(['buyer_address', 'address']),
    tax_id: buildAliasList(['buyer_tax_id', 'tax_id']),
    email: buildAliasList(['buyer_email', 'email']),
    id_number: buildAliasList(['buyer_id_number', 'id_number']),
    date_of_birth: buildAliasList(['date_of_birth'])
  };

 const resolved = {};

for (const [field, aliases] of Object.entries(fieldMap)) {
  let value = base[field];

  if (!hasValue(value)) {
    const alias = aliases.find(a => hasValue(mergedData[a]));
    if (alias) value = mergedData[alias];
  }

  resolved[field] = CLEANERS.string(value);
}

return resolved;

}

function normalizeGenericParty(partyData, mergedData, fallbackAliases) {
  const base = partyData || {};
  const docType = mergedData.document_type || 'unknown';
  const info = getDocumentTypeInfo(docType);
  
  const buildAliasList = (canonicalFields) => {
    const aliases = new Set();
    if (!info.fieldAliases) return canonicalFields;
    for (const canonical of canonicalFields) {
      const fieldAliases = getFieldAliases(docType, canonical);
      fieldAliases.forEach(a => aliases.add(a));
    }
    return Array.from(aliases);
  };

  const fieldMap = {
    name: buildAliasList(fallbackAliases),
    address: buildAliasList([...fallbackAliases.map(a => a.replace('_name', '_address')), 'address']),
    email: buildAliasList([...fallbackAliases.map(a => a.replace('_name', '_email')), 'email']),
    phone: buildAliasList([...fallbackAliases.map(a => a.replace('_name', '_phone')), 'phone']),
    tax_id: buildAliasList([...fallbackAliases.map(a => a.replace('_name', '_tax_id')), 'tax_id']),
    contact_person: buildAliasList([...fallbackAliases.map(a => a.replace('_name', '_contact')), 'contact_person'])
  };

  const resolved = {};
  for (const [field, aliases] of Object.entries(fieldMap)) {
    resolved[field] = CLEANERS.string(
      base[field] || aliases.find(a => mergedData[a]) || null
    );
  }
  
  return resolved;
}


/**
 * Normalizes sections array
 */
function normalizeSections(sections, docType) {
  if (!Array.isArray(sections)) return [];
  
  return sections.map(section => ({
    section_type: CLEANERS.string(section.section_type) || 'general',
    section_title: CLEANERS.string(section.section_title) || '',
    fields: Object.entries(section.fields || {}).reduce((acc, [key, val]) => {
      const cleanKey = CLEANERS.string(key);
      if (!cleanKey) return acc;
      
      let cleanVal = val;
      if (typeof val === 'string') {
        const numVal = CLEANERS.number(val);
        cleanVal = numVal !== null ? numVal : CLEANERS.string(val, true);
      }
      acc[cleanKey] = cleanVal;
      return acc;
    }, {}),
    items: (section.items || []).map(item => {
      if (typeof item === 'object' && item !== null) {
        return Object.entries(item).reduce((acc, [k, v]) => {
          const ck = CLEANERS.string(k);
          if (!ck) return acc;
          let cv = v;
          if (typeof v === 'string') {
            const nv = CLEANERS.number(v);
            cv = nv !== null ? nv : CLEANERS.string(v, true);
          }
          acc[ck] = cv;
          return acc;
        }, {});
      }
      return { value: item };
    }),
    text: CLEANERS.string(section.text) || ''
  }));
}

/**
 * Extracts known fields dynamically from merged data
 */
function extractKnownFields(merged, knownFields) {
  const result = {};

  // Maps legacy fields to nested party properties
  const partyFieldMaps = {
    vendor_: {
      source: merged.issuer || merged.seller || merged.supplier,
      fields: {
        vendor_name: 'name',
        vendor_address: 'address',
        vendor_tax_id: 'tax_id',
        vendor_email: 'email',
        vendor_phone: 'phone',
        vendor_website: 'website',
        vendor_registration_number: 'registration_number',
        vendor_id_number: 'id_number'
      }
    },

    buyer_: {
      source: merged.recipient || merged.buyer || merged.customer,
      fields: {
        buyer_name: 'name',
        buyer_address: 'address',
        buyer_tax_id: 'tax_id',
        buyer_email: 'email',
        buyer_phone: 'phone',
        buyer_contact_person: 'contact_person',
        buyer_id_number: 'id_number'
      }
    }
  };

  for (const field of knownFields) {

    let value = merged[field];

    // ------------------------------------------------------------------
    // Fallback to issuer/seller/supplier for vendor_* fields
    // ------------------------------------------------------------------
    if (!hasValue(value) && field.startsWith('vendor_')) {
      const mapping = partyFieldMaps.vendor_;

      if (mapping.fields[field]) {
        value = mapping.source?.[mapping.fields[field]];
      }
    }

    // ------------------------------------------------------------------
    // Fallback to recipient/buyer/customer for buyer_* fields
    // ------------------------------------------------------------------
    if (!hasValue(value) && field.startsWith('buyer_')) {
      const mapping = partyFieldMaps.buyer_;

      if (mapping.fields[field]) {
        value = mapping.source?.[mapping.fields[field]];
      }
    }

    // Nothing found
    if (!hasValue(value)) continue;

    // ------------------------------------------------------------------
    // Type coercion
    // ------------------------------------------------------------------
    const name = field.toLowerCase();

    if (
      name.includes('date') ||
      name.includes('_date')
    ) {
      result[field] = CLEANERS.date(value);

    } else if (
      name.includes('amount') ||
      name.includes('cost') ||
      name.includes('price') ||
      name.includes('fee') ||
      name.includes('total') ||
      name.includes('balance') ||
      name.includes('value') ||
      name.includes('payment') ||
      name.includes('salary') ||
      name.includes('rent') ||
      name.includes('deposit') ||
      name.includes('gpa') ||
      name.includes('quantity') ||
      name.includes('rate') ||
      name.includes('percent')
    ) {
      result[field] = CLEANERS.number(value);

    } else if (
      name.includes('period') ||
      name.includes('range')
    ) {
      result[field] = CLEANERS.period(value);

    } else if (
      name.includes('line_items') ||
      name.includes('transactions') ||
      name.includes('items') ||
      name.includes('employees') ||
      name.includes('courses') ||
      name.includes('grades') ||
      name.includes('medications') ||
      name.includes('allergies')
    ) {
      result[field] = CLEANERS.array(value);

    } else {
      result[field] = CLEANERS.string(value, true);
    }
  }

  return result;
}


function normalizeSpecificFields(merged, knownFields) {
  const excludedTopLevel = new Set([
    'issuer', 'recipient', 'buyer', 'seller', 'customer', 'supplier',
    'sections', 'line_items', 'items', 'transactions',
    'specific_fields',
    'document_type', 'document_subtype', 'document_category', 'category',
    'language', 'country', 'state',
    'confidence_scores', 'notes', 'currency', 'status',
    'processingMethod', 'validation', 'flags', 'warningFlags',
    'document_id', 'document_title', 'document_source',
    'created_date', 'updated_date',
    '_schema_version', '_source'
  ]);

  const specific = {};
  for (const [key, value] of Object.entries(merged)) {
    if (knownFields.has(key)) continue;
    if (excludedTopLevel.has(key)) continue;
    if (key.startsWith('_')) continue;
    if (!hasValue(value)) continue;
    if (/^\d+$/.test(key)) continue;

    specific[key] = value;
  }
  return specific;
}
  /**
 * Calculates confidence using registry fieldWeights
 */
function calculateConfidence(merged, docType) {
  const info = getDocumentTypeInfo(docType);
  const weights = info.fieldWeights || {};
  
  const presentFields = Object.keys(merged).filter(k => hasValue(merged[k]));
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const actualWeight = presentFields.reduce((sum, field) => sum + (weights[field] || 0), 0);
  
  const overall = totalWeight > 0 ? Math.min(1, actualWeight / totalWeight) : 0;
  
  // Determine status
  let status = 'HIGH';
  let requiresReview = false;
  let reviewReason = null;
  
  const missingRequired = (info.requiredFields || []).filter(f => !hasValue(merged[f]));
  
  if (missingRequired.length > 0) {
    status = 'LOW';
    requiresReview = true;
    reviewReason = `Missing required: ${missingRequired.join(', ')}`;
  } else if (overall < 0.5) {
    status = 'MEDIUM';
    requiresReview = true;
    reviewReason = 'Low extraction confidence';
  }
  
  return {
    overall: Math.round(overall * 100) / 100,
    completeness: Math.round((presentFields.length / Math.max(info.expectedFields?.length || 1, 1)) * 100),
    breakdown: { [docType]: overall },
    status,
    requiresReview,
    reviewReason,
    flags: {
      low_confidence_fields: [],
      missing_required_fields: missingRequired,
      invalid_dates: [],
      math_issue: false,
      balance_mismatch: false
    },
    extractedFieldCount: presentFields.length,
    totalPossibleFields: info.expectedFields?.length || 0
  };
}


function normalizeLegacyFormat(data) {
  return normalizeFlexibleFormat(data);
}

function mapCategory(category) {
  if (!category) return 'Uncategorized';
  const map = {
    [DOCUMENT_CATEGORIES.FINANCIAL]: 'Banking & Finance',
    [DOCUMENT_CATEGORIES.LEGAL]: 'Professional Services',
    [DOCUMENT_CATEGORIES.HR]: 'Professional Services',
    [DOCUMENT_CATEGORIES.HEALTHCARE]: 'Insurance',
    [DOCUMENT_CATEGORIES.INSURANCE]: 'Insurance',
    [DOCUMENT_CATEGORIES.LOGISTICS]: 'Shipping & Logistics',
    [DOCUMENT_CATEGORIES.REAL_ESTATE]: 'Rent & Facilities',
    [DOCUMENT_CATEGORIES.EDUCATION]: 'Professional Services',
    [DOCUMENT_CATEGORIES.GOVERNMENT]: 'Taxes & Government',
    [DOCUMENT_CATEGORIES.OTHER]: 'Uncategorized'
  };
  return map[category.toLowerCase()] || category;
}

// AWS refinement (also registry-driven)
export async function refineWithGPT(awsExtractedData, documentType) {
  const info = getDocumentTypeInfo(documentType);
  const prompt = `Document Type: ${documentType} (${info.displayName})
Category: ${info.category}
Required Fields: ${info.requiredFields?.join(', ') || 'none'}
Expected Sections: ${info.sections?.join(', ') || 'general'}

Raw AWS Textract Data:
${JSON.stringify(awsExtractedData, null, 2)}

Clean up this data into the flexible format with sections, issuer, recipient, and document_category. Use canonical field names from the registry. Return strict JSON.`;

    const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    response_format: { type: 'json_object' },
    max_tokens: 1500,         
    temperature: 0
  });
  
  return JSON.parse(response.choices[0].message.content);
}
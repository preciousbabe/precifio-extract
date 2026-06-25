import OpenAI from 'openai';
import { 
  getDocumentTypeInfo, 
  detectDocumentCategory, 
  DOCUMENT_REGISTRY,
  DOCUMENT_CATEGORIES 
} from '../schemas/documentRegistry.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================
// PROMPT FACTORY — Builds context-aware prompts per document type
// ============================================================

function buildSystemPrompt() {
  return `You are an intelligent document analyzer specializing in structured data extraction across 40+ document types.

CRITICAL RULES:
1. Detect the EXACT document type by analyzing structure, headers, logos, and content patterns
2. Extract ALL visible data into structured sections — NEVER leave structured data in plain text notes
3. Use null for genuinely missing fields, NEVER guess or fabricate
4. Dates: ISO 8601 (YYYY-MM-DD)
5. Amounts: numbers only, strip symbols. ₦4,709,875.00 → 4709875.00
6. Currency: 3-letter code (USD, NGN, EUR, GBP)
7. Arrays must always be arrays (empty [] if none)
8. NEVER calculate totals — extract what's printed
9. NEVER return placeholder text as values. If you see "Vendor Name", "TBD", "N/A" → treat as null
10. For payment/invoice status: ONLY return if explicitly stated, otherwise null

OUTPUT FORMAT — You MUST return this exact JSON structure:
{
  "document_type": "specific-type-kebab-case",
  "document_category": "financial|legal|hr|healthcare|insurance|logistics|real_estate|education|government|other",
  "issuer": {
    "name": "string or null",
    "address": "string or null", 
    "tax_id": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "website": "string or null",
    "registration_number": "string or null",
    "id_number": "string or null"
  },
  "recipient": {
    "name": "string or null",
    "address": "string or null",
    "tax_id": "string or null", 
    "email": "string or null",
    "id_number": "string or null",
    "date_of_birth": "YYYY-MM-DD or null"
  },
  "issue_date": "YYYY-MM-DD or null",
  "effective_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "total_amount": number or null,
  "currency": "3-letter code or null",
  "tax_amount": number or null,
  "line_items": [
    { "description": "...", "quantity": 1, "unit_price": 10.00, "total": 10.00, "sku": "...", "tax_amount": 0 }
  ],
  "items": [
    { "description": "...", "quantity": 1, "price": 10.00, "total": 10.00 }
  ],
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "...", "debit": null, "credit": 10.00, "balance": 100.00 }
  ],
  "sections": [
    {
      "section_type": "logical-section-name",
      "section_title": "Human Readable Title",
      "fields": { "key": "value", "numeric_key": 123 },
      "items": [
        { "description": "...", "amount": 100, "date": "..." }
      ],
      "text": "raw text of section if unstructured"
    }
  ],
  "specific_fields": {
    // Any type-specific fields not fitting sections
  },
  "category": "business category or Uncategorized",
  "language": "detected language code or null",
  "country": "detected country or null"
}

CRITICAL FOR ALL DOCUMENT TYPES:
- line_items, items, and transactions MUST be arrays at the TOP LEVEL of the JSON response
- Each array item must be a complete object with all relevant fields
- Do NOT put structured data only in sections.text — always populate the top-level arrays
- For invoices: line_items array is REQUIRED if items are visible
- For receipts: items array is REQUIRED if items are visible  
- For bank statements: transactions array is REQUIRED if transactions are visible
- For purchase orders: line_items array is REQUIRED if items are visible

SECTION GUIDELINES BY DOCUMENT CATEGORY:

FINANCIAL (invoice, receipt, bank-statement, credit-card-statement, purchase-order, expense-report, tax-form, payroll-report):
- sections: transaction_details, line_items, payment_info, account_summary, tax_breakdown, employee_info
- key fields: total_amount, tax_amount, currency, account_number, dates, payment_method
- ALWAYS populate top-level line_items, items, transactions arrays with structured objects

LEGAL (contract, lease-agreement, nda, service-agreement, court-document, property-deed):
- sections: parties, terms, clauses, signatures, obligations, jurisdiction, property_details
- key fields: effective_date, expiration_date, counterparty, contract_value, governing_law

INSURANCE (insurance-claim, auto-claim, property-claim):
- sections: claim_information, incident_details, vehicle_information, damage_assessment, supporting_documents, policy_info
- key fields: claim_number, policy_number, incident_date, location, primary_damage, estimated_repair_cost, claim_status
- ISSUER = the party FILING the claim (claimant, policyholder, vehicle owner, injured party)
- RECIPIENT = the party RECEIVING the claim (insurance company, insurer, adjuster)

HR (resume, employment-contract, offer-letter, employee-record, performance-review):
- sections: personal_info, experience, education, skills, certifications, compensation, review_period, goals
- key fields: full_name, email, phone, position, salary, hire_date, company_name

HEALTHCARE (medical-report, lab-result, prescription, patient-intake):
- sections: patient_info, diagnosis, treatment, medications, test_results, provider_info, charges
- key fields: patient_name, date_of_birth, medical_record_number, provider_name, service_date

LOGISTICS (bill-of-lading, shipping-manifest, delivery-note, customs-document):
- sections: shipment_info, cargo_details, route, parties, declarations, tracking
- key fields: tracking_number, origin, destination, weight, ship_date, carrier, vessel

REAL ESTATE (property-valuation, inspection-report, mortgage-document, land-registry):
- sections: property_details, valuation, parties, terms, inspection_items, mortgage_terms
- key fields: property_address, value, owner, date, inspector, loan_amount

EDUCATION (transcript, certificate, diploma, student-record):
- sections: student_info, institution, courses, grades, awards, dates, credentials
- key fields: student_name, institution, gpa, graduation_date, degree, course_codes

GOVERNMENT (passport, drivers-license, national-id, permit, license):
- sections: personal_info, document_info, issuing_authority, restrictions, conditions
- key fields: full_name, document_number, issue_date, expiry_date, authority, nationality, date_of_birth

UNKNOWN / OTHER:
- sections: general
- Extract ALL visible text into sections with fields
- Use "text" field for unstructured content`;
}

function buildUserPrompt(processedDoc, categoryHint = null, typeHint = null) {
  const isExtractionFailure = processedDoc.type === 'text' && 
    processedDoc.content && 
    (processedDoc.content.startsWith('[UNREADABLE PDF') || processedDoc.content.startsWith('[PDF Document'));

  if (isExtractionFailure) {
    return `The document could not be parsed. The system reported: "${processedDoc.content}". 
Return document_type: "unknown", document_category: "other", and include this message in the notes field. 
Return empty sections []. Return null for all other fields.`;
  }

  let prompt = '';

  if (categoryHint) {
    const typeInfo = getDocumentTypeInfo(typeHint || 'unknown');
    prompt += `HINT: This appears to be a ${categoryHint} document`;
    if (typeHint && typeInfo.displayName !== 'Unknown Document') {
      prompt += ` (likely a ${typeInfo.displayName})`;
    }
    prompt += `.\n\n`;

    if (typeInfo.promptHints?.length) {
      prompt += `Look for these indicators: ${typeInfo.promptHints.join(', ')}.\n`;
    }
    prompt += `Focus on these sections: ${typeInfo.sections?.join(', ') || 'general'}.\n\n`;
  }

  if (processedDoc.type === 'image') {
    prompt += `Extract structured data from this image. ${processedDoc.textContent ? 'Additional extracted text: ' + processedDoc.textContent.substring(0, 2000) : ''} Return ONLY valid JSON matching the schema above.`;
  } else {
    prompt += `Extract all structured data from this document text. First detect the document type and category, then extract all relevant fields into sections.\n\nDOCUMENT TEXT:\n${processedDoc.content}`;
  }

  return prompt;
}

// ============================================================
// GPT EXTRACTION
// ============================================================

export async function extractWithGPT(processedDoc, fileName = '') {
  console.log('=== GPT EXTRACT: Building messages ===');
  console.log('Input type:', processedDoc.type);
  console.log('Content length:', processedDoc.content?.length || 0);

  // Detect category from filename/content for better prompting
  const categoryHint = detectDocumentCategory(fileName, processedDoc.content || '');
  console.log('Detected category hint:', categoryHint);

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'user',
      content: processedDoc.type === 'image' ? [
        { type: 'text', text: buildUserPrompt(processedDoc, categoryHint) },
        {
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${processedDoc.content}`, detail: 'low' }
        }
      ] : buildUserPrompt(processedDoc, categoryHint)
    }
  ];

  console.log('=== GPT EXTRACT: Calling OpenAI ===');
  const startTime = Date.now();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    response_format: { type: 'json_object' },
    max_tokens: 2048,
    temperature: 0
  });

  const duration = Date.now() - startTime;
  console.log('=== GPT EXTRACT: Response in', duration, 'ms ===');
  console.log('Tokens - prompt:', response.usage?.prompt_tokens, 'completion:', response.usage?.completion_tokens);

  const content = response.choices[0].message.content;
  console.log('Raw content length:', content?.length);

  if (!content) throw new Error('Empty GPT response');

  try {
    const parsed = JSON.parse(content);
    console.log('=== GPT EXTRACT: Parsed ===');
    console.log('Doc type:', parsed.document_type);
    console.log('Category:', parsed.document_category);
    console.log('Issuer:', parsed.issuer?.name);
    console.log('Total:', parsed.total_amount);
    console.log('Line items:', parsed.line_items?.length || 0);
    console.log('Items:', parsed.items?.length || 0);
    console.log('Transactions:', parsed.transactions?.length || 0);
    console.log('Sections:', parsed.sections?.map(s => s.section_type).join(', '));
    return parsed;
  } catch (err) {
    console.error('JSON parse failed:', err.message);
    throw new Error('GPT returned invalid JSON');
  }
}

// ============================================================
// NORMALIZATION — Converts GPT output to FlexibleDocumentSchema
// ============================================================

export function normalizeExtraction(data = {}) {
  const isNewFormat = data.sections !== undefined || data.issuer !== undefined;

  if (!isNewFormat) {
    return normalizeLegacyFormat(data);
  }

  return normalizeFlexibleFormat(data);
}

// ============================================================
// TEXT-TO-ARRAY PARSING HELPERS
// ============================================================

function parseLineItemsFromText(text) {
  if (!text) return [];
  const lines = text.split('\n').filter(l => l.trim());
  const items = [];

  for (const line of lines) {
    // Pattern: "Description | Qty | Unit Price | Total" or tabular
    const pipeMatch = line.match(/^([^|]+)\|\s*(\d+)\s*\|\s*[$₦€£]?([\d,.]+)\s*\|\s*[$₦€£]?([\d,.]+)/);
    if (pipeMatch) {
      items.push({
        description: pipeMatch[1].trim(),
        quantity: parseInt(pipeMatch[2]) || 1,
        unit_price: parseFloat(pipeMatch[3].replace(/,/g, '')) || null,
        total: parseFloat(pipeMatch[4].replace(/,/g, '')) || null,
        sku: null,
        category: null,
        tax_amount: 0
      });
      continue;
    }

    // Pattern: "1. Product Name $10.00" or "Product Name - $10.00"
    const simpleMatch = line.match(/^(?:\d+\.?\s*)?(.+?)[\s\-–]+[$₦€£]?([\d,.]+)(?:\s*each|\s*ea)?/i);
    if (simpleMatch && line.length > 5) {
      items.push({
        description: simpleMatch[1].trim(),
        quantity: 1,
        unit_price: parseFloat(simpleMatch[2].replace(/,/g, '')) || null,
        total: parseFloat(simpleMatch[2].replace(/,/g, '')) || null,
        sku: null,
        category: null,
        tax_amount: 0
      });
    }
  }

  return items;
}

function parseTransactionsFromText(text) {
  if (!text) return [];
  const lines = text.split('\n').filter(l => l.trim());
  const transactions = [];

  for (const line of lines) {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 3) {
      const dateMatch = parts.find(p => /^\d{4}-\d{2}-\d{2}$/.test(p));
      const descPart = parts.find(p => p.length > 3 && !/^\d{4}-\d{2}-\d{2}$/.test(p) && !/^[$₦€£]?[\d,.]+$/.test(p));
      const numParts = parts.filter(p => /^[$₦€£]?[\d,.]+$/.test(p)).map(p => parseFloat(p.replace(/[$₦€£,]/g, '')));

      transactions.push({
        date: dateMatch || null,
        description: descPart || '',
        reference: null,
        transaction_type: null,
        debit: numParts.length > 1 ? numParts[0] : null,
        credit: numParts.length > 2 ? numParts[1] : null,
        balance: numParts.length > 0 ? numParts[numParts.length - 1] : null,
        category: null
      });
    }
  }

  return transactions;
}

function parseReceiptItemsFromText(text) {
  const lineItems = parseLineItemsFromText(text);
  if (lineItems.length > 0) {
    return lineItems.map(li => ({
      description: li.description,
      quantity: li.quantity,
      price: li.unit_price,
      total: li.total
    }));
  }
  return [];
}

// ============================================================
// MAIN NORMALIZATION
// ============================================================

function normalizeFlexibleFormat(data) {
  const cleanString = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') {
      const t = val.trim();
      return t.length ? t : null;
    }
    if (typeof val === 'number') return String(val);
    return null;
  };

  const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    if (typeof val === 'string' && ['UNKNOWN', 'unknown', 'Uncategorized'].includes(val)) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    if (typeof val === 'object' && !Array.isArray(val)) {
      const values = Object.values(val);
      if (values.length === 0 || values.every(v => v === null || v === undefined || v === '')) return false;
    }
    return true;
  };

  const isPlaceholder = (val) => {
    if (typeof val !== 'string') return false;
    const normalized = val.trim().toLowerCase();
    const placeholders = [
      'vendor name', 'company name', 'buyer name', 'customer name',
      'supplier name', 'counterparty name', 'your company', 'company',
      'vendor', 'supplier', 'client', 'customer', 'name',
      'not applicable', 'n/a', 'tbd', 'to be determined',
      'placeholder', 'example', 'sample', 'test', 'demo',
      'unknown vendor', 'unknown company', 'full name',
      'enter name', 'your name here'
    ];
    return placeholders.includes(normalized) || /^\[.*\]$/.test(val.trim());
  };

  const cleanStringStrict = (val) => {
    const s = cleanString(val);
    return isPlaceholder(s) ? null : s;
  };

  const coerceToNumber = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
      if (/^\d{1,2}:\d{2}/.test(value)) return fallback;
      if (/[a-zA-Z]/.test(value) && !/^[₦,$€£\s\d.,-]+$/.test(value)) return fallback;
      const cleaned = value.replace(/[₦,$€£\s,%]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  };

  const normalizePeriod = (period) => {
    if (!period || typeof period !== 'object') return { from: null, to: null };
    return {
      from: cleanString(period.from),
      to: cleanString(period.to)
    };
  };

  // Normalize sections
  const sections = Array.isArray(data.sections)
    ? data.sections.map(section => ({
        section_type: cleanString(section.section_type) || 'general',
        section_title: cleanString(section.section_title) || '',
        fields: Object.entries(section.fields || {}).reduce((acc, [key, val]) => {
          const cleanKey = cleanString(key);
          if (cleanKey) {
            let cleanVal = val;
            if (typeof val === 'string') {
              const numVal = coerceToNumber(val, null);
              cleanVal = numVal !== null ? numVal : cleanStringStrict(val);
            }
            acc[cleanKey] = cleanVal;
          }
          return acc;
        }, {}),
        items: Array.isArray(section.items)
          ? section.items.map(item => {
              if (typeof item === 'object' && item !== null) {
                return Object.entries(item).reduce((acc, [k, v]) => {
                  const ck = cleanString(k);
                  if (ck) {
                    let cv = v;
                    if (typeof v === 'string') {
                      const nv = coerceToNumber(v, null);
                      cv = nv !== null ? nv : cleanStringStrict(v);
                    }
                    acc[ck] = cv;
                  }
                  return acc;
                }, {});
              }
              return { value: item };
            })
          : [],
        text: cleanString(section.text) || ''
      }))
    : [];

  // Normalize specific_fields
  const specificFields = Object.entries(data.specific_fields || {}).reduce((acc, [key, val]) => {
    const cleanKey = cleanString(key);
    if (cleanKey) acc[cleanKey] = val;
    return acc;
  }, {});

  // Build issuer
  const issuer = data.issuer || {};
  const recipient = data.recipient || {};

  // === LEGACY FIELD HOISTING (only for legacy types) ===
  const isLegacy = ['invoice', 'receipt', 'bank-statement', 'utility-bill', 'purchase-order', 'contract'].includes(cleanString(data.document_type));

  if (isLegacy && sections.length > 0) {
    const sectionFields = {};
    sections.forEach(section => {
      Object.entries(section.fields || {}).forEach(([key, val]) => {
        if (hasValue(val)) sectionFields[key] = val;
      });
    });

    const text = sections.map(s => s.text || '').join('\n');

    if (!hasValue(data.vendor_name) && sectionFields.vendor_name) data.vendor_name = sectionFields.vendor_name;
    if (!hasValue(data.vendor_name) && sectionFields.company_name) data.vendor_name = sectionFields.company_name;

    if (!hasValue(data.invoice_number) && sectionFields.invoice_number) data.invoice_number = sectionFields.invoice_number;
    if (!hasValue(data.invoice_number) && sectionFields.receipt_number) data.invoice_number = sectionFields.receipt_number;

    if (!hasValue(data.invoice_date) && sectionFields.invoice_date) data.invoice_date = sectionFields.invoice_date;
    if (!hasValue(data.invoice_date) && sectionFields.date) data.invoice_date = sectionFields.date;

    if (!hasValue(data.due_date) && sectionFields.due_date) data.due_date = sectionFields.due_date;

    if (!hasValue(data.total_amount) && sectionFields.total_amount != null) data.total_amount = sectionFields.total_amount;
    if (!hasValue(data.amount_due) && sectionFields.amount_due != null) data.amount_due = sectionFields.amount_due;
    if (!hasValue(data.amount_due) && sectionFields.amount != null) data.amount_due = sectionFields.amount;
    if (!hasValue(data.amount_due) && sectionFields['Amount Due'] != null) data.amount_due = sectionFields['Amount Due'];
    if (!hasValue(data.total_amount) && sectionFields.amount != null) data.total_amount = sectionFields.amount;

    if (!hasValue(data.account_number) && sectionFields.account_number) data.account_number = sectionFields.account_number;

    if (!hasValue(data.closing_balance) && sectionFields.closing_balance != null) data.closing_balance = sectionFields.closing_balance;
    if (!hasValue(data.opening_balance) && sectionFields.opening_balance != null) data.opening_balance = sectionFields.opening_balance;

    if (!hasValue(data.po_number) && sectionFields.po_number) data.po_number = sectionFields.po_number;
    if (!hasValue(data.po_number) && sectionFields['PO Number']) data.po_number = sectionFields['PO Number'];
    if (!hasValue(data.po_number) && sectionFields['P.O. Number']) data.po_number = sectionFields['P.O. Number'];

    // Extract from text patterns as last resort
    if (!hasValue(data.vendor_name)) {
      const vendorMatch = text.match(/(?:from|vendor|seller|merchant|store|company)[:\s]+([^\n,]+)/i);
      if (vendorMatch) data.vendor_name = vendorMatch[1].trim();
    }
    if (!hasValue(data.total_amount) && typeof data.total_amount !== 'number') {
      const amountMatch = text.match(/(?:total|amount|sum)[:\s]+[$₦€£]?([\d,]+\.?\d*)/i);
      if (amountMatch) data.total_amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
  }

  // === LINE ITEMS EXTRACTION ===
  let lineItems = [];
  if (Array.isArray(data.line_items) && data.line_items.length > 0) {
    lineItems = data.line_items.map((item, index) => ({
      description: cleanStringStrict(item?.description) || `Item ${index + 1}`,
      quantity: coerceToNumber(item?.quantity, 1),
      unit_price: coerceToNumber(item?.unit_price, null),
      total: coerceToNumber(item?.total, null),
      sku: cleanStringStrict(item?.sku),
      category: cleanStringStrict(item?.category),
      tax_amount: coerceToNumber(item?.tax_amount, 0)
    }));
  } else if (isLegacy && sections.length > 0) {
    // Try to extract from section text
    for (const section of sections) {
      const textItems = parseLineItemsFromText(section.text);
      if (textItems.length > 0) {
        lineItems = textItems;
        break;
      }
      // Also check section.items
      if (section.items?.length > 0) {
        lineItems = section.items.map((item, index) => ({
          description: cleanStringStrict(item?.description) || `Item ${index + 1}`,
          quantity: coerceToNumber(item?.quantity, 1),
          unit_price: coerceToNumber(item?.unit_price || item?.price, null),
          total: coerceToNumber(item?.total, null),
          sku: cleanStringStrict(item?.sku),
          category: cleanStringStrict(item?.category),
          tax_amount: coerceToNumber(item?.tax_amount, 0)
        }));
        break;
      }
    }
  }

  // === TRANSACTIONS EXTRACTION ===
  let transactions = [];
  if (Array.isArray(data.transactions) && data.transactions.length > 0) {
    transactions = data.transactions.map(t => ({
      date: cleanString(t?.date),
      description: cleanStringStrict(t?.description) || '',
      reference: cleanStringStrict(t?.reference),
      transaction_type: cleanStringStrict(t?.transaction_type),
      debit: coerceToNumber(t?.debit, null),
      credit: coerceToNumber(t?.credit, null),
      balance: coerceToNumber(t?.balance, null),
      category: cleanStringStrict(t?.category)
    }));
  } else if (isLegacy && sections.length > 0) {
    for (const section of sections) {
      const textTxns = parseTransactionsFromText(section.text);
      if (textTxns.length > 0) {
        transactions = textTxns;
        break;
      }
      if (section.items?.length > 0 && section.items.some(i => i.date || i.description)) {
        transactions = section.items.map(t => ({
          date: cleanString(t?.date),
          description: cleanStringStrict(t?.description) || '',
          reference: cleanStringStrict(t?.reference),
          transaction_type: cleanStringStrict(t?.transaction_type),
          debit: coerceToNumber(t?.debit || t?.amount, null),
          credit: coerceToNumber(t?.credit, null),
          balance: coerceToNumber(t?.balance, null),
          category: cleanStringStrict(t?.category)
        }));
        break;
      }
    }
  }

  // === RECEIPT ITEMS EXTRACTION ===
  let receiptItems = [];
  if (Array.isArray(data.items) && data.items.length > 0) {
    receiptItems = data.items.map((item, index) => ({
      description: cleanStringStrict(item?.description) || `Item ${index + 1}`,
      quantity: coerceToNumber(item?.quantity, 1),
      price: coerceToNumber(item?.price || item?.unit_price, null),
      total: coerceToNumber(item?.total, null)
    }));
  } else if (lineItems.length > 0) {
    receiptItems = lineItems.map(li => ({
      description: li.description,
      quantity: li.quantity,
      price: li.unit_price,
      total: li.total
    }));
  } else if (isLegacy && sections.length > 0) {
    for (const section of sections) {
      const textItems = parseReceiptItemsFromText(section.text);
      if (textItems.length > 0) {
        receiptItems = textItems;
        break;
      }
    }
  }

  // === CLEAN GARBAGE RECEIPT ITEMS ===
  receiptItems = receiptItems.filter(item => {
    const desc = (item.description || '').trim().toLowerCase();
    if (desc === 'receipt #' || desc === 'amount:' || desc === 'total:' || desc === 'subtotal:') return false;
    if (desc === 'receipt' || desc === 'amount' || desc === 'total') return false;
    if (desc.startsWith('receipt #')) return false;
    if (item.price === 1 && item.total === 1 && desc.length < 10) return false;
    return true;
  });

  return {
    document_type: cleanString(data.document_type) || 'unknown',
    document_subtype: cleanString(data.document_subtype) || null,
    document_category: cleanString(data.document_category) || 'other',

    issuer: {
      name: cleanStringStrict(issuer.name || data.vendor_name),
      address: cleanStringStrict(issuer.address || data.vendor_address),
      tax_id: cleanStringStrict(issuer.tax_id || data.vendor_tax_id),
      email: cleanStringStrict(issuer.email || data.vendor_email),
      phone: cleanStringStrict(issuer.phone || data.vendor_phone),
      website: cleanStringStrict(issuer.website || data.vendor_website),
      registration_number: cleanStringStrict(issuer.registration_number || data.vendor_registration_number),
      id_number: cleanStringStrict(issuer.id_number) || null
    },

    recipient: {
      name: cleanStringStrict(recipient.name || data.buyer_name || data.counterparty || data.employee_name || data.patient_name || data.student_name),
      address: cleanStringStrict(recipient.address || data.buyer_address),
      tax_id: cleanStringStrict(recipient.tax_id || data.buyer_tax_id),
      email: cleanStringStrict(recipient.email || data.buyer_email),
      id_number: cleanStringStrict(recipient.id_number) || null,
      date_of_birth: cleanString(recipient.date_of_birth) || null
    },

    issue_date: normalizeDate(data.issue_date || data.date || data.invoice_date || data.effective_date),
    effective_date: normalizeDate(data.effective_date),
    expiry_date: normalizeDate(data.expiration_date || data.expiry_date),

    total_amount: coerceToNumber(data.total_amount, null),
    currency: cleanString(data.currency) || 'USD',
    tax_amount: coerceToNumber(data.tax_amount, 0),

    sections,
    specific_fields: specificFields,

    vendor_name: cleanStringStrict(data.vendor_name),
    vendor_address: cleanStringStrict(data.vendor_address),
    vendor_tax_id: cleanStringStrict(data.vendor_tax_id),
    vendor_email: cleanStringStrict(data.vendor_email),
    vendor_phone: cleanStringStrict(data.vendor_phone),
    vendor_website: cleanStringStrict(data.vendor_website),
    vendor_registration_number: cleanStringStrict(data.vendor_registration_number),

    date: cleanString(data.date),
    notes: cleanString(data.notes),
    document_source: cleanString(data.document_source),
    document_id: cleanString(data.document_id),
    document_title: cleanString(data.document_title),
    created_date: cleanString(data.created_date),
    updated_date: cleanString(data.updated_date),
    country: cleanString(data.country),
    state: cleanString(data.state),
    language: cleanString(data.language),

    invoice_number: cleanStringStrict(data.invoice_number) || cleanStringStrict(data.reference_number),
    reference_number: cleanStringStrict(data.reference_number),
    po_number: cleanStringStrict(data.po_number),
    buyer_name: cleanStringStrict(data.buyer_name),
    buyer_address: cleanStringStrict(data.buyer_address),
    buyer_tax_id: cleanStringStrict(data.buyer_tax_id),
    buyer_email: cleanStringStrict(data.buyer_email),
    invoice_date: cleanString(data.invoice_date),
    due_date: cleanString(data.due_date),
    payment_date: cleanString(data.payment_date),

    line_items: lineItems,
    subtotal: coerceToNumber(data.subtotal, null),
    discount_amount: coerceToNumber(data.discount_amount, 0),
    tax_details: Array.isArray(data.tax_details)
      ? data.tax_details.map(t => ({
          type: cleanStringStrict(t?.type) || 'Unknown',
          rate: coerceToNumber(t?.rate, null),
          amount: coerceToNumber(t?.amount, 0)
        }))
      : [],
    shipping_amount: coerceToNumber(data.shipping_amount, 0),
    amount_due: coerceToNumber(data.amount_due, null),
    amount_paid: coerceToNumber(data.amount_paid, 0),

    payment_status: pickStatus(data.payment_status, ['PAID', 'UNPAID', 'PARTIAL', 'OVERDUE']),
    payment_method: cleanStringStrict(data.payment_method),
    payment_terms: cleanStringStrict(data.payment_terms),
    purchase_order_reference: cleanStringStrict(data.purchase_order_reference),
    service_period: normalizePeriod(data.service_period),
    late_fee: coerceToNumber(data.late_fee, null),
    invoice_status: pickStatus(data.invoice_status, ['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE']),

    receipt_number: cleanStringStrict(data.receipt_number),
    items: receiptItems,
    change_given: coerceToNumber(data.change_given, 0),
    cashier_name: cleanStringStrict(data.cashier_name),
    store_location: cleanStringStrict(data.store_location),
    terminal_id: cleanStringStrict(data.terminal_id),

    account_number: cleanStringStrict(data.account_number),
    statement_period: normalizePeriod(data.statement_period),
    opening_balance: coerceToNumber(data.opening_balance, null),
    closing_balance: coerceToNumber(data.closing_balance, null),
    transactions: transactions,
    account_name: cleanStringStrict(data.account_name),
    bank_name: cleanStringStrict(data.bank_name),
    branch_name: cleanStringStrict(data.branch_name),
    routing_number: cleanStringStrict(data.routing_number),
    swift_code: cleanStringStrict(data.swift_code),
    iban: cleanStringStrict(data.iban),
    account_type: cleanStringStrict(data.account_type),

    bill_number: cleanStringStrict(data.bill_number),
    usage_amount: data.usage_amount !== undefined ? data.usage_amount : null,
    usage_period: normalizePeriod(data.usage_period),
    previous_balance: coerceToNumber(data.previous_balance, 0),
    current_charges: coerceToNumber(data.current_charges, 0),
    meter_number: cleanStringStrict(data.meter_number),
    customer_number: cleanStringStrict(data.customer_number),
    tariff_plan: cleanStringStrict(data.tariff_plan),
    units_consumed: coerceToNumber(data.units_consumed, null),

    order_date: cleanString(data.order_date),
    delivery_date: cleanString(data.delivery_date),
    ship_to: cleanStringStrict(data.ship_to),
    buyer_company: cleanStringStrict(data.buyer_company),
    supplier_name: cleanStringStrict(data.supplier_name),
    supplier_contact: cleanStringStrict(data.supplier_contact),
    expected_total: coerceToNumber(data.expected_total, null),

    contract_number: cleanStringStrict(data.contract_number),
    contract_type: cleanStringStrict(data.contract_type),
    counterparty: cleanStringStrict(data.counterparty),
    contract_value: coerceToNumber(data.contract_value, null),
    renewal_date: cleanString(data.renewal_date),

    category: mapGptCategory(cleanStringStrict(data.category)) || 'Uncategorized',

    _schema_version: 'v7-flexible',
    _source: {
      aws: false,
      gpt: true
    }
  };
}

function normalizeLegacyFormat(data) {
  const normalized = normalizeFlexibleFormat(data);
  return {
    ...normalized,
    vendor_name: normalized.vendor_name || normalized.issuer?.name,
    buyer_name: normalized.buyer_name || normalized.recipient?.name,
    date: normalized.date || normalized.issue_date
  };
}

function normalizeDate(val) {
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
}

function pickStatus(val, validValues) {
  const s = (val || '').toString().trim().toUpperCase();
  return validValues.includes(s) ? s : null;
}

function mapGptCategory(category) {
  if (!category) return 'Uncategorized';
  const map = {
    'financial': 'Banking & Finance',
    'legal': 'Professional Services',
    'hr': 'Professional Services',
    'healthcare': 'Insurance',
    'insurance': 'Insurance',
    'logistics': 'Shipping & Logistics',
    'real_estate': 'Rent & Facilities',
    'education': 'Professional Services',
    'government': 'Taxes & Government',
    'other': 'Uncategorized'
  };
  const lower = category.toLowerCase();
  return map[lower] || category;
}

export async function refineWithGPT(awsExtractedData, documentType) {
  const prompt = `Document Type: ${documentType}\nRaw AWS Textract Data:\n${JSON.stringify(awsExtractedData, null, 2)}\n\nClean up this data into the new flexible format with sections, issuer, recipient, and document_category. Return strict JSON.`;
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: buildSystemPrompt() }, { role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 2048,
    temperature: 0
  });
  return JSON.parse(response.choices[0].message.content);
}
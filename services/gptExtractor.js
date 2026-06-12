
const SYSTEM_PROMPT = `
You are a precise financial document data extractor. Extract ONLY what is visible.

REQUIRED JSON OUTPUT:
{
  "invoice_number": "string or null",
  "vendor_name": "string or null",
  "vendor_address": "string or null",
  "vendor_tax_id": "string or null",
  "buyer_name": "string or null",
  "buyer_address": "string or null",
  "buyer_tax_id": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "payment_date": "YYYY-MM-DD or null",
  "line_items": [{"description": "string", "quantity": number, "unit_price": number, "total": number}],
  "subtotal": number or null,
  "tax_amount": number,
  "total_amount": number or null,
  "amount_due": number or null,
  "amount_paid": number or null,
  "currency": "3-letter code",
  "payment_status": "PAID, UNPAID, PARTIAL, OVERDUE, UNKNOWN",
  "payment_method": "string or null",
  "payment_terms": "string or null",
  "category": "actual category name",
  "tax_details": [{"type": "string", "rate": number, "amount": number}],
  "notes": "string or null"
}

RULES:
1. Amounts: NUMBERS only, no symbols. $608.35 → 608.35
2. Dates: ISO 8601 format
3. If field not visible → null
4. line_items must always exist (empty array if none)
5. tax_amount: 0 if not found
6. currency: detect from $, €, £, ₦ symbols or text
7. category: infer from vendor name and description
`;

// ============================================
// FUNCTION 1: Full extraction from image/text
// Used ONLY when AWS Textract fails
// ============================================
export async function extractWithGPT(processedDoc) {
  let messages;

  if (processedDoc.type === 'image') {
    messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract structured invoice data from this document image. Return ONLY valid JSON matching the schema. Infer category from vendor name and line item descriptions.`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${processedDoc.content}`,
              detail: 'high'
            }
          }
        ]
      }
    ];
  } else {
    messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extract all invoice data from this text. Return strict JSON.\n\nDOCUMENT TEXT:\n${processedDoc.content}`
      }
    ];
  }

  console.log('GPT INPUT TYPE:', processedDoc.type);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    response_format: { type: 'json_object' },
    max_tokens: 4096,
    temperature: 0
  });

  const content = response.choices[0].message.content;

  if (!content) {
    throw new Error('Empty GPT response');
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error('GPT returned invalid JSON');
  }
}

// ============================================
// FUNCTION 2: Refine AWS output (OPTIONAL)
// Used when AWS succeeds but needs cleanup
// ============================================
export async function refineWithGPT(awsExtractedData, documentType) {
  const prompt = `
Document Type: ${documentType}
Raw AWS Textract Data:
${JSON.stringify(awsExtractedData, null, 2)}

Clean up this data:
1. Fix OCR typos in names and addresses
2. Standardize dates to YYYY-MM-DD
3. Ensure amounts are proper numbers
4. Infer category from vendor/description
5. Detect payment status

Return strict JSON with the same schema.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4096,
    temperature: 0
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    throw new Error('GPT refinement failed');
  }
}

// ============================================
// FUNCTION 3: Normalize GPT nested output to flat schema
// Handles both nested (vendor.name) and flat (vendor_name) formats
// ============================================
export function normalizeExtraction(data = {}) {
  const vendor = data.vendor || {};
  const customer = data.customer || {};
  const dates = data.dates || {};
  const financials = data.financials || {};
  const payment = data.payment || {};

  const safeString = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed.length ? trimmed : null;
    }
    if (typeof val === 'number') return String(val);
    return null;
  };

  const coerceToNumber = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[₦,$€£\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  };

  const lineItems = Array.isArray(data.line_items)
    ? data.line_items.map((item, index) => ({
        description: typeof item?.description === 'string'
          ? item.description
          : `Item ${index + 1}`,
        quantity: coerceToNumber(item?.quantity, 1),
        unit_price: coerceToNumber(item?.unit_price, null),
        total: coerceToNumber(item?.total, null),
        sku: safeString(item?.sku) || null,
        category: safeString(item?.category) || null,
        tax_amount: coerceToNumber(item?.tax_amount, 0)
      }))
    : [];

  // Handle both nested and flat formats
  const subtotal = coerceToNumber(
    financials.subtotal ?? data.subtotal,
    null
  );

  const total = coerceToNumber(
    financials.total ?? data.total_amount,
    null
  );

  return {
    // ================= CORE =================
    document_type: [
      'invoice',
      'receipt',
      'bank-statement',
      'contract',
      'utility-bill',
      'purchase-order'
    ].includes(data.document_type)
      ? data.document_type
      : 'invoice',

    invoice_number:
      safeString(data.invoice_number) ??
      safeString(data.reference_number),

    reference_number: safeString(data.reference_number),
    po_number: safeString(data.po_number),

    // ================= VENDOR =================
    vendor_name: safeString(vendor.name || data.vendor_name),
    vendor_address: safeString(vendor.address || data.vendor_address),
    vendor_tax_id: safeString(vendor.tax_id || data.vendor_tax_id),
    vendor_email: safeString(vendor.email || data.vendor_email),
    vendor_phone: safeString(vendor.phone || data.vendor_phone),

    // ================= CUSTOMER =================
    buyer_name: safeString(customer.name || data.buyer_name),
    buyer_address: safeString(customer.address || data.buyer_address),
    buyer_tax_id: safeString(customer.tax_id || data.buyer_tax_id),
    buyer_email: safeString(customer.email || data.buyer_email),

    // ================= DATES =================
    invoice_date: safeString(dates.issued || data.invoice_date),
    due_date: safeString(dates.due || data.due_date),
    payment_date: safeString(dates.paid || data.payment_date),

    // ================= FINANCIALS =================
    currency:
      typeof (financials.currency ?? data.currency) === 'string'
        ? (financials.currency ?? data.currency)
        : 'USD',

    subtotal: subtotal ?? null,
    tax_amount: coerceToNumber(financials.tax ?? data.tax_amount, 0),
    total_amount: total ?? null,
    amount_due: coerceToNumber(
      financials.amount_due ?? data.amount_due,
      null
    ),
    amount_paid: coerceToNumber(
      financials.amount_paid ?? data.amount_paid,
      0
    ),
    discount_amount: coerceToNumber(data.discount_amount, 0),
    shipping_amount: coerceToNumber(data.shipping_amount, 0),

    // ================= PAYMENT =================
    payment_status: ['PAID', 'UNPAID', 'PARTIAL', 'OVERDUE', 'UNKNOWN']
      .includes(payment.status || data.payment_status)
      ? (payment.status || data.payment_status)
      : 'UNKNOWN',

    payment_method: safeString(payment.method || data.payment_method),
    payment_terms: safeString(payment.terms || data.payment_terms),

    // ================= CLASSIFICATION =================
    category: safeString(data.category) || 'Uncategorized',

    // ================= STRUCTURE =================
    line_items: lineItems,
    tax_details: Array.isArray(data.tax_details) ? data.tax_details : [],
    notes: safeString(data.notes),

    _schema_version: 'v3'
  };
}
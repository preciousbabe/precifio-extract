import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a precise financial document data extractor. Extract ONLY what is physically printed on the document. NEVER calculate, infer, or guess values.

REQUIRED JSON OUTPUT — every field must be filled if visible on document:
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

CRITICAL EXTRACTION RULES:
1. **total_amount**: Scan the document for ANY of these labels: "Total", "Grand Total", "Amount Due", "Balance Due", "Total Amount", "Total Due". Extract the NUMBER next to it. Example: "TOTAL: ₦4,709,875.00" → total_amount MUST be 4709875.00
2. **amount_due**: Same as total_amount unless document shows separate "Amount Due" or "Balance". 
3. **subtotal**: Look for "Subtotal", "Sub-total", "Net Amount". Extract exactly.
4. **tax_amount**: Look for "Tax", "VAT", "GST". Extract the amount value. If rate shown (e.g. "VAT 7.5%"), include in tax_details.
5. Amounts: NUMBERS only, no currency symbols. ₦4,709,875.00 → 4709875.00
6. Dates: ISO 8601 (YYYY-MM-DD)
7. If a field is NOT on the document → null
8. line_items must always be an array (empty [] if none)
9. currency: NGN for ₦, USD for $, EUR for €, GBP for £
10. category: infer from vendor name + items
11. payment_status: UNKNOWN if not stated

EXAMPLE — if document shows:
Subtotal: ₦4,595,000.00
VAT (7.5%): ₦344,625.00
Discount (5%): -₦229,750.00
TOTAL: ₦4,709,875.00

Your output MUST be:
{
  "subtotal": 4595000.00,
  "tax_amount": 344625.00,
  "discount_amount": 229750.00,
  "total_amount": 4709875.00,
  "amount_due": 4709875.00,
  "currency": "NGN"
}

NEVER return null for total_amount if "Total" or "Amount Due" appears on the document.`;

export async function extractWithGPT(processedDoc) {
  let messages;

  console.log('=== GPT EXTRACT: Building messages ===');
  console.log('Input type:', processedDoc.type);
  console.log('Content length:', processedDoc.content?.length || 0);
  console.log('Content preview:', processedDoc.content?.substring(0, 300) || 'EMPTY');

  if (processedDoc.type === 'image') {
    messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract structured invoice data from this document image. ${processedDoc.textContent ? 'Additional extracted text: ' + processedDoc.textContent.substring(0, 2000) : ''} Return ONLY valid JSON matching the schema.`
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${processedDoc.content}`, detail: 'high' }
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

  console.log('=== GPT EXTRACT: Calling OpenAI ===');
  const startTime = Date.now();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    response_format: { type: 'json_object' },
    max_tokens: 4096,
    temperature: 0
  });

  const duration = Date.now() - startTime;
  console.log('=== GPT EXTRACT: Response in', duration, 'ms ===');
  console.log('Tokens - prompt:', response.usage?.prompt_tokens, 'completion:', response.usage?.completion_tokens);

  const content = response.choices[0].message.content;
  console.log('Raw content length:', content?.length);
  console.log('Raw content:', content);

  if (!content) throw new Error('Empty GPT response');

  try {
    const parsed = JSON.parse(content);
    console.log('=== GPT EXTRACT: Parsed ===');
    console.log('Invoice #:', parsed.invoice_number);
    console.log('Vendor:', parsed.vendor_name);
    console.log('Total:', parsed.total_amount);
    console.log('Line items:', parsed.line_items?.length);
    return parsed;
  } catch (err) {
    console.error('JSON parse failed:', err.message);
    throw new Error('GPT returned invalid JSON');
  }
}

export async function refineWithGPT(awsExtractedData, documentType) {
  const prompt = `Document Type: ${documentType}\nRaw AWS Textract Data:\n${JSON.stringify(awsExtractedData, null, 2)}\n\nClean up this data. Return strict JSON with the same schema.`;
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 4096,
    temperature: 0
  });
  return JSON.parse(response.choices[0].message.content);
}

export function normalizeExtraction(data = {}) {
  const vendor = data.vendor || {};
  const customer = data.customer || {};
  const dates = data.dates || {};
  const financials = data.financials || {};
  const payment = data.payment || {};

  const safeString = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') { const t = val.trim(); return t.length ? t : null; }
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
        description: typeof item?.description === 'string' ? item.description : `Item ${index + 1}`,
        quantity: coerceToNumber(item?.quantity, 1),
        unit_price: coerceToNumber(item?.unit_price, null),
        total: coerceToNumber(item?.total, null),
        sku: safeString(item?.sku) || null,
        category: safeString(item?.category) || null,
        tax_amount: coerceToNumber(item?.tax_amount, 0)
      }))
    : [];

  const subtotal = coerceToNumber(financials.subtotal ?? data.subtotal, null);
  const total = coerceToNumber(financials.total ?? data.total_amount, null);

  return {
    document_type: ['invoice', 'receipt', 'bank-statement', 'contract', 'utility-bill', 'purchase-order'].includes(data.document_type) ? data.document_type : 'invoice',
    invoice_number: safeString(data.invoice_number) ?? safeString(data.reference_number),
    reference_number: safeString(data.reference_number),
    po_number: safeString(data.po_number),
    vendor_name: safeString(vendor.name || data.vendor_name),
    vendor_address: safeString(vendor.address || data.vendor_address),
    vendor_tax_id: safeString(vendor.tax_id || data.vendor_tax_id),
    vendor_email: safeString(vendor.email || data.vendor_email),
    vendor_phone: safeString(vendor.phone || data.vendor_phone),
    buyer_name: safeString(customer.name || data.buyer_name),
    buyer_address: safeString(customer.address || data.buyer_address),
    buyer_tax_id: safeString(customer.tax_id || data.buyer_tax_id),
    buyer_email: safeString(customer.email || data.buyer_email),
    invoice_date: safeString(dates.issued || data.invoice_date),
    due_date: safeString(dates.due || data.due_date),
    payment_date: safeString(dates.paid || data.payment_date),
    currency: typeof (financials.currency ?? data.currency) === 'string' ? (financials.currency ?? data.currency) : 'USD',
    subtotal: subtotal ?? null,
    tax_amount: coerceToNumber(financials.tax ?? data.tax_amount, 0),
    total_amount: total ?? null,
    amount_due: coerceToNumber(financials.amount_due ?? data.amount_due, null),
    amount_paid: coerceToNumber(financials.amount_paid ?? data.amount_paid, 0),
    discount_amount: coerceToNumber(data.discount_amount, 0),
    shipping_amount: coerceToNumber(data.shipping_amount, 0),
    payment_status: ['PAID', 'UNPAID', 'PARTIAL', 'OVERDUE', 'UNKNOWN'].includes(payment.status || data.payment_status) ? (payment.status || data.payment_status) : 'UNKNOWN',
    payment_method: safeString(payment.method || data.payment_method),
    payment_terms: safeString(payment.terms || data.payment_terms),
    category: safeString(data.category) || 'Uncategorized',
    line_items: lineItems,
    tax_details: Array.isArray(data.tax_details) ? data.tax_details : [],
    notes: safeString(data.notes),
    _schema_version: 'v3'
  };
}
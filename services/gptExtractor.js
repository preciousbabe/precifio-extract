import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a precise financial document data extractor. First, detect the document type by analyzing its STRUCTURE and CONTENT, then extract ONLY the fields relevant to that document type.

STEP 1 — Detect Document Type (CRITICAL):
Analyze the document's structure, headers, and content patterns. Classify as ONE of:

- "invoice" — Contains: "Invoice" header, seller/buyer info, line items with quantities/prices, subtotal, tax, total due, payment terms, invoice number
- "receipt" — Contains: "Receipt" or "Thank you", store/vendor name, transaction details, payment method, items purchased, change given, "Paid" stamp
- "bank_statement" — Contains: "Statement", "Account Number", "Opening Balance", "Closing Balance", table of transactions (date, description, debit, credit, balance), bank name/logo
- "utility_bill" — Contains: "Bill" or "Invoice" from utility company, "Usage" or "kWh" or "Consumption", "Meter Number", "Account Number", "Due Date", charges breakdown, utility company name (e.g., City Power, Water Corp, Gas Co)
- "purchase_order" — Contains: "Purchase Order" or "PO", "Ship To", "Bill To", ordered items with quantities, unit prices, PO number, order date, delivery date, buyer/seller info
- "payment_voucher" — Contains: "Payment Voucher", "Approved By", payment amount, payee name, voucher number, approval signatures
- "delivery_note" — Contains: "Delivery Note", "Waybill", "Received by", delivered items list, delivery date, recipient signature
- "unknown" — Does not match any of the above patterns

STEP 2 — Extract fields based on detected type. ONLY include fields that are ACTUALLY PRESENT in the document. Use null for genuinely missing fields.

FOR ALL DOCUMENTS (common fields):
{
  "document_type": "detected type",
  "vendor_name": "string or null",
  "vendor_address": "string or null",
  "date": "YYYY-MM-DD or null",
  "currency": "3-letter code or null",
  "total_amount": number or null,
  "notes": "string or null",
  "category": "CATEGORIZE based on vendor/content: 'Office Supplies', 'Utilities', 'Professional Services', 'Travel & Entertainment', 'Software & Technology', 'Marketing & Advertising', 'Rent & Facilities', 'Insurance', 'Taxes & Government', 'Banking & Finance', 'Raw Materials', 'Equipment', 'Maintenance & Repairs', 'Telecommunications', 'Shipping & Logistics', 'Uncategorized'"
}

FOR INVOICE (add these):
{
  "invoice_number": "string or null",
  "buyer_name": "string or null",
  "buyer_address": "string or null",
  "due_date": "YYYY-MM-DD or null",
  "payment_terms": "string or null",
  "line_items": [{"description": "string", "quantity": number, "unit_price": number, "total": number}],
  "subtotal": number or null,
  "tax_amount": number,
  "amount_due": number or null,
  "amount_paid": number or null,
  "payment_status": "PAID, UNPAID, PARTIAL, OVERDUE, UNKNOWN"
}

FOR RECEIPT (add these):
{
  "receipt_number": "string or null",
  "payment_method": "string or null",
  "items": [{"description": "string", "quantity": number, "price": number, "total": number}],
  "tax_amount": number,
  "change_given": number or null
}

FOR BANK_STATEMENT (add these):
{
  "account_number": "string or null",
  "statement_period": {"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"},
  "opening_balance": number or null,
  "closing_balance": number or null,
  "transactions": [{"date": "YYYY-MM-DD", "description": "string", "debit": number, "credit": number, "balance": number}]
}

FOR UTILITY_BILL (add these):
{
  "bill_number": "string or null",
  "account_number": "string or null",
  "usage_amount": "string or number",
  "usage_period": {"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"},
  "due_date": "YYYY-MM-DD or null",
  "amount_due": number or null,
  "previous_balance": number or null,
  "current_charges": number or null
}

FOR PURCHASE_ORDER (add these):
{
  "po_number": "string or null",
  "buyer_name": "string or null",
  "ship_to": "string or null",
  "line_items": [{"description": "string", "quantity": number, "unit_price": number, "total": number}],
  "subtotal": number or null,
  "tax_amount": number,
  "order_date": "YYYY-MM-DD or null",
  "delivery_date": "YYYY-MM-DD or null"
}

CRITICAL RULES:
1. Document type detection is the MOST IMPORTANT step. Look at headers, logos, and structural patterns, not just keywords.
2. Only include fields that are RELEVANT to the detected document type
3. If a field is NOT on the document → null, never guess or fabricate
4. For amounts: numbers only, strip currency symbols. ₦4,709,875.00 → 4709875.00
5. Dates: ISO 8601 (YYYY-MM-DD)
6. currency: NGN for ₦, USD for $, EUR for €, GBP for £
7. line_items/items/transactions must always be arrays (empty [] if none)
8. NEVER calculate totals — extract what's printed
9. For category: analyze the vendor name and document content to assign the most appropriate business category`;


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
            text: `Extract structured financial document data from this image. ${processedDoc.textContent ? 'Additional extracted text: ' + processedDoc.textContent.substring(0, 2000) : ''} Return ONLY valid JSON matching the schema.`
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
        content: `Extract all financial document data from this text. First detect the document type, then extract only relevant fields. Return strict JSON.\n\nDOCUMENT TEXT:\n${processedDoc.content}`
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
    console.log('Doc type:', parsed.document_type);
    console.log('Vendor:', parsed.vendor_name);
    console.log('Total:', parsed.total_amount);
    console.log('Category:', parsed.category);
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

  // Detect document type from GPT response or fallback
  const typeMapping = {
    'invoice': 'invoice',
    'receipt': 'receipt',
    'bank_statement': 'bank-statement',
    'bank-statement': 'bank-statement',
    'utility_bill': 'utility-bill',
    'utility-bill': 'utility-bill',
    'purchase_order': 'purchase-order',
    'purchase-order': 'purchase-order',
    'payment_voucher': 'payment-voucher',
    'delivery_note': 'delivery-note',
    'contract': 'contract'
  };

  const detectedType = typeMapping[data.document_type] || 'unknown';

  // Normalize line items (invoice/purchase-order)
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

  // Normalize receipt items
  const receiptItems = Array.isArray(data.items)
    ? data.items.map((item, index) => ({
        description: typeof item?.description === 'string' ? item.description : `Item ${index + 1}`,
        quantity: coerceToNumber(item?.quantity, 1),
        price: coerceToNumber(item?.price || item?.unit_price, null),
        total: coerceToNumber(item?.total, null)
      }))
    : [];

  // Normalize transactions (bank statement)
  const transactions = Array.isArray(data.transactions)
    ? data.transactions.map(t => ({
        date: safeString(t?.date) || null,
        description: safeString(t?.description) || '',
        debit: coerceToNumber(t?.debit, 0),
        credit: coerceToNumber(t?.credit, 0),
        balance: coerceToNumber(t?.balance, null)
      }))
    : [];

  const subtotal = coerceToNumber(financials.subtotal ?? data.subtotal, null);
  const total = coerceToNumber(financials.total ?? data.total_amount, null);

  return {
    document_type: detectedType,

    // Common fields
    vendor_name: safeString(vendor.name || data.vendor_name),
    vendor_address: safeString(vendor.address || data.vendor_address),
    vendor_tax_id: safeString(vendor.tax_id || data.vendor_tax_id),
    vendor_email: safeString(vendor.email || data.vendor_email),
    vendor_phone: safeString(vendor.phone || data.vendor_phone),

    date: safeString(data.date || dates.issued || data.invoice_date),
    currency: typeof (financials.currency ?? data.currency) === 'string' ? (financials.currency ?? data.currency) : 'USD',
    total_amount: total ?? null,
    notes: safeString(data.notes),
    category: safeString(data.category) || 'Uncategorized',

    // Invoice fields
    invoice_number: safeString(data.invoice_number) ?? safeString(data.reference_number),
    reference_number: safeString(data.reference_number),
    po_number: safeString(data.po_number),

    buyer_name: safeString(customer.name || data.buyer_name),
    buyer_address: safeString(customer.address || data.buyer_address),
    buyer_tax_id: safeString(customer.tax_id || data.buyer_tax_id),
    buyer_email: safeString(customer.email || data.buyer_email),

    invoice_date: safeString(dates.issued || data.invoice_date),
    due_date: safeString(dates.due || data.due_date),
    payment_date: safeString(dates.paid || data.payment_date),

    line_items: lineItems,
    subtotal: subtotal ?? null,
    tax_amount: coerceToNumber(financials.tax ?? data.tax_amount, 0),
    tax_details: Array.isArray(data.tax_details) ? data.tax_details : [],
    shipping_amount: coerceToNumber(data.shipping_amount, 0),
    discount_amount: coerceToNumber(data.discount_amount, 0),
    amount_due: coerceToNumber(financials.amount_due ?? data.amount_due, null),
    amount_paid: coerceToNumber(financials.amount_paid ?? data.amount_paid, 0),

    payment_status: ['PAID', 'UNPAID', 'PARTIAL', 'OVERDUE', 'UNKNOWN'].includes(payment.status || data.payment_status) 
      ? (payment.status || data.payment_status) 
      : 'UNKNOWN',
    payment_method: safeString(payment.method || data.payment_method),
    payment_terms: safeString(payment.terms || data.payment_terms),

    // Receipt fields
    receipt_number: safeString(data.receipt_number),
    items: receiptItems,
    change_given: coerceToNumber(data.change_given, 0),

    // Bank statement fields
    account_number: safeString(data.account_number),
    statement_period: {
      from: safeString(data.statement_period?.from) || null,
      to: safeString(data.statement_period?.to) || null
    },
    opening_balance: coerceToNumber(data.opening_balance, null),
    closing_balance: coerceToNumber(data.closing_balance, null),
    transactions: transactions,

    // Utility bill fields
    bill_number: safeString(data.bill_number),
    usage_amount: data.usage_amount !== undefined ? data.usage_amount : null,
    usage_period: {
      from: safeString(data.usage_period?.from) || null,
      to: safeString(data.usage_period?.to) || null
    },
    previous_balance: coerceToNumber(data.previous_balance, 0),
    current_charges: coerceToNumber(data.current_charges, 0),

    // Purchase order fields
    order_date: safeString(data.order_date),
    delivery_date: safeString(data.delivery_date),
    ship_to: safeString(data.ship_to),

    _schema_version: 'v4'
  };
}
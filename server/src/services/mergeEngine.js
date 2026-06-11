export function mergeExtraction({ aws = null, gpt = null }) {
  // Normalize inputs
  aws = aws || {};
  gpt = gpt || {};

  const pick = (a, b) => {
    if (a !== null && a !== undefined && a !== '') return a;
    if (b !== null && b !== undefined && b !== '') return b;
    return null;
  };

  const pickNumber = (a, b) => {
    const isValid = (v) => typeof v === 'number' && !isNaN(v);
    if (isValid(a)) return a;
    if (isValid(b)) return b;
    return null;
  };

  const pickArray = (a, b) => {
    if (Array.isArray(a) && a.length) return a;
    if (Array.isArray(b) && b.length) return b;
    return [];
  };

  // -----------------------------
  // FIELD PRIORITY RULES
  // AWS > GPT for financials
  // GPT > AWS for text cleanup
  // -----------------------------

  return {
    // ================= CORE =================
    document_type: pick(aws.document_type, gpt.document_type) || 'invoice',
    invoice_number: pick(aws.invoice_number, gpt.invoice_number),
    reference_number: pick(aws.reference_number, gpt.reference_number),
    po_number: pick(aws.po_number, gpt.po_number),

    // ================= VENDOR =================
    vendor_name: pick(aws.vendor_name, gpt.vendor_name),
    vendor_address: pick(aws.vendor_address, gpt.vendor_address),
    vendor_tax_id: pick(aws.vendor_tax_id, gpt.vendor_tax_id),
    vendor_email: pick(aws.vendor_email, gpt.vendor_email),
    vendor_phone: pick(aws.vendor_phone, gpt.vendor_phone),

    // ================= CUSTOMER =================
    buyer_name: pick(aws.buyer_name, gpt.buyer_name),
    buyer_address: pick(aws.buyer_address, gpt.buyer_address),
    buyer_tax_id: pick(aws.buyer_tax_id, gpt.buyer_tax_id),
    buyer_email: pick(aws.buyer_email, gpt.buyer_email),

    // ================= DATES =================
    invoice_date: pick(aws.invoice_date, gpt.invoice_date),
    due_date: pick(aws.due_date, gpt.due_date),
    payment_date: pick(aws.payment_date, gpt.payment_date),

    // ================= FINANCIALS =================
    currency: pick(aws.currency, gpt.currency) || 'USD',

    subtotal: pickNumber(aws.subtotal, gpt.subtotal),
    tax_amount: pickNumber(aws.tax_amount, gpt.tax_amount) || 0,
    total_amount: pickNumber(aws.total_amount, gpt.total_amount),
    amount_due: pickNumber(aws.amount_due, gpt.amount_due),
    amount_paid: pickNumber(aws.amount_paid, gpt.amount_paid) || 0,
    discount_amount: pickNumber(aws.discount_amount, gpt.discount_amount) || 0,
    shipping_amount: pickNumber(aws.shipping_amount, gpt.shipping_amount) || 0,

    // ================= PAYMENT =================
    payment_status: pick(aws.payment_status, gpt.payment_status) || 'UNKNOWN',
    payment_method: pick(aws.payment_method, gpt.payment_method),
    payment_terms: pick(aws.payment_terms, gpt.payment_terms),

    // ================= STRUCTURE =================
    line_items: pickArray(aws.line_items, gpt.line_items),
    tax_details: pickArray(aws.tax_details, gpt.tax_details),

    // ================= CLASSIFICATION =================
    category: pick(aws.category, gpt.category) || 'Uncategorized',

    // ================= OTHER =================
    notes: pick(aws.notes, gpt.notes),

    // Keep original traces for debugging
    _source: {
      aws: Object.keys(aws).length > 0,
      gpt: Object.keys(gpt).length > 0
    }
  };
}
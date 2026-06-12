export function calculateConfidence(extracted = {}) {
  const lineItems = extracted.line_items || [];

  // -----------------------------
  // helpers
  // -----------------------------
  const exists = (v) => v !== null && v !== undefined && v !== '';
  const isNumber = (v) => typeof v === 'number' && !isNaN(v);

  const score = (checks) => {
    const passed = checks.filter(Boolean).length;
    return checks.length === 0 ? 0 : passed / checks.length;
  };

  // -----------------------------
  // FIELD COMPLETENESS SCORES
  // -----------------------------
  const invoice_number = score([
    exists(extracted.invoice_number),
  ]);

  const vendor_name = score([
    exists(extracted.vendor_name),
  ]);

  const total_amount = score([
    isNumber(extracted.total_amount),
    extracted.total_amount > 0,
  ]);

  const invoice_date = score([
    exists(extracted.invoice_date),
  ]);

  // -----------------------------
  // LINE ITEMS QUALITY
  // -----------------------------
  const line_items = score([
    Array.isArray(lineItems),
    lineItems.length > 0,
    lineItems.every(i =>
      exists(i.description) &&
      isNumber(i.quantity) &&
      (isNumber(i.unit_price) || isNumber(i.total))
    )
  ]);

  // -----------------------------
  // FINANCIAL CONSISTENCY
  // -----------------------------
  let financialConsistency = 1;

  if (
    isNumber(extracted.subtotal) &&
    isNumber(extracted.total_amount)
  ) {
    const calc =
      (extracted.subtotal || 0) +
      (extracted.tax_amount || 0) +
      (extracted.shipping_amount || 0) -
      (extracted.discount_amount || 0);

    const diff = Math.abs(calc - extracted.total_amount);

    financialConsistency = diff < 0.01 ? 1 : Math.max(0, 1 - diff / extracted.total_amount);
  }

  // -----------------------------
  // STRUCTURE QUALITY
  // -----------------------------
  const structure = score([
    Array.isArray(lineItems),
    typeof extracted === 'object',
    exists(extracted.currency),
  ]);

  // -----------------------------
  // FINAL WEIGHTED SCORE
  // -----------------------------
  const finalScore =
    (invoice_number * 0.15) +
    (vendor_name * 0.15) +
    (total_amount * 0.2) +
    (invoice_date * 0.1) +
    (line_items * 0.2) +
    (financialConsistency * 0.15) +
    (structure * 0.05);

  // -----------------------------
  // FIELD BREAKDOWN
  // -----------------------------
  return {
    overall: Math.round(finalScore * 100) / 100,

    breakdown: {
      invoice_number,
      vendor_name,
      total_amount,
      invoice_date,
      line_items,
      financialConsistency,
      structure,
    },

    flags: {
      low_confidence_fields: Object.entries({
        invoice_number,
        vendor_name,
        total_amount,
        invoice_date,
        line_items,
      })
        .filter(([_, v]) => v < 0.85)
        .map(([k]) => k)
    },

    status:
      finalScore >= 0.9
        ? 'HIGH'
        : finalScore >= 0.75
        ? 'MEDIUM'
        : 'LOW'
  };
}
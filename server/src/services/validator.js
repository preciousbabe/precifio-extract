export function validateExtraction(extracted) {
  const flags = [];

  // =====================
  // REQUIRED FIELD CHECKS
  // =====================
  if (!extracted.vendor_name) {
    flags.push({ type: 'MISSING', field: 'vendor_name', message: 'Vendor name not found' });
  }

  if (!extracted.total_amount || extracted.total_amount === 0) {
    flags.push({ type: 'MISSING', field: 'total_amount', message: 'Total amount not found' });
  }

  if (!extracted.invoice_date) {
    flags.push({ type: 'MISSING', field: 'invoice_date', message: 'Invoice date not found' });
  }

  if (!extracted.category || extracted.category === 'Uncategorized') {
    flags.push({
      type: 'MISSING',
      field: 'category',
      message: 'Category not found or defaulted to Uncategorized'
    });
  }

  // =====================
  // MATH VALIDATION (READ ONLY)
  // =====================
  if (
    extracted.subtotal != null &&
    extracted.total_amount != null &&
    extracted.total_amount > 0
  ) {
    const calculatedTotal =
      (extracted.subtotal || 0) +
      (extracted.tax_amount || 0) +
      (extracted.shipping_amount || 0) -
      (extracted.discount_amount || 0);

    if (Math.abs(calculatedTotal - extracted.total_amount) > 0.01) {
      flags.push({
        type: 'MATH_MISMATCH',
        field: 'total_amount',
        message: `Subtotal + Tax + Shipping - Discount (${calculatedTotal}) ≠ Total (${extracted.total_amount})`
      });
    }
  }

  // =====================
  // LINE ITEM VALIDATION
  // =====================
  const lineItems = extracted.line_items || [];

  const incompleteItems = lineItems.filter(
    item => !item.unit_price || !item.total
  );

  if (incompleteItems.length > 0) {
    flags.push({
      type: 'INCOMPLETE_LINE_ITEMS',
      count: incompleteItems.length,
      message: `${incompleteItems.length} line items missing price/total`
    });
  }

  // =====================
  // TAX STRUCTURE CHECK
  // =====================
  if (extracted.tax_amount > 0 && (!extracted.tax_details || extracted.tax_details.length === 0)) {
    flags.push({
      type: 'MISSING_TAX_DETAILS',
      message: 'Tax amount present but no tax details (rate, type)'
    });
  }

  // =====================
  // RESULT
  // =====================
  return {
    isValid: flags.length === 0,
    flags,
    requiresReview: flags.length > 0
  };
}
export function validateExtraction(extracted) {
  const flags = [];
  const docType = extracted.document_type || 'unknown';

  // =====================
  // INFORMATIONAL FLAGS (do NOT trigger review)
  // These note what was not found but don't require user action
  // =====================

  const informationalFlags = [];

  // Check expected fields per type — purely informational
  const expectedFields = {
    invoice: ['vendor_name', 'total_amount', 'invoice_date', 'line_items'],
    receipt: ['vendor_name', 'total_amount', 'date', 'items'],
    'bank-statement': ['account_number', 'closing_balance', 'transactions'],
    'utility-bill': ['vendor_name', 'amount_due', 'usage_amount'],
    'purchase-order': ['po_number', 'vendor_name', 'line_items'],
    unknown: ['vendor_name', 'total_amount']
  };

  const fieldsToCheck = expectedFields[docType] || expectedFields.unknown;

  for (const field of fieldsToCheck) {
    const value = extracted[field];
    const isNullish = value === null || value === undefined || value === '' || value === 0;
    const isEmptyArray = Array.isArray(value) && value.length === 0;

    if (isNullish || isEmptyArray) {
      // Skip fields that are genuinely not applicable
      if (docType === 'bank-statement' && field === 'vendor_name') continue;
      if (docType === 'utility-bill' && field === 'total_amount' && extracted.amount_due) continue;
      if (docType === 'purchase-order' && field === 'total_amount' && extracted.line_items?.length > 0) continue;

      informationalFlags.push({
        type: 'INFO',
        field,
        message: `${field.replace(/_/g, ' ')} not present in document`
      });
    }
  }

  // Category check — informational only
  if (extracted.category === 'Uncategorized' && extracted.vendor_name) {
    informationalFlags.push({
      type: 'INFO',
      field: 'category',
      message: 'Category could not be determined from document content'
    });
  }

  // =====================
  // WARNING FLAGS (may trigger review depending on severity)
  // =====================

  const warningFlags = [];

  // Math validation — only warn if both subtotal AND total are present
  if (
    extracted.subtotal != null &&
    extracted.total_amount != null &&
    extracted.total_amount > 0 &&
    ['invoice', 'purchase-order', 'receipt'].includes(docType)
  ) {
    const calculatedTotal =
      (extracted.subtotal || 0) +
      (extracted.tax_amount || 0) +
      (extracted.shipping_amount || 0) -
      (extracted.discount_amount || 0);

    const diff = Math.abs(calculatedTotal - extracted.total_amount);
    if (diff > 0.01) {
      const severity = diff / extracted.total_amount > 0.10 ? 'WARNING' : 'INFO';
      warningFlags.push({
        type: severity,
        field: 'total_amount',
        message: `Calculated total (${calculatedTotal.toFixed(2)}) differs from extracted total (${extracted.total_amount}) by ${diff.toFixed(2)}`
      });
    }
  }

  // Line item validation — only for docs that have line items
  if (['invoice', 'purchase-order'].includes(docType)) {
    const lineItems = extracted.line_items || [];

    if (lineItems.length > 0) {
      const incompleteItems = lineItems.filter(item => 
        !item.unit_price || !item.total || !item.description
      );

      if (incompleteItems.length > 0) {
        warningFlags.push({
          type: 'WARNING',
          field: 'line_items',
          message: `${incompleteItems.length} of ${lineItems.length} line items have missing data`
        });
      }
    }
  }

  // Tax details check
  if (
    ['invoice', 'receipt'].includes(docType) &&
    extracted.tax_amount > 0 &&
    (!extracted.tax_details || extracted.tax_details.length === 0)
  ) {
    warningFlags.push({
      type: 'INFO',
      field: 'tax_details',
      message: 'Tax amount present but no breakdown of tax rate/type'
    });
  }

  // Bank statement validation
  if (docType === 'bank-statement') {
    const txns = extracted.transactions || [];
    if (txns.length === 0 && (extracted.opening_balance || extracted.closing_balance)) {
      warningFlags.push({
        type: 'WARNING',
        field: 'transactions',
        message: 'Balances present but no transaction details extracted'
      });
    }
  }

  // =====================
  // DETERMINE REVIEW REQUIREMENT
  // =====================

  // Combine all flags
  const allFlags = [...informationalFlags, ...warningFlags];

  // Critical flags that ALWAYS require review
  const criticalTypes = ['CRITICAL', 'ERROR'];
  const hasCritical = allFlags.some(f => criticalTypes.includes(f.type));

  // Warning flags that require review only if severe
  const warningTypes = ['WARNING'];
  const hasSevereWarning = allFlags.some(f => warningTypes.includes(f.type));

  // Determine if review is needed
  // INFO flags alone NEVER trigger review
  const requiresReview = hasCritical || hasSevereWarning;

  return {
    isValid: !requiresReview,
    flags: allFlags,
    informationalFlags,
    warningFlags,
    requiresReview,
    severity: hasCritical ? 'CRITICAL' : hasSevereWarning ? 'WARNING' : 'INFO'
  };
}
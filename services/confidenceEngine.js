export function calculateConfidence(extracted = {}) {
  const docType = extracted.document_type || 'unknown';

  const exists = (v) => v !== null && v !== undefined && v !== '';
  const isNumber = (v) => typeof v === 'number' && !isNaN(v);
  const isMeaningfulArray = (arr) => Array.isArray(arr) && arr.length > 0;

  const score = (checks) => {
    const passed = checks.filter(Boolean).length;
    return checks.length === 0 ? 1 : passed / checks.length;
  };

  // Define ALL possible fields per document type with their weights
  // We only score fields that were ACTUALLY EXTRACTED (non-null)
  // Missing fields are simply ignored — not penalized
  const fieldDefinitions = {
    invoice: {
      invoice_number: 0.08,
      vendor_name: 0.12,
      buyer_name: 0.06,
      total_amount: 0.18,
      invoice_date: 0.08,
      due_date: 0.05,
      line_items: 0.20,
      subtotal: 0.08,
      tax_amount: 0.05,
      amount_due: 0.05,
      payment_status: 0.05
    },
    receipt: {
      vendor_name: 0.15,
      total_amount: 0.25,
      date: 0.10,
      items: 0.25,
      payment_method: 0.10,
      receipt_number: 0.08,
      tax_amount: 0.07
    },
    'bank-statement': {
      account_number: 0.10,
      statement_period: 0.08,
      opening_balance: 0.12,
      closing_balance: 0.15,
      transactions: 0.40,
      date: 0.05
    },
    'utility-bill': {
      vendor_name: 0.10,
      bill_number: 0.08,
      account_number: 0.08,
      amount_due: 0.20,
      usage_amount: 0.12,
      date: 0.10,
      due_date: 0.10,
      previous_balance: 0.10,
      current_charges: 0.12
    },
    'purchase-order': {
      po_number: 0.12,
      vendor_name: 0.12,
      buyer_name: 0.08,
      total_amount: 0.15,
      line_items: 0.30,
      order_date: 0.10,
      delivery_date: 0.08,
      ship_to: 0.05
    },
    'payment-voucher': {
      vendor_name: 0.15,
      total_amount: 0.30,
      date: 0.15,
      payment_method: 0.15,
      structure: 0.10,
      notes: 0.15
    },
    'delivery-note': {
      vendor_name: 0.15,
      date: 0.15,
      line_items: 0.30,
      total_amount: 0.10,
      ship_to: 0.15,
      structure: 0.15
    },
    unknown: {
      vendor_name: 0.25,
      total_amount: 0.25,
      date: 0.20,
      structure: 0.30
    }
  };

  const weights = fieldDefinitions[docType] || fieldDefinitions.unknown;
  const scores = {};
  let totalWeight = 0;
  let weightedScore = 0;
  let extractedFieldCount = 0;
  let lowConfidenceExtractedFields = [];

  // Helper to check if a field was actually extracted
  const wasExtracted = (field) => {
    const val = extracted[field];
    if (val === null || val === undefined || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    if (typeof val === 'object' && Object.keys(val).length === 0) return false;
    return true;
  };

  // Calculate scores ONLY for extracted fields
  for (const [field, weight] of Object.entries(weights)) {
    let fieldScore = 0;
    let wasFound = false;

    // Check if field exists in extraction
    if (!wasExtracted(field)) {
      // Field not extracted — skip entirely, don't penalize
      continue;
    }

    wasFound = true;
    extractedFieldCount++;

    // Calculate score based on field type
    switch (field) {
      case 'invoice_number':
      case 'receipt_number':
      case 'bill_number':
      case 'po_number':
      case 'account_number':
      case 'vendor_name':
      case 'buyer_name':
      case 'ship_to':
      case 'payment_method':
      case 'payment_status':
      case 'payment_terms':
      case 'date':
      case 'invoice_date':
      case 'due_date':
      case 'order_date':
      case 'delivery_date':
        fieldScore = score([exists(extracted[field])]);
        break;

      case 'total_amount':
      case 'amount_due':
      case 'opening_balance':
      case 'closing_balance':
      case 'previous_balance':
      case 'current_charges':
      case 'subtotal':
      case 'tax_amount':
      case 'change_given':
        fieldScore = score([isNumber(extracted[field]), extracted[field] >= 0]);
        break;

      case 'line_items':
        const li = extracted.line_items || [];
        fieldScore = score([
          isMeaningfulArray(li),
          li.every(i => exists(i.description)),
          li.every(i => isNumber(i.quantity) || isNumber(i.total))
        ]);
        break;

      case 'items':
        const items = extracted.items || [];
        fieldScore = score([
          isMeaningfulArray(items),
          items.every(i => exists(i.description)),
          items.every(i => isNumber(i.price) || isNumber(i.total))
        ]);
        break;

      case 'transactions':
        const txns = extracted.transactions || [];
        fieldScore = score([
          isMeaningfulArray(txns),
          txns.every(t => exists(t.date) || exists(t.description)),
          txns.every(t => isNumber(t.debit) || isNumber(t.credit))
        ]);
        break;

      case 'statement_period':
        fieldScore = score([
          exists(extracted.statement_period?.from),
          exists(extracted.statement_period?.to)
        ]);
        break;

      case 'usage_amount':
        fieldScore = score([exists(extracted.usage_amount)]);
        break;

      case 'structure':
        fieldScore = score([
          typeof extracted === 'object',
          exists(extracted.document_type)
        ]);
        break;

      default:
        fieldScore = score([exists(extracted[field])]);
    }

    scores[field] = fieldScore;
    weightedScore += fieldScore * weight;
    totalWeight += weight;

    if (fieldScore < 0.5) {
      lowConfidenceExtractedFields.push(field);
    }
  }

  // Calculate final score based ONLY on extracted fields
  const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // Determine status
  const status = finalScore >= 0.80 ? 'HIGH' : finalScore >= 0.50 ? 'MEDIUM' : 'LOW';

  // Determine if review is required
  // CRITICAL RULE: Review only if:
  // 1. We extracted fewer than 2 meaningful fields (basically empty)
  // 2. More than 50% of extracted fields have low confidence (< 0.5)
  // 3. The document type is "unknown" and we have almost no data
  // 4. For bank statements: no transactions extracted
  // 5. For invoices/POs: line items extracted but all incomplete

  let requiresReview = false;
  let reviewReason = null;

  if (extractedFieldCount < 2) {
    requiresReview = true;
    reviewReason = 'Too few fields extracted';
  } else if (lowConfidenceExtractedFields.length / extractedFieldCount > 0.5) {
    requiresReview = true;
    reviewReason = 'Multiple extracted fields have low confidence';
  } else if (docType === 'unknown' && extractedFieldCount < 3) {
    requiresReview = true;
    reviewReason = 'Unknown document type with minimal data';
  } else if (docType === 'bank-statement' && !isMeaningfulArray(extracted.transactions)) {
    // Bank statements without transactions are basically useless
    requiresReview = true;
    reviewReason = 'Bank statement missing transactions';
  }

  // Math validation — always flag but don't auto-require review unless severe
  let mathIssue = false;
  if (
    isNumber(extracted.subtotal) && 
    isNumber(extracted.total_amount) && 
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
      mathIssue = true;
      // Only require review if math is WAY off (> 10% difference)
      if (diff / extracted.total_amount > 0.10) {
        requiresReview = true;
        reviewReason = 'Math validation failed significantly';
      }
    }
  }

  return {
    overall: Math.round(finalScore * 100) / 100,
    breakdown: scores,
    status,
    requiresReview,
    reviewReason,
    extractedFieldCount,
    totalPossibleFields: Object.keys(weights).length,
    flags: {
      low_confidence_fields: lowConfidenceExtractedFields,
      math_issue: mathIssue
    }
  };
}
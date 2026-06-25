import { getDocumentTypeInfo, isLegacyType } from '../schemas/documentRegistry.js';

function getFieldFromSections(sections, fieldName) {
  if (!sections) return null;
  for (const section of sections) {
    if (section.fields?.[fieldName] !== undefined) return section.fields[fieldName];
  }
  // Alias matches
  const aliases = {
    vendor_name: ['vendor_name', 'company_name', 'issuer_name', 'seller_name'],
    invoice_number: ['invoice_number', 'receipt_number', 'bill_number', 'document_number'],
    invoice_date: ['invoice_date', 'date', 'issue_date', 'document_date'],
    total_amount: ['total_amount', 'amount', 'amount_due', 'total', 'sum'],
    account_number: ['account_number', 'account_no', 'acct_number'],
    closing_balance: ['closing_balance', 'ending_balance', 'current_balance'],
    transactions: ['transactions', 'entries', 'records'],
    claim_number: ['claim_number', 'claim_no', 'claim_id'],
    policy_number: ['policy_number', 'policy_no', 'policy_id'],
    incident_date: ['incident_date', 'accident_date', 'date_of_incident', 'event_date'],
    full_name: ['full_name', 'name', 'person_name'],
    passport_number: ['passport_number', 'document_number'],
    license_number: ['license_number', 'document_number', 'dl_number'],
  };
  const searchAliases = aliases[fieldName] || [];
  for (const alias of searchAliases) {
    for (const section of sections) {
      if (section.fields?.[alias] !== undefined) return section.fields[alias];
    }
  }
  return null;
}

// ============================================================
// CONFIDENCE ENGINE — Generic scoring with category-specific boosters
// ============================================================

export function calculateConfidence(extracted = {}) {
  const docType = extracted.document_type || 'unknown';
  const typeInfo = getDocumentTypeInfo(docType);

  // For legacy types, use weighted field scoring
  if (isLegacyType(docType)) {
    return calculateLegacyConfidence(extracted, typeInfo, docType);
  }

  // For new types, use section-based scoring
  return calculateFlexibleConfidence(extracted, typeInfo, docType);
}

// ============================================================
// FLEXIBLE CONFIDENCE (new types)
// ============================================================

function calculateFlexibleConfidence(extracted, typeInfo, docType) {
  const flags = {
    low_confidence_fields: [],
    missing_required_fields: [],
    invalid_dates: [],
    math_issue: false,
    balance_mismatch: false
  };

  let totalScore = 0;
  let maxScore = 0;
  const breakdown = {};

  // Score issuer presence (20%)
  const issuer = extracted.issuer || {};
  const issuerScore = scoreIssuer(issuer);
  totalScore += issuerScore * 0.20;
  maxScore += 0.20;
  breakdown.issuer = issuerScore;

  // Score recipient presence (15%)
  const recipient = extracted.recipient || {};
  const recipientScore = scoreRecipient(recipient);
  totalScore += recipientScore * 0.15;
  maxScore += 0.15;
  breakdown.recipient = recipientScore;

  // Score dates (15%)
  const dateScore = scoreDates(extracted);
  totalScore += dateScore * 0.15;
  maxScore += 0.15;
  breakdown.dates = dateScore;

  // Score sections (35%)
  const sections = extracted.sections || [];
  const sectionScore = scoreSections(sections, typeInfo);
  totalScore += sectionScore * 0.35;
  maxScore += 0.35;
  breakdown.sections = sectionScore;

  // Score specific_fields (10%)
  const specificScore = scoreSpecificFields(extracted.specific_fields || {}, typeInfo);
  totalScore += specificScore * 0.10;
  maxScore += 0.10;
  breakdown.specific_fields = specificScore;

  // Score legacy field presence as bonus (15%) — helps during transition
  const legacyScore = scoreLegacyFields(extracted, docType);
  totalScore += legacyScore * 0.15;
  maxScore += 0.15;
  breakdown.legacy_fields = legacyScore;

  // Check for placeholder values
  checkPlaceholders(extracted, flags);

  // Check date validity
  checkDateValidity(extracted, flags);

  // Calculate final score
  const finalScore = maxScore > 0 ? totalScore / maxScore : 0;
  const completeness = calculateCompleteness(extracted, typeInfo);

  // Determine status
  const status = finalScore >= 0.80 ? 'HIGH' : finalScore >= 0.50 ? 'MEDIUM' : 'LOW';

  // Determine review requirement — FLEXIBLE TYPES ARE MORE LENIENT
  let requiresReview = false;
  let reviewReason = null;

  const requiredFields = typeInfo.requiredFields || [];
  const fieldAliases = typeInfo.fieldAliases || {};
  const missingRequired = requiredFields.filter(field => {
    const aliases = [field, ...(fieldAliases[field] || [])];
    const found = aliases.some(alias => {
      const value = extracted.specific_fields?.[alias] || getFieldFromSections(extracted.sections, alias);
      return hasValue(value);
    });
    return !found;
  });

  // For flexible types, missing required fields alone don't trigger review
  // unless we have virtually no data at all
  const hasAnyData = hasValue(extracted.issuer?.name) || 
                     hasValue(extracted.recipient?.name) || 
                     sections.length > 0 || 
                     Object.keys(extracted.specific_fields || {}).length > 0;

  if (!hasAnyData) {
    requiresReview = true;
    reviewReason = 'No structured data extracted from document';
  } else if (finalScore < 0.15) {
    requiresReview = true;
    reviewReason = 'Very low extraction confidence';
  } else if (flags.invalid_dates.length > 0 && flags.invalid_dates.length > 2) {
    requiresReview = true;
    reviewReason = 'Multiple invalid date formats detected';
  }

  return {
    overall: Math.round(finalScore * 100) / 100,
    completeness: Math.round(completeness * 100),
    breakdown,
    status,
    requiresReview,
    reviewReason,
    extractedFieldCount: countExtractedFields(extracted),
    totalPossibleFields: estimateTotalFields(typeInfo),
    flags
  };
}

// ============================================================
// LEGACY CONFIDENCE (invoice, receipt, bank-statement, etc.)
// ============================================================

function calculateLegacyConfidence(extracted, typeInfo, docType) {
  const exists = (v) => v !== null && v !== undefined && v !== '';
  const isNumber = (v) => typeof v === 'number' && !isNaN(v);
  const isMeaningfulArray = (arr) => Array.isArray(arr) && arr.length > 0;

  const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    if (typeof val === 'string' && ['UNKNOWN', 'unknown'].includes(val)) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    if (typeof val === 'object' && !Array.isArray(val)) {
      const values = Object.values(val);
      if (values.length === 0 || values.every(v => v === null || v === undefined || v === '')) return false;
    }
    return true;
  };

  const PLACEHOLDER_PATTERNS = [
    /^vendor\s*name$/i, /^company\s*name$/i, /^buyer\s*name$/i,
    /^customer\s*name$/i, /^supplier\s*name$/i, /^counterparty\s*name$/i,
    /^your\s*company$/i, /^company$/i, /^vendor$/i, /^supplier$/i,
    /^client$/i, /^customer$/i, /^name$/i, /^\[?\s*vendor\s*name\s*\]?$/i,
    /^\[?\s*company\s*name\s*\]?$/i, /^\[?\s*your\s*name\s*here\s*\]?$/i,
    /^\[?\s*enter\s+\w+\s*\]?$/i, /^\{\{.*\}\}$/, /^\$\{.*\}$/,
    /^\[.*\]$/i, /^placeholder$/i, /^example$/i, /^sample$/i,
    /^test$/i, /^demo$/i, /^n\/a$/i, /^not\s*applicable$/i,
    /^tbd$/i, /^to\s*be\s*determined$/i, /^unknown\s*vendor$/i,
    /^unknown\s*company$/i
  ];

  const isPlaceholder = (val) => {
    if (typeof val !== 'string') return false;
    const trimmed = val.trim();
    return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(trimmed));
  };

  const weights = typeInfo.fieldWeights || {};
  const scores = {};
  let totalWeight = 0;
  let weightedScore = 0;
  let extractedFieldCount = 0;
  let lowConfidenceFields = [];
  let missingRequiredFields = [];
  let invalidDates = [];

  for (const [field, weight] of Object.entries(weights)) {
    let val = extracted[field];

    // === UNIFIED FALLBACK: Check new-format + section locations ===
    if (!hasValue(val)) {
      const fallbackMap = {
        vendor_name: [
          () => extracted.issuer?.name,
          () => extracted.vendor_name
        ],
        buyer_name: [
          () => extracted.recipient?.name,
          () => extracted.buyer_name
        ],
        invoice_date: [
          () => extracted.issue_date,
          () => extracted.date,
          () => extracted.invoice_date
        ],
        total_amount: [
          () => extracted.total_amount
        ],
        line_items: [
          () => extracted.line_items,
          () => extracted.items
        ],
        items: [
          () => extracted.items,
          () => extracted.line_items
        ],
        transactions: [
          () => extracted.transactions
        ],
        account_number: [
          () => extracted.account_number
        ],
        closing_balance: [
          () => extracted.closing_balance,
          () => extracted.transactions?.at(-1)?.balance
        ],
        opening_balance: [
          () => extracted.opening_balance,
          () => extracted.transactions?.[0]?.balance
        ],
        invoice_number: [
          () => extracted.invoice_number,
          () => extracted.reference_number,
          () => extracted.sections?.[0]?.fields?.invoice_number,
          () => extracted.sections?.[0]?.fields?.receipt_number,
          () => extracted.sections?.[0]?.fields?.po_number
        ],
        po_number: [
          () => extracted.po_number,
          () => extracted.sections?.[0]?.fields?.po_number
        ],
        receipt_number: [
          () => extracted.receipt_number,
          () => extracted.sections?.[0]?.fields?.receipt_number
        ],
        bill_number: [
          () => extracted.bill_number,
          () => extracted.sections?.[0]?.fields?.bill_number
        ],
        amount_due: [
          () => extracted.amount_due,
          () => extracted.total_amount
        ]
      };

      const fallbacks = fallbackMap[field] || [];
      for (const getter of fallbacks) {
        val = getter();
        if (hasValue(val)) break;
      }
    }

    // Fallback to sections for any field
    if (!hasValue(val) && extracted.sections?.length > 0) {
      val = getFieldFromSections(extracted.sections, field);
    }
    // === END UNIFIED FALLBACK ===

    const isPlaceholderValue = isPlaceholder(val);
    const effectiveVal = isPlaceholderValue ? null : val;

    if (typeInfo.requiredFields?.includes(field) && !hasValue(effectiveVal)) {
      // === DOCUMENT-TYPE-AWARE SKIP RULES ===
      let skip = false;
      if (docType === 'bank-statement') {
        if (['vendor_name', 'line_items', 'items', 'invoice_number', 'due_date', 'total_amount', 'account_number'].includes(field)) skip = true;
        if (field === 'closing_balance' && extracted.transactions?.length > 0) skip = true;
        if (field === 'opening_balance' && extracted.transactions?.length > 0) skip = true;
      }
      if (docType === 'receipt') {
        if (['vendor_tax_id', 'due_date', 'payment_terms', 'po_number'].includes(field)) skip = true;
        if (field === 'line_items' && extracted.items?.length > 0) skip = true;
      }
      if (docType === 'utility-bill') {
        if (field === 'total_amount' && extracted.amount_due) skip = true;
        if (['line_items', 'invoice_number'].includes(field)) skip = true;
        if (field === 'vendor_name' && (extracted.issuer?.name || extracted.vendor_name)) skip = true;
      }
      if (docType === 'purchase-order') {
        if (field === 'total_amount' && extracted.line_items?.length > 0) skip = true;
        if (['amount_paid', 'payment_status', 'invoice_number'].includes(field)) skip = true;
      }
      if (['insurance-claim-report', 'insurance-claim', 'insurance'].includes(docType)) {
        if (['total_amount', 'line_items', 'items', 'invoice_number', 'due_date', 'amount_due'].includes(field)) skip = true;
        if (field === 'vendor_name' && (extracted.issuer?.name || extracted.vendor_name)) skip = true;
      }
      if (docType === 'contract') {
        if (field === 'total_amount' && extracted.contract_value) skip = true;
        if (['line_items', 'items', 'invoice_number', 'due_date'].includes(field)) skip = true;
      }
      // === END SKIP RULES ===

      if (!skip) {
        missingRequiredFields.push(field);
      }
    }

    if (!hasValue(effectiveVal)) {
      scores[field] = 0;
      totalWeight += weight;
      lowConfidenceFields.push(field);
      continue;
    }

    const isDefaultValue = (val, field) => {
      if (field === 'currency' && val === 'USD') return true;
      if (field === 'category' && val === 'Uncategorized') return true;
      return false;
    };

    if (!isDefaultValue(val, field)) extractedFieldCount++;

    let fieldScore = 0;

    switch (field) {
      case 'line_items': {
        if (docType === 'bank-statement') {
          fieldScore = 1;
          break;
        }
        const li = extracted.line_items || [];
        fieldScore = score([li.length > 0, li.every(i => i.description && i.description !== 'Unknown item'), li.some(i => isNumber(i.quantity) && i.quantity > 0)]);
        break;
      }
      case 'items': {
        const items = extracted.items || [];
        fieldScore = score([items.length > 0, items.every(i => i.description && i.description !== 'Unknown item'), items.some(i => isNumber(i.quantity) && i.quantity > 0)]);
        break;
      }
      case 'transactions': {
        const txns = extracted.transactions || [];
        fieldScore = score([txns.length > 0, txns.some(t => t.date || t.description), txns.some(t => isNumber(t.debit) || isNumber(t.credit) || isNumber(t.balance))]);
        break;
      }
      case 'tax_details': {
        const td = extracted.tax_details || [];
        fieldScore = score([td.length > 0, td.every(t => t.type && t.type !== 'Unknown'), td.some(t => isNumber(t.amount) && t.amount >= 0)]);
        break;
      }
      case 'statement_period':
      case 'service_period':
      case 'usage_period': {
        const p = extracted[field] || {};
        fieldScore = score([hasValue(p.from), hasValue(p.to)]);
        break;
      }
      default:
        fieldScore = isNumber(val) ? 1 : hasValue(val) ? 1 : 0;
    }

    if (isPlaceholderValue) fieldScore = 0;

    scores[field] = fieldScore;
    weightedScore += fieldScore * weight;
    totalWeight += weight;
    if (fieldScore < 0.5) lowConfidenceFields.push(field);
  }

  const dateFields = ['date', 'invoice_date', 'due_date', 'payment_date', 'order_date', 'delivery_date', 'effective_date', 'expiration_date', 'renewal_date', 'created_date', 'updated_date'];
  dateFields.forEach(field => {
    const value = extracted[field];
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalidDates.push(field);
  });

  let mathIssue = false;
  if (isNumber(extracted.subtotal) && isNumber(extracted.total_amount) && extracted.total_amount > 0 && ['invoice', 'purchase-order', 'receipt'].includes(docType)) {
    const calculatedTotal = (extracted.subtotal || 0) + (extracted.tax_amount || 0) + (extracted.shipping_amount || 0) - (extracted.discount_amount || 0);
    if (Math.abs(calculatedTotal - extracted.total_amount) > 0.01) mathIssue = true;
  }

  let balanceMismatch = false;
  if (docType === 'bank-statement' && extracted.transactions?.length) {
    const lastTxn = extracted.transactions[extracted.transactions.length - 1];
    if (isNumber(lastTxn.balance) && isNumber(extracted.closing_balance)) {
      balanceMismatch = Math.abs(lastTxn.balance - extracted.closing_balance) > 0.01;
    }
  }

  const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  const completeness = Object.keys(weights).length > 0 ? extractedFieldCount / Object.keys(weights).length : 0;
  const status = finalScore >= 0.8 ? 'HIGH' : finalScore >= 0.5 ? 'MEDIUM' : 'LOW';

  let requiresReview = false;
  let reviewReason = null;

  // === DOCUMENT-TYPE-AWARE REVIEW RULES ===
  const filteredMissingRequired = missingRequiredFields.filter(field => {
    if (docType === 'bank-statement') {
      if (['vendor_name', 'line_items', 'items', 'invoice_number', 'due_date', 'total_amount', 'account_number'].includes(field)) return false;
      if (field === 'closing_balance' && extracted.transactions?.length > 0) return false;
      if (field === 'opening_balance' && extracted.transactions?.length > 0) return false;
    }
    if (docType === 'receipt') {
      if (['vendor_tax_id', 'due_date', 'payment_terms', 'po_number'].includes(field)) return false;
      if (field === 'line_items' && extracted.items?.length > 0) return false;
    }
    if (docType === 'utility-bill') {
      if (field === 'total_amount' && extracted.amount_due) return false;
      if (['line_items', 'invoice_number'].includes(field)) return false;
      if (field === 'vendor_name' && (extracted.issuer?.name || extracted.vendor_name)) return false;
    }
    if (docType === 'purchase-order') {
      if (field === 'total_amount' && extracted.line_items?.length > 0) return false;
      if (['amount_paid', 'payment_status', 'invoice_number'].includes(field)) return false;
    }
    if (['insurance-claim-report', 'insurance-claim', 'insurance'].includes(docType)) {
      if (['total_amount', 'line_items', 'items', 'invoice_number', 'due_date', 'amount_due'].includes(field)) return false;
      if (field === 'vendor_name' && (extracted.issuer?.name || extracted.vendor_name)) return false;
    }
    if (docType === 'contract') {
      if (field === 'total_amount' && extracted.contract_value) return false;
      if (['line_items', 'items', 'invoice_number', 'due_date'].includes(field)) return false;
    }
    return true;
  });
  // === END REVIEW RULES ===

  if (filteredMissingRequired.length > 0) {
    requiresReview = true;
    reviewReason = 'Missing required fields: ' + filteredMissingRequired.join(', ');
  } else if (extractedFieldCount === 0) {
    requiresReview = true;
    reviewReason = 'No meaningful fields extracted';
  } else if (extractedFieldCount < 2) {
    requiresReview = true;
    reviewReason = 'Too few fields extracted';
  } else if (docType === 'unknown' && extractedFieldCount < 3) {
    requiresReview = true;
    reviewReason = 'Unrecognized document type with insufficient data';
  } else if (invalidDates.length > 0) {
    requiresReview = true;
    reviewReason = 'Invalid date format detected';
  } else if (balanceMismatch) {
    requiresReview = true;
    reviewReason = 'Bank statement balance mismatch';
  } else if (docType === 'bank-statement' && !isMeaningfulArray(extracted.transactions)) {
    requiresReview = true;
    reviewReason = 'Bank statement missing transactions';
  }

  return {
    overall: Math.round(finalScore * 100) / 100,
    completeness: Math.round(completeness * 100),
    breakdown: scores,
    status,
    requiresReview,
    reviewReason,
    extractedFieldCount,
    totalPossibleFields: Object.keys(weights).length,
    flags: {
      low_confidence_fields: lowConfidenceFields,
      missing_required_fields: missingRequiredFields,
      invalid_dates: invalidDates,
      math_issue: mathIssue,
      balance_mismatch: balanceMismatch
    }
  };
}

// ============================================================
// SCORING HELPERS
// ============================================================

function scoreIssuer(issuer) {
  let score = 0;
  if (hasValue(issuer.name)) score += 0.5;
  if (hasValue(issuer.address) || hasValue(issuer.email) || hasValue(issuer.phone)) score += 0.3;
  if (hasValue(issuer.tax_id) || hasValue(issuer.registration_number)) score += 0.2;
  return Math.min(score, 1);
}

function scoreRecipient(recipient) {
  let score = 0;
  if (hasValue(recipient.name)) score += 0.6;
  if (hasValue(recipient.address) || hasValue(recipient.email)) score += 0.3;
  if (hasValue(recipient.id_number) || hasValue(recipient.date_of_birth)) score += 0.1;
  return Math.min(score, 1);
}

function scoreDates(extracted) {
  let score = 0;
  if (hasValue(extracted.issue_date) || hasValue(extracted.date)) score += 0.5;
  if (hasValue(extracted.effective_date)) score += 0.25;
  if (hasValue(extracted.expiry_date)) score += 0.25;
  return Math.min(score, 1);
}

function scoreSections(sections, typeInfo) {
  if (!sections.length) return 0;

  const expectedSections = typeInfo.sections || ['general'];
  const presentTypes = sections.map(s => s.section_type);

  const sectionAliases = {
    scope: ['scope', 'services', 'service_scope', 'work_description'],
    terms: ['terms', 'term', 'conditions', 'agreement_terms'],
    payment: ['payment', 'payment_terms', 'payment_schedule', 'billing'],
    sla: ['sla', 'service_level', 'service_level_agreement', 'performance_standards'],
    deliverables: ['deliverables', 'deliverables_schedule', 'milestones', 'outputs'],
    general: ['general', 'overview', 'summary', 'document_summary']
  };

  let coverage = 0;
  expectedSections.forEach(es => {
    const aliases = sectionAliases[es] || [es];
    if (presentTypes.some(ps => aliases.includes(ps))) coverage += 1;
  });

  const sectionCoverage = expectedSections.length > 0 ? coverage / expectedSections.length : 1;

  let contentScore = 0;
  sections.forEach(section => {
    const hasFields = Object.keys(section.fields || {}).length > 0;
    const hasItems = (section.items || []).length > 0;
    const hasText = hasValue(section.text);
    if (hasFields || hasItems || hasText) contentScore += 1;
  });
  const contentQuality = sections.length > 0 ? contentScore / sections.length : 0;

  return (sectionCoverage * 0.6) + (contentQuality * 0.4);
}

function scoreSpecificFields(specificFields, typeInfo) {
  const required = typeInfo.requiredFields || [];
  const fieldAliases = typeInfo.fieldAliases || {};
  if (!required.length) return 1;

  let present = 0;
  required.forEach(field => {
    const aliases = [field, ...(fieldAliases[field] || [])];
    const found = aliases.some(alias => hasValue(specificFields[alias]));
    if (found) present += 1;
  });

  return present / required.length;
}

function scoreLegacyFields(extracted, docType) {
  // Give points if legacy fields are populated — helps during transition
  let score = 0;
  let checks = 0;

  const legacyChecks = [
    ['vendor_name', extracted.vendor_name || extracted.issuer?.name],
    ['buyer_name', extracted.buyer_name || extracted.recipient?.name],
    ['total_amount', extracted.total_amount],
    ['invoice_date', extracted.invoice_date || extracted.issue_date || extracted.date],
    ['line_items', extracted.line_items?.length > 0 ? extracted.line_items : null],
    ['items', extracted.items?.length > 0 ? extracted.items : null],
    ['transactions', extracted.transactions?.length > 0 ? extracted.transactions : null],
  ];

  legacyChecks.forEach(([_, val]) => {
    checks++;
    if (hasValue(val)) score++;
  });

  return checks > 0 ? score / checks : 0;
}

function checkPlaceholders(extracted, flags) {
  const sections = extracted.sections || [];
  sections.forEach(section => {
    Object.entries(section.fields || {}).forEach(([key, value]) => {
      if (isPlaceholderValue(value)) {
        flags.low_confidence_fields.push(`${section.section_type}.${key}`);
      }
    });
  });
}

function checkDateValidity(extracted, flags) {
  const dateFields = ['issue_date', 'effective_date', 'expiry_date', 'date'];
  dateFields.forEach(field => {
    const value = extracted[field];
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      flags.invalid_dates.push(field);
    }
  });

  (extracted.sections || []).forEach(section => {
    Object.entries(section.fields || {}).forEach(([key, value]) => {
      if (key.includes('date') && typeof value === 'string' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        flags.invalid_dates.push(`${section.section_type}.${key}`);
      }
    });
  });
}

function calculateCompleteness(extracted, typeInfo) {
  const sections = extracted.sections || [];
  const specificFields = extracted.specific_fields || {};
  const requiredSections = typeInfo.sections || [];
  const requiredFields = typeInfo.requiredFields || [];

  let total = requiredSections.length + requiredFields.length;
  if (total === 0) total = 1;

  let present = 0;
  const sectionTypes = sections.map(s => s.section_type);
  requiredSections.forEach(rs => {
    if (sectionTypes.includes(rs)) present += 1;
  });
  requiredFields.forEach(rf => {
    if (hasValue(specificFields[rf]) || hasValue(getFieldFromSections(sections, rf))) present += 1;
  });

  return present / total;
}

function countExtractedFields(extracted) {
  let count = 0;
  if (hasValue(extracted.issuer?.name)) count++;
  if (hasValue(extracted.recipient?.name)) count++;
  if (hasValue(extracted.issue_date)) count++;
  if (hasValue(extracted.total_amount)) count++;

  (extracted.sections || []).forEach(section => {
    count += Object.keys(section.fields || {}).length;
    count += (section.items || []).length;
  });

  return count;
}

function estimateTotalFields(typeInfo) {
  return (typeInfo.sections?.length || 1) + (typeInfo.requiredFields?.length || 0) + 5;
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

function isPlaceholderValue(val) {
  if (typeof val !== 'string') return false;
  const normalized = val.trim().toLowerCase();
  const placeholders = ['vendor name', 'company name', 'buyer name', 'customer name', 'supplier name', 'counterparty name', 'your company', 'company', 'vendor', 'supplier', 'client', 'customer', 'name', 'not applicable', 'n/a', 'tbd', 'to be determined', 'placeholder', 'example', 'sample', 'test', 'demo', 'unknown vendor', 'unknown company', 'full name', 'enter name', 'your name here', 'unknown'];
  return placeholders.includes(normalized) || /^\[.*\]$/.test(val.trim());
}

function score(checks) {
  const passed = checks.filter(Boolean).length;
  return checks.length === 0 ? 1 : passed / checks.length;
}
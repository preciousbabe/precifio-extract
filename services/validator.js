// ============================================================
// VALIDATOR — Type-agnostic validation using document registry
// ============================================================

import { getDocumentTypeInfo, isLegacyType } from '../schemas/documentRegistry.js';

// ============================================================
// MAIN ENTRY POINT
// ============================================================

export function validateExtraction(extracted) {
  console.log('VALIDATOR INPUT:', JSON.stringify(extracted, null, 2));

  const docType = extracted.document_type || 'unknown';
  const typeInfo = getDocumentTypeInfo(docType);
  const isLegacy = isLegacyType(docType);

  // For legacy types, use old flat-field validation
  if (isLegacy) {
    return validateLegacyFormat(extracted, typeInfo, docType);
  }

  // For new types, use section-based validation
  return validateFlexibleFormat(extracted, typeInfo, docType);
}

// ============================================================
// FLEXIBLE FORMAT VALIDATION (new types: resume, passport, insurance-claim, etc.)
// ============================================================

function validateFlexibleFormat(extracted, typeInfo, docType) {
  const informationalFlags = [];
  const warningFlags = [];

  // ── 1. STRUCTURAL VALIDATION ──────────────────────────────

  // sections must be an array
  if (!Array.isArray(extracted.sections)) {
    warningFlags.push({
      type: 'WARNING',
      field: 'sections',
      message: 'sections is not an array — extraction may be malformed'
    });
  }

  // issuer should be an object
  if (!extracted.issuer || typeof extracted.issuer !== 'object') {
    informationalFlags.push({
      type: 'INFO',
      field: 'issuer',
      message: 'Issuer information not structured'
    });
  }

  // recipient should be an object
  if (!extracted.recipient || typeof extracted.recipient !== 'object') {
    informationalFlags.push({
      type: 'INFO',
      field: 'recipient',
      message: 'Recipient information not structured'
    });
  }

  // ── 2. CHECK REQUIRED SECTIONS (soft check — informational only) ──

  const requiredSections = typeInfo.sections || [];
  const presentSections = (extracted.sections || []).map(s => s.section_type);

  const sectionAliases = {
    scope: ['scope', 'services', 'service_scope', 'work_description'],
    terms: ['terms', 'term', 'conditions', 'agreement_terms'],
    payment: ['payment', 'payment_terms', 'payment_schedule', 'billing'],
    sla: ['sla', 'service_level', 'service_level_agreement', 'performance_standards'],
    deliverables: ['deliverables', 'deliverables_schedule', 'milestones', 'outputs'],
    general: ['general', 'overview', 'summary', 'document_summary'],
    parties: ['parties', 'party', 'contract_parties'],
    claim_information: ['claim_information', 'claim_info', 'general'],
    incident_details: ['incident_details', 'incident', 'event_details'],
    vehicle_information: ['vehicle_information', 'vehicle', 'auto_info'],
    damage_assessment: ['damage_assessment', 'damage', 'assessment'],
    personal_info: ['personal_info', 'personal', 'contact_info', 'profile'],
    experience: ['experience', 'work_experience', 'employment_history'],
    education: ['education', 'academic', 'qualifications'],
    skills: ['skills', 'competencies', 'expertise'],
    certifications: ['certifications', 'certificates', 'licenses'],
    patient_info: ['patient_info', 'patient', 'demographics'],
    diagnosis: ['diagnosis', 'findings', 'assessment'],
    treatment: ['treatment', 'plan', 'recommendations'],
    medications: ['medications', 'medication', 'drugs', 'prescriptions'],
    property: ['property', 'property_details', 'real_estate'],
    shipment_info: ['shipment_info', 'shipment', 'cargo'],
    cargo_details: ['cargo_details', 'cargo', 'goods'],
    route: ['route', 'itinerary', 'journey'],
    student_info: ['student_info', 'student', 'applicant'],
    institution: ['institution', 'school', 'university'],
    courses: ['courses', 'subjects', 'modules'],
    grades: ['grades', 'marks', 'scores'],
    document_info: ['document_info', 'document', 'id_details'],
    issuing_authority: ['issuing_authority', 'authority', 'issuer'],
  };

  const missingSections = requiredSections.filter(rs => {
    const aliases = sectionAliases[rs] || [rs];
    return !presentSections.some(ps => aliases.includes(ps));
  });

  if (missingSections.length > 0) {
    informationalFlags.push({
      type: 'INFO',
      field: 'sections',
      message: `Expected sections not found: ${missingSections.join(', ')}`
    });
  }

  // ── 3. CHECK REQUIRED FIELDS IN SPECIFIC_FIELDS (soft check) ──

  const requiredFields = typeInfo.requiredFields || [];
  const fieldAliases = typeInfo.fieldAliases || {};
  const specificFields = extracted.specific_fields || {};

  for (const field of requiredFields) {
    const aliases = [field, ...(fieldAliases[field] || [])];
    let value = null;
    for (const alias of aliases) {
      value = specificFields[alias] || getFieldFromSections(extracted.sections, alias);
      if (hasValue(value)) break;
    }
    if (!hasValue(value)) {
      // For flexible types, missing required fields are INFO, not WARNING
      // because GPT might have put the data in sections instead
      informationalFlags.push({
        type: 'INFO',
        field,
        message: `${field.replace(/_/g, ' ')} not found in specific_fields — may be in sections`
      });
    }
  }

  // ── 4. CHECK ISSUER / RECIPIENT (generic, applies to ALL docs) ──

  const issuer = extracted.issuer || {};
  if (!hasValue(issuer.name) && !hasValue(extracted.vendor_name)) {
    informationalFlags.push({
      type: 'INFO',
      field: 'issuer.name',
      message: 'Issuer/company name not detected'
    });
  }

  const recipient = extracted.recipient || {};
  if (!hasValue(recipient.name) && !hasValue(extracted.buyer_name)) {
    informationalFlags.push({
      type: 'INFO',
      field: 'recipient.name',
      message: 'Recipient name not detected'
    });
  }

  // ── 5. CHECK DATES ──

  if (!hasValue(extracted.issue_date) && !hasValue(extracted.date)) {
    informationalFlags.push({
      type: 'INFO',
      field: 'issue_date',
      message: 'Document date not found'
    });
  }

  // ── 6. CHECK FOR PLACEHOLDER VALUES ──

  const sections = extracted.sections || [];
  sections.forEach(section => {
    Object.entries(section.fields || {}).forEach(([key, value]) => {
      if (isPlaceholderValue(value)) {
        warningFlags.push({
          type: 'WARNING',
          field: `${section.section_type}.${key}`,
          message: `Placeholder value detected for ${key}`
        });
      }
    });
  });

  // Also check specific_fields
  Object.entries(specificFields).forEach(([key, value]) => {
    if (isPlaceholderValue(value)) {
      warningFlags.push({
        type: 'WARNING',
        field: `specific_fields.${key}`,
        message: `Placeholder value detected for ${key}`
      });
    }
  });

  // ── 7. CATEGORY CHECK ──

  if (extracted.category === 'Uncategorized' && hasValue(issuer.name)) {
    informationalFlags.push({
      type: 'INFO',
      field: 'category',
      message: 'Category could not be determined from document content'
    });
  }

  // ── 8. COMPUTE RESULT ──

  const allFlags = [...informationalFlags, ...warningFlags];
  const hasCritical = allFlags.some(f => ['CRITICAL', 'ERROR'].includes(f.type));
  const hasSevereWarning = allFlags.some(f => f.type === 'WARNING');

  // For flexible types, only require review if there are real warnings
  // or if virtually nothing was extracted
  const hasAnyData = hasValue(issuer.name) || 
                     hasValue(recipient.name) || 
                     sections.length > 0 || 
                     Object.keys(specificFields).length > 0;

  const requiresReview = hasCritical || 
                         (hasSevereWarning && !hasAnyData) ||
                         (!hasAnyData && docType !== 'unknown');

  return {
    isValid: !requiresReview,
    flags: allFlags,
    informationalFlags,
    warningFlags,
    requiresReview,
    severity: hasCritical ? 'CRITICAL' : hasSevereWarning ? 'WARNING' : 'INFO'
  };
}

// ============================================================
// LEGACY FORMAT VALIDATION (invoice, receipt, bank-statement, etc.)
// ============================================================

function validateLegacyFormat(extracted, typeInfo, docType) {
  const flags = [];
  const informationalFlags = [];
  const warningFlags = [];

  const requiredFields = typeInfo.requiredFields || [];
  const expectedFields = typeInfo.expectedFields || [];

  // Check expected fields (with section fallback for legacy types)
  for (const field of expectedFields) {
    let value = extracted[field];
    // If not found at top level, search in sections
    if (!hasValue(value) && extracted.sections?.length > 0) {
      value = getFieldFromSections(extracted.sections, field);
    }

    const isNullish = value === null || value === undefined || value === '';
    const isEmptyArray = Array.isArray(value) && value.length === 0;
    const isEmptyObject = typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;

    const isRequired = requiredFields.includes(field);
    const severity = isRequired ? 'WARNING' : 'OPTIONAL';

    if (isNullish || isEmptyArray || isEmptyObject) {
      // === DOCUMENT-TYPE-AWARE SKIP RULES ===
      if (docType === 'bank-statement') {
        if (['vendor_name', 'line_items', 'items', 'invoice_number', 'due_date', 'total_amount'].includes(field)) continue;
        if (field === 'closing_balance' && extracted.transactions?.length > 0) continue;
        if (field === 'opening_balance' && extracted.transactions?.length > 0) continue;
        if (field === 'account_number') continue;
      }
      if (docType === 'receipt') {
        if (['vendor_tax_id', 'due_date', 'payment_terms', 'po_number'].includes(field)) continue;
        if (field === 'line_items' && extracted.items?.length > 0) continue;
      }
      if (docType === 'utility-bill') {
        if (field === 'total_amount' && extracted.amount_due) continue;
        if (['line_items', 'invoice_number'].includes(field)) continue;
        if (field === 'vendor_name' && (extracted.issuer?.name || extracted.vendor_name)) continue;
      }
      if (docType === 'purchase-order') {
        if (field === 'total_amount' && extracted.line_items?.length > 0) continue;
        if (['amount_paid', 'payment_status', 'invoice_number'].includes(field)) continue;
      }
      if (docType === 'insurance-claim-report' || docType === 'insurance-claim' || docType === 'insurance') {
        if (['total_amount', 'line_items', 'items', 'invoice_number', 'due_date', 'amount_due'].includes(field)) continue;
        if (field === 'vendor_name' && (extracted.issuer?.name || extracted.vendor_name)) continue;
      }
      if (docType === 'contract') {
        if (field === 'total_amount' && extracted.contract_value) continue;
        if (['line_items', 'items', 'invoice_number', 'due_date'].includes(field)) continue;
      }
      // === END SKIP RULES ===

      informationalFlags.push({
        type: severity,
        field,
        message: isRequired
          ? `${field.replace(/_/g, ' ')} not present in document`
          : `${field.replace(/_/g, ' ')} not found`
      });
    }
  }

  // Category check
  if (extracted.category === 'Uncategorized' && extracted.vendor_name) {
    informationalFlags.push({
      type: 'INFO',
      field: 'category',
      message: 'Category could not be determined from document content'
    });
  }

  // Math validation
  if (extracted.subtotal != null && extracted.total_amount != null && extracted.total_amount > 0 &&
      ['invoice', 'purchase-order', 'receipt'].includes(docType)) {
    const calculatedTotal = (extracted.subtotal || 0) + (extracted.tax_amount || 0) + (extracted.shipping_amount || 0) - (extracted.discount_amount || 0);
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

  // Line item validation
  if (['invoice', 'purchase-order'].includes(docType)) {
    const lineItems = extracted.line_items || [];
    if (lineItems.length > 0) {
      const incompleteItems = lineItems.filter(item => item.unit_price == null || item.total == null || !item.description);
      if (incompleteItems.length > 0) {
        warningFlags.push({
          type: 'WARNING',
          field: 'line_items',
          message: `${incompleteItems.length} of ${lineItems.length} line items have missing data`
        });
      }
    }
  }

  // Receipt items validation
  if (docType === 'receipt') {
    const receiptItems = extracted.items || [];
    if (receiptItems.length > 0) {
      const incompleteItems = receiptItems.filter(item => item.price == null || item.total == null || !item.description);
      if (incompleteItems.length > 0) {
        warningFlags.push({
          type: 'WARNING',
          field: 'items',
          message: `${incompleteItems.length} of ${receiptItems.length} receipt items have missing data`
        });
      }
    }
  }

  // Tax details check
  if (['invoice', 'receipt'].includes(docType) && extracted.tax_amount > 0 && (!extracted.tax_details || extracted.tax_details.length === 0)) {
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
    const sp = extracted.statement_period || {};
    const hasTransactionDates = txns.length > 0 && txns.some(t => t.date);
    if (!sp.from && !sp.to && !hasTransactionDates) {
      warningFlags.push({
        type: 'INFO',
        field: 'statement_period',
        message: 'Statement period incomplete or missing'
      });
    }
    if (!extracted.account_number && !extracted.account_name && !extracted.bank_name) {
      informationalFlags.push({
        type: 'INFO',
        field: 'account_number',
        message: 'No account identifying information found'
      });
    }
  }

  // Utility bill validation
  if (docType === 'utility-bill') {
    const up = extracted.usage_period || {};
    if (!up.from || !up.to) {
      warningFlags.push({
        type: 'INFO',
        field: 'usage_period',
        message: 'Usage period incomplete or missing'
      });
    }
  }

  // Contract validation
  if (docType === 'contract') {
    if (!extracted.effective_date && !extracted.expiration_date) {
      warningFlags.push({
        type: 'INFO',
        field: 'dates',
        message: 'No effective or expiration date found for contract'
      });
    }
  }

  const allFlags = [...informationalFlags, ...warningFlags];
  const hasCritical = allFlags.some(f => ['CRITICAL', 'ERROR'].includes(f.type));
  const hasSevereWarning = allFlags.some(f => f.type === 'WARNING');
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

// ============================================================
// HELPER FUNCTIONS
// ============================================================

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

function getFieldFromSections(sections, fieldName) {
  if (!sections) return null;
  for (const section of sections) {
    if (section.fields?.[fieldName] !== undefined) return section.fields[fieldName];
  }

  // Alias matches for common field names
  const aliases = {
    vendor_name: ['vendor_name', 'company_name', 'issuer_name', 'seller_name', 'merchant_name', 'store_name'],
    invoice_number: ['invoice_number', 'receipt_number', 'bill_number', 'document_number', 'reference_number'],
    invoice_date: ['invoice_date', 'date', 'issue_date', 'document_date', 'receipt_date'],
    total_amount: ['total_amount', 'amount', 'amount_due', 'total', 'sum', 'grand_total'],
    amount_due: ['amount_due', 'total_amount', 'balance_due', 'total_due'],
    account_number: ['account_number', 'account_no', 'acct_number', 'account_id'],
    closing_balance: ['closing_balance', 'ending_balance', 'current_balance', 'balance'],
    opening_balance: ['opening_balance', 'beginning_balance', 'start_balance'],
    po_number: ['po_number', 'purchase_order_number', 'order_number', 'po_no'],
    line_items: ['line_items', 'items', 'products', 'services'],
    transactions: ['transactions', 'entries', 'records'],
    claim_number: ['claim_number', 'claim_no', 'claim_id'],
    policy_number: ['policy_number', 'policy_no', 'policy_id'],
    incident_date: ['incident_date', 'accident_date', 'date_of_incident', 'event_date'],
    full_name: ['full_name', 'name', 'person_name', 'individual_name'],
    passport_number: ['passport_number', 'document_number', 'pp_no'],
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

function isPlaceholderValue(val) {
  if (typeof val !== 'string') return false;
  const normalized = val.trim().toLowerCase();
  const placeholders = [
    'vendor name', 'company name', 'buyer name', 'customer name',
    'supplier name', 'counterparty name', 'your company', 'company',
    'vendor', 'supplier', 'client', 'customer', 'name',
    'not applicable', 'n/a', 'tbd', 'to be determined',
    'placeholder', 'example', 'sample', 'test', 'demo',
    'unknown vendor', 'unknown company', 'full name',
    'enter name', 'your name here', 'unknown'
  ];
  return placeholders.includes(normalized) || /^\[.*\]$/.test(val.trim());
}
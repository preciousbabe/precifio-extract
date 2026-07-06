// ============================================================
// VALIDATION UTILITIES — Shared by confidenceEngine.js and validator.js
// ============================================================

import { getDocumentTypeInfo, getFieldAliases } from '../schemas/documentRegistry.js';

// ==================== CORE VALUE CHECKS ====================

/**
 * Checks if a value has meaningful content (not null, empty, or placeholder)
 */
export function hasValue(val) {
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

/**
 * Checks if a value is a placeholder (e.g., "Vendor Name", "TBD", "N/A")
 */
export function isPlaceholder(val) {
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

// ==================== FIELD RESOLUTION ====================

/**
 * Resolves a field value using ALL available sources:
 * 1. Direct field access
 * 2. Registry alias resolution
 * 3. Party fallbacks (issuer.name / recipient.name)
 * 4. Section search
 */
export function resolveFieldValue(extracted, field, docType) {
  // 1. Direct field access
  if (hasValue(extracted[field])) return extracted[field];

  // 2. Registry alias resolution
  const aliases = getFieldAliases(docType, field);
  for (const alias of aliases) {
    if (alias === field) continue;
    if (hasValue(extracted[alias])) return extracted[alias];
  }

  // 3. Party fallbacks
  const partyValue = resolvePartyFallback(extracted, field, docType);
  if (partyValue !== null) return partyValue;

  // 4. Section search
  return getFieldFromSections(extracted.sections, field, docType);
}

/**
 * Resolves party-based fallbacks using registry fieldAliases
 */
function resolvePartyFallback(extracted, field, docType) {
  const info = getDocumentTypeInfo(docType);
  if (!info.fieldAliases) return null;

  const aliases = info.fieldAliases[field] || [];

  // Check if field aliases suggest issuer relationship
  const isIssuerField = aliases.some(a => 
    a.includes('vendor') || a.includes('seller') || a.includes('provider') || 
    a.includes('issuer') || a.includes('employer') || a.includes('bank') ||
    a.includes('company') || a.includes('institution') || a.includes('authority')
  );

  if (isIssuerField && hasValue(extracted.issuer?.name)) {
    return extracted.issuer.name;
  }

  // Check if field aliases suggest recipient relationship
  const isRecipientField = aliases.some(a => 
    a.includes('buyer') || a.includes('customer') || a.includes('patient') || 
    a.includes('recipient') || a.includes('employee') || a.includes('student') ||
    a.includes('client') || a.includes('tenant') || a.includes('borrower')
  );

  if (isRecipientField && hasValue(extracted.recipient?.name)) {
    return extracted.recipient.name;
  }

  return null;
}

// ==================== SECTION HELPERS ====================

/**
 * Gets a field value from sections with alias support
 */
export function getFieldFromSections(sections, fieldName, docType = 'unknown') {
  if (!sections) return null;

  // Direct search
  for (const section of sections) {
    if (section.fields?.[fieldName] !== undefined) {
      const val = section.fields[fieldName];
      if (hasValue(val)) return val;
    }
  }

  // Registry alias lookup
  const info = getDocumentTypeInfo(docType);
  if (info.fieldAliases && info.fieldAliases[fieldName]) {
    for (const alias of info.fieldAliases[fieldName]) {
      for (const section of sections) {
        if (section.fields?.[alias] !== undefined) {
          const val = section.fields[alias];
          if (hasValue(val)) return val;
        }
      }
    }
  }

  return null;
}

/**
 * Gets items from a specific section type
 */
export function getItemsFromSection(sections, sectionType) {
  if (!sections) return [];
  const section = sections.find(s => s.section_type === sectionType);
  return section?.items || [];
}

/**
 * Gets all fields from all sections as a flat object
 */
export function getAllSectionFields(sections) {
  if (!sections) return {};
  const result = {};
  for (const section of sections) {
    Object.assign(result, section.fields || {});
  }
  return result;
}

// ==================== SECTION ALIASES ====================

/**
 * Builds comprehensive section aliases from registry
 */
export function buildSectionAliases(typeInfo) {
  const aliases = {};

  for (const section of (typeInfo.sections || [])) {
    aliases[section] = [section];

    // Add common variations
    const variations = {
      general: ['overview', 'summary', 'document_summary'],
      parties: ['party_info', 'contract_parties'],
      terms: ['term', 'conditions', 'agreement_terms', 'contract_terms'],
      clauses: ['contract_clauses', 'legal_clauses'],
      signatures: ['signatories', 'execution'],
      obligations: ['duties', 'responsibilities'],
      jurisdiction: ['governing_law', 'venue', 'applicable_law'],
      property_details: ['property', 'subject_property'],
      claim_information: ['claim_info', 'claim_details', 'claim_data'],
      incident_details: ['incident', 'incident_info', 'accident_details'],
      vehicle_information: ['vehicle', 'vehicle_info', 'auto_details'],
      damage_assessment: ['damage', 'damage_info', 'assessment'],
      supporting_documents: ['documents', 'attachments', 'evidence'],
      policy_info: ['policy', 'policy_details', 'insurance_policy'],
      personal_info: ['personal', 'personal_details', 'contact_info', 'individual_info'],
      experience: ['work_experience', 'employment_history', 'career'],
      education: ['academic_background', 'qualifications', 'degrees'],
      skills: ['competencies', 'expertise', 'capabilities'],
      certifications: ['certificates', 'licenses', 'accreditations'],
      compensation: ['salary', 'pay', 'remuneration'],
      review_period: ['evaluation_period', 'appraisal_period'],
      goals: ['objectives', 'targets', 'kpis'],
      patient_info: ['patient', 'patient_details', 'demographics'],
      diagnosis: ['assessment', 'clinical_diagnosis'],
      treatment: ['treatment_plan', 'care_plan', 'management'],
      medications: ['meds', 'prescribed_drugs', 'drug_list'],
      test_results: ['results', 'lab_results', 'findings'],
      provider_info: ['provider', 'provider_details', 'physician_info'],
      charges: ['fees', 'billing', 'costs'],
      shipment_info: ['shipment', 'shipment_details', 'shipping_info'],
      cargo_details: ['cargo', 'goods', 'freight'],
      route: ['routing', 'itinerary', 'path'],
      tracking: ['tracking_info', 'trace'],
      declarations: ['customs_declarations', 'entry_details'],
      valuation: ['appraisal', 'value_assessment'],
      inspection_items: ['inspection', 'checked_items'],
      mortgage_terms: ['mortgage', 'loan_terms'],
      student_info: ['student', 'student_details', 'applicant_info'],
      institution: ['school', 'university', 'college'],
      courses: ['classes', 'subjects', 'modules'],
      grades: ['marks', 'scores', 'results'],
      awards: ['honors', 'distinctions', 'recognitions'],
      credentials: ['qualifications', 'certifications'],
      document_info: ['document_details', 'id_details'],
      issuing_authority: ['authority', 'issuer', 'government_agency'],
      restrictions: ['limitations', 'constraints'],
      conditions: ['terms', 'provisions'],
      biometrics: ['biometric_data', 'physical_characteristics'],
      account_info: ['account_information', 'account_summary'],
      statement_period: ['period', 'reporting_period', 'billing_period'],
      balances: ['balance_summary', 'account_balances'],
      transactions: ['transaction_history', 'activity', 'entries'],
      payment_info: ['payment_information', 'billing'],
      line_items: ['items', 'products', 'services'],
      totals: ['summary', 'totals_summary'],
      tax_breakdown: ['tax_details', 'taxes'],
      employee_info: ['employee_information', 'staff']
    };

    if (variations[section]) {
      aliases[section].push(...variations[section]);
    }
  }

  return aliases;
}

// ==================== DATE VALIDATION ====================

/**
 * Validates date format (YYYY-MM-DD)
 */
export function isValidDate(value) {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

/**
 * Checks all date fields in extracted data
 */
export function checkDateValidity(extracted, invalidDates = []) {
  const dateFields = [
    'date', 'issue_date', 'effective_date', 'expiry_date', 'due_date', 
    'payment_date', 'order_date', 'delivery_date', 'invoice_date', 'graduation_date',
    'recording_date', 'incident_date', 'test_date', 'prescription_date',
    'statement_period_from', 'statement_period_to'
  ];

  // Check top-level fields
  dateFields.forEach(field => {
    const value = extracted[field];
    if (value && !isValidDate(value)) {
      invalidDates.push(field);
    }
  });

  // Check section fields
  (extracted.sections || []).forEach(section => {
    Object.entries(section.fields || {}).forEach(([key, value]) => {
      if (key.includes('date') && value && !isValidDate(value)) {
        invalidDates.push(`${section.section_type}.${key}`);
      }
    });
  });

  return invalidDates;
}

// ==================== MATH INTEGRITY ====================

/**
 * Checks math integrity for financial documents
 */
export function checkMathIntegrity(extracted, docType) {
  if (!['invoice', 'purchase-order', 'receipt'].includes(docType)) return false;

  const subtotal = extracted.subtotal;
  const total = extracted.total_amount;

  if (typeof subtotal !== 'number' || typeof total !== 'number' || total <= 0) return false;

  const calculated = (subtotal || 0) + (extracted.tax_amount || 0) + (extracted.shipping_amount || 0) - (extracted.discount_amount || 0);
  return Math.abs(calculated - total) > 0.01;
}

/**
 * Checks balance integrity for bank statements
 */
export function checkBalanceIntegrity(extracted, docType) {
  if (docType !== 'bank-statement' && docType !== 'credit-card-statement') return false;

  const transactions = getItemsFromSection(extracted.sections, 'transactions');
  if (!transactions.length) return false;

  const balancesSection = extracted.sections?.find(s => s.section_type === 'balances');
  const closingBalance = balancesSection?.fields?.closing_balance ?? extracted.closing_balance;

  const lastTxn = transactions[transactions.length - 1];
  if (typeof lastTxn?.balance !== 'number' || typeof closingBalance !== 'number') return false;

  return Math.abs(lastTxn.balance - closingBalance) > 0.01;
}

// ==================== PLACEHOLDER DETECTION ====================

/**
 * Checks all fields for placeholder values
 */
export function checkPlaceholders(extracted, flags = []) {
  // Check sections
  (extracted.sections || []).forEach(section => {
    Object.entries(section.fields || {}).forEach(([key, value]) => {
      if (isPlaceholder(value)) {
        flags.push({
          type: 'WARNING',
          field: `${section.section_type}.${key}`,
          message: `Placeholder value detected for ${key}`
        });
      }
    });
  });

  // Check specific_fields
  Object.entries(extracted.specific_fields || {}).forEach(([key, value]) => {
    if (isPlaceholder(value)) {
      flags.push({
        type: 'WARNING',
        field: `specific_fields.${key}`,
        message: `Placeholder value detected for ${key}`
      });
    }
  });

  return flags;
}

// ==================== COMPLETENESS ====================

/**
 * Calculates extraction completeness percentage
 */
export function calculateCompleteness(extracted, typeInfo) {
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
    if (hasValue(specificFields[rf]) || hasValue(getFieldFromSections(sections, rf))) {
      present += 1;
    }
  });

  return present / total;
}

// ==================== COUNTING ====================

/**
 * Counts total extracted fields across all sections
 */
export function countExtractedFields(extracted) {
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

/**
 * Estimates total possible fields for a document type
 */
export function estimateTotalFields(typeInfo) {
  return (typeInfo.sections?.length || 1) + (typeInfo.requiredFields?.length || 0) + 5;
}
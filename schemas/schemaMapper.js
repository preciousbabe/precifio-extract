// ============================================================
// SCHEMA MAPPER — Converts flexible format ↔ legacy flat format
// ============================================================

import { 
  isLegacyType, 
  getDocumentTypeInfo, 
  matchFieldName,
  getDocumentCategory,
  DOCUMENT_CATEGORIES 
} from './documentRegistry.js';

// Type-specific issuer/recipient field mappings
// Maps: which flat field → which party (issuer/recipient)
const TYPE_PARTY_MAPPINGS = {
  // Financial
  invoice: { issuer: ['vendor_name', 'seller_name'], recipient: ['buyer_name', 'customer_name'] },
  receipt: { issuer: ['vendor_name', 'merchant_name', 'store_name'], recipient: [] },
  'bank-statement': { issuer: ['bank_name'], recipient: ['account_name', 'account_holder'] },
  'credit-card-statement': { issuer: ['card_issuer', 'bank_name'], recipient: ['cardholder_name'] },
  'purchase-order': { issuer: ['buyer_name', 'buyer_company'], recipient: ['vendor_name', 'supplier_name'] },
  'expense-report': { issuer: ['employee_name', 'submitted_by'], recipient: ['approver_name', 'manager_name'] },
  'tax-form': { issuer: ['taxpayer_name', 'filer_name'], recipient: ['preparer_name'] },
  'payroll-report': { issuer: ['company_name', 'employer_name'], recipient: [] },
  'utility-bill': { issuer: ['vendor_name', 'utility_provider'], recipient: ['customer_name'] },
  
  // Legal
  contract: { issuer: ['vendor_name', 'party_a', 'first_party'], recipient: ['counterparty', 'party_b', 'second_party'] },
  'lease-agreement': { issuer: ['lessor', 'landlord'], recipient: ['lessee', 'tenant'] },
  nda: { issuer: ['disclosing_party'], recipient: ['receiving_party'] },
  'service-agreement': { issuer: ['provider', 'service_provider'], recipient: ['client', 'customer'] },
  'court-document': { issuer: ['plaintiff', 'petitioner'], recipient: ['defendant', 'respondent'] },
  'property-deed': { issuer: ['grantor', 'seller'], recipient: ['grantee', 'buyer'] },
  
  // HR
  resume: { issuer: ['full_name', 'candidate_name'], recipient: [] },
  'employment-contract': { issuer: ['employer_name', 'company'], recipient: ['employee_name'] },
  'offer-letter': { issuer: ['employer_name', 'company'], recipient: ['candidate_name'] },
  'employee-record': { issuer: ['employer_name', 'company'], recipient: ['full_name', 'employee_name'] },
  'performance-review': { issuer: ['reviewer_name', 'manager'], recipient: ['employee_name', 'reviewee'] },
  
  // Healthcare
  'medical-report': { issuer: ['provider_name', 'physician', 'doctor'], recipient: ['patient_name'] },
  'lab-result': { issuer: ['lab_name', 'ordering_provider'], recipient: ['patient_name'] },
  prescription: { issuer: ['prescriber_name', 'pharmacy'], recipient: ['patient_name'] },
  'patient-intake': { issuer: ['provider_name', 'clinic'], recipient: ['patient_name'] },
  
  // Insurance
  'insurance-claim': { issuer: ['claimant_name', 'insured_name'], recipient: ['adjuster_name'] },
  
  // Logistics
  'bill-of-lading': { issuer: ['shipper', 'exporter'], recipient: ['consignee', 'importer'] },
  'shipping-manifest': { issuer: ['vessel_owner', 'carrier'], recipient: [] },
  'delivery-note': { issuer: ['sender', 'shipper'], recipient: ['recipient_name', 'delivered_to'] },
  'customs-document': { issuer: ['exporter'], recipient: ['importer'] },
  
  // Real Estate
  'property-valuation': { issuer: ['appraiser_name', 'appraisal_firm'], recipient: ['property_owner'] },
  'inspection-report': { issuer: ['inspector_name', 'inspection_firm'], recipient: ['property_owner', 'client'] },
  'mortgage-document': { issuer: ['lender_name', 'mortgagee'], recipient: ['borrower_name', 'mortgagor'] },
  'land-registry': { issuer: ['registrar', 'registry'], recipient: ['owner_name'] },
  
  // Education
  transcript: { issuer: ['institution_name', 'university'], recipient: ['student_name'] },
  certificate: { issuer: ['institution_name', 'issuing_body'], recipient: ['recipient_name'] },
  diploma: { issuer: ['institution_name', 'university'], recipient: ['graduate_name'] },
  'student-record': { issuer: ['institution_name', 'school'], recipient: ['student_name'] },
  
  // Government
  passport: { issuer: ['issuing_authority', 'country'], recipient: ['full_name', 'holder_name'] },
  'drivers-license': { issuer: ['issuing_state', 'dmv'], recipient: ['full_name', 'licensee'] },
  'national-id': { issuer: ['issuing_authority', 'government'], recipient: ['full_name', 'holder_name'] },
  permit: { issuer: ['issuing_authority', 'agency'], recipient: ['holder_name', 'permit_holder'] },
  license: { issuer: ['issuing_authority', 'board'], recipient: ['holder_name', 'licensee'] }
};

// Type-specific date field priority (which flat field to use for `date`)
const TYPE_DATE_FIELDS = {
  invoice: ['invoice_date', 'date', 'issue_date'],
  receipt: ['date', 'receipt_date', 'transaction_date'],
  'bank-statement': ['statement_period', 'date'],
  'credit-card-statement': ['statement_period', 'issue_date'],
  'purchase-order': ['order_date', 'date'],
  'expense-report': ['submission_date', 'date'],
  'tax-form': ['tax_year', 'issue_date'],
  'payroll-report': ['pay_period', 'pay_date'],
  'utility-bill': ['date', 'issue_date'],
  contract: ['effective_date', 'date', 'issue_date'],
  'lease-agreement': ['start_date', 'effective_date'],
  nda: ['effective_date', 'date'],
  'service-agreement': ['start_date', 'effective_date'],
  'court-document': ['filing_date', 'date'],
  'property-deed': ['recording_date', 'date'],
  resume: ['date', 'issue_date'],
  'employment-contract': ['start_date', 'effective_date'],
  'offer-letter': ['offer_date', 'date'],
  'employee-record': ['hire_date', 'date'],
  'performance-review': ['review_date', 'date'],
  'medical-report': ['report_date', 'date'],
  'lab-result': ['test_date', 'date'],
  prescription: ['prescription_date', 'date'],
  'patient-intake': ['date', 'issue_date'],
  'insurance-claim': ['incident_date', 'date'],
  'bill-of-lading': ['issue_date', 'date'],
  'shipping-manifest': ['date_of_departure', 'date'],
  'delivery-note': ['delivery_date', 'date'],
  'customs-document': ['issue_date', 'date'],
  'property-valuation': ['valuation_date', 'date'],
  'inspection-report': ['inspection_date', 'date'],
  'mortgage-document': ['origination_date', 'date'],
  'land-registry': ['registration_date', 'date'],
  transcript: ['graduation_date', 'issue_date'],
  certificate: ['issue_date', 'date'],
  diploma: ['graduation_date', 'issue_date'],
  'student-record': ['enrollment_date', 'date'],
  passport: ['issue_date', 'date'],
  'drivers-license': ['issue_date', 'date'],
  'national-id': ['issue_date', 'date'],
  permit: ['issue_date', 'date'],
  license: ['issue_date', 'date']
};

/**
 * Extracts all fields from sections into a flat object with canonical names
 */
function extractFieldsFromSections(sections = [], docType) {
  const extracted = {};
  
  for (const section of sections) {
    // Extract from section.fields
    for (const [rawKey, value] of Object.entries(section.fields || {})) {
      if (value === null || value === undefined || value === '') continue;
      
      const canonical = matchFieldName(rawKey, docType);
      const key = canonical || rawKey;
      
      // Don't overwrite with null/empty, but do overwrite if new value is more specific
      if (!(key in extracted) || 
          (extracted[key] === null && value !== null) ||
          (typeof extracted[key] === 'string' && extracted[key].length < (String(value).length))) {
        extracted[key] = value;
      }
    }
    
    // Extract from section.items (for line items, transactions, etc.)
    if (section.items?.length > 0) {
      const itemType = inferItemType(section.section_type, docType);
      if (itemType) {
        extracted[itemType] = section.items;
      }
    }
  }
  
  return extracted;
}

/**
 * Maps section types to legacy array field names
 */
function inferItemType(sectionType, docType) {
  const mappings = {
    line_items: ['line_items', 'items'],
    transactions: ['transactions'],
    items: ['items', 'line_items'],
    expenses: ['expense_items'],
    courses: ['courses'],
    grades: ['grades'],
    employees: ['employees'],
    cargo_items: ['cargo_items'],
    cargo_list: ['cargo_items'],
    items_delivered: ['items_delivered'],
    goods: ['items'],
    experience: ['experience'],
    education: ['education'],
    skills: ['skills'],
    certifications: ['certifications'],
    findings: ['findings'],
    recommendations: ['recommendations'],
    results: ['results'],
    medications: ['medications'],
    allergies: ['allergies']
  };
  
  const possible = mappings[sectionType];
  if (!possible) return null;
  
  // Return the first one that exists as a field in the registry for this type
  const info = getDocumentTypeInfo(docType);
  if (!info.fieldWeights) return possible[0];
  
  for (const field of possible) {
    if (field in info.fieldWeights) return field;
  }
  
  return possible[0];
}

/**
 * Maps the new flexible document format to the old flat schema
 * for backward compatibility with existing UI components.
 */
export function mapToLegacyFormat(flexibleDoc) {
  if (!flexibleDoc) return flexibleDoc;
  
  const docType = flexibleDoc.document_type;
  const info = getDocumentTypeInfo(docType);
  const partyMap = TYPE_PARTY_MAPPINGS[docType] || { issuer: [], recipient: [] };
  
  // Start with the original doc
  let result = { ...flexibleDoc };
  
  // Step 1: Extract fields from sections (highest priority)
  const sectionFields = extractFieldsFromSections(flexibleDoc.sections, docType);
  
  // Step 2: Merge section fields → flat fields (section fields win over existing nulls)
  for (const [key, value] of Object.entries(sectionFields)) {
    if (value !== null && value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  
  // Step 3: Map issuer → type-specific flat fields
  const issuer = flexibleDoc.issuer || {};
  if (issuer.name) {
    for (const field of partyMap.issuer) {
      if (!result[field]) result[field] = issuer.name;
    }
    // Always set vendor_name as fallback
    if (!result.vendor_name) result.vendor_name = issuer.name;
  }
  if (issuer.address && !result.vendor_address) result.vendor_address = issuer.address;
  if (issuer.tax_id && !result.vendor_tax_id) result.vendor_tax_id = issuer.tax_id;
  if (issuer.email && !result.vendor_email) result.vendor_email = issuer.email;
  if (issuer.phone && !result.vendor_phone) result.vendor_phone = issuer.phone;
  if (issuer.website && !result.vendor_website) result.vendor_website = issuer.website;
  if (issuer.registration_number && !result.vendor_registration_number) {
    result.vendor_registration_number = issuer.registration_number;
  }
  if (issuer.id_number && !result.vendor_id_number) result.vendor_id_number = issuer.id_number;
  
  // Step 4: Map recipient → type-specific flat fields
  const recipient = flexibleDoc.recipient || {};
  if (recipient.name) {
    for (const field of partyMap.recipient) {
      if (!result[field]) result[field] = recipient.name;
    }
    // Always set buyer_name as fallback
    if (!result.buyer_name) result.buyer_name = recipient.name;
  }
  if (recipient.address && !result.buyer_address) result.buyer_address = recipient.address;
  if (recipient.tax_id && !result.buyer_tax_id) result.buyer_tax_id = recipient.tax_id;
  if (recipient.email && !result.buyer_email) result.buyer_email = recipient.email;
  if (recipient.id_number && !result.buyer_id_number) result.buyer_id_number = recipient.id_number;
  if (recipient.date_of_birth && !result.date_of_birth) result.date_of_birth = recipient.date_of_birth;
  
  // Step 5: Map dates
  const datePriority = TYPE_DATE_FIELDS[docType] || ['date', 'issue_date'];
  for (const dateField of datePriority) {
    if (result[dateField]) {
      if (!result.date) result.date = result[dateField];
      break;
    }
  }
  if (!result.date) result.date = flexibleDoc.issue_date || flexibleDoc.effective_date || null;
  
  // Step 6: Map total_amount from specific_fields if missing
  if (!result.total_amount && flexibleDoc.specific_fields?.total_amount) {
    result.total_amount = flexibleDoc.specific_fields.total_amount;
  }
  
  // Step 7: Sync category
  const categoryMap = {
    [DOCUMENT_CATEGORIES.FINANCIAL]: 'Banking & Finance',
    [DOCUMENT_CATEGORIES.LEGAL]: 'Professional Services',
    [DOCUMENT_CATEGORIES.HR]: 'Professional Services',
    [DOCUMENT_CATEGORIES.HEALTHCARE]: 'Insurance',
    [DOCUMENT_CATEGORIES.INSURANCE]: 'Insurance',
    [DOCUMENT_CATEGORIES.LOGISTICS]: 'Shipping & Logistics',
    [DOCUMENT_CATEGORIES.REAL_ESTATE]: 'Rent & Facilities',
    [DOCUMENT_CATEGORIES.EDUCATION]: 'Professional Services',
    [DOCUMENT_CATEGORIES.GOVERNMENT]: 'Taxes & Government',
    [DOCUMENT_CATEGORIES.OTHER]: 'Uncategorized'
  };
  result.category = categoryMap[info.category] || flexibleDoc.category || 'Uncategorized';
  
  // Step 8: For non-legacy types, generate summary notes
  if (!isLegacyType(docType) && !result.notes) {
    result.notes = generateSummaryFromSections(flexibleDoc.sections);
  }
  
  // Step 9: Ensure document_category is set
  if (!result.document_category) {
    result.document_category = info.category;
  }
  
  return result;
}

/**
 * Maps old flat format to new flexible format (for migrations)
 */
export function mapToFlexibleFormat(legacyDoc) {
  if (!legacyDoc) return legacyDoc;
  
  const typeInfo = getDocumentTypeInfo(legacyDoc.document_type);
  const partyMap = TYPE_PARTY_MAPPINGS[legacyDoc.document_type] || { issuer: [], recipient: [] };
  
  // Build issuer from legacy fields
  const issuer = {
    name: legacyDoc.vendor_name || legacyDoc[partyMap.issuer[0]] || null,
    address: legacyDoc.vendor_address || null,
    tax_id: legacyDoc.vendor_tax_id || null,
    email: legacyDoc.vendor_email || null,
    phone: legacyDoc.vendor_phone || null,
    website: legacyDoc.vendor_website || null,
    registration_number: legacyDoc.vendor_registration_number || null,
    id_number: legacyDoc.vendor_id_number || null
  };
  
  // Build recipient from legacy fields
  const recipient = {
    name: legacyDoc.buyer_name || legacyDoc[partyMap.recipient[0]] || legacyDoc.counterparty || null,
    address: legacyDoc.buyer_address || null,
    tax_id: legacyDoc.buyer_tax_id || null,
    email: legacyDoc.buyer_email || null,
    id_number: legacyDoc.buyer_id_number || null,
    date_of_birth: legacyDoc.date_of_birth || null
  };
  
  // Build sections from legacy array fields
  const sections = [];
  
  const arrayFields = ['line_items', 'items', 'transactions', 'experience', 'education', 
    'skills', 'certifications', 'courses', 'grades', 'employees', 'expense_items',
    'cargo_items', 'items_delivered', 'findings', 'recommendations', 'results',
    'medications', 'allergies'];
  
  for (const field of arrayFields) {
    if (legacyDoc[field]?.length > 0) {
      sections.push({
        section_type: field,
        section_title: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        items: legacyDoc[field],
        fields: {},
        text: ''
      });
    }
  }
  
  // Build specific_fields from remaining non-standard fields
  const standardFields = new Set([
    'document_type', 'document_subtype', 'document_category', 'issuer', 'recipient',
    'issue_date', 'effective_date', 'expiry_date', 'total_amount', 'currency', 'tax_amount',
    'sections', 'specific_fields', 'category', 'confidence_scores', '_schema_version', '_source',
    'vendor_name', 'vendor_address', 'vendor_tax_id', 'vendor_email', 'vendor_phone',
    'vendor_website', 'vendor_registration_number', 'buyer_name', 'buyer_address',
    'buyer_tax_id', 'buyer_email', 'date', 'notes', ...arrayFields
  ]);
  
  const specific_fields = {};
  for (const [key, value] of Object.entries(legacyDoc)) {
    if (!standardFields.has(key) && value !== null && value !== undefined) {
      specific_fields[key] = value;
    }
  }
  
  return {
    document_type: legacyDoc.document_type,
    document_subtype: null,
    document_category: typeInfo.category,
    
    issuer,
    recipient,
    
    issue_date: legacyDoc.date || legacyDoc.invoice_date || legacyDoc.effective_date || null,
    effective_date: legacyDoc.effective_date || null,
    expiry_date: legacyDoc.expiration_date || legacyDoc.expiry_date || null,
    
    total_amount: legacyDoc.total_amount || null,
    currency: legacyDoc.currency || 'USD',
    tax_amount: legacyDoc.tax_amount || 0,
    
    sections,
    specific_fields,
    
    // Keep all legacy fields for backward compat
    ...legacyDoc,
    
    _schema_version: 'v8-flexible'
  };
}

/**
 * Generates a human-readable summary from sections for display in legacy UI
 */
function generateSummaryFromSections(sections = []) {
  if (!sections.length) return 'No structured data extracted';
  
  const lines = [];
  sections.forEach(section => {
    const title = section.section_title || section.section_type;
    lines.push(`\n=== ${title} ===`);
    
    // Add fields
    Object.entries(section.fields || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        lines.push(`${key}: ${value}`);
      }
    });
    
    // Add items (first 3)
    const items = section.items || [];
    if (items.length > 0) {
      lines.push(`Items (${items.length}):`);
      items.slice(0, 3).forEach((item, i) => {
        const itemStr = Object.entries(item)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        lines.push(`  ${i + 1}. ${itemStr}`);
      });
      if (items.length > 3) lines.push(`  ... and ${items.length - 3} more`);
    }
    
    // Add text
    if (section.text) {
      lines.push(section.text.substring(0, 500));
    }
  });
  
  return lines.join('\n');
}

/**
 * Extracts a specific section from the flexible document
 */
export function getSection(doc, sectionType) {
  if (!doc?.sections) return null;
  return doc.sections.find(s => s.section_type === sectionType) || null;
}

/**
 * Gets a field value from sections (searches all sections)
 */
export function getFieldFromSections(doc, fieldName) {
  if (!doc?.sections) return null;
  for (const section of doc.sections) {
    if (section.fields?.[fieldName] !== undefined) {
      return section.fields[fieldName];
    }
  }
  return null;
}

/**
 * Gets all items from a specific section type
 */
export function getItemsFromSection(doc, sectionType) {
  const section = getSection(doc, sectionType);
  return section?.items || [];
}

/**
 * NEW: Gets all fields from all sections as a flat object
 */
export function getAllSectionFields(doc) {
  if (!doc?.sections) return {};
  const result = {};
  for (const section of doc.sections) {
    Object.assign(result, section.fields || {});
  }
  return result;
}

/**
 * NEW: Finds a field by alias (searches sections + flat fields)
 */
export function findFieldByAlias(doc, possibleNames, docType) {
  // Check flat fields first
  for (const name of possibleNames) {
    if (doc?.[name] !== undefined && doc[name] !== null) {
      return { value: doc[name], source: 'flat', field: name };
    }
  }
  
  // Check sections
  if (doc?.sections) {
    for (const section of doc.sections) {
      for (const name of possibleNames) {
        const canonical = docType ? matchFieldName(name, docType) : name;
        const searchKey = canonical || name;
        if (section.fields?.[searchKey] !== undefined && section.fields[searchKey] !== null) {
          return { value: section.fields[searchKey], source: 'section', field: searchKey };
        }
      }
    }
  }
  
  return null;
}

/**
 * NEW: Validates that a legacy-mapped document has all required fields
 */
export function validateLegacyMapping(mappedDoc, docType) {
  const info = getDocumentTypeInfo(docType);
  const missing = [];
  
  for (const required of info.requiredFields || []) {
    if (mappedDoc[required] === null || mappedDoc[required] === undefined || mappedDoc[required] === '') {
      missing.push(required);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    completeness: info.requiredFields ? 
      ((info.requiredFields.length - missing.length) / info.requiredFields.length) : 1
  };
}
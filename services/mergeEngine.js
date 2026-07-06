import { 
  getDocumentTypeInfo, 
  isLegacyType,
  matchFieldName,
  getFieldAliases,
  getFieldWeight,
  getAllDocumentTypes,
  DOCUMENT_CATEGORIES
} from '../schemas/documentRegistry.js';

// ============================================================
// DYNAMIC MERGE ENGINE — Registry-driven, section-native
// ============================================================

export function mergeExtraction({ aws = null, gpt = null }) {
  aws = aws || {};
  gpt = gpt || {};

  // Determine final document type
  const detectedType = pickString(gpt.document_type, aws.document_type) || 'unknown';
  const typeInfo = getDocumentTypeInfo(detectedType);

  // === DYNAMIC FIELD MERGE ===
  const merged = {
    document_type: detectedType,
    document_subtype: pickString(gpt.document_subtype, aws.document_subtype),
    document_category: pickString(gpt.document_category, aws.document_category) || typeInfo.category || 'other',

    // Parties
    issuer: mergeParty(aws.issuer, gpt.issuer, aws, gpt, 'issuer', detectedType),
    recipient: mergeParty(aws.recipient, gpt.recipient, aws, gpt, 'recipient', detectedType),
    // Common dates
    issue_date: pickDate(gpt.issue_date, aws.issue_date, gpt.date, aws.date),
    effective_date: pickString(gpt.effective_date, aws.effective_date),
    expiry_date: pickString(gpt.expiry_date, aws.expiry_date) || pickString(gpt.expiration_date, aws.expiration_date),

    // Financial
    total_amount: pickNumber(gpt.total_amount, aws.total_amount),
    currency: pickString(gpt.currency, aws.currency) || 'USD',
    tax_amount: pickNumber(gpt.tax_amount, aws.tax_amount) || 0,

    // Flexible structures (sections are the source of truth)
    sections: mergeSections(aws.sections, gpt.sections),
    specific_fields: (() => {
  const awsSpec = typeof aws.specific_fields === 'object' && aws.specific_fields !== null && !Array.isArray(aws.specific_fields)
    ? aws.specific_fields
    : {};
  const gptSpec = typeof gpt.specific_fields === 'object' && gpt.specific_fields !== null && !Array.isArray(gpt.specific_fields)
    ? gpt.specific_fields
    : {};
  // Only keep primitive values
  const cleaned = {};
  for (const [k, v] of Object.entries({ ...awsSpec, ...gptSpec })) {
    if (v !== null && v !== undefined && !Array.isArray(v) && typeof v !== 'object') {
      cleaned[k] = v;
    }
  }
  return cleaned;
})(),

    // Legacy common fields (kept for backward compat, but sections are primary)
    date: pickString(gpt.date, aws.date),
    notes: pickString(gpt.notes, aws.notes),
    document_source: pickString(gpt.document_source, aws.document_source),
    document_id: pickString(gpt.document_id, aws.document_id),
    document_title: pickString(gpt.document_title, aws.document_title),
    created_date: pickString(gpt.created_date, aws.created_date),
    updated_date: pickString(gpt.updated_date, aws.updated_date),
    country: pickString(gpt.country, aws.country),
    state: pickString(gpt.state, aws.state),
    language: pickString(gpt.language, aws.language),
    category: pickString(gpt.category, aws.category) || typeInfo.category || 'Uncategorized',
  };

  // === DYNAMIC TYPE-SPECIFIC FIELD MERGE ===
  const allKnownFields = new Set([
    ...(typeInfo.expectedFields || []),
    ...(typeInfo.requiredFields || []),
    ...(typeInfo.fieldWeights ? Object.keys(typeInfo.fieldWeights) : []),
    ...(typeInfo.fieldAliases ? Object.keys(typeInfo.fieldAliases) : [])
  ]);

  for (const field of allKnownFields) {
    if (field in merged) continue;

    const aliases = getFieldAliases(detectedType, field);
    let value = null;

    for (const alias of aliases) {
      const gptVal = getNestedValue(gpt, alias);
      const awsVal = getNestedValue(aws, alias);
      const picked = pickValue(gptVal, awsVal);
      if (picked !== null) {
        value = picked;
        break;
      }
    }

    if (value === null) {
      const sectionVal = getFieldFromSections(merged.sections, field);
      if (sectionVal !== null) value = sectionVal;
    }

    merged[field] = coerceValue(value, field);
  }

  // === DYNAMIC ARRAY FIELD MERGE ===
  const arrayFields = inferArrayFields(typeInfo);
  for (const field of arrayFields) {
    merged[field] = pickArray(gpt[field], aws[field]);
  }

  // === POST-MERGE: SECTION-NATIVE PROCESSING ===
  applyPostMergeFixes(merged, detectedType, typeInfo);

  // === SOURCE TRACKING ===
  merged._source = {
    aws: Object.keys(aws).length > 0,
    gpt: Object.keys(gpt).length > 0
  };

  return merged;
}

// ==================== MERGE HELPERS ====================

function mergeParty(awsParty, gptParty, awsFlat, gptFlat, partyType, docType) {
  const party = {
    name: pickString(gptParty?.name, awsParty?.name),
    address: pickString(gptParty?.address, awsParty?.address),
    tax_id: pickString(gptParty?.tax_id, awsParty?.tax_id),
    email: pickString(gptParty?.email, awsParty?.email),
    phone: pickString(gptParty?.phone, awsParty?.phone),
    website: pickString(gptParty?.website, awsParty?.website),
    registration_number: pickString(gptParty?.registration_number, awsParty?.registration_number),
    id_number: pickString(gptParty?.id_number, awsParty?.id_number),
    date_of_birth: pickString(gptParty?.date_of_birth, awsParty?.date_of_birth)
  };

  if (!party.name) {
    // Build alias list dynamically from registry
    const buildPartyAliases = (canonicalFields) => {
      const aliases = new Set();
      for (const type of [docType, 'unknown']) {
        const info = getDocumentTypeInfo(type);
        if (!info.fieldAliases) continue;
        for (const canonical of canonicalFields) {
          const fieldAliases = getFieldAliases(type, canonical);
          fieldAliases.forEach(a => aliases.add(a));
        }
      }
      return Array.from(aliases);
    };

    const flatNames = partyType === 'issuer' 
      ? buildPartyAliases(['vendor_name', 'bank_name', 'company_name', 'employer_name', 'provider_name', 
           'institution_name', 'issuing_authority', 'shipper', 'lessor', 'grantor'])
      : buildPartyAliases(['buyer_name', 'counterparty', 'account_name', 'employee_name', 'patient_name',
           'student_name', 'claimant_name', 'cardholder_name', 'consignee', 'lessee', 'grantee']);

    for (const field of flatNames) {
      party.name = pickString(gptFlat[field], awsFlat[field]);
      if (party.name) break;
    }
  }

  return Object.fromEntries(Object.entries(party).filter(([_, v]) => v !== null));
}


function getNestedValue(obj, path) {
  if (!obj || typeof obj !== 'object') return null;
  return obj[path] ?? null;
}

function pickValue(gptVal, awsVal) {
  if (gptVal !== null && gptVal !== undefined && gptVal !== '') return gptVal;
  if (awsVal !== null && awsVal !== undefined && awsVal !== '') return awsVal;
  return null;
}

function pickString(a, b) {
  const val = pickValue(a, b);
  return val ? String(val).trim() : null;
}

function pickNumber(a, b) {
  const isValid = (v) => typeof v === 'number' && !isNaN(v);
  if (isValid(a)) return a;
  if (isValid(b)) return b;
  
  const parseNumericString = (str) => {
    if (typeof str !== 'string') return null;
    // Handle formats: $1,234.56 | 1.234,56 | 1 234,56 | USD 1,234.56 | 1,234.56 USD
    const cleaned = str
      .replace(/[₦,$€£\s]/g, '')     // Remove currency symbols and spaces
      .replace(/[a-zA-Z]/g, '')      // Remove any remaining letters
      .replace(/\.(?=.*\.)/g, '')     // Remove all but last dot (thousand separators)
      .replace(/,(?=.*,)/g, '')       // Remove all but last comma (thousand separators)
      .replace(',', '.');             // Convert comma decimal to dot
    const parsed = parseFloat(cleaned);
    return !isNaN(parsed) ? parsed : null;
  };

  const parsedA = parseNumericString(a);
  if (parsedA !== null) return parsedA;
  
  const parsedB = parseNumericString(b);
  if (parsedB !== null) return parsedB;
  
  return null;
}


function pickDate(...vals) {
  for (const val of vals) {
    if (!val) continue;
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split('T')[0];
  }
  return null;
}

function pickArray(a, b) {
  if (Array.isArray(a) && a.length) return a;
  if (Array.isArray(b) && b.length) return b;
  return [];
}

function coerceValue(value, fieldName) {
  const name = fieldName.toLowerCase();

  if (name.includes('date') || name.includes('_date')) {
    return pickDate(value);
  }

  if (name.includes('amount') || name.includes('cost') || name.includes('price') || 
      name.includes('fee') || name.includes('total') || name.includes('balance') ||
      name.includes('value') || name.includes('salary') || name.includes('rent') ||
      name.includes('deposit') || name.includes('gpa') || name.includes('quantity') ||
      name.includes('rate') || name.includes('percent') || name.includes('debit') ||
      name.includes('credit')) {
    return pickNumber(value, null);
  }

  if (name.includes('period') || name.includes('range')) {
    if (value && typeof value === 'object') return value;
    return null;
  }

  return value !== null ? String(value).trim() : null;
}

function inferArrayFields(typeInfo) {
  // Known array fields from registry analysis
  const knownArrayFields = [
    'line_items', 'items', 'transactions', 'courses', 'grades', 
    'employees', 'experience', 'education', 'skills', 'certifications', 
    'medications', 'allergies', 'findings', 'recommendations', 
    'cargo_items', 'items_delivered', 'tax_details', 'signatures',
    'encumbrances', 'previous_owners', 'comparable_sales', 'employees',
    'expense_items', 'courses', 'grades', 'honors', 'semester_dates',
    'disciplinary_record', 'policy_violations', 'results', 'reference_ranges',
    'abnormal_flags', 'current_medications', 'family_history', 'social_history',
    'fees_charged', 'rewards_points', 'cash_advance', 'containers'
  ];

  const fromRegistry = (typeInfo.expectedFields || []).filter(f => {
    // Explicitly known
    if (knownArrayFields.some(k => f === k || f.includes(k))) return true;
    // Schema-level array fields (check if schema defines them as arrays)
    return false; // We'll rely on the explicit list + section inference
  });

  // Also infer from sections that have items
  const fromSections = (typeInfo.sections || []).map(s => {
    const mappings = {
      line_items: 'line_items', items: 'items', transactions: 'transactions',
      expenses: 'expense_items', courses: 'courses', grades: 'grades',
      employee_earnings: 'employees', cargo_list: 'cargo_items',
      items_delivered: 'items_delivered', diagnosis: 'diagnosis',
      treatment: 'treatment_plan', medications: 'medications',
      allergies: 'allergies', findings: 'findings',
      recommendations: 'recommendations', results: 'results',
      experience: 'experience', education: 'education',
      skills: 'skills', certifications: 'certifications'
    };
    return mappings[s];
  }).filter(Boolean);

  return [...new Set([...fromRegistry, ...fromSections])];
}

// ==================== SECTION-NATIVE POST-MERGE ====================

function applyPostMergeFixes(merged, docType, typeInfo) {
  // Ensure sections is always an array
  merged.sections = Array.isArray(merged.sections) ? merged.sections : [];

  if (merged.transactions?.length > 0 && !getItemsFromSection(merged.sections, 'transactions').length) {
    merged.sections.push({
      section_type: 'transactions',
      section_title: 'Transactions',
      fields: {},
      items: merged.transactions,
      text: ''
    });
  }

  if (merged.line_items?.length > 0 && !getItemsFromSection(merged.sections, 'line_items').length) {
    merged.sections.push({
      section_type: 'line_items',
      section_title: 'Line Items',
      fields: {},
      items: merged.line_items,
      text: ''
    });
  }

  if (merged.items?.length > 0 && !getItemsFromSection(merged.sections, 'items').length) {
    merged.sections.push({
      section_type: 'items',
      section_title: 'Items',
      fields: {},
      items: merged.items,
      text: ''
    });
  }

  // === PROMOTE TOP-LEVEL FIELDS TO SECTIONS ===
  // Group known fields into semantic sections based on naming patterns
  const sectionMappings = buildSectionMappings(typeInfo, merged);

  for (const [sectionType, fields] of Object.entries(sectionMappings)) {
    const existingSection = merged.sections.find(s => s.section_type === sectionType);
    const sectionFields = {};

    for (const field of fields) {
      if (merged[field] != null && !getFieldFromSections(merged.sections, field)) {
        sectionFields[field] = merged[field];
      }
    }

    if (Object.keys(sectionFields).length > 0) {
      if (existingSection) {
        existingSection.fields = { ...sectionFields, ...existingSection.fields };
      } else {
        merged.sections.push({
          section_type: sectionType,
          section_title: sectionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          fields: sectionFields,
          items: [],
          text: ''
        });
      }
    }
  }

  // === DERIVE TOP-LEVEL FIELDS FROM SECTIONS (for backward compat only) ===
  const derivedFields = deriveTopLevelFromSections(merged.sections);
  for (const [key, value] of Object.entries(derivedFields)) {
    if (merged[key] == null) merged[key] = value;
  }

  // === DOCUMENT-TYPE SPECIFIC DERIVATIONS ===
  deriveDocumentSpecific(merged, docType, typeInfo);
   merged.category = merged.document_category || merged.category || 'Uncategorized';
  merged.line_items = merged.line_items || [];
  merged.items = merged.items || [];
  merged.transactions = merged.transactions || [];

  // === EXTRACT TAX DETAILS FROM SECTIONS ===
  const taxSection = merged.sections?.find(s => 
    s.section_type === 'tax_breakdown' || 
    s.section_type === 'tax_details' ||
    s.section_title?.toLowerCase().includes('tax')
  );
  
  if (taxSection && !merged.tax_details?.length) {
    if (taxSection.items?.length > 0) {
      merged.tax_details = taxSection.items.map(item => ({
        type: item.type || item.tax_type || 'Unknown',
        rate: pickNumber(item.rate, item.tax_rate),
        amount: pickNumber(item.amount, item.tax_amount) || 0
      })).filter(t => t.amount !== null);
    } else if (taxSection.fields) {
      const taxAmount = pickNumber(taxSection.fields.tax_amount, taxSection.fields.amount);
      if (taxAmount !== null) {
        merged.tax_details = [{
          type: taxSection.fields.tax_type || taxSection.fields.type || 'Unknown',
          rate: pickNumber(taxSection.fields.tax_rate, taxSection.fields.rate),
          amount: taxAmount
        }];
      }
    }
  }
  
  // Ensure tax_details is always an array
  merged.tax_details = merged.tax_details || [];
}

function buildSectionMappings(typeInfo, merged) {
  const mappings = {};
  
  // Start with registry sections
  for (const sectionType of (typeInfo.sections || [])) {
    mappings[sectionType] = [];
  }
  
  // Distribute expectedFields into sections based on fieldAliases
  const fieldAliases = typeInfo.fieldAliases || {};
  
  for (const field of (typeInfo.expectedFields || [])) {
    // Find which section this field belongs to based on alias patterns
    let assigned = false;
    
    // Check if field name contains section type hints
    for (const sectionType of (typeInfo.sections || [])) {
      const sectionWords = sectionType.split('_');
      if (sectionWords.some(word => field.includes(word))) {
        if (!mappings[sectionType]) mappings[sectionType] = [];
        mappings[sectionType].push(field);
        assigned = true;
        break;
      }
    }
    
    // If not assigned, check aliases
    if (!assigned) {
      const aliases = fieldAliases[field] || [];
      for (const sectionType of (typeInfo.sections || [])) {
        const sectionWords = sectionType.split('_');
        if (aliases.some(alias => sectionWords.some(word => alias.includes(word)))) {
          if (!mappings[sectionType]) mappings[sectionType] = [];
          mappings[sectionType].push(field);
          assigned = true;
          break;
        }
      }
    }
    
    // Fallback: put in first section
    if (!assigned) {
      const firstSection = typeInfo.sections?.[0] || 'general';
      if (!mappings[firstSection]) mappings[firstSection] = [];
      mappings[firstSection].push(field);
    }
  }
  
  // Filter to only fields that exist in this document
  const result = {};
  for (const [sectionType, fields] of Object.entries(mappings)) {
    const present = fields.filter(f => merged[f] != null);
    if (present.length > 0) result[sectionType] = present;
  }
  
  return result;
}


function deriveTopLevelFromSections(sections) {
  const derived = {};
  if (!sections) return derived;

  for (const section of sections) {
    // Derive arrays from section items
    if (section.section_type === 'transactions' && section.items?.length > 0) {
      derived.transactions = section.items;
    }
    if (section.section_type === 'line_items' && section.items?.length > 0) {
      derived.line_items = section.items;
    }
    if (section.section_type === 'items' && section.items?.length > 0) {
      derived.items = section.items;
    }

    // Derive period from section fields
    if (section.section_type === 'statement_period' || section.section_type === 'period') {
      if (section.fields?.statement_period_from || section.fields?.statement_period_to) {
        derived.statement_period = {
          from: section.fields.statement_period_from || null,
          to: section.fields.statement_period_to || null
        };
      }
    }

    // Derive balances
    if (section.section_type === 'balances') {
      if (section.fields?.opening_balance != null) derived.opening_balance = section.fields.opening_balance;
      if (section.fields?.closing_balance != null) derived.closing_balance = section.fields.closing_balance;
      if (section.fields?.total_debits != null) derived.total_debits = section.fields.total_debits;
      if (section.fields?.total_credits != null) derived.total_credits = section.fields.total_credits;
    }

        // Derive tax_details from tax_breakdown section
    if (section.section_type === 'tax_breakdown' || section.section_type === 'tax_details') {
      if (section.items?.length > 0) {
        derived.tax_details = section.items.map(item => ({
          type: item.type || item.tax_type || 'Unknown',
          rate: pickNumber(item.rate, item.tax_rate),
          amount: pickNumber(item.amount, item.tax_amount) || 0
        }));
      } else if (section.fields?.tax_amount != null || section.fields?.amount != null) {
        derived.tax_details = [{
          type: section.fields.tax_type || section.fields.type || 'Unknown',
          rate: pickNumber(section.fields.tax_rate, section.fields.rate),
          amount: pickNumber(section.fields.tax_amount, section.fields.amount) || 0
        }];
      }
    }

  }

  return derived;
}

function deriveDocumentSpecific(merged, docType, typeInfo) {
  const fieldTypes = typeInfo.fieldTypes || {};
  
  // Derive period fields from date ranges in sections
  for (const [field, type] of Object.entries(fieldTypes)) {
    if (type === 'period' && !merged[field]) {
      // Look for period in sections
      const periodSection = merged.sections?.find(s => 
        s.section_type === field || s.section_type === field.replace('_', '')
      );
      if (periodSection?.fields) {
        const from = periodSection.fields[`${field}_from`] || periodSection.fields.from;
        const to = periodSection.fields[`${field}_to`] || periodSection.fields.to;
        if (from || to) {
          merged[field] = { from: from || null, to: to || null };
        }
      }
    }
  }
  
  // Derive balances from transactions for financial docs
  if (typeInfo.category === 'financial') {
    const transactions = getItemsFromSection(merged.sections, 'transactions');
    if (transactions.length > 0) {
      const dates = transactions
        .map(t => t.date)
        .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort();
      
      if (dates.length >= 2 && !merged.statement_period) {
        merged.statement_period = { from: dates[0], to: dates[dates.length - 1] };
      }
      
        const balancesSection = Array.isArray(merged.sections) && merged.sections.find(s => s.section_type === 'balances');
      if (balancesSection) {
        if (balancesSection.fields.opening_balance == null && transactions[0]?.balance != null) {
          balancesSection.fields.opening_balance = transactions[0].balance;
        }
        if (balancesSection.fields.closing_balance == null && transactions[transactions.length - 1]?.balance != null) {
          balancesSection.fields.closing_balance = transactions[transactions.length - 1].balance;
        }
      }
    }
  }
  
  // Clean garbage line items
  if (merged.line_items?.length > 0) {
    merged.line_items = merged.line_items.filter(item => {
      const desc = (item.description || '').trim();
      if (/^-?\d{1,2}$/.test(desc)) return false;
      if (/^\d{4}-\d{2}-\d{2}$/.test(desc)) return false;
      return true;
    });
  }
}



function mergeSections(awsSections = [], gptSections = []) {
  awsSections = Array.isArray(awsSections) ? awsSections : [];
  gptSections = Array.isArray(gptSections) ? gptSections : [];
  
  if (!gptSections.length) return awsSections;
  if (!awsSections.length) return gptSections;

  const sectionMap = new Map();

  awsSections.forEach(s => {
    sectionMap.set(s.section_type, { ...s });
  });

  gptSections.forEach(s => {
    const existing = sectionMap.get(s.section_type);
    if (existing) {
      sectionMap.set(s.section_type, {
        ...existing,
        ...s,
        fields: { ...existing.fields, ...s.fields },
        items: s.items?.length ? s.items : existing.items
      });
    } else {
      sectionMap.set(s.section_type, { ...s });
    }
  });

  return Array.from(sectionMap.values());
}

// ==================== SECTION ACCESS EXPORTS ====================

export function getFieldFromSections(sections, fieldName) {
  if (!Array.isArray(sections)) return null;

  for (const section of sections) {
    if (section.fields?.[fieldName] !== undefined) {
      return section.fields[fieldName];
    }
  }

  return null;
}

export function getItemsFromSection(sections, sectionType) {
  if (!Array.isArray(sections)) return [];
  const section = sections.find(s => s.section_type === sectionType);
  return section?.items || [];
}

export function getSectionFields(sections, sectionType) {
   if (!Array.isArray(sections)) return {};
  const section = sections.find(s => s.section_type === sectionType);
  return section?.fields || {};
}
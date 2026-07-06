// ============================================================
// POST-PROCESSOR — Registry-driven type coercion & validation
// ============================================================

import { 
  getDocumentTypeInfo,
  getFieldAliases,
  matchFieldName,
  getFieldWeight,
  calculateExtractionConfidence,
  DOCUMENT_CATEGORIES
} from '../schemas/documentRegistry.js';

// ==================== TYPE COERCION ENGINE ====================

export function coerceValue(value, fieldName, docType) {
  if (value === null || value === undefined || value === '') return null;

  const typeInfo = getDocumentTypeInfo(docType);
  const fieldType = typeInfo.fieldTypes?.[fieldName];

  // Use registry fieldType if available
  if (fieldType) {
    switch (fieldType) {
      case 'string':
        if (typeof value === 'object' && value !== null) {
          if (value.name) return String(value.name).trim();
          if (value.full_name) return String(value.full_name).trim();
          return JSON.stringify(value);
        }
        return String(value).trim();
      
      case 'number':
        if (typeof value === 'number') return value;
        if (typeof value === 'object' && value !== null) {
          const candidate = value.amount ?? value.total ?? value.value ?? value.price ?? null;
          if (candidate !== null) {
            const parsed = parseGenericNumber(String(candidate));
            if (parsed !== null) return parsed;
          }
          return null;
        }
        if (typeof value === 'string') {
          const parsed = parseGenericNumber(value);
          if (parsed !== null) return parsed;
        }
        return null;
      
      case 'date':
        return coerceDate(value);
      
      case 'period':
        if (typeof value === 'object' && value !== null) {
          return {
            from: coerceDate(value.from) || null,
            to: coerceDate(value.to) || null
          };
        }
        return { from: null, to: null };
      
      case 'array':
        if (Array.isArray(value)) return value;
        return value !== null ? [value] : [];
      
      case 'record':
        if (typeof value === 'object' && value !== null) return value;
        return {};
      
      case 'party':
        if (typeof value === 'object' && value !== null) return value;
        if (typeof value === 'string' && value.trim()) {
          return { name: value.trim(), address: null, tax_id: null, email: null, phone: null, website: null, registration_number: null, id_number: null };
        }
        return { name: null, address: null, tax_id: null, email: null, phone: null, website: null, registration_number: null, id_number: null };
      
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return ['true', 'yes', '1'].includes(value.toLowerCase().trim());
        return Boolean(value);
      
      default:
        return String(value).trim();
    }
  }

  // Fallback: infer from field name (only for fields not in registry)
  const name = fieldName.toLowerCase();
  
  // String identifiers ending in _number
  if (name.endsWith('_number') && !name.includes('quantity') && !name.includes('count')) {
    return String(value).trim();
  }
  
  // Date fields
  if (name.includes('date') || name === 'dob') {
    return coerceDate(value);
  }
  
  // Number fields (fallback)
  const numberIndicators = ['amount', 'cost', 'price', 'fee', 'total', 'balance', 'value', 'payment', 'salary', 'rent', 'deposit', 'gpa', 'quantity', 'rate', 'percent', 'debit', 'credit', 'limit', 'deductible', 'premium', 'withholding', 'tax', 'refund', 'income', 'volume', 'area', 'percentage', 'ratio', 'count', 'age', 'year'];
  if (numberIndicators.some(n => name.includes(n))) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseGenericNumber(value);
      if (parsed !== null) return parsed;
    }
    return null;
  }
  
  return typeof value === 'string' ? value.trim() : String(value).trim();
}


/**
 * Parses numbers from various formats, handling currency and units
 */
function parseGenericNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val !== 'string') return null;

  const str = val.trim();

  // Already a clean number
  if (/^-?\d+\.?\d*$/.test(str)) return parseFloat(str);

  // Currency: $1,234.56 | ₦1,234.56 | 1,234.56 USD
  const currencyCleaned = str
    .replace(/^[₦$€£]\s*/, '')
    .replace(/\s*(?:USD|NGN|EUR|GBP)$/i, '')
    .replace(/,/g, '');

  if (/^-?\d+\.?\d*$/.test(currencyCleaned)) {
    const parsed = parseFloat(currencyCleaned);
    return !isNaN(parsed) ? parsed : null;
  }

  // European format: 1.234,56
  if (/^-?\d{1,3}(\.\d{3})+,\d{2}$/.test(str)) {
    const cleaned = str.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return !isNaN(parsed) ? parsed : null;
  }

  // Percentage: 12.5%
  if (/^-?\d+\.?\d*%$/.test(str)) {
    return parseFloat(str.replace('%', ''));
  }

  return null;
}

/**
 * Coerces dates to ISO 8601 format
 */
function coerceDate(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split('T')[0];

    // DD/MM/YYYY or DD-MM-YYYY
    const match = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (match) {
      const [_, d, m, y] = match;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // MM/DD/YYYY (American)
    const usMatch = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (usMatch) {
      const [_, m, d, y] = usMatch;
      // If day > 12, it's probably DD/MM
      if (parseInt(d) > 12) {
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      // Otherwise assume DD/MM (more common globally)
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    return s;
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return null;
}

// ==================== POST-PROCESS PIPELINE ====================

/**
 * Main post-processing function.
 * Runs after GPT extraction, before Zod schema validation.
 */
export function postProcessExtraction(rawData, detectedType) {
  console.log('=== POST-PROCESSOR START ===');
  console.log('Document type:', detectedType);

  const typeInfo = getDocumentTypeInfo(detectedType);

  // Step 1: Flatten sections into top-level fields with alias resolution
  const flattened = flattenAndResolve(rawData, detectedType);

  // Step 2: Coerce all known fields to correct types
  const coerced = coerceAllFields(flattened, detectedType);

  // Step 3: Ensure all expected fields exist (null if missing)
  const complete = ensureExpectedFields(coerced, typeInfo);

  // Step 4: Map parties (issuer/recipient) using registry
  const withParties = mapParties(complete, detectedType);

  // Step 5: Calculate confidence using registry weights
  const confidence = calculateRegistryConfidence(withParties, detectedType);

  // Step 6: Build final structure
  const result = {
    ...withParties,
    document_type: detectedType,
    document_category: typeInfo.category || 'other',
    confidence_scores: confidence,
    _schema_version: 'v8-flexible',
    _source: { aws: false, gpt: true }
  };

  console.log('Post-process complete. Fields:', Object.keys(result).length);
  console.log('Confidence:', confidence.overall, '| Status:', confidence.status);
  console.log('=== POST-PROCESSOR END ===');

  return result;
}

/**
 * Flattens sections and resolves field aliases
 */
function flattenAndResolve(data, docType) {
  const result = { ...data };

  // Extract from sections
  if (Array.isArray(data.sections)) {
    for (const section of data.sections) {
      // Extract fields
      for (const [rawKey, value] of Object.entries(section.fields || {})) {
        if (value === null || value === undefined || value === '') continue;

        const canonical = matchFieldName(rawKey, docType);
        const key = canonical || rawKey;

        // Don't overwrite with null, but prefer more specific values
        if (!(key in result) || !hasValue(result[key]) || 
            (typeof result[key] === 'string' && String(value).length > result[key].length)) {
          result[key] = value;
        }
      }

      // Extract items
      if (section.items?.length > 0) {
        const itemType = inferItemType(section.section_type, docType);
        if (itemType) {
          result[itemType] = section.items;
        }
      }
    }
  }

  // Also check specific_fields
  if (data.specific_fields && typeof data.specific_fields === 'object') {
    for (const [key, value] of Object.entries(data.specific_fields)) {
      if (value !== null && value !== undefined && value !== '') {
        const canonical = matchFieldName(key, docType);
        result[canonical || key] = value;
      }
    }
  }

  return result;
}

/**
 * Coerces all known fields in the data
 */
function coerceAllFields(data, docType) {
  const result = {};
  const typeInfo = getDocumentTypeInfo(docType);
  const knownFields = new Set([
    ...(typeInfo.requiredFields || []),
    ...(typeInfo.expectedFields || []),
    ...(typeInfo.fieldWeights ? Object.keys(typeInfo.fieldWeights) : []),
    ...(typeInfo.fieldAliases ? Object.keys(typeInfo.fieldAliases) : [])
  ]);

  // Coerce known fields
  for (const field of knownFields) {
    if (field in data) {
      result[field] = coerceValue(data[field], field, docType);
    }
  }

    // Coerce unknown fields using registry or inferred types
  for (const [key, value] of Object.entries(data)) {
    if (!knownFields.has(key)) {
      result[key] = coerceValue(value, key, docType);
    }
  }

  return result;
}

/**
 * Ensures all expected fields exist with null defaults
 */
function ensureExpectedFields(data, typeInfo) {
  const result = { ...data };

  for (const field of (typeInfo.expectedFields || [])) {
    if (!(field in result) || result[field] === undefined) {
      result[field] = null;
    }
  }

  for (const field of (typeInfo.requiredFields || [])) {
    if (!(field in result) || result[field] === undefined) {
      result[field] = null;
    }
  }

  return result;
}

/**
 * Maps parties using registry type-specific mappings
 */
function mapParties(data, docType) {
  const result = { ...data };

  // Type-specific party mappings
  const partyMappings = {
    'utility-bill': {
      issuer: ['vendor_name', 'utility_provider', 'company'],
      recipient: ['customer_name', 'account_holder']
    },
    'invoice': {
      issuer: ['vendor_name', 'seller_name'],
      recipient: ['buyer_name', 'customer_name']
    },
    'bank-statement': {
      issuer: ['bank_name'],
      recipient: ['account_name', 'account_holder']
    },
    'medical-report': {
      issuer: ['provider_name', 'physician', 'doctor'],
      recipient: ['patient_name']
    },
    'prescription': {
      issuer: ['prescriber_name', 'pharmacy'],
      recipient: ['patient_name']
    }
  };

  const mapping = partyMappings[docType];
  if (!mapping) return result;

  // Build issuer
  const issuer = { ...data.issuer };
  if (!issuer.name) {
    for (const field of mapping.issuer) {
      if (data[field]) {
        issuer.name = data[field];
        break;
      }
    }
  }

  // Build recipient
  const recipient = { ...data.recipient };
  if (!recipient.name) {
    for (const field of mapping.recipient) {
      if (data[field]) {
        recipient.name = data[field];
        break;
      }
    }
  }

  result.issuer = issuer;
  result.recipient = recipient;

  return result;
}

/**
 * Calculates confidence using registry field weights
 */
export function calculateRegistryConfidence(data, docType) {
  const typeInfo = getDocumentTypeInfo(docType);
  const weights = typeInfo.fieldWeights || {};

  const presentFields = Object.keys(data).filter(k => hasValue(data[k]));
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const actualWeight = presentFields.reduce((sum, field) => sum + (weights[field] || 0), 0);

  const overall = totalWeight > 0 ? Math.min(1, actualWeight / totalWeight) : 0;

  const missingRequired = (typeInfo.requiredFields || []).filter(f => !hasValue(data[f]));

  let status = 'HIGH';
  let requiresReview = false;
  let reviewReason = null;

  if (missingRequired.length > 0) {
    status = 'LOW';
    requiresReview = true;
    reviewReason = `Missing required fields: ${missingRequired.join(', ')}`;
  } else if (overall < 0.5) {
    status = 'MEDIUM';
    requiresReview = true;
    reviewReason = 'Low extraction confidence';
  } else if (overall < 0.3) {
    status = 'LOW';
    requiresReview = true;
    reviewReason = 'Very low extraction confidence';
  }

  return {
    overall: Math.round(overall * 100) / 100,
    completeness: Math.round((presentFields.length / Math.max(typeInfo.expectedFields?.length || 1, 1)) * 100),
    status,
    requiresReview,
    reviewReason,
    flags: {
      low_confidence_fields: [],
      missing_required_fields: missingRequired,
      invalid_dates: [],
      math_issue: false,
      balance_mismatch: false
    },
    extractedFieldCount: presentFields.length,
    totalPossibleFields: typeInfo.expectedFields?.length || 0
  };
}

/**
 * Infers item array field name from section type
 */
function inferItemType(sectionType, docType) {
  const mappings = {
    line_items: 'line_items',
    items: 'items',
    transactions: 'transactions',
    expenses: 'expense_items',
    courses: 'courses',
    grades: 'grades',
    employee_earnings: 'employees',
    cargo_list: 'cargo_items',
    items_delivered: 'items_delivered',
    experience: 'experience',
    education: 'education',
    skills: 'skills',
    certifications: 'certifications',
    findings: 'findings',
    recommendations: 'recommendations',
    results: 'results',
    medications: 'medications',
    allergies: 'allergies'
  };

  return mappings[sectionType] || null;
}

/**
 * Checks if a value has meaningful content
 */
function hasValue(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string' && val.trim() === '') return false;
  if (Array.isArray(val) && val.length === 0) return false;
  if (typeof val === 'object' && !Array.isArray(val)) {
    const values = Object.values(val);
    if (values.length === 0) return false;
    if (values.every(v => v === null || v === undefined || v === '')) return false;
  }
  return true;
}

export default { postProcessExtraction, coerceValue };
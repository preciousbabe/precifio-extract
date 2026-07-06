import { getDocumentTypeInfo } from '../schemas/documentRegistry.js';

// Type coercers — each returns { value, valid }
const COERCERS = {
   string: (val) => {
    if (val === null || val === undefined) return { value: '', valid: true };
    if (typeof val === 'string') return { value: val.trim(), valid: true };
    // FIX #3a: objects leaking into string fields — extract name or stringify
    if (typeof val === 'object' && val !== null) {
      if (val.name) return { value: String(val.name).trim(), valid: true };
      if (val.full_name) return { value: String(val.full_name).trim(), valid: true };
      return { value: JSON.stringify(val), valid: true };
    }
    return { value: String(val).trim(), valid: true };
  },
  
    number: (val) => {
    if (val === null || val === undefined || val === '') return { value: null, valid: true };
    if (typeof val === 'number' && !isNaN(val)) return { value: val, valid: true };
    // FIX #3b: objects leaking into number fields — extract nested amount/total/value
    if (typeof val === 'object' && val !== null) {
      const candidate = val.amount ?? val.total ?? val.value ?? val.price ?? null;
      if (candidate !== null) {
        const parsed = parseFloat(String(candidate).replace(/[₦,$€£\s,%]/g, '').replace(/,/g, ''));
        if (!isNaN(parsed)) return { value: parsed, valid: true };
      }
      return { value: null, valid: false };
    }
    if (typeof val === 'string') {
      const cleaned = val.replace(/[₦,$€£\s,%]/g, '').replace(/,/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) return { value: parsed, valid: true };
    }
    return { value: null, valid: false };
  },
  
  date: (val) => {
    if (!val) return { value: null, valid: true };
    if (typeof val === 'string') {
      const s = val.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: s, valid: true };
      // Add more date parsing...
      return { value: s, valid: true }; // pass through for now
    }
    return { value: null, valid: false };
  },
  
  period: (val) => {
    if (!val || typeof val !== 'object') return { value: { from: null, to: null }, valid: true };
    return {
      value: {
        from: val.from || null,
        to: val.to || null
      },
      valid: true
    };
  },
  
  array: (val) => {
    if (val === null || val === undefined) return { value: [], valid: true };
    if (Array.isArray(val)) return { value: val, valid: true };
    return { value: [val], valid: true };
  },
  
    record: (val) => {
    if (!val || typeof val !== 'object') {
      // FIX #3c: string that should be an object
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          if (typeof parsed === 'object' && parsed !== null) return { value: parsed, valid: true };
        } catch {}
      }
      return { value: {}, valid: true };
    }
    return { value: val, valid: true };
  },
  
    party: (val) => {
    if (!val || typeof val !== 'object') {
      // FIX #3d: string that should be a party object
      if (typeof val === 'string' && val.trim()) {
        return {
          value: { 
            name: val.trim(), 
            address: null, 
            tax_id: null, 
            email: null, 
            phone: null, 
            website: null, 
            registration_number: null, 
            id_number: null 
          },
          valid: true
        };
      }
      return {
        value: { name: null, address: null, tax_id: null, email: null, phone: null, website: null, registration_number: null, id_number: null },
        valid: true
      };
    }
    return { value: val, valid: true };
  },
  
  boolean: (val) => {
    if (val === null || val === undefined) return { value: false, valid: true };
    if (typeof val === 'boolean') return { value: val, valid: true };
    if (typeof val === 'string') {
      const s = val.toLowerCase().trim();
      return { value: ['true', 'yes', '1'].includes(s), valid: true };
    }
    return { value: Boolean(val), valid: true };
  }
};

// Infer type from field name if not in registry
function inferFieldType(fieldName) {
  const name = fieldName.toLowerCase();
  
  if (name.includes('period') || name.includes('_range')) return 'period';
  if (name === 'vital_signs' || name.endsWith('_info') || name.endsWith('_details')) return 'record';
  if (['sections', 'items', 'transactions', 'line_items', 'employees', 'courses', 'grades', 'medications', 'allergies', 'findings', 'recommendations'].includes(name) || name.endsWith('_items') || name.endsWith('_list')) return 'array';
  if (['issuer', 'recipient', 'buyer', 'seller', 'customer', 'supplier'].includes(name)) return 'party';
  if (name.startsWith('is_') || name.startsWith('has_') || ['mutual_nda', 'utilities_included', 'generic_substitution', 'consent', 'inspection_required', 'organ_donor', 'real_id'].includes(name)) return 'boolean';
  if (name.includes('date') || name.includes('_date') || name === 'dob') return 'date';
  if (name.includes('amount') || name.includes('cost') || name.includes('price') || name.includes('fee') || name.includes('total') || name.includes('balance') || name.includes('quantity') || name.includes('rate') || name.includes('percent') || name.includes('gpa')) return 'number';
  
  return 'string';
}

export function sanitizeForZod(data, docType = 'unknown') {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForZod(item, docType));
  }
  
  if (typeof data !== 'object') return data;
  
  const typeInfo = getDocumentTypeInfo(docType);
  const fieldTypes = typeInfo.fieldTypes || {};
  
  const result = {};
  
  for (const [key, value] of Object.entries(data)) {
    // FIX #3e: _source must always be an object
    if (key === '_source') {
      if (typeof value === 'object' && value !== null) {
        result[key] = value;
      } else if (typeof value === 'string') {
        try { result[key] = JSON.parse(value); } 
        catch { result[key] = { aws: false, gpt: true }; }
      } else {
        result[key] = { aws: false, gpt: true };
      }
      continue;
    }
    
      // FIX #3f: specific_fields must always be an object with primitive values only
    if (key === 'specific_fields') {
      let source = value;
      
      // If string, try to parse
      if (typeof source === 'string') {
        try { source = JSON.parse(source); } 
        catch { source = {}; }
      }
      
      // Must be a plain object (not array, not null)
      if (typeof source !== 'object' || source === null || Array.isArray(source)) {
        result[key] = {};
        continue;
      }
      
      // Filter out numeric keys (spread from string) and non-primitive values
      const cleaned = {};
      for (const [k, v] of Object.entries(source)) {
        if (/^\d+$/.test(k)) continue; // Skip numeric keys
        if (v !== null && v !== undefined && !Array.isArray(v) && typeof v !== 'object') {
          cleaned[k] = v;
        }
      }
      result[key] = cleaned;
      continue;
    }
    
    const fieldType = fieldTypes[key] || inferFieldType(key);
    const coercer = COERCERS[fieldType] || COERCERS.string;
    const { value: coerced } = coercer(value);
    result[key] = coerced;
  }
  
  return result;
}


export function sanitizeSections(sections, docType = 'unknown') {
  // Fix: remove the broken copy-pasted block, just sanitize the input
  if (!Array.isArray(sections)) {
    return [];
  }
  
  return sections.map(section => ({
    section_type: section?.section_type || 'general',
    section_title: section?.section_title || '',
    fields: sanitizeForZod(section?.fields, docType),
    items: Array.isArray(section?.items) ? section.items.map(item => sanitizeForZod(item, docType)) : [],
    text: section?.text || ''
  }));
}


export function sanitizeParty(party) {
  const coercer = COERCERS.party;
  const { value } = coercer(party);
  return value;
}

export default { sanitizeForZod, sanitizeSections, sanitizeParty };
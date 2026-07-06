import { useState, useMemo } from 'react';
import DownloadMenu from './DownloadMenu';
import { ConfidenceBadge } from './ConfidenceBadge';
import { 
  isLegacyType, 
  getDocumentTypeInfo,
  getFieldWeight,
  DOCUMENT_CATEGORIES
} from '../../schemas/documentRegistry.js';

// ==================== DYNAMIC FORMATTERS ====================

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string' && val.trim() === '') return false;
  if (typeof val === 'string' && ['UNKNOWN', 'unknown', 'Uncategorized'].includes(val)) return false;
  if (Array.isArray(val) && val.length === 0) return false;
  if (typeof val === 'object' && !Array.isArray(val)) {
    const values = Object.values(val);
    if (values.length === 0 || values.every(v => v === null || v === undefined || v === '')) return false;
  }
  return true;
};

const fmt = (val) => val != null ? val.toLocaleString() : '—';

const fmtMoney = (val, currency = 'USD') => {
  if (val == null) return '—';
  if (typeof val !== 'number') return String(val);
  return `${currency} ${val.toLocaleString()}`;
};

const fmtDate = (val) => val || '—';

const fmtPeriod = (period) => {
  if (!period || (!period.from && !period.to)) return '—';
  return `${period.from || '?'} → ${period.to || '?'}`;
};

/**
 * Dynamic field formatter — infers type from field name using registry patterns
 */
const fmtField = (val, fieldName, currency = 'USD', docType = 'unknown') => {
  if (val == null) return '—';
  
  // === FIX #1: ARRAY OF OBJECTS — render as count, never join ===
  if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
    return `${val.length} item${val.length !== 1 ? 's' : ''}`;
  }
  
  // === REGISTRY-DRIVEN TYPE LOOKUP (new) ===
  const typeInfo = getDocumentTypeInfo(docType);
  const fieldType = typeInfo.fieldTypes?.[fieldName];
  
  if (fieldType === 'number' && typeof val === 'number') return fmtMoney(val, currency);
  if (fieldType === 'date') return fmtDate(val);
  if (fieldType === 'period') return fmtPeriod(val);
  if (fieldType === 'boolean') return val ? 'Yes' : 'No';
  if (fieldType === 'array') {
    // === FIX #1b: arrays of primitives only ===
    if (Array.isArray(val)) {
      if (val.length === 0) return '—';
      return val.join(', ');
    }
    return '—';
  }
    if (fieldType === 'party') {
    if (!val) return '—';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return val.name || val.full_name || Object.values(val).filter(v => v).join(', ') || '—';
    }
    return '—';
  }
  // === END REGISTRY LOOKUP ===
  
  const name = (fieldName || '').toLowerCase();

  // Date fields (fallback)
  if (name.includes('date') || name.includes('_date') || name.includes('dob')) return fmtDate(val);
  // Time fields
  if (name.includes('time') || name.includes('_time')) return String(val);
  // Address/location
  if (name.includes('address') || name.includes('location') || name.includes('street') || 
      name.includes('premises') || name.includes('ship_to')) return String(val);
  // Percentage/rate
  if ((name.includes('percent') || name.includes('rate') || name.includes('advance') || 
       name.includes('final') || name.includes('cap_rate')) && typeof val === 'number') {
    if (val <= 1) return `${Math.round(val * 100)}%`;
    if (val > 1 && val <= 100) return `${val}%`;
    return String(val);
  }
  // Money (fallback)
  if (name.includes('amount') || name.includes('cost') || name.includes('price') || 
      name.includes('fee') || name.includes('total') || name.includes('payment') ||
      name.includes('salary') || name.includes('rent') || name.includes('deposit') ||
      name.includes('value') || name.includes('balance') || name.includes('charge') ||
      (name.includes('gpa') && typeof val === 'number')) {
    if (typeof val === 'number') return fmtMoney(val, currency);
    return String(val);
  }
  // Boolean (fallback)
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  // Array (fallback)
  if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '—';
  // Default
  return String(val);
};


const displayValue = (val, fieldName) => {
  if (!hasValue(val)) {
    if (fieldName?.includes('status')) return 'Not specified';
    return '—';
  }
  return val;
};

const isPlaceholderValue = (val, fieldName) => {
  if (typeof val !== 'string') return false;
  const normalized = val.trim().toLowerCase();
  const normalizedField = (fieldName || '').toLowerCase().replace(/_/g, ' ');
  if (normalized === normalizedField) return true;
  const placeholders = [
    /^vendor\s*name$/i, /^company\s*name$/i, /^buyer\s*name$/i,
    /^customer\s*name$/i, /^supplier\s*name$/i, /^counterparty\s*name$/i,
    /^account\s*name$/i, /^bank\s*name$/i, /^your\s*company$/i,
    /^not\s*applicable$/i, /^n\/a$/i, /^t\.b\.d\.$/i,
    /^placeholder$/i, /^example$/i, /^sample$/i, /^test$/i,
    /^xxx+$/i, /^000+$/i, /^123+$/i, /^abc+$/i
  ];
  return placeholders.some(pattern => pattern.test(val.trim()));
};

// ==================== SECTION HELPERS ====================

function getFieldFromSections(sections, fieldName) {
  if (!sections) return null;
  for (const section of sections) {
    if (section.fields && section.fields[fieldName] != null) {
      return section.fields[fieldName];
    }
  }
  return null;
}

function getItemsFromSection(sections, sectionType) {
  if (!sections) return [];
  const section = sections.find(s => s.section_type === sectionType);
  return section?.items || [];
}

function getSectionFields(sections, sectionType) {
  if (!sections) return {};
  const section = sections.find(s => s.section_type === sectionType);
  return section?.fields || {};
}

// ==================== DYNAMIC FIELD GROUPING ====================

function groupFields(extraction, docType) {
  const info = getDocumentTypeInfo(docType);
  const groups = [];
  const sections = Array.isArray(extraction.sections) ? extraction.sections : [];

  // Helper to get value from top-level or sections
  const getVal = (field) => {
    if (hasValue(extraction[field])) return extraction[field];
    return getFieldFromSections(sections, field);
  };

  // Core document info
  const coreFields = ['document_type', 'document_subtype', 'document_category', 'category'];
  if (coreFields.some(f => hasValue(extraction[f]))) {
    groups.push({
      title: 'Document Information',
      icon: '📄',
      fields: coreFields.filter(f => hasValue(extraction[f])).map(f => ({
        key: f,
        label: f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: extraction[f]
      }))
    });
  }

  // Issuer / From party
  if (extraction.issuer && Object.values(extraction.issuer).some(hasValue)) {
    groups.push({
      title: getPartyTitle(docType, 'issuer'),
      icon: getPartyIcon(docType, 'issuer'),
      fields: Object.entries(extraction.issuer)
        .filter(([_, v]) => hasValue(v))
        .map(([k, v]) => ({
          key: `issuer.${k}`,
          label: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: v
        }))
    });
  }

  // Recipient / To party
  if (extraction.recipient && Object.values(extraction.recipient).some(hasValue)) {
    groups.push({
      title: getPartyTitle(docType, 'recipient'),
      icon: getPartyIcon(docType, 'recipient'),
      fields: Object.entries(extraction.recipient)
        .filter(([_, v]) => hasValue(v))
        .map(([k, v]) => ({
          key: `recipient.${k}`,
          label: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: v
        }))
    });
  }

  // Build groups from registry sections
  const sectionToFields = {};
  for (const sectionType of (info.sections || [])) {
    sectionToFields[sectionType] = [];
  }
  
      // Distribute expectedFields into section groups using registry fieldTypes
  for (const field of (info.expectedFields || [])) {
    const val = getVal(field);
    if (!hasValue(val)) continue;
    
    const fieldType = info.fieldTypes?.[field] || 'string';
    
    // === FIX #1c: Skip arrays of objects — they render via ArrayTable, not field cards ===
    if (fieldType === 'array' && Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
      continue;
    }
    
    let assigned = false;
    const fieldLower = field.toLowerCase();
    
    // Check if field name matches a registry section type
    for (const sectionType of (info.sections || [])) {
      if (fieldLower.includes(sectionType.replace(/_/g, ''))) {
        if (!sectionToFields[sectionType]) sectionToFields[sectionType] = [];
        sectionToFields[sectionType].push({
          key: field,
          label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: val,
          fieldType
        });
        assigned = true;
        break;
      }
    }
    
    // Fallback: infer section from fieldType
    if (!assigned) {
      const fallbackSection = inferSectionFromFieldType(fieldType, info.sections);
      if (!sectionToFields[fallbackSection]) sectionToFields[fallbackSection] = [];
      sectionToFields[fallbackSection].push({
        key: field,
        label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: val,
        fieldType
      });
    }
  }


  // Convert sectionToFields to groups (only non-empty)
  const sectionIcons = {
    line_items: '📋', payment_info: '💳', account_summary: '📊', account_info: '🏦',
    statement_period: '📅', balances: '💰', tax_breakdown: '🧾', transactions: '📈',
    parties: '⚖️', terms: '📜', clauses: '📋', signatures: '✍️', obligations: '✅',
    property_details: '🏠', claim_information: '📋', incident_details: '⚠️',
    vehicle_information: '🚗', damage_assessment: '🔧', personal_info: '👤',
    experience: '💼', education: '🎓', skills: '⭐', certifications: '🏆',
    compensation: '💰', diagnosis: '🔬', treatment: '💊', medications: '💉',
    test_results: '📊', shipment_info: '📦', cargo_details: '🚢', route: '🗺️',
    valuation: '💰', inspection_items: '🔍', courses: '📚', grades: '📊',
    document_info: '📄', issuing_authority: '🏛️', restrictions: '⛔'
  };

  for (const [sectionType, fields] of Object.entries(sectionToFields)) {
    if (fields.length === 0) continue;
    groups.push({
      title: sectionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      icon: sectionIcons[sectionType] || '🔹',
      highlight: sectionType === 'totals' || sectionType === 'balances' || sectionType === 'compensation',
      fields
    });
  }

  return groups;
}


function inferSectionFromFieldType(fieldType, registrySections) {
  const typeToSection = {
    number: 'totals',
    date: 'dates',
    period: 'dates',
    money: 'totals',
    array: 'items',
    boolean: 'conditions',
    party: 'parties',
    string: 'general',
    record: 'details'
  };
  
  const suggested = typeToSection[fieldType] || 'general';
  
  // If suggested section exists in registry, use it
  if (registrySections?.includes(suggested)) return suggested;
  
  // Otherwise return first registry section or 'general'
  return registrySections?.[0] || 'general';
}



function getPartyTitle(docType, partyType) {
  const titles = {
    issuer: {
      invoice: 'Vendor / Seller',
      receipt: 'Merchant / Store',
      'bank-statement': 'Bank',
      'credit-card-statement': 'Card Issuer',
      'purchase-order': 'Buyer',
      'expense-report': 'Employee',
      'tax-form': 'Taxpayer',
      'payroll-report': 'Employer',
      'utility-bill': 'Utility Provider',
      contract: 'Party A',
      'lease-agreement': 'Lessor / Landlord',
      nda: 'Disclosing Party',
      'service-agreement': 'Service Provider',
      'court-document': 'Plaintiff',
      'property-deed': 'Grantor / Seller',
      resume: 'Candidate',
      'employment-contract': 'Employer',
      'offer-letter': 'Employer',
      'employee-record': 'Employer',
      'performance-review': 'Reviewer',
      'medical-report': 'Provider',
      'lab-result': 'Lab / Provider',
      prescription: 'Prescriber',
      'patient-intake': 'Provider',
      'insurance-claim': 'Claimant',
      'bill-of-lading': 'Shipper',
      'shipping-manifest': 'Carrier',
      'delivery-note': 'Sender',
      'customs-document': 'Exporter',
      'property-valuation': 'Appraiser',
      'inspection-report': 'Inspector',
      'mortgage-document': 'Lender',
      'land-registry': 'Registry',
      transcript: 'Institution',
      certificate: 'Institution',
      diploma: 'Institution',
      'student-record': 'Institution',
      passport: 'Issuing Country',
      'drivers-license': 'Issuing State',
      'national-id': 'Issuing Authority',
      permit: 'Issuing Authority',
      license: 'Issuing Authority'
    },
    recipient: {
      invoice: 'Buyer / Customer',
      receipt: 'Customer',
      'bank-statement': 'Account Holder',
      'credit-card-statement': 'Cardholder',
      'purchase-order': 'Vendor / Supplier',
      'expense-report': 'Approver',
      'tax-form': 'Tax Authority',
      'payroll-report': 'Employees',
      'utility-bill': 'Customer',
      contract: 'Party B / Counterparty',
      'lease-agreement': 'Lessee / Tenant',
      nda: 'Receiving Party',
      'service-agreement': 'Client',
      'court-document': 'Defendant',
      'property-deed': 'Grantee / Buyer',
      resume: '—',
      'employment-contract': 'Employee',
      'offer-letter': 'Candidate',
      'employee-record': 'Employee',
      'performance-review': 'Employee',
      'medical-report': 'Patient',
      'lab-result': 'Patient',
      prescription: 'Patient',
      'patient-intake': 'Patient',
      'insurance-claim': 'Insurance Company',
      'bill-of-lading': 'Consignee',
      'shipping-manifest': 'Consignees',
      'delivery-note': 'Recipient',
      'customs-document': 'Importer',
      'property-valuation': 'Property Owner',
      'inspection-report': 'Property Owner',
      'mortgage-document': 'Borrower',
      'land-registry': 'Owner',
      transcript: 'Student',
      certificate: 'Recipient',
      diploma: 'Graduate',
      'student-record': 'Student',
      passport: 'Holder',
      'drivers-license': 'Holder',
      'national-id': 'Holder',
      permit: 'Holder',
      license: 'Holder'
    }
  };

  return titles[partyType]?.[docType] || (partyType === 'issuer' ? 'From' : 'To');
}

function getPartyIcon(docType, partyType) {
  const icons = {
    issuer: { financial: '🏦', legal: '⚖️', hr: '🏢', healthcare: '🏥', 
              insurance: '🛡️', logistics: '📦', real_estate: '🏠',
              education: '🎓', government: '🏛️' },
    recipient: { financial: '👤', legal: '👤', hr: '👤', healthcare: '🧑',
                 insurance: '🏢', logistics: '📬', real_estate: '🏠',
                 education: '🎓', government: '🆔' }
  };
  const info = getDocumentTypeInfo(docType);
  return icons[partyType]?.[info.category] || (partyType === 'issuer' ? '🏢' : '👤');
}

// ==================== SECTION RENDERING ====================

const SECTION_STYLES = {
  // Financial
  line_items: { bg: '#eff6ff', border: '#bfdbfe', icon: '📋' },
  payment_info: { bg: '#f0fdf4', border: '#bbf7d0', icon: '💳' },
  account_summary: { bg: '#fffbeb', border: '#fde68a', icon: '📊' },
  account_info: { bg: '#eff6ff', border: '#bfdbfe', icon: '🏦' },
  statement_period: { bg: '#f0fdf4', border: '#bbf7d0', icon: '📅' },
  balances: { bg: '#fffbeb', border: '#fde68a', icon: '💰' },
  tax_breakdown: { bg: '#faf5ff', border: '#e9d5ff', icon: '🧾' },
  transactions: { bg: '#eff6ff', border: '#bfdbfe', icon: '📈' },
  employee_info: { bg: '#f0fdf4', border: '#bbf7d0', icon: '👤' },

  // Legal
  parties: { bg: '#eff6ff', border: '#bfdbfe', icon: '⚖️' },
  terms: { bg: '#f9fafb', border: '#e5e7eb', icon: '📜' },
  clauses: { bg: '#fef2f2', border: '#fecaca', icon: '📋' },
  signatures: { bg: '#f0fdf4', border: '#bbf7d0', icon: '✍️' },
  obligations: { bg: '#fffbeb', border: '#fde68a', icon: '✅' },
  jurisdiction: { bg: '#faf5ff', border: '#e9d5ff', icon: '🌍' },
  property_details: { bg: '#f0fdf4', border: '#bbf7d0', icon: '🏠' },

  // Insurance
  claim_information: { bg: '#eff6ff', border: '#bfdbfe', icon: '📋' },
  incident_details: { bg: '#fef2f2', border: '#fecaca', icon: '⚠️' },
  vehicle_information: { bg: '#f0fdf4', border: '#bbf7d0', icon: '🚗' },
  damage_assessment: { bg: '#fffbeb', border: '#fde68a', icon: '🔧' },
  supporting_documents: { bg: '#f9fafb', border: '#e5e7eb', icon: '📎' },
  policy_info: { bg: '#eff6ff', border: '#bfdbfe', icon: '🛡️' },

  // HR
  personal_info: { bg: '#eff6ff', border: '#bfdbfe', icon: '👤' },
  experience: { bg: '#f0fdf4', border: '#bbf7d0', icon: '💼' },
  education: { bg: '#fffbeb', border: '#fde68a', icon: '🎓' },
  skills: { bg: '#faf5ff', border: '#e9d5ff', icon: '⭐' },
  certifications: { bg: '#f0fdf4', border: '#bbf7d0', icon: '🏆' },
  compensation: { bg: '#eff6ff', border: '#bfdbfe', icon: '💰' },
  review_period: { bg: '#f9fafb', border: '#e5e7eb', icon: '📅' },
  goals: { bg: '#f0fdf4', border: '#bbf7d0', icon: '🎯' },

  // Healthcare
  patient_info: { bg: '#eff6ff', border: '#bfdbfe', icon: '🏥' },
  diagnosis: { bg: '#fef2f2', border: '#fecaca', icon: '🔬' },
  treatment: { bg: '#f0fdf4', border: '#bbf7d0', icon: '💊' },
  medications: { bg: '#fffbeb', border: '#fde68a', icon: '💉' },
  test_results: { bg: '#eff6ff', border: '#bfdbfe', icon: '📊' },
  provider_info: { bg: '#f9fafb', border: '#e5e7eb', icon: '👨‍⚕️' },
  charges: { bg: '#faf5ff', border: '#e9d5ff', icon: '💰' },

  // Logistics
  shipment_info: { bg: '#eff6ff', border: '#bfdbfe', icon: '📦' },
  cargo_details: { bg: '#fffbeb', border: '#fde68a', icon: '🚢' },
  route: { bg: '#f0fdf4', border: '#bbf7d0', icon: '🗺️' },
  tracking: { bg: '#eff6ff', border: '#bfdbfe', icon: '📍' },
  declarations: { bg: '#f9fafb', border: '#e5e7eb', icon: '📝' },

  // Real Estate
  property_details: { bg: '#f0fdf4', border: '#bbf7d0', icon: '🏠' },
  valuation: { bg: '#eff6ff', border: '#bfdbfe', icon: '💰' },
  inspection_items: { bg: '#fffbeb', border: '#fde68a', icon: '🔍' },
  mortgage_terms: { bg: '#f9fafb', border: '#e5e7eb', icon: '🏦' },

  // Education
  student_info: { bg: '#eff6ff', border: '#bfdbfe', icon: '🎓' },
  institution: { bg: '#f0fdf4', border: '#bbf7d0', icon: '🏫' },
  courses: { bg: '#fffbeb', border: '#fde68a', icon: '📚' },
  grades: { bg: '#eff6ff', border: '#bfdbfe', icon: '📊' },
  awards: { bg: '#faf5ff', border: '#e9d5ff', icon: '🏆' },
  credentials: { bg: '#f0fdf4', border: '#bbf7d0', icon: '📜' },

  // Government
  document_info: { bg: '#eff6ff', border: '#bfdbfe', icon: '📄' },
  issuing_authority: { bg: '#f0fdf4', border: '#bbf7d0', icon: '🏛️' },
  restrictions: { bg: '#fef2f2', border: '#fecaca', icon: '⛔' },
  conditions: { bg: '#fffbeb', border: '#fde68a', icon: '📋' },
  biometrics: { bg: '#f9fafb', border: '#e5e7eb', icon: '🔐' },

  // Default
  general: { bg: '#f9fafb', border: '#e5e7eb', icon: '📄' }
};

function getSectionStyle(sectionType) {
  return SECTION_STYLES[sectionType] || SECTION_STYLES.general;
}

// ==================== MAIN COMPONENT ===================

export function ExtractionResult({ data }) {
    const {
    extraction = {},
    validation = { flags: [] },
    status,
    processingMethod
  } = data;
  
  const topLevelConfidence = extraction.confidence_scores || data.confidence;

  const needsReview = status === 'REVIEW_REQUIRED';
  const [exporting, setExporting] = useState(false);
  const docType = extraction.document_type || 'unknown';
  const typeInfo = getDocumentTypeInfo(docType);
  const isLegacy = isLegacyType(docType);

  // Dynamic field groups from registry + sections
  const fieldGroups = useMemo(() => groupFields(extraction, docType), [extraction, docType]);

  // ==================== NEW DYNAMIC LAYOUT (handles both legacy and new) ====================
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      {/* Processing Badge */}
      <div style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '12px',
        background: '#dbeafe',
        color: '#1e40af',
        fontSize: '12px',
        fontWeight: 600,
        marginBottom: '16px'
      }}>
        🔒 Secured by Precifio AI Engine
        {processingMethod ? ` • ${processingMethod}` : ''}
      </div>

      {/* Status Banner */}
      <div style={{
        padding: '16px',
        borderRadius: '8px',
        background: needsReview ? '#fef3c7' : '#dcfce7',
        marginBottom: '24px',
        border: `1px solid ${needsReview ? '#f59e0b' : '#22c55e'}`
      }}>
        <h3 style={{ margin: 0, color: needsReview ? '#92400e' : '#166534' }}>
          {needsReview ? '⚠️ Review Required' : '✅ Auto-Approved'}
        </h3>
        {validation?.warningFlags?.length > 0 && (
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            {validation.warningFlags.map((flag, i) => (
              <li key={i} style={{ color: '#92400e', fontSize: '14px' }}>
                <strong>{flag.type}:</strong> {flag.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Document Type Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '32px' }}>{typeInfo.displayName?.split(' ')[0] || '📄'}</span>
          <div>
            <h2 style={{ margin: 0, color: '#111827', fontSize: '24px' }}>
              {typeInfo.displayName || docType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h2>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px', textTransform: 'capitalize' }}>
              {extraction.document_category?.replace(/_/g, ' ')} Document
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {extraction.category && extraction.category !== 'Uncategorized' && (
            <span style={{ padding: '4px 12px', background: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
              {extraction.category}
            </span>
          )}
          {extraction.language && (
            <span style={{ padding: '4px 12px', background: '#f3f4f6', color: '#4b5563', borderRadius: '9999px', fontSize: '12px' }}>
              🌐 {extraction.language.toUpperCase()}
            </span>
          )}
          {extraction.country && (
            <span style={{ padding: '4px 12px', background: '#f3f4f6', color: '#4b5563', borderRadius: '9999px', fontSize: '12px' }}>
              📍 {extraction.country}
            </span>
          )}
        </div>
      </div>

      {/* Dynamic Field Groups */}
      {fieldGroups.map((group, idx) => (
        <div key={idx} style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '12px',
            padding: '8px 0',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <span style={{ fontSize: '20px' }}>{group.icon}</span>
            <h3 style={{ margin: 0, color: '#374151', fontSize: '16px', fontWeight: 600 }}>
              {group.title}
            </h3>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '12px' 
          }}>
                        {group.fields.map(field => (
              <DynamicField
                key={field.key}
                label={field.label}
                value={field.value}
                fieldType={field.fieldType}
                currency={extraction.currency}
                docType={docType}
                score={topLevelConfidence?.breakdown?.[field.key]}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Top-level Arrays (line_items, items, transactions) */}
      {extraction.line_items?.length > 0 && (
        <ArrayTable
          title="Line Items"
          data={extraction.line_items}
          columns={['description', 'sku', 'quantity', 'unit_price', 'tax_amount', 'total']}
          currency={extraction.currency}
          docType={docType}
        />
      )}

      {Array.isArray(extraction.items) && extraction.items.length > 0 && (
        <ArrayTable
          title="Items"
          data={extraction.items}
          columns={['description', 'quantity', 'price', 'total']}
          currency={extraction.currency}
          docType={docType}
        />
      )}

      {Array.isArray(extraction.transactions) && extraction.transactions.length > 0 && (
        <ArrayTable
          title="Transactions"
          data={extraction.transactions}
          columns={['date', 'description', 'reference', 'debit', 'credit', 'balance']}
          currency={extraction.currency}
          docType={docType}
        />
      )}


            {/* Sections */}
      {extraction.sections?.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '12px',
            padding: '8px 0',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <span style={{ fontSize: '20px' }}>📑</span>
            <h3 style={{ margin: 0, color: '#374151', fontSize: '16px', fontWeight: 600 }}>
              Document Sections
            </h3>
            <span style={{ 
              marginLeft: 'auto', 
              padding: '2px 10px', 
              background: '#f3f4f6', 
              borderRadius: '9999px', 
              fontSize: '12px', 
              color: '#6b7280', 
              fontWeight: 500 
            }}>
              {extraction.sections.length} section{extraction.sections.length !== 1 ? 's' : ''}
            </span>
          </div>
          {extraction.sections.map((section, idx) => (
            <SectionRenderer 
              key={idx} 
              section={section} 
              index={idx} 
              currency={extraction.currency} 
              docType={docType} 
            />
          ))}
        </div>
      )}

      {/* ==================== SPECIFIC / UNKNOWN FIELDS ==================== */}
            {(() => {
        // Build comprehensive set of already-rendered field keys to prevent duplication
        const renderedKeys = new Set([
          // All field group keys (from groupFields)
          ...fieldGroups.flatMap(g => g.fields.map(f => f.key)),
          // All section field keys AND item type keys
          ...(extraction.sections || []).flatMap(s => {
            const keys = s.fields ? Object.keys(s.fields) : [];
            if (s.items?.length > 0 && typeof s.items[0] === 'object' && s.items[0] !== null) {
              keys.push(s.section_type); // e.g. 'line_items', 'transactions'
            }
            return keys;
          }),
          // Legacy array fields (already rendered as tables above)
          'line_items', 'items', 'transactions',
          // Core metadata already shown in header/tags
          'document_type', 'document_subtype', 'document_category', 'category',
          'language', 'country', 'state', 'currency',
          // Internal fields
          'confidence_scores', 'notes', 'sections', 'specific_fields',
          'processingMethod', 'validation', 'flags', 'warningFlags',
          'document_id', 'document_title', 'document_source',
          'created_date', 'updated_date', 'status',
          '_schema_version', '_source',
          // Party objects (already rendered as issuer/recipient cards)
          'issuer', 'recipient'
        ]);

        
        const entries = Object.entries(extraction.specific_fields || {})
          .filter(([key, value]) => {
            if (renderedKeys.has(key)) return false;
            if (/^\d+$/.test(key)) return false;
            if (!hasValue(value)) return false;
            return true;
          });

        if (entries.length === 0) return null;

        // Separate by type for better rendering
        const primitives = entries.filter(([_, v]) => 
          !Array.isArray(v) && typeof v !== 'object'
        );
        const arrays = entries.filter(([_, v]) => Array.isArray(v));
        const objects = entries.filter(([_, v]) => 
          typeof v === 'object' && v !== null && !Array.isArray(v)
        );

        return (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              marginBottom: '12px',
              padding: '8px 0',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <span style={{ fontSize: '20px' }}>🔍</span>
              <h3 style={{ margin: 0, color: '#374151', fontSize: '16px', fontWeight: 600 }}>
                Additional Extracted Fields
              </h3>
              <span style={{ 
                marginLeft: 'auto', 
                padding: '2px 10px', 
                background: '#f3f4f6', 
                borderRadius: '9999px', 
                fontSize: '12px', 
                color: '#6b7280', 
                fontWeight: 500 
              }}>
                {entries.length} field{entries.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Primitive fields */}
            {primitives.length > 0 && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '12px',
                marginBottom: (arrays.length + objects.length) > 0 ? '20px' : 0
              }}>
                {primitives.map(([key, value]) => (
                  <DynamicField
                    key={key}
                    label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    value={value}
                    fieldType={typeInfo.fieldTypes?.[key] || 'string'}
                    currency={extraction.currency}
                    docType={docType}
                    score={topLevelConfidence?.breakdown?.[key]}
                  />
                ))}
              </div>
            )}

            {/* Array fields */}
            {arrays.map(([key, value]) => {
              const isArrayOfObjects = value.length > 0 && typeof value[0] === 'object' && value[0] !== null;

              if (isArrayOfObjects) {
                const columns = value[0] ? Object.keys(value[0]) : [];
                return (
                  <div key={key} style={{ marginBottom: '16px' }}>
                    <h4 style={{ 
                      margin: '0 0 12px 0', 
                      color: '#374151', 
                      fontSize: '14px', 
                      fontWeight: 600,
                      textTransform: 'capitalize'
                    }}>
                      {key.replace(/_/g, ' ')}
                    </h4>
                    <ArrayTable
                      title=""
                      data={value}
                      columns={columns}
                      currency={extraction.currency}
                      docType={docType}
                    />
                  </div>
                );
              }

              // Array of primitives — render as tags
              return (
                <div key={key} style={{ marginBottom: '12px' }}>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#6b7280', 
                    textTransform: 'uppercase', 
                    fontWeight: 500,
                    marginBottom: '6px'
                  }}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {value.map((item, i) => (
                      <span key={i} style={{
                        padding: '4px 10px',
                        background: '#eff6ff',
                        color: '#1e40af',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 500
                      }}>
                        {String(item)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Object fields */}
            {objects.map(([key, value]) => (
              <div key={key} style={{ 
                marginBottom: '12px',
                padding: '12px',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  fontWeight: 500,
                  marginBottom: '8px'
                }}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {Object.entries(value).map(([subKey, subVal]) => (
                    hasValue(subVal) && (
                      <div key={subKey} style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af', minWidth: '100px' }}>
                          {subKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <span style={{ fontSize: '14px', color: '#111827', fontWeight: 500 }}>
                          {fmtField(subVal, subKey, extraction.currency, docType)}
                        </span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
      {/* Notes */}
      {extraction.notes && (
        <div style={{ 
          padding: '16px', 
          background: '#fefce8', 
          borderRadius: '8px', 
          marginBottom: '24px', 
          border: '1px solid #fde047' 
        }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#a16207', 
            fontWeight: 600, 
            marginBottom: '8px', 
            textTransform: 'uppercase' 
          }}>
            Notes
          </div>
          <p style={{ margin: 0, color: '#713f12', fontSize: '14px', lineHeight: 1.6 }}>
            {extraction.notes}
          </p>
        </div>
      )}

      {/* Metadata */}
      <MetadataSection extraction={extraction} />

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '32px', 
        padding: '16px', 
        borderTop: '1px solid #e5e7eb', 
        color: '#9ca3af', 
        fontSize: '12px' 
      }}>
        🔒 Secured by Precifio AI Engine • Enterprise-grade document intelligence
      </div>
    </div>
  );
}

// ==================== DYNAMIC SUB-COMPONENTS ====================

function DynamicField({ label, value, fieldType, currency, score, docType }) {
  const isPlaceholder = typeof value === 'string' && isPlaceholderValue(value, label);
  const displayVal = isPlaceholder ? 'Not detected' : displayValue(value, label.toLowerCase().replace(/ /g, '_'));
  const isMissing = isPlaceholder || !hasValue(value);

  const formattedValue = fmtField(value, label.toLowerCase().replace(/ /g, '_'), currency, docType);
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 12px',
      background: isMissing ? '#fef2f2' : '#f9fafb',
      borderRadius: '6px',
      border: isMissing ? '1px solid #fecaca' : 'none'
    }}>
      <div>
        <div style={{ 
          fontSize: '12px', 
          color: isMissing ? '#dc2626' : '#6b7280', 
          textTransform: 'uppercase', 
          fontWeight: 500 
        }}>
          {label}
        </div>
        <div style={{ 
          fontSize: '15px', 
          fontWeight: 600, 
          marginTop: '2px', 
          color: isMissing ? '#dc2626' : '#111827' 
        }}>
          {formattedValue}
        </div>
      </div>
    {score != null && score > 0 && !isMissing && <ConfidenceBadge score={score} />}
      {isMissing && (
        <span style={{ 
          fontSize: '11px', 
          color: '#dc2626', 
          background: '#fee2e2', 
          padding: '2px 8px', 
          borderRadius: '4px' 
        }}>
          MISSING
        </span>
      )}
    </div>
  );
}

function SectionRenderer({ section, index, currency, docType }) {
  const { section_type, section_title, fields, items, text } = section;
  const title = section_title || section_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const style = getSectionStyle(section_type);

   const hasFields = fields && Object.entries(fields).some(([_, v]) => hasValue(v));
  const hasItems = items && items.length > 0;
  const hasText = text && text.trim().length > 0;

  if (!hasFields && !hasItems && !hasText) return null;
  return (
    <div style={{ 
      marginBottom: '16px', 
      background: style.bg, 
      borderRadius: '12px', 
      border: `1px solid ${style.border}`,
      overflow: 'hidden'
    }}>
      {/* Section Header */}
      <div style={{ 
        padding: '14px 20px', 
        background: 'rgba(255,255,255,0.6)', 
        borderBottom: `1px solid ${style.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span style={{ fontSize: '20px' }}>{style.icon}</span>
        <h4 style={{ margin: 0, color: '#111827', fontSize: '16px', fontWeight: 600 }}>
          {title}
        </h4>
        {hasItems && (
          <span style={{ 
            marginLeft: 'auto', 
            padding: '2px 10px', 
            background: '#fff', 
            borderRadius: '9999px', 
            fontSize: '12px', 
            color: '#6b7280', 
            fontWeight: 500 
          }}>
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Section Content */}
      <div style={{ padding: '20px' }}>
        {/* Fields */}
        {hasFields && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
            gap: '16px', 
            marginBottom: hasItems || hasText ? '20px' : 0 
          }}>
            {Object.entries(fields).map(([key, value]) => (
              hasValue(value) && (
                <div key={key}>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#6b7280', 
                    textTransform: 'capitalize', 
                    marginBottom: '4px', 
                    fontWeight: 500 
                  }}>
                    {key.replace(/_/g, ' ')}
                  </div>
                    <div style={{ fontSize: '14px', color: '#111827', fontWeight: 600, lineHeight: 1.5 }}>
                    {fmtField(value, key, currency, docType)}
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* Items Table */}
        {hasItems && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {Object.keys(items[0] || {}).map(key => (
                    <th key={key} style={{ 
                      padding: '10px 12px', 
                      textAlign: 'left', 
                      fontWeight: 600, 
                      color: '#6b7280', 
                      textTransform: 'capitalize', 
                      fontSize: '12px' 
                    }}>
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    {Object.entries(item).map(([key, val]) => (
                      <td key={key} style={{ padding: '10px 12px', color: '#374151' }}>
                        {fmtField(val, key, currency, docType)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Raw Text */}
        {hasText && (
          <div style={{ marginTop: hasFields || hasItems ? '16px' : 0 }}>
            <div style={{ 
              padding: '12px', 
              background: '#fff', 
              borderRadius: '6px', 
              border: '1px solid #e5e7eb',
              fontSize: '13px',
              color: '#4b5563',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap'
            }}>
              {text}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ArrayTable({ title, data, columns, currency, docType }) {
  // Dynamically determine columns if not provided
  const actualColumns = columns.length > 0 ? columns : (data[0] ? Object.keys(data[0]) : []);

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#111827', fontSize: '18px' }}>
        {title}
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {actualColumns.map(col => (
                <th key={col} style={{ 
                  padding: '10px 12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  color: '#6b7280', 
                  textTransform: 'capitalize', 
                  fontSize: '12px' 
                }}>
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {actualColumns.map(col => (
                  <td key={col} style={{ padding: '10px 12px', color: '#374151' }}>
                    {fmtField(item[col], col, currency, docType)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetadataSection({ extraction }) {
  const metaFields = ['document_id', 'document_title', 'document_source', 'created_date', 'updated_date', 'country', 'state', 'language'];
  const hasMeta = metaFields.some(f => hasValue(extraction[f]));

  if (!hasMeta) return null;

  return (
    <div style={{ marginBottom: '24px' }}>
      <h4 style={{ margin: '0 0 12px 0', color: '#6b7280', fontSize: '14px', textTransform: 'uppercase' }}>
        Metadata
      </h4>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {metaFields.map(f => (
          hasValue(extraction[f]) && (
            <span key={f} style={{ fontSize: '12px', color: '#9ca3af' }}>
              {f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: {extraction[f]}
            </span>
          )
        ))}
      </div>
    </div>
  );
}

export default ExtractionResult;

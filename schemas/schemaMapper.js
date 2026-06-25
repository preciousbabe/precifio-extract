// ============================================================
// SCHEMA MAPPER — Converts flexible format ↔ legacy flat format
// ============================================================

import { isLegacyType, getDocumentTypeInfo } from './documentRegistry.js';

/**
 * Maps the new flexible document format to the old flat schema
 * for backward compatibility with existing UI components.
 * 
 * For legacy types (invoice, receipt, bank-statement, etc.):
 *   - Extracts fields from sections + specific_fields + issuer/recipient
 *   - Populates old flat fields like vendor_name, line_items, etc.
 * 
 * For new types (resume, passport, etc.):
 *   - Returns the flexible format as-is (UI needs to handle sections)
 */
export function mapToLegacyFormat(flexibleDoc) {
  if (!flexibleDoc) return flexibleDoc;
  
    // If it's already a legacy type with flat fields populated, return as-is
  if (isLegacyType(flexibleDoc.document_type)) {
    // But still ensure issuer/recipient are mapped to old vendor/buyer fields
    // And sync category with document_category
    const categoryMap = {
      'financial': 'Banking & Finance',
      'legal': 'Professional Services',
      'hr': 'Professional Services',
      'healthcare': 'Insurance',
      'insurance': 'Insurance',
      'logistics': 'Shipping & Logistics',
      'real_estate': 'Rent & Facilities',
      'education': 'Professional Services',
      'government': 'Taxes & Government',
      'other': 'Uncategorized'
    };
    return {
      ...flexibleDoc,
      category: categoryMap[flexibleDoc.document_category] || flexibleDoc.category || 'Uncategorized',
      vendor_name: flexibleDoc.vendor_name || flexibleDoc.issuer?.name || null,
      vendor_address: flexibleDoc.vendor_address || flexibleDoc.issuer?.address || null,
      vendor_tax_id: flexibleDoc.vendor_tax_id || flexibleDoc.issuer?.tax_id || null,
      vendor_email: flexibleDoc.vendor_email || flexibleDoc.issuer?.email || null,
      vendor_phone: flexibleDoc.vendor_phone || flexibleDoc.issuer?.phone || null,
      vendor_website: flexibleDoc.vendor_website || flexibleDoc.issuer?.website || null,
      vendor_registration_number: flexibleDoc.vendor_registration_number || flexibleDoc.issuer?.registration_number || null,
      buyer_name: flexibleDoc.buyer_name || flexibleDoc.recipient?.name || null,
      buyer_address: flexibleDoc.buyer_address || flexibleDoc.recipient?.address || null,
      buyer_tax_id: flexibleDoc.buyer_tax_id || flexibleDoc.recipient?.tax_id || null,
      buyer_email: flexibleDoc.buyer_email || flexibleDoc.recipient?.email || null,
      date: flexibleDoc.date || flexibleDoc.issue_date || null,
    };
  }
  
  // For new types, we still populate some common legacy fields
  // so the UI doesn't completely break, but sections carry the real data
  return {
    ...flexibleDoc,
    // Map issuer to vendor fields for minimal UI display
    vendor_name: flexibleDoc.issuer?.name || null,
    vendor_address: flexibleDoc.issuer?.address || null,
    vendor_email: flexibleDoc.issuer?.email || null,
    vendor_phone: flexibleDoc.issuer?.phone || null,
    // Map recipient to buyer fields
    buyer_name: flexibleDoc.recipient?.name || null,
    // Use issue_date as date
    date: flexibleDoc.issue_date || null,
    // For new types, put a summary in notes if not present
    notes: flexibleDoc.notes || generateSummaryFromSections(flexibleDoc.sections),
  };
}

/**
 * Maps old flat format to new flexible format (for migrations)
 */
export function mapToFlexibleFormat(legacyDoc) {
  if (!legacyDoc) return legacyDoc;
  
  const typeInfo = getDocumentTypeInfo(legacyDoc.document_type);
  
  return {
    document_type: legacyDoc.document_type,
    document_subtype: null,
    document_category: typeInfo.category,
    
    issuer: {
      name: legacyDoc.vendor_name,
      address: legacyDoc.vendor_address,
      tax_id: legacyDoc.vendor_tax_id,
      email: legacyDoc.vendor_email,
      phone: legacyDoc.vendor_phone,
      website: legacyDoc.vendor_website,
      registration_number: legacyDoc.vendor_registration_number
    },
    
    recipient: {
      name: legacyDoc.buyer_name || legacyDoc.counterparty,
      address: legacyDoc.buyer_address,
      tax_id: legacyDoc.buyer_tax_id,
      email: legacyDoc.buyer_email
    },
    
    issue_date: legacyDoc.date || legacyDoc.invoice_date || legacyDoc.effective_date,
    effective_date: legacyDoc.effective_date,
    expiry_date: legacyDoc.expiration_date,
    
    total_amount: legacyDoc.total_amount,
    currency: legacyDoc.currency,
    tax_amount: legacyDoc.tax_amount,
    
    sections: [], // Could be populated by re-processing
    specific_fields: {},
    
    // Keep all legacy fields for backward compat
    ...legacyDoc,
    
    _schema_version: 'v7-flexible'
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
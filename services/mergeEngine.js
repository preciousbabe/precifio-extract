import { isLegacyType } from '../schemas/documentRegistry.js';

// ============================================================
// MERGE ENGINE — Type-agnostic merge supporting both legacy and new formats
// ============================================================

export function mergeExtraction({ aws = null, gpt = null }) {
  aws = aws || {};
  gpt = gpt || {};

  const pick = (a, b) => {
    if (a !== null && a !== undefined && a !== '') return a;
    if (b !== null && b !== undefined && b !== '') return b;
    return null;
  };

  const pickNumber = (a, b) => {
    const isValid = (v) => typeof v === 'number' && !isNaN(v);
    if (isValid(a)) return a;
    if (isValid(b)) return b;
    return null;
  };

  const pickArray = (a, b) => {
    if (Array.isArray(a) && a.length) return a;
    if (Array.isArray(b) && b.length) return b;
    return [];
  };

  const pickObject = (a, b) => {
    if (a && typeof a === 'object' && !Array.isArray(a) && Object.keys(a).length > 0) return a;
    if (b && typeof b === 'object' && !Array.isArray(b) && Object.keys(b).length > 0) return b;
    return {};
  };

  const pickStatus = (a, b) => {
    const valid = (v) => v !== null && v !== undefined && v !== '' && v !== 'UNKNOWN' && v !== 'unknown';
    if (valid(a)) return a;
    if (valid(b)) return b;
    return null;
  };

  const pickString = (a, b) => {
    const val = pick(a, b);
    return val ? String(val).trim() : null;
  };

  // Determine final document type
  const detectedType = pickString(gpt.document_type, aws.document_type) || 'unknown';
  const isLegacy = isLegacyType(detectedType);

  // Merge issuer (new format)
  const mergedIssuer = {
    name: pickString(aws.issuer?.name, gpt.issuer?.name) || pickString(aws.vendor_name, gpt.vendor_name),
    address: pickString(aws.issuer?.address, gpt.issuer?.address) || pickString(aws.vendor_address, gpt.vendor_address),
    tax_id: pickString(aws.issuer?.tax_id, gpt.issuer?.tax_id) || pickString(aws.vendor_tax_id, gpt.vendor_tax_id),
    email: pickString(aws.issuer?.email, gpt.issuer?.email) || pickString(aws.vendor_email, gpt.vendor_email),
    phone: pickString(aws.issuer?.phone, gpt.issuer?.phone) || pickString(aws.vendor_phone, gpt.vendor_phone),
    website: pickString(aws.issuer?.website, gpt.issuer?.website) || pickString(aws.vendor_website, gpt.vendor_website),
    registration_number: pickString(aws.issuer?.registration_number, gpt.issuer?.registration_number) || pickString(aws.vendor_registration_number, gpt.vendor_registration_number),
    id_number: pickString(aws.issuer?.id_number, gpt.issuer?.id_number)
  };

  // Merge recipient (new format)
  const mergedRecipient = {
    name: pickString(aws.recipient?.name, gpt.recipient?.name) || pickString(aws.buyer_name, gpt.buyer_name) || pickString(aws.counterparty, gpt.counterparty),
    address: pickString(aws.recipient?.address, gpt.recipient?.address) || pickString(aws.buyer_address, gpt.buyer_address),
    tax_id: pickString(aws.recipient?.tax_id, gpt.recipient?.tax_id) || pickString(aws.buyer_tax_id, gpt.buyer_tax_id),
    email: pickString(aws.recipient?.email, gpt.recipient?.email) || pickString(aws.buyer_email, gpt.buyer_email),
    id_number: pickString(aws.recipient?.id_number, gpt.recipient?.id_number),
    date_of_birth: pickString(aws.recipient?.date_of_birth, gpt.recipient?.date_of_birth)
  };

  // Merge sections (new format) — prefer GPT's structured sections, fallback to AWS
  const mergedSections = mergeSections(aws.sections, gpt.sections);

  // Merge specific_fields
  const mergedSpecificFields = { ...aws.specific_fields, ...gpt.specific_fields };

  // Build result
  const result = {
    document_type: detectedType,
    document_subtype: pickString(gpt.document_subtype, aws.document_subtype),
    document_category: pickString(gpt.document_category, aws.document_category) || 'other',
    
    issuer: mergedIssuer,
    recipient: mergedRecipient,
    
    issue_date: pickString(gpt.issue_date, aws.issue_date) || pickString(gpt.date, aws.date) || pickString(gpt.invoice_date, aws.invoice_date) || pickString(gpt.effective_date, aws.effective_date),
    effective_date: pickString(gpt.effective_date, aws.effective_date),
    expiry_date: pickString(gpt.expiry_date, aws.expiry_date) || pickString(gpt.expiration_date, aws.expiration_date),
    
    total_amount: pickNumber(gpt.total_amount, aws.total_amount),
    currency: pickString(gpt.currency, aws.currency) || 'USD',
    tax_amount: pickNumber(gpt.tax_amount, aws.tax_amount) || 0,
    
    sections: mergedSections,
    specific_fields: mergedSpecificFields,
    
    // Legacy fields (for backward compat)
    vendor_name: mergedIssuer.name,
    vendor_address: mergedIssuer.address,
    vendor_tax_id: mergedIssuer.tax_id,
    vendor_email: mergedIssuer.email,
    vendor_phone: mergedIssuer.phone,
    vendor_website: mergedIssuer.website,
    vendor_registration_number: mergedIssuer.registration_number,
    
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
    
    // Legacy invoice fields
    invoice_number: pickString(gpt.invoice_number, aws.invoice_number) || pickString(gpt.reference_number, aws.reference_number),
    reference_number: pickString(gpt.reference_number, aws.reference_number),
    po_number: pickString(gpt.po_number, aws.po_number),
    buyer_name: mergedRecipient.name,
    buyer_address: mergedRecipient.address,
    buyer_tax_id: mergedRecipient.tax_id,
    buyer_email: mergedRecipient.email,
    invoice_date: pickString(gpt.invoice_date, aws.invoice_date),
    due_date: pickString(gpt.due_date, aws.due_date),
    payment_date: pickString(gpt.payment_date, aws.payment_date),
    
    line_items: pickArray(gpt.line_items, aws.line_items),
    subtotal: pickNumber(gpt.subtotal, aws.subtotal),
    discount_amount: pickNumber(gpt.discount_amount, aws.discount_amount) || 0,
    tax_details: pickArray(gpt.tax_details, aws.tax_details),
    shipping_amount: pickNumber(gpt.shipping_amount, aws.shipping_amount) || 0,
    amount_due: pickNumber(gpt.amount_due, aws.amount_due),
    amount_paid: pickNumber(gpt.amount_paid, aws.amount_paid) || 0,
    
    payment_status: pickStatus(gpt.payment_status, aws.payment_status),
    payment_method: pickString(gpt.payment_method, aws.payment_method),
    payment_terms: pickString(gpt.payment_terms, aws.payment_terms),
    purchase_order_reference: pickString(gpt.purchase_order_reference, aws.purchase_order_reference),
    service_period: pickObject(gpt.service_period, aws.service_period),
    late_fee: pickNumber(gpt.late_fee, aws.late_fee),
    invoice_status: pickStatus(gpt.invoice_status, aws.invoice_status),
    
    // Legacy receipt fields
    receipt_number: pickString(gpt.receipt_number, aws.receipt_number),
    items: pickArray(gpt.items, aws.items),
    change_given: pickNumber(gpt.change_given, aws.change_given) || 0,
    cashier_name: pickString(gpt.cashier_name, aws.cashier_name),
    store_location: pickString(gpt.store_location, aws.store_location),
    terminal_id: pickString(gpt.terminal_id, aws.terminal_id),
    
    // Legacy bank statement fields
    account_number: pickString(gpt.account_number, aws.account_number),
    statement_period: pickObject(gpt.statement_period, aws.statement_period),
    opening_balance: pickNumber(gpt.opening_balance, aws.opening_balance),
    closing_balance: pickNumber(gpt.closing_balance, aws.closing_balance),
    transactions: pickArray(gpt.transactions, aws.transactions),
    account_name: pickString(gpt.account_name, aws.account_name),
    bank_name: pickString(gpt.bank_name, aws.bank_name),
    branch_name: pickString(gpt.branch_name, aws.branch_name),
    routing_number: pickString(gpt.routing_number, aws.routing_number),
    swift_code: pickString(gpt.swift_code, aws.swift_code),
    iban: pickString(gpt.iban, aws.iban),
    account_type: pickString(gpt.account_type, aws.account_type),
    
    // Legacy utility bill fields
    bill_number: pickString(gpt.bill_number, aws.bill_number),
    usage_amount: pick(gpt.usage_amount, aws.usage_amount),
    usage_period: pickObject(gpt.usage_period, aws.usage_period),
    previous_balance: pickNumber(gpt.previous_balance, aws.previous_balance) || 0,
    current_charges: pickNumber(gpt.current_charges, aws.current_charges) || 0,
    meter_number: pickString(gpt.meter_number, aws.meter_number),
    customer_number: pickString(gpt.customer_number, aws.customer_number),
    tariff_plan: pickString(gpt.tariff_plan, aws.tariff_plan),
    units_consumed: pickNumber(gpt.units_consumed, aws.units_consumed),
    
    // Legacy purchase order fields
    order_date: pickString(gpt.order_date, aws.order_date),
    delivery_date: pickString(gpt.delivery_date, aws.delivery_date),
    ship_to: pickString(gpt.ship_to, aws.ship_to),
    buyer_company: pickString(gpt.buyer_company, aws.buyer_company),
    supplier_name: pickString(gpt.supplier_name, aws.supplier_name),
    supplier_contact: pickString(gpt.supplier_contact, aws.supplier_contact),
    expected_total: pickNumber(gpt.expected_total, aws.expected_total),
    
    // Legacy contract fields
    contract_number: pickString(gpt.contract_number, aws.contract_number),
    contract_type: pickString(gpt.contract_type, aws.contract_type),
    counterparty: pickString(gpt.counterparty, aws.counterparty),
    expiration_date: pickString(gpt.expiration_date, aws.expiration_date),
    renewal_date: pickString(gpt.renewal_date, aws.renewal_date),
    contract_value: pickNumber(gpt.contract_value, aws.contract_value),
    
             category: pickString(gpt.category, aws.category) || pickString(gpt.document_category, aws.document_category) || 'Uncategorized',
    _source: {
      aws: Object.keys(aws).length > 0,
      gpt: Object.keys(gpt).length > 0
    }
  };

  // === FIX 1: Sync root category with document_category ===
  result.category = result.document_category || result.category || 'Uncategorized';

  // === FIX 2: Bank statements never have line_items ===
  if (result.document_type === 'bank-statement') {
    result.line_items = [];
    result.items = [];
  }

  // === FIX 3: Derive bank statement data from transactions ===
  if (result.document_type === 'bank-statement' && result.transactions?.length > 0) {
    const dates = result.transactions
      .map(t => t.date)
      .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    if (dates.length >= 2) {
      result.statement_period = {
        from: result.statement_period?.from || dates[0],
        to: result.statement_period?.to || dates[dates.length - 1]
      };
    }
    if (result.opening_balance == null && result.transactions[0]?.balance != null) {
      result.opening_balance = result.transactions[0].balance;
    }
    if (result.closing_balance == null && result.transactions[result.transactions.length - 1]?.balance != null) {
      result.closing_balance = result.transactions[result.transactions.length - 1].balance;
    }
  }

  // === FIX 4: Clean garbage line items (date fragments) ===
  if (result.line_items?.length > 0) {
    result.line_items = result.line_items.filter(item => {
      const desc = (item.description || '').trim();
      if (/^-?\d{1,2}$/.test(desc)) return false;
      if (/^\d{4}-\d{2}-\d{2}$/.test(desc)) return false;
      return true;
    });
  }

  return result;
}

function mergeSections(awsSections = [], gptSections = []) {
  // Prefer GPT sections, but merge with AWS if GPT is missing data
  if (!gptSections.length) return awsSections;
  if (!awsSections.length) return gptSections;

  // Merge by section_type
  const sectionMap = new Map();
  
  awsSections.forEach(s => {
    sectionMap.set(s.section_type, { ...s });
  });
  
  gptSections.forEach(s => {
    const existing = sectionMap.get(s.section_type);
    if (existing) {
      // Merge fields — prefer GPT, fallback to AWS
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



// ============================================================
// DOCUMENT REGISTRY — Single source of truth for all supported types
// ============================================================

export const DOCUMENT_CATEGORIES = {
  FINANCIAL: 'financial',
  LEGAL: 'legal',
  HR: 'hr',
  HEALTHCARE: 'healthcare',
  INSURANCE: 'insurance',
  LOGISTICS: 'logistics',
  REAL_ESTATE: 'real_estate',
  EDUCATION: 'education',
  GOVERNMENT: 'government',
  OTHER: 'other'
};

// Registry of all supported document types
// legacy: true = outputs old flat schema for backward UI compat
// legacy: false = outputs new sections-based schema
export const DOCUMENT_REGISTRY = {
  // ================= FINANCIAL =================
  invoice: {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: true,
    displayName: 'Invoice',
    sections: ['line_items', 'payment_info', 'parties', 'totals'],
    requiredFields: ['invoice_number', 'vendor_name', 'total_amount', 'invoice_date'],
    expectedFields: [
      'vendor_name', 'total_amount', 'invoice_date', 'line_items', 'invoice_number',
      'buyer_name', 'subtotal', 'tax_amount', 'amount_due'
    ],
    fieldWeights: {
      vendor_name: 0.10, vendor_address: 0.03, vendor_tax_id: 0.02,
      vendor_email: 0.02, vendor_phone: 0.02, date: 0.05,
      currency: 0.02, total_amount: 0.12, invoice_number: 0.08,
      po_number: 0.02, reference_number: 0.02, buyer_name: 0.05,
      buyer_address: 0.02, buyer_tax_id: 0.02, buyer_email: 0.02,
      invoice_date: 0.06, due_date: 0.04, payment_date: 0.02,
      line_items: 0.15, subtotal: 0.06, discount_amount: 0.02,
      tax_amount: 0.04, tax_details: 0.02, shipping_amount: 0.02,
      amount_due: 0.04, amount_paid: 0.02, payment_status: 0.03,
      payment_method: 0.02, payment_terms: 0.02, category: 0.02
    }
  },
  receipt: {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: true,
    displayName: 'Receipt',
    sections: ['items', 'payment_info', 'store_info'],
    requiredFields: ['vendor_name', 'total_amount'],
    expectedFields: ['vendor_name', 'total_amount', 'date', 'items', 'receipt_number', 'payment_method'],
    fieldWeights: {
      vendor_name: 0.15, vendor_address: 0.03, date: 0.08,
      currency: 0.02, total_amount: 0.18, receipt_number: 0.06,
      items: 0.20, change_given: 0.03, cashier_name: 0.03,
      store_location: 0.03, terminal_id: 0.02, tax_amount: 0.05,
      payment_method: 0.05, category: 0.02
    }
  },
  'bank-statement': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: true,
    displayName: 'Bank Statement',
    sections: ['transactions', 'account_summary', 'account_info'],
    requiredFields: ['transactions'],
    expectedFields: ['transactions', 'statement_period', 'bank_name', 'account_number', 'closing_balance', 'opening_balance'],
    fieldWeights: {
      transactions: 0.40, statement_period: 0.10, opening_balance: 0.10,
      closing_balance: 0.10, account_number: 0.05, account_name: 0.05,
      bank_name: 0.05, branch_name: 0.03, routing_number: 0.03,
      swift_code: 0.02, iban: 0.02, account_type: 0.03, currency: 0.02,
      category: 0.02, date: 0.01
    }
  },

  'credit-card-statement': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: false,
    displayName: 'Credit Card Statement',
    sections: ['transactions', 'account_summary', 'payment_info', 'rewards'],
    requiredFields: ['account_number', 'transactions'],
    expectedFields: ['account_number', 'closing_balance', 'transactions', 'statement_period', 'payment_due_date', 'credit_limit'],
    promptHints: ['credit card', 'card ending in', 'statement balance', 'minimum payment due', 'transactions', 'merchant', 'cashback', 'rewards points']
  },
  'purchase-order': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: true,
    displayName: 'Purchase Order',
    sections: ['line_items', 'delivery_info', 'parties'],
    requiredFields: ['po_number', 'vendor_name', 'line_items'],
    expectedFields: ['po_number', 'vendor_name', 'line_items', 'buyer_name', 'order_date', 'delivery_date', 'ship_to'],
    fieldWeights: {
      vendor_name: 0.08, date: 0.03, currency: 0.02, total_amount: 0.10,
      po_number: 0.10, buyer_name: 0.05, buyer_company: 0.04,
      line_items: 0.20, order_date: 0.06, delivery_date: 0.05,
      ship_to: 0.04, supplier_name: 0.05, supplier_contact: 0.03,
      expected_total: 0.06, category: 0.02
    }
  },
  'expense-report': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: false,
    displayName: 'Expense Report',
    sections: ['expenses', 'approvals', 'employee_info', 'totals'],
    requiredFields: ['employee_name', 'expense_items'],
    expectedFields: ['employee_name', 'department', 'submission_date', 'expenses', 'total_reimbursement', 'approval_status'],
    promptHints: ['expense report', 'reimbursement', 'business expense', 'receipts attached', 'mileage', 'per diem', 'approval', 'submitted by']
  },
  'tax-form': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: false,
    displayName: 'Tax Form',
    sections: ['taxpayer_info', 'income', 'deductions', 'credits', 'calculations'],
    requiredFields: ['taxpayer_name', 'tax_year'],
    expectedFields: ['taxpayer_name', 'tax_id', 'tax_year', 'filing_status', 'income', 'taxable_income', 'tax_due', 'refund'],
    promptHints: ['tax return', 'form 1040', 'W-2', 'W2', '1099', 'taxable income', 'deductions', 'credits', 'IRS', 'filing status', 'refund amount']
  },
  'payroll-report': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: false,
    displayName: 'Payroll Report',
    sections: ['employee_earnings', 'deductions', 'net_pay', 'company_info'],
    requiredFields: ['company_name', 'pay_period', 'employees'],
    expectedFields: ['company_name', 'pay_period', 'employees', 'gross_pay_total', 'deductions_total', 'net_pay_total'],
    promptHints: ['payroll', 'pay period', 'gross pay', 'net pay', 'deductions', 'withholding', 'social security', 'medicare', 'pay date', 'employee earnings']
  },

  // ================= LEGAL =================
  contract: {
    category: DOCUMENT_CATEGORIES.LEGAL,
    legacy: true,
    displayName: 'Contract',
    sections: ['parties', 'terms', 'clauses', 'signatures', 'obligations'],
    requiredFields: ['contract_number', 'effective_date'],
    expectedFields: ['contract_number', 'counterparty', 'effective_date', 'contract_value', 'contract_type'],
    fieldWeights: {
      vendor_name: 0.06, date: 0.03, currency: 0.02, total_amount: 0.05,
      contract_number: 0.12, contract_type: 0.06, counterparty: 0.10,
      effective_date: 0.10, expiration_date: 0.08, renewal_date: 0.05,
      contract_value: 0.15, category: 0.02
    }
  },
  'lease-agreement': {
    category: DOCUMENT_CATEGORIES.LEGAL,
    legacy: false,
    displayName: 'Lease Agreement',
    sections: ['parties', 'property', 'terms', 'rent', 'deposit', 'clauses'],
    requiredFields: ['lessor', 'lessee', 'property_address'],
    expectedFields: ['lessor', 'lessee', 'property_address', 'lease_term', 'monthly_rent', 'security_deposit', 'start_date', 'end_date'],
    promptHints: ['lease agreement', 'rental agreement', 'lessor', 'lessee', 'tenant', 'landlord', 'security deposit', 'monthly rent', 'lease term', 'property address']
  },
  nda: {
    category: DOCUMENT_CATEGORIES.LEGAL,
    legacy: false,
    displayName: 'Non-Disclosure Agreement',
    sections: ['parties', 'confidentiality_terms', 'duration', 'scope', 'return_period'],
    requiredFields: ['disclosing_party', 'receiving_party', 'effective_date'],
    expectedFields: ['disclosing_party', 'receiving_party', 'effective_date', 'term_years', 'jurisdiction', 'mutual_nda'],
    promptHints: ['non-disclosure', 'NDA', 'confidential information', 'disclosing party', 'receiving party', 'proprietary', 'trade secret', 'term', 'mutual']
  },
  'service-agreement': {
    category: DOCUMENT_CATEGORIES.LEGAL,
    legacy: false,
    displayName: 'Service Agreement',
    sections: ['parties', 'services', 'contract_value', 'payment_terms', 'term', 'key_contacts', 'termination', 'governing_law', 'signatures'],
    requiredFields: ['provider', 'client', 'service_description'],
    expectedFields: ['provider', 'client', 'service_description', 'start_date', 'end_date', 'payment_terms', 'total_contract_amount'],
    fieldAliases: {
      provider: ['provider', 'service_provider_name', 'service_provider', 'vendor_name', 'issuer_name'],
      client: ['client', 'client_name', 'buyer_name', 'customer_name', 'recipient_name'],
      service_description: ['service_description', 'description', 'scope_of_work', 'services_description'],
      start_date: ['start_date', 'effective_date', 'commencement_date'],
      end_date: ['end_date', 'expiry_date', 'termination_date'],
      payment_terms: ['payment_terms', 'payment_schedule', 'billing_terms'],
      total_contract_amount: ['total_contract_amount', 'contract_value', 'total_amount', 'agreement_value']
    },
    promptHints: ['service agreement', 'SOW', 'statement of work', 'service provider', 'client', 'deliverables', 'SLA', 'service level', 'scope of work']
  },
  'court-document': {
    category: DOCUMENT_CATEGORIES.LEGAL,
    legacy: false,
    displayName: 'Court Document',
    sections: ['case_info', 'parties', 'filing_info', 'rulings', 'scheduling'],
    requiredFields: ['case_number', 'court_name', 'filing_date'],
    expectedFields: ['case_number', 'court_name', 'judge', 'parties', 'filing_date', 'document_type', 'hearing_date'],
    promptHints: ['court', 'case number', 'docket', 'plaintiff', 'defendant', 'filing', 'motion', 'judgment', 'subpoena', 'hearing', 'jurisdiction']
  },
  'property-deed': {
    category: DOCUMENT_CATEGORIES.LEGAL,
    legacy: false,
    displayName: 'Property Deed',
    sections: ['property', 'grantor', 'grantee', 'terms', 'encumbrances'],
    requiredFields: ['property_address', 'grantor', 'grantee', 'recording_date'],
    expectedFields: ['property_address', 'grantor', 'grantee', 'recording_date', 'recording_number', 'property_description', 'consideration'],
    promptHints: ['deed', 'grantor', 'grantee', 'property description', 'legal description', 'recording', 'county recorder', 'consideration', 'warranty deed', 'quitclaim']
  },

  // ================= HR =================
  resume: {
    category: DOCUMENT_CATEGORIES.HR,
    legacy: false,
    displayName: 'Resume / CV',
    sections: ['personal_info', 'experience', 'education', 'skills', 'certifications', 'summary'],
    requiredFields: ['full_name'],
    expectedFields: ['full_name', 'email', 'phone', 'experience', 'education', 'skills'],
    promptHints: ['resume', 'CV', 'curriculum vitae', 'professional summary', 'work experience', 'education', 'skills', 'certifications', 'contact information']
  },
  'employment-contract': {
    category: DOCUMENT_CATEGORIES.HR,
    legacy: false,
    displayName: 'Employment Contract',
    sections: ['parties', 'position', 'compensation', 'terms', 'benefits', 'termination'],
    requiredFields: ['employee_name', 'employer_name', 'start_date', 'position'],
    expectedFields: ['employee_name', 'employer_name', 'start_date', 'position', 'salary', 'employment_type', 'benefits'],
    promptHints: ['employment contract', 'offer of employment', 'salary', 'position', 'job title', 'start date', 'probation', 'benefits', 'termination clause']
  },
  'offer-letter': {
    category: DOCUMENT_CATEGORIES.HR,
    legacy: false,
    displayName: 'Offer Letter',
    sections: ['candidate', 'position', 'compensation', 'start_date', 'conditions'],
    requiredFields: ['candidate_name', 'position', 'start_date'],
    expectedFields: ['candidate_name', 'position', 'start_date', 'salary', 'reporting_manager', 'employment_type', 'acceptance_deadline'],
    promptHints: ['offer letter', 'job offer', 'congratulations', 'position', 'salary', 'start date', 'reporting to', 'acceptance', 'employment type', 'benefits overview']
  },
  'employee-record': {
    category: DOCUMENT_CATEGORIES.HR,
    legacy: false,
    displayName: 'Employee Record',
    sections: ['personal_info', 'employment_history', 'benefits', 'performance', 'contact'],
    requiredFields: ['employee_id', 'full_name', 'hire_date'],
    expectedFields: ['employee_id', 'full_name', 'hire_date', 'department', 'position', 'status', 'benefits'],
    promptHints: ['employee record', 'personnel file', 'employee ID', 'hire date', 'department', 'job classification', 'benefits enrollment', 'emergency contact']
  },
  'performance-review': {
    category: DOCUMENT_CATEGORIES.HR,
    legacy: false,
    displayName: 'Performance Review',
    sections: ['employee', 'reviewer', 'ratings', 'goals', 'feedback', 'development'],
    requiredFields: ['employee_name', 'reviewer_name', 'review_period'],
    expectedFields: ['employee_name', 'reviewer_name', 'review_period', 'review_date', 'overall_rating', 'goals', 'strengths', 'improvements'],
    promptHints: ['performance review', 'annual review', 'performance evaluation', 'goals', 'objectives', 'competencies', 'rating', 'reviewer', 'development plan', 'feedback']
  },

  // ================= HEALTHCARE =================
  'medical-report': {
    category: DOCUMENT_CATEGORIES.HEALTHCARE,
    legacy: false,
    displayName: 'Medical Report',
    sections: ['patient_info', 'diagnosis', 'treatment', 'provider', 'vitals', 'history'],
    requiredFields: ['patient_name', 'date_of_birth', 'provider_name', 'report_date'],
    expectedFields: ['patient_name', 'date_of_birth', 'medical_record_number', 'provider_name', 'diagnosis', 'treatment_plan', 'report_date'],
    promptHints: ['medical report', 'clinical report', 'diagnosis', 'treatment plan', 'physician', 'patient', 'medical history', 'symptoms', 'findings', 'recommendations']
  },
  'insurance-claim': {
    category: DOCUMENT_CATEGORIES.INSURANCE,
    legacy: false,
    displayName: 'Insurance Claim',
    sections: ['claim_information', 'incident_details', 'vehicle_information', 'damage_assessment', 'supporting_documents'],
    requiredFields: ['claim_number', 'policy_number', 'incident_date'],
    expectedFields: ['claim_number', 'policy_number', 'incident_date', 'claim_status', 'location', 'primary_damage', 'estimated_repair_cost'],
    fieldAliases: {
      claim_number: ['claim_number', 'claim_no', 'claim_id'],
      policy_number: ['policy_number', 'policy_no', 'policy_id'],
      incident_date: ['incident_date', 'accident_date', 'date_of_incident', 'event_date'],
      location: ['location', 'incident_location', 'accident_location'],
      primary_damage: ['primary_damage', 'damage_description', 'main_damage'],
      estimated_repair_cost: ['estimated_repair_cost', 'repair_cost', 'estimated_cost']
    },
    promptHints: ['insurance claim', 'claim form', 'claim number', 'policy number', 'incident', 'accident', 'damage', 'repair estimate', 'vehicle', 'property', 'liability', 'coverage', 'deductible']
  },
  // Alias for GPT-extracted type name
  'insurance-claim-report': {
    category: DOCUMENT_CATEGORIES.INSURANCE,
    legacy: false,
    displayName: 'Insurance Claim',
    sections: ['claim_information', 'incident_details', 'vehicle_information', 'damage_assessment', 'supporting_documents'],
    requiredFields: ['claim_number', 'policy_number', 'incident_date'],
    expectedFields: ['claim_number', 'policy_number', 'incident_date', 'claim_status', 'location', 'primary_damage', 'estimated_repair_cost'],
    fieldAliases: {
      claim_number: ['claim_number', 'claim_no', 'claim_id'],
      policy_number: ['policy_number', 'policy_no', 'policy_id'],
      incident_date: ['incident_date', 'accident_date', 'date_of_incident', 'event_date'],
      location: ['location', 'incident_location', 'accident_location'],
      primary_damage: ['primary_damage', 'damage_description', 'main_damage'],
      estimated_repair_cost: ['estimated_repair_cost', 'repair_cost', 'estimated_cost']
    },
    promptHints: ['insurance claim', 'claim form', 'claim number', 'policy number', 'incident', 'accident', 'damage', 'repair estimate', 'vehicle', 'property', 'liability', 'coverage', 'deductible']
  },
  'lab-result': {
    category: DOCUMENT_CATEGORIES.HEALTHCARE,
    legacy: false,
    displayName: 'Lab Result',
    sections: ['patient', 'test_info', 'results', 'reference_ranges', 'provider', 'specimen'],
    requiredFields: ['patient_name', 'test_name', 'test_date', 'ordering_provider'],
    expectedFields: ['patient_name', 'test_name', 'test_date', 'ordering_provider', 'results', 'reference_ranges', 'lab_name'],
    promptHints: ['laboratory', 'lab result', 'test result', 'specimen', 'reference range', 'abnormal', 'critical value', 'pathology', 'blood test', 'urinalysis', 'culture']
  },
  prescription: {
    category: DOCUMENT_CATEGORIES.HEALTHCARE,
    legacy: false,
    displayName: 'Prescription',
    sections: ['patient', 'medication', 'dosage', 'provider', 'pharmacy', 'instructions'],
    requiredFields: ['patient_name', 'medication_name', 'prescriber_name', 'prescription_date'],
    expectedFields: ['patient_name', 'medication_name', 'dosage', 'frequency', 'prescriber_name', 'prescription_date', 'pharmacy', 'refills'],
    promptHints: ['prescription', 'Rx', 'medication', 'dosage', 'sig', 'refills', 'prescriber', 'pharmacy', 'NDC', 'quantity', 'directions', 'PRN']
  },
  'patient-intake': {
    category: DOCUMENT_CATEGORIES.HEALTHCARE,
    legacy: false,
    displayName: 'Patient Intake Form',
    sections: ['patient_info', 'medical_history', 'insurance', 'emergency_contact', 'consent'],
    requiredFields: ['patient_name', 'date_of_birth'],
    expectedFields: ['patient_name', 'date_of_birth', 'address', 'phone', 'insurance_provider', 'policy_number', 'emergency_contact', 'reason_for_visit'],
    promptHints: ['patient intake', 'registration form', 'medical history', 'allergies', 'medications', 'insurance card', 'emergency contact', 'reason for visit', 'consent', 'HIPAA']
  },

  // ================= LOGISTICS =================
  'bill-of-lading': {
    category: DOCUMENT_CATEGORIES.LOGISTICS,
    legacy: false,
    displayName: 'Bill of Lading',
    sections: ['shipment', 'carrier', 'cargo', 'route', 'parties', 'terms'],
    requiredFields: ['bol_number', 'shipper', 'consignee', 'vessel', 'port_of_loading'],
    expectedFields: ['bol_number', 'shipper', 'consignee', 'notify_party', 'vessel', 'voyage_number', 'port_of_loading', 'port_of_discharge', 'cargo_description'],
    promptHints: ['bill of lading', 'B/L', 'shipper', 'consignee', 'notify party', 'vessel', 'port of loading', 'port of discharge', 'freight', 'cargo', 'container number', 'master B/L']
  },
  'shipping-manifest': {
    category: DOCUMENT_CATEGORIES.LOGISTICS,
    legacy: false,
    displayName: 'Shipping Manifest',
    sections: ['vessel', 'cargo_list', 'ports', 'parties', 'voyage_info'],
    requiredFields: ['manifest_number', 'vessel_name', 'voyage_number'],
    expectedFields: ['manifest_number', 'vessel_name', 'voyage_number', 'port_of_loading', 'port_of_discharge', 'cargo_items', 'total_weight'],
    promptHints: ['manifest', 'cargo manifest', 'vessel', 'voyage', 'IMO number', 'port of loading', 'port of discharge', 'consignee list', 'container manifest', 'master manifest']
  },
  'delivery-note': {
    category: DOCUMENT_CATEGORIES.LOGISTICS,
    legacy: false,
    displayName: 'Delivery Note',
    sections: ['order', 'items', 'delivery', 'recipient', 'carrier'],
    requiredFields: ['delivery_note_number', 'recipient_name', 'delivery_date'],
    expectedFields: ['delivery_note_number', 'order_reference', 'recipient_name', 'delivery_address', 'delivery_date', 'items_delivered', 'carrier'],
    promptHints: ['delivery note', 'delivery receipt', 'proof of delivery', 'POD', 'consignment', 'items delivered', 'recipient signature', 'delivery date', 'order reference']
  },
  'customs-document': {
    category: DOCUMENT_CATEGORIES.LOGISTICS,
    legacy: false,
    displayName: 'Customs Document',
    sections: ['declaration', 'goods', 'duties', 'parties', 'shipment'],
    requiredFields: ['declaration_number', 'importer', 'exporter', 'country_of_origin'],
    expectedFields: ['declaration_number', 'importer', 'exporter', 'country_of_origin', 'hs_codes', 'customs_value', 'duties_taxes', 'port_of_entry'],
    promptHints: ['customs declaration', 'import declaration', 'export declaration', 'HS code', 'harmonized system', 'CIF value', 'duty', 'tariff', 'country of origin', 'customs broker', 'clearance']
  },

  // ================= REAL ESTATE =================
  'property-valuation': {
    category: DOCUMENT_CATEGORIES.REAL_ESTATE,
    legacy: false,
    displayName: 'Property Valuation',
    sections: ['property', 'valuation', 'comparables', 'appraiser', 'methodology'],
    requiredFields: ['property_address', 'valuation_date', 'appraiser_name', 'estimated_value'],
    expectedFields: ['property_address', 'valuation_date', 'appraiser_name', 'estimated_value', 'property_type', 'square_footage', 'valuation_method'],
    promptHints: ['appraisal', 'valuation', 'comparable sales', 'market value', 'appraiser', 'property type', 'square footage', 'condition', 'neighborhood', 'cap rate']
  },
  'inspection-report': {
    category: DOCUMENT_CATEGORIES.REAL_ESTATE,
    legacy: false,
    displayName: 'Inspection Report',
    sections: ['property', 'inspector', 'findings', 'recommendations', 'systems'],
    requiredFields: ['property_address', 'inspection_date', 'inspector_name'],
    expectedFields: ['property_address', 'inspection_date', 'inspector_name', 'inspector_license', 'findings', 'recommendations', 'systems_checked'],
    promptHints: ['home inspection', 'property inspection', 'inspector', 'structural', 'roof', 'plumbing', 'electrical', 'HVAC', 'foundation', 'deficiencies', 'recommendations']
  },
  'mortgage-document': {
    category: DOCUMENT_CATEGORIES.REAL_ESTATE,
    legacy: false,
    displayName: 'Mortgage Document',
    sections: ['borrower', 'lender', 'property', 'terms', 'payment_schedule', 'escrow'],
    requiredFields: ['borrower_name', 'lender_name', 'loan_amount', 'property_address'],
    expectedFields: ['borrower_name', 'lender_name', 'loan_amount', 'property_address', 'interest_rate', 'loan_term', 'monthly_payment', 'loan_number'],
    promptHints: ['mortgage', 'deed of trust', 'promissory note', 'loan amount', 'interest rate', 'APR', 'principal', 'escrow', 'PMI', 'closing costs', 'lender', 'mortgagor']
  },
  'land-registry': {
    category: DOCUMENT_CATEGORIES.REAL_ESTATE,
    legacy: false,
    displayName: 'Land Registry Record',
    sections: ['property', 'owner', 'encumbrances', 'history', 'legal_description'],
    requiredFields: ['property_id', 'owner_name', 'registration_date'],
    expectedFields: ['property_id', 'owner_name', 'registration_date', 'property_address', 'land_area', 'title_number', 'encumbrances'],
    promptHints: ['land registry', 'title deed', 'cadastral', 'parcel number', 'title search', 'encumbrance', 'lien', 'easement', 'registered owner', 'land area', 'survey']
  },

  // ================= EDUCATION =================
  transcript: {
    category: DOCUMENT_CATEGORIES.EDUCATION,
    legacy: false,
    displayName: 'Academic Transcript',
    sections: ['student', 'institution', 'courses', 'grades', 'gpa', 'academic_standing'],
    requiredFields: ['student_name', 'institution_name', 'student_id'],
    expectedFields: ['student_name', 'institution_name', 'student_id', 'program', 'courses', 'grades', 'gpa', 'credits_earned', 'graduation_date'],
    promptHints: ['transcript', 'academic record', 'GPA', 'credit hours', 'course code', 'semester', 'grade', 'cumulative GPA', 'major', 'degree program', 'official transcript']
  },
  certificate: {
    category: DOCUMENT_CATEGORIES.EDUCATION,
    legacy: false,
    displayName: 'Certificate',
    sections: ['recipient', 'institution', 'credential', 'date', 'verification'],
    requiredFields: ['recipient_name', 'institution_name', 'credential_name', 'issue_date'],
    expectedFields: ['recipient_name', 'institution_name', 'credential_name', 'issue_date', 'credential_id', 'field_of_study', 'completion_date'],
    promptHints: ['certificate', 'certification', 'completed', 'awarded', 'credential', 'training', 'professional development', 'CEU', 'continuing education', 'accredited']
  },
  diploma: {
    category: DOCUMENT_CATEGORIES.EDUCATION,
    legacy: false,
    displayName: 'Diploma',
    sections: ['graduate', 'institution', 'degree', 'date', 'honors'],
    requiredFields: ['graduate_name', 'institution_name', 'degree_name', 'graduation_date'],
    expectedFields: ['graduate_name', 'institution_name', 'degree_name', 'graduation_date', 'major', 'honors', 'degree_type'],
    promptHints: ['diploma', 'degree', 'bachelor', 'master', 'doctorate', 'graduated', 'cum laude', 'magna cum laude', 'conferred', 'registrar', 'seal', 'graduation']
  },
  'student-record': {
    category: DOCUMENT_CATEGORIES.EDUCATION,
    legacy: false,
    displayName: 'Student Record',
    sections: ['student', 'enrollment', 'grades', 'attendance', 'disciplinary', 'contact'],
    requiredFields: ['student_name', 'student_id', 'institution_name'],
    expectedFields: ['student_name', 'student_id', 'institution_name', 'enrollment_date', 'program', 'status', 'contact_info'],
    promptHints: ['student record', 'student file', 'enrollment', 'academic standing', 'attendance', 'disciplinary', 'advisor', 'major', 'minor', 'credits']
  },

  // ================= GOVERNMENT =================
  passport: {
    category: DOCUMENT_CATEGORIES.GOVERNMENT,
    legacy: false,
    displayName: 'Passport',
    sections: ['personal_info', 'document_info', 'issuing_authority', 'emergency_contact'],
    requiredFields: ['full_name', 'passport_number', 'nationality', 'date_of_birth', 'issue_date', 'expiry_date'],
    expectedFields: ['full_name', 'passport_number', 'nationality', 'date_of_birth', 'place_of_birth', 'issue_date', 'expiry_date', 'issuing_authority', 'mrz'],
    promptHints: ['passport', 'travel document', 'nationality', 'place of birth', 'issuing authority', 'MRZ', 'machine readable zone', 'biometric', 'visa pages', 'passport number']
  },
  'drivers-license': {
    category: DOCUMENT_CATEGORIES.GOVERNMENT,
    legacy: false,
    displayName: "Driver's License",
    sections: ['personal_info', 'license_info', 'restrictions', 'endorsements'],
    requiredFields: ['full_name', 'license_number', 'date_of_birth', 'issue_date', 'expiry_date', 'issuing_state'],
    expectedFields: ['full_name', 'license_number', 'date_of_birth', 'address', 'issue_date', 'expiry_date', 'issuing_state', 'class', 'restrictions'],
    promptHints: ["driver's license", 'DL', 'motor vehicle', 'class', 'endorsement', 'restriction', 'DL number', 'issuing state', 'expiration', 'organ donor', 'REAL ID']
  },
  'national-id': {
    category: DOCUMENT_CATEGORIES.GOVERNMENT,
    legacy: false,
    displayName: 'National ID',
    sections: ['personal_info', 'document_info', 'issuing_authority', 'biometrics'],
    requiredFields: ['full_name', 'id_number', 'nationality', 'date_of_birth', 'issue_date'],
    expectedFields: ['full_name', 'id_number', 'nationality', 'date_of_birth', 'place_of_birth', 'issue_date', 'expiry_date', 'issuing_authority'],
    promptHints: ['national ID', 'identity card', 'ID card', 'citizen', 'national identification number', 'NIN', 'SSN', 'social security', 'resident card', 'government ID']
  },
  permit: {
    category: DOCUMENT_CATEGORIES.GOVERNMENT,
    legacy: false,
    displayName: 'Permit',
    sections: ['holder', 'permit_info', 'conditions', 'issuing_authority', 'scope'],
    requiredFields: ['permit_number', 'holder_name', 'permit_type', 'issue_date', 'issuing_authority'],
    expectedFields: ['permit_number', 'holder_name', 'permit_type', 'issue_date', 'expiry_date', 'issuing_authority', 'conditions', 'scope'],
    promptHints: ['permit', 'authorization', 'license', 'building permit', 'work permit', 'environmental permit', 'zoning', 'conditional use', 'issuing authority', 'valid period']
  },
  license: {
    category: DOCUMENT_CATEGORIES.GOVERNMENT,
    legacy: false,
    displayName: 'License',
    sections: ['holder', 'license_info', 'conditions', 'issuing_authority', 'scope'],
    requiredFields: ['license_number', 'holder_name', 'license_type', 'issue_date', 'issuing_authority'],
    expectedFields: ['license_number', 'holder_name', 'license_type', 'issue_date', 'expiry_date', 'issuing_authority', 'conditions', 'scope'],
    promptHints: ['license', 'business license', 'professional license', 'renewal', 'license number', 'issuing board', 'practicing', 'certified', 'accredited', 'valid through']
  },

  'utility-bill': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: true,
    displayName: 'Utility Bill',
    sections: ['account_info', 'usage', 'charges', 'payment'],
    requiredFields: ['amount_due'],
    expectedFields: ['vendor_name', 'amount_due', 'usage_amount', 'bill_number', 'account_number', 'usage_period', 'due_date'],
    fieldWeights: {
      vendor_name: 0.08, date: 0.05, currency: 0.02, total_amount: 0.08,
      bill_number: 0.06, usage_amount: 0.10, usage_period: 0.05,
      previous_balance: 0.06, current_charges: 0.08, amount_due: 0.12,
      due_date: 0.06, account_number: 0.05, meter_number: 0.04,
      customer_number: 0.04, tariff_plan: 0.03, units_consumed: 0.04,
      category: 0.02
    }
  },
  // ================= FALLBACK =================
  unknown: {
    category: DOCUMENT_CATEGORIES.OTHER,
    legacy: false,
    displayName: 'Unknown Document',
    sections: ['general'],
    requiredFields: [],
    expectedFields: ['notes'],
    promptHints: []
  }
};

// Helper functions
export function getDocumentTypeInfo(type) {
  return DOCUMENT_REGISTRY[type] || DOCUMENT_REGISTRY.unknown;
}

export function isLegacyType(type) {
  return getDocumentTypeInfo(type).legacy === true;
}

export function getDocumentCategory(type) {
  return getDocumentTypeInfo(type).category;
}

export function getAllDocumentTypes() {
  return Object.keys(DOCUMENT_REGISTRY).filter(t => t !== 'unknown');
}

export function getSupportedTypeList() {
  return Object.entries(DOCUMENT_REGISTRY)
    .filter(([key]) => key !== 'unknown')
    .map(([key, value]) => ({
      type: key,
      displayName: value.displayName,
      category: value.category,
      legacy: value.legacy
    }));
}

export function getTypesByCategory(category) {
  return Object.entries(DOCUMENT_REGISTRY)
    .filter(([_, info]) => info.category === category)
    .map(([type, _]) => type);
}

// Detect document category from filename and content
export function detectDocumentCategory(fileName = '', content = '') {
  const name = fileName.toLowerCase();
  const text = content.slice(0, 3000).toLowerCase();

  const patterns = [
    { 
      category: DOCUMENT_CATEGORIES.FINANCIAL, 
      keywords: ['invoice', 'receipt', 'statement', 'payment', 'purchase order', 'expense', 'tax', 'payroll', 'salary', 'bank', 'credit card', 'bill', 'amount due', 'total', 'subtotal']
    },
    { 
      category: DOCUMENT_CATEGORIES.LEGAL, 
      keywords: ['contract', 'agreement', 'lease', 'nda', 'non-disclosure', 'court', 'deed', 'legal', 'terms', 'jurisdiction', 'plaintiff', 'defendant', 'motion', 'judgment']
    },
    { 
      category: DOCUMENT_CATEGORIES.HR, 
      keywords: ['resume', 'cv', 'curriculum vitae', 'employment', 'offer letter', 'employee', 'performance review', 'hr', 'hiring', 'salary', 'position', 'work experience']
    },
    { 
      category: DOCUMENT_CATEGORIES.HEALTHCARE, 
      keywords: ['medical', 'prescription', 'lab', 'patient', 'diagnosis', 'treatment', 'health', 'doctor', 'hospital', 'clinical', 'pharmacy', 'rx', 'medical report', 'lab result']
    },
    { 
      category: DOCUMENT_CATEGORIES.INSURANCE, 
      keywords: ['insurance claim', 'claim number', 'policy number', 'incident report', 'damage assessment', 'repair estimate', 'auto claim', 'vehicle claim', 'property claim', 'liability', 'coverage', 'deductible', 'premium']
    },
    { 
      category: DOCUMENT_CATEGORIES.LOGISTICS, 
      keywords: ['bill of lading', 'shipping', 'manifest', 'delivery', 'cargo', 'customs', 'freight', 'tracking', 'consignment', 'vessel', 'port']
    },
    { 
      category: DOCUMENT_CATEGORIES.REAL_ESTATE, 
      keywords: ['property', 'mortgage', 'valuation', 'inspection', 'land registry', 'deed', 'title', 'real estate', 'appraisal', 'home inspection']
    },
    { 
      category: DOCUMENT_CATEGORIES.EDUCATION, 
      keywords: ['transcript', 'diploma', 'certificate', 'student', 'academic', 'grade', 'university', 'college', 'degree', 'gpa', 'course']
    },
    { 
      category: DOCUMENT_CATEGORIES.GOVERNMENT, 
      keywords: ['passport', 'license', 'permit', 'national id', 'driver', 'government', 'authority', 'identification', 'citizen', 'identification number']
    }
  ];

  for (const { category, keywords } of patterns) {
    if (keywords.some(k => name.includes(k) || text.includes(k))) return category;
  }
  return null;
}

// Build a human-readable list of supported types for error messages
export function getSupportedTypesMessage() {
  const types = getSupportedTypeList();
  const byCategory = {};
  types.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t.displayName);
  });

  return Object.entries(byCategory)
    .map(([cat, names]) => `${cat.replace('_', ' ').toUpperCase()}: ${names.join(', ')}`)
    .join(' | ');
}
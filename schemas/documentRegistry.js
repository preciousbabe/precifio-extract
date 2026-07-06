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


export const DOCUMENT_REGISTRY = {
  // ================= FINANCIAL =================
  invoice: {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: false,
    displayName: 'Invoice',
    sections: ['line_items', 'payment_info', 'parties', 'totals'],
    requiredFields: ['invoice_number', 'vendor_name', 'total_amount', 'invoice_date'],
    expectedFields: [
  'vendor_name', 'vendor_address', 'vendor_tax_id', 'vendor_email', 'vendor_phone',
  'total_amount', 'invoice_date', 'due_date', 'line_items', 'invoice_number',
  'buyer_name', 'buyer_address', 'buyer_tax_id', 'buyer_email',
  'subtotal', 'discount_amount', 'tax_amount', 'tax_details', 'shipping_amount',
  'amount_due', 'amount_paid', 'payment_method', 'payment_terms', 'payment_status',
  'bank_name', 'account_number', 'swift_code', 'branch_name', 'notes',
  'po_number', 'reference_number', 'currency', 'category'
],
    fieldTypes: {
  account_number: 'string',    
  amount_due: 'number', 
  notes: 'string',          
  amount_paid: 'number',
  bank_name: 'string',            
  branch_name: 'string',
  buyer_name: 'string',           
  discount_amount: 'number',
  due_date: 'date',
  invoice_date: 'date',
  invoice_number: 'string',       
  line_items: 'array',
  payment_method: 'string',
  payment_status: 'string',
  payment_terms: 'string',      
  po_number: 'string',           
  reference_number: 'string',    
  shipping_amount: 'number',
  subtotal: 'number',            
  swift_code: 'string',
  tax_amount: 'number',
  total_amount: 'number',        
  vendor_name: 'string'         
},
    fieldAliases: {
      invoice_number: ['invoice_number', 'inv_number', 'inv_no', 'invoice_no', 'bill_number', 'invoice #', 'inv #'],
      invoice_date: ['invoice_date', 'issue_date', 'date', 'bill_date', 'date_of_invoice'],
      due_date: ['due_date', 'payment_due', 'due_by', 'payment_deadline'],
      subtotal: ['subtotal', 'sub_total', 'sub-total', 'net_amount', 'net_total'],
      discount_amount: ['discount_amount', 'discount', 'disc', 'less_discount', 'discount_total'],
      shipping_amount: ['shipping_amount', 'shipping', 'freight', 'delivery_charge', 'delivery', 'shipping_cost'],
      tax_amount: ['tax_amount', 'tax', 'vat', 'sales_tax', 'tax_total', 'vat_amount'],
      amount_due: ['amount_due', 'balance_due', 'total_due', 'due_amount', 'balance', 'amount_payable'],
      amount_paid: ['amount_paid', 'paid_amount', 'payment_received', 'advance', 'payment_made'],
      payment_method: ['payment_method', 'payment_mode', 'mode_of_payment', 'paid_by'],
      payment_terms: ['payment_terms', 'terms', 'credit_terms', 'net_terms'],
      payment_status: ['payment_status', 'status', 'payment_state', 'paid_status'],
      bank_name: ['bank_name', 'bank', 'bank_details', 'remit_to_bank'],
      account_number: ['account_number', 'account', 'acct_no', 'bank_account', 'account_no'],
      swift_code: ['swift_code', 'swift', 'swift_bic', 'bic', 'swift_code'],
      branch_name: ['branch_name', 'branch'],
      po_number: ['po_number', 'po_no', 'purchase_order', 'p.o. number', 'PO Number'],
      reference_number: ['reference_number', 'ref_no', 'reference', 'ref_number'],
      vendor_name: ['vendor_name', 'seller_name', 'from', 'billed_by', 'issuer_name', 'company_name'],
      buyer_name: ['buyer_name', 'billed_to', 'customer_name', 'client_name', 'purchaser']
    },
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
    legacy: false,
    displayName: 'Receipt',
    sections: ['items', 'payment_info', 'store_info'],
    requiredFields: ['vendor_name', 'total_amount'],
    expectedFields: [
      'vendor_name', 'vendor_address', 'total_amount', 'date', 'items', 
      'receipt_number', 'payment_method', 'tax_amount', 'change_given',
      'store_location', 'terminal_id', 'cashier_name', 'currency'
    ],
    fieldTypes: {
      cashier_name: 'party',
      change_given: 'number',        
      currency: 'string',
      date: 'date',
      items: 'array',
      payment_method: 'string',
      receipt_number: 'string',    
      store_location: 'string',      
      tax_amount: 'number',
      terminal_id: 'string',         
      total_amount: 'number',        
      vendor_address: 'string',
      vendor_name: 'party'
    },
    fieldAliases: {
      receipt_number: ['receipt_number', 'receipt_no', 'receipt_id', 'txn_id', 'transaction_id', 'ref_no', 'receipt#', 'transaction_no', 'invoice_no', 'bill_no'],
      date: ['date', 'receipt_date', 'transaction_date', 'date_of_purchase', 'purchase_date', 'sale_date', 'time', 'timestamp'],
      total_amount: ['total_amount', 'total', 'grand_total', 'amount', 'sum', 'total_paid', 'amount_paid', 'bill_total', 'order_total'],
      tax_amount: ['tax_amount', 'tax', 'vat', 'sales_tax', 'gst', 'tax_total', 'vat_amount', 'tax_amt'],
      change_given: ['change_given', 'change', 'change_due', 'cash_back', 'balance_returned', 'change_amount', 'balance_given'],
      payment_method: ['payment_method', 'payment_mode', 'paid_by', 'payment_type', 'card_type', 'tender_type', 'paid_with', 'payment'],
      vendor_name: ['vendor_name', 'merchant_name', 'store_name', 'seller', 'retailer', 'shop_name', 'business_name', 'from', 'merchant', 'company_name', 'sold_by'],
      vendor_address: ['vendor_address', 'store_address', 'location', 'branch_address', 'merchant_address', 'shop_address', 'business_address'],
      store_location: ['store_location', 'branch', 'outlet', 'store', 'location', 'branch_name', 'branch_location', 'shop_location'],
      terminal_id: ['terminal_id', 'pos_id', 'terminal', 'device_id', 'register_no', 'pos_terminal', 'register_id', 'machine_id'],
      cashier_name: ['cashier_name', 'cashier', 'served_by', 'operator', 'clerk', 'attendant', 'staff_name', 'employee_name'],
      currency: ['currency', 'cur', 'ccy', 'payment_currency']
    },
    fieldWeights: {
      vendor_name: 0.15,
      vendor_address: 0.03,
      date: 0.08,
      currency: 0.02,
      total_amount: 0.18,
      receipt_number: 0.06,
      items: 0.20,
      change_given: 0.03,
      cashier_name: 0.03,
      store_location: 0.03,
      terminal_id: 0.02,
      tax_amount: 0.05,
      payment_method: 0.05,
      category: 0.02
    }
  },


  'bank-statement': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: false,
    displayName: 'Bank Statement',
    sections: ['transactions', 'account_summary', 'account_info'],
    requiredFields: ['transactions'],
    expectedFields: [
      'transactions', 'statement_period', 'bank_name', 'account_number', 
      'account_name', 'account_type', 'closing_balance', 'opening_balance',
      'branch_name', 'swift_code', 'routing_number', 'iban', 'currency',
      'total_debits', 'total_credits', 'statement_date', 'statement_id'
    ],
    fieldTypes: {
      account_name: 'string',
      account_number: 'string',        
      account_type: 'string',          
      bank_name: 'party',
      branch_name: 'string',
      closing_balance: 'number',
      currency: 'string',
      iban: 'string',
      opening_balance: 'number',
      routing_number: 'string',        
      statement_date: 'date',
      statement_id: 'string',
      statement_period: 'period',
      swift_code: 'string',
      total_credits: 'number',
      total_debits: 'number',
      transactions: 'array'
    },
    fieldAliases: {
      bank_name: ['bank_name', 'bank', 'financial_institution', 'institution', 'banking_partner'],
      account_number: ['account_number', 'account', 'acct_no', 'account_no', 'acct_number', 'account_id'],
      account_name: ['account_name', 'account_holder', 'holder_name', 'customer_name', 'primary_account_holder'],
      account_type: ['account_type', 'type_of_account', 'product_type', 'account_category'],
      opening_balance: ['opening_balance', 'beginning_balance', 'start_balance', 'balance_brought_forward', 'ob', 'previous_balance'],
      closing_balance: ['closing_balance', 'ending_balance', 'end_balance', 'balance_carried_forward', 'cb', 'current_balance'],
      statement_period: ['statement_period', 'period', 'reporting_period', 'statement_date', 'for_the_period', 'statement_month'],
      statement_date: ['statement_date', 'statement_generated_date', 'report_date', 'issue_date'],
      statement_id: ['statement_id', 'statement_number', 'report_id', 'reference_number'],
      branch_name: ['branch_name', 'branch', 'bank_branch'],
      routing_number: ['routing_number', 'routing', 'sort_code', 'aba', 'routing_no', 'sort'],
      swift_code: ['swift_code', 'swift', 'bic', 'swift_bic', 'swift_id'],
      iban: ['iban', 'iban_number', 'international_account'],
      total_debits: ['total_debits', 'total_debit', 'debit_total', 'sum_debits', 'debits'],
      total_credits: ['total_credits', 'total_credit', 'credit_total', 'sum_credits', 'credits'],
      transactions: ['transactions', 'entries', 'transaction_history', 'activity', 'debits_and_credits', 'transaction_list']
    },
    fieldWeights: {
      transactions: 0.35,
      statement_period: 0.10,
      opening_balance: 0.10,
      closing_balance: 0.10,
      account_number: 0.08,
      account_name: 0.05,
      bank_name: 0.05,
      branch_name: 0.03,
      routing_number: 0.03,
      swift_code: 0.02,
      iban: 0.02,
      account_type: 0.02,
      currency: 0.02,
      total_debits: 0.02,
      total_credits: 0.02,
      statement_date: 0.01,
      statement_id: 0.01,
      category: 0.01
    }
  },

  'credit-card-statement': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: false,
    displayName: 'Credit Card Statement',
    sections: ['transactions', 'account_summary', 'payment_info', 'rewards'],
    requiredFields: ['account_number', 'transactions'],
    expectedFields: ['account_number', 'closing_balance', 'transactions', 'statement_period', 'payment_due_date', 'credit_limit'],
    fieldTypes: {
      account_number: 'number',
      annual_percentage_rate: 'number',
      cardholder_name: 'party',
      cash_advance: 'string',
      closing_balance: 'number',
      credit_limit: 'number',
      fees_charged: 'number',
      minimum_payment: 'string',
      payment_due_date: 'date',
      previous_balance: 'number',
      rewards_points: 'number',
      statement_period: 'period',
      transactions: 'array'
    },
    fieldAliases: {
      account_number: ['account_number', 'card_number', 'acct_no', 'account_no', 'card_no', 'card_ending_in', 'last_4_digits', 'card_number_ending'],
      cardholder_name: ['cardholder_name', 'card_holder', 'primary_cardholder', 'member_name'],
      statement_period: ['statement_period', 'period', 'billing_period', 'statement_date', 'billing_cycle', 'for_the_period'],
      payment_due_date: ['payment_due_date', 'due_date', 'payment_deadline', 'must_pay_by'],
      closing_balance: ['closing_balance', 'statement_balance', 'new_balance', 'current_balance', 'balance'],
      previous_balance: ['previous_balance', 'last_statement_balance', 'prior_balance'],
      credit_limit: ['credit_limit', 'available_credit', 'credit_line', 'spending_limit', 'limit'],
      minimum_payment: ['minimum_payment', 'min_payment', 'minimum_payment_due', 'min_amount_due'],
      annual_percentage_rate: ['annual_percentage_rate', 'apr', 'interest_rate', 'purchase_apr', 'cash_advance_apr'],
      transactions: ['transactions', 'purchases', 'charges', 'transaction_history', 'activity', 'debits_and_credits'],
      rewards_points: ['rewards_points', 'points_earned', 'cashback', 'reward_balance', 'miles', 'points'],
      cash_advance: ['cash_advance', 'cash_advance_balance', 'cash_withdrawal'],
      fees_charged: ['fees_charged', 'fees', 'annual_fee', 'late_fee', 'over_limit_fee', 'transaction_fees']
    },
    fieldWeights: {
      account_number: 0.08, cardholder_name: 0.05, statement_period: 0.08,
      closing_balance: 0.12, previous_balance: 0.05, payment_due_date: 0.08,
      minimum_payment: 0.06, credit_limit: 0.05, annual_percentage_rate: 0.04,
      transactions: 0.25, rewards_points: 0.04, cash_advance: 0.03,
      fees_charged: 0.03, currency: 0.02, category: 0.02
    },
    promptHints: ['credit card', 'card ending in', 'statement balance', 'minimum payment due', 'transactions', 'merchant', 'cashback', 'rewards points']
  },

  'purchase-order': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: false,
    displayName: 'Purchase Order',
    sections: ['line_items', 'delivery_info', 'parties'],
    requiredFields: ['po_number', 'vendor_name', 'line_items'],
    expectedFields: ['po_number', 'vendor_name', 'line_items', 'buyer_name', 'order_date', 'delivery_date', 'ship_to'],
    fieldTypes: {
      buyer_company: 'string',
      buyer_name: 'party',
      delivery_date: 'date',
      expected_total: 'period',
      line_items: 'array',
      order_date: 'date',
      po_number: 'number',
      ship_to: 'period',
      supplier_contact: 'string',
      supplier_name: 'string',
      vendor_name: 'party'
    },
    fieldAliases: {
      po_number: ['po_number', 'po_no', 'purchase_order', 'p.o. number', 'PO Number', 'order_number', 'purchase_order_no', 'po_id'],
      order_date: ['order_date', 'date', 'po_date', 'purchase_order_date', 'issued_date', 'date_issued'],
      delivery_date: ['delivery_date', 'deliver_by', 'expected_delivery', 'ship_date', 'delivery_by', 'required_delivery_date'],
      vendor_name: ['vendor_name', 'supplier_name', 'seller_name', 'vendor', 'supplier', 'from', 'seller'],
      supplier_name: ['supplier_name', 'supplier', 'vendor_name', 'seller', 'provider'],
      supplier_contact: ['supplier_contact', 'supplier_email', 'supplier_phone', 'vendor_contact', 'vendor_email', 'vendor_phone'],
      buyer_name: ['buyer_name', 'purchaser', 'ordered_by', 'company_name', 'organization', 'purchasing_company'],
      buyer_company: ['buyer_company', 'company', 'organization', 'purchasing_company', 'buyer_organization'],
      ship_to: ['ship_to', 'delivery_address', 'shipping_address', 'consignee', 'deliver_to', 'destination'],
      expected_total: ['expected_total', 'po_total', 'order_total', 'total_value', 'estimated_total', 'total_amount'],
      line_items: ['line_items', 'items', 'products', 'goods', 'services', 'order_lines', 'ordered_items']
    },
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
    fieldTypes: {
      approval_date: 'date',
      approval_status: 'string',
      approver_name: 'party',
      currency: 'string',
      department: 'string',
      employee_id: 'string',
      employee_name: 'party',
      expense_items: 'array',
      expense_period: 'period',
      expenses: 'string',
      policy_violations: 'string',
      purpose: 'string',
      submission_date: 'date',
      total_reimbursement: 'period'
    },
    fieldAliases: {
      employee_name: ['employee_name', 'submitted_by', 'employee', 'staff_name', 'claimant', 'reported_by'],
      employee_id: ['employee_id', 'staff_id', 'employee_number', 'emp_id', 'personnel_number'],
      department: ['department', 'dept', 'division', 'cost_center', 'business_unit'],
      submission_date: ['submission_date', 'submitted_date', 'date_submitted', 'report_date', 'date'],
      expense_items: ['expense_items', 'expenses', 'line_items', 'expense_lines', 'claimed_expenses', 'expense_details'],
      total_reimbursement: ['total_reimbursement', 'total_claimed', 'amount_reimbursable', 'total_amount', 'reimbursement_amount'],
      approval_status: ['approval_status', 'status', 'approved', 'pending_approval', 'rejected', 'approval_state'],
      approver_name: ['approver_name', 'approved_by', 'manager_name', 'supervisor', 'reviewer'],
      approval_date: ['approval_date', 'date_approved', 'approved_on'],
      expense_period: ['expense_period', 'reporting_period', 'period_covered', 'from_date', 'to_date'],
      purpose: ['purpose', 'business_purpose', 'reason', 'trip_purpose', 'project_code'],
      policy_violations: ['policy_violations', 'violations', 'out_of_policy', 'non_compliant']
    },
    fieldWeights: {
      employee_name: 0.12, employee_id: 0.04, department: 0.04,
      submission_date: 0.06, expense_items: 0.25, total_reimbursement: 0.10,
      approval_status: 0.08, approver_name: 0.05, approval_date: 0.04,
      expense_period: 0.05, purpose: 0.06, policy_violations: 0.04,
      currency: 0.02, category: 0.02
    },
    promptHints: ['expense report', 'reimbursement', 'business expense', 'receipts attached', 'mileage', 'per diem', 'approval', 'submitted by']
  },

  'tax-form': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: false,
    displayName: 'Tax Form',
    sections: ['taxpayer_info', 'income', 'deductions', 'credits', 'calculations'],
    requiredFields: ['taxpayer_name', 'tax_year'],
    expectedFields: ['taxpayer_name', 'tax_id', 'tax_year', 'filing_status', 'income', 'taxable_income', 'tax_due', 'refund'],
    fieldTypes: {
      credits: 'number',
      deductions: 'array',
      filing_status: 'date',
      form_type: 'string',
      income: 'string',
      preparer_id: 'string',
      preparer_name: 'party',
      refund: 'string',
      tax_due: 'date',
      tax_id: 'number',
      tax_year: 'number',
      taxable_income: 'number',
      taxpayer_name: 'party',
      withholding: 'string'
    },
    fieldAliases: {
      taxpayer_name: ['taxpayer_name', 'taxpayer', 'filer_name', 'name', 'primary_taxpayer'],
      tax_id: ['tax_id', 'ssn', 'social_security_number', 'tin', 'taxpayer_identification_number', 'ein', 'itin'],
      tax_year: ['tax_year', 'year', 'filing_year', 'tax_period', 'return_year'],
      filing_status: ['filing_status', 'status', 'marital_status', 'filing_category', 'filing_type'],
      income: ['income', 'total_income', 'gross_income', 'adjusted_gross_income', 'agi', 'wages', 'salary', 'earnings'],
      taxable_income: ['taxable_income', 'taxable_earnings', 'net_taxable_income'],
      tax_due: ['tax_due', 'tax_liability', 'total_tax', 'amount_owed', 'tax_owed'],
      refund: ['refund', 'refund_amount', 'overpayment', 'amount_to_be_refunded', 'expected_refund'],
      withholding: ['withholding', 'tax_withheld', 'federal_withholding', 'state_withholding', 'tax_paid'],
      deductions: ['deductions', 'itemized_deductions', 'standard_deduction', 'total_deductions'],
      credits: ['credits', 'tax_credits', 'total_credits', 'child_tax_credit', 'earned_income_credit'],
      form_type: ['form_type', 'form', 'return_type', 'form_1040', 'form_1099', 'w2', 'w-2'],
      preparer_name: ['preparer_name', 'tax_preparer', 'prepared_by', 'accountant'],
      preparer_id: ['preparer_id', 'ptin', 'preparer_tax_id']
    },
    fieldWeights: {
      taxpayer_name: 0.10, tax_id: 0.08, tax_year: 0.10,
      filing_status: 0.06, income: 0.12, taxable_income: 0.08,
      tax_due: 0.08, refund: 0.08, withholding: 0.06,
      deductions: 0.08, credits: 0.06, form_type: 0.05,
      preparer_name: 0.03, preparer_id: 0.02, category: 0.02
    },
    promptHints: ['tax return', 'form 1040', 'W-2', 'W2', '1099', 'taxable income', 'deductions', 'credits', 'IRS', 'filing status', 'refund amount']
  },

  'payroll-report': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: false,
    displayName: 'Payroll Report',
    sections: ['employee_earnings', 'deductions', 'net_pay', 'company_info'],
    requiredFields: ['company_name', 'pay_period', 'employees'],
    expectedFields: ['company_name', 'pay_period', 'employees', 'gross_pay_total', 'deductions_total', 'net_pay_total'],
    fieldTypes: {
      company_name: 'party',
      deductions_total: 'period',
      employee_count: 'number',
      employees: 'array',
      federal_tax: 'number',
      gross_pay_total: 'period',
      health_insurance: 'string',
      medicare: 'string',
      net_pay_total: 'period',
      pay_date: 'date',
      pay_period: 'period',
      social_security: 'string',
      state_tax: 'number'
    },
    fieldAliases: {
      company_name: ['company_name', 'employer_name', 'organization', 'business_name', 'employer'],
      pay_period: ['pay_period', 'pay_date', 'payroll_period', 'period_ending', 'pay_period_end', 'payroll_date'],
      pay_date: ['pay_date', 'payment_date', 'date_paid', 'check_date', 'deposit_date'],
      employees: ['employees', 'employee_list', 'payroll_records', 'staff', 'worker_records'],
      gross_pay_total: ['gross_pay_total', 'total_gross_pay', 'gross_wages', 'total_earnings', 'gross_payroll'],
      deductions_total: ['deductions_total', 'total_deductions', 'withholdings', 'total_withholdings'],
      net_pay_total: ['net_pay_total', 'total_net_pay', 'net_wages', 'total_net', 'take_home_pay'],
      federal_tax: ['federal_tax', 'federal_withholding', 'federal_income_tax', 'fit'],
      state_tax: ['state_tax', 'state_withholding', 'state_income_tax', 'sit'],
      social_security: ['social_security', 'ss_tax', 'fica_ss', 'oasdi'],
      medicare: ['medicare', 'medicare_tax', 'fica_medicare'],
      retirement_401k: ['retirement_401k', '401k', 'retirement_contribution', 'deferred_compensation'],
      health_insurance: ['health_insurance', 'medical_premium', 'health_premium', 'insurance_deduction'],
      employee_count: ['employee_count', 'number_of_employees', 'total_employees', 'headcount']
    },
    fieldWeights: {
      company_name: 0.08, pay_period: 0.10, pay_date: 0.06,
      employees: 0.20, gross_pay_total: 0.10, deductions_total: 0.08,
      net_pay_total: 0.10, federal_tax: 0.05, state_tax: 0.04,
      social_security: 0.04, medicare: 0.04, retirement_401k: 0.03,
      health_insurance: 0.03, employee_count: 0.03, category: 0.02
    },
    promptHints: ['payroll', 'pay period', 'gross pay', 'net pay', 'deductions', 'withholding', 'social security', 'medicare', 'pay date', 'employee earnings']
  },

  'utility-bill': {
    category: DOCUMENT_CATEGORIES.FINANCIAL,
    legacy: false,
    displayName: 'Utility Bill',
    sections: ['account_info', 'usage', 'charges', 'payment'],
    requiredFields: ['amount_due'],
    expectedFields: ['vendor_name', 'amount_due', 'usage_amount', 'bill_number', 'account_number', 'usage_period', 'due_date'],
    fieldTypes: {
      account_number: 'number',
      amount_due: 'date',
      bill_number: 'number',
      current_charges: 'number',
      customer_number: 'period',
      due_date: 'date',
      meter_number: 'number',
      previous_balance: 'number',
      tariff_plan: 'string',
      units_consumed: 'number',
      usage_amount: 'number',
      usage_period: 'period',
      vendor_name: 'party'
    },
    fieldAliases: {
      bill_number: ['bill_number', 'bill_no', 'invoice_number', 'statement_number', 'bill_id'],
      account_number: ['account_number', 'account_no', 'acct_number', 'customer_account', 'utility_account'],
      meter_number: ['meter_number', 'meter_no', 'meter_id', 'meter_serial'],
      customer_number: ['customer_number', 'customer_no', 'customer_id', 'cust_number', 'customer_reference'],
      tariff_plan: ['tariff_plan', 'tariff', 'rate_plan', 'billing_plan', 'rate_schedule'],
      units_consumed: ['units_consumed', 'consumption', 'kwh', 'units', 'usage_units', 'usage', 'consumption_units'],
      current_charges: ['current_charges', 'current_amount', 'charges', 'amount', 'this_month_charges'],
      previous_balance: ['previous_balance', 'prev_balance', 'balance_brought_forward', 'prior_balance'],
      amount_due: ['amount_due', 'total_due', 'total_amount', 'balance_due', 'amount_payable', 'payment_due'],
      due_date: ['due_date', 'payment_due_date', 'pay_by', 'deadline'],
      usage_period: ['usage_period', 'billing_period', 'service_period', 'period', 'from_to_dates'],
      vendor_name: ['vendor_name', 'utility_provider', 'service_provider', 'company', 'utility_company', 'electric_company', 'water_company', 'gas_company']
    },
    fieldWeights: {
      vendor_name: 0.08, date: 0.05, currency: 0.02, total_amount: 0.08,
      bill_number: 0.06, usage_amount: 0.10, usage_period: 0.05,
      previous_balance: 0.06, current_charges: 0.08, amount_due: 0.12,
      due_date: 0.06, account_number: 0.05, meter_number: 0.04,
      customer_number: 0.04, tariff_plan: 0.03, units_consumed: 0.04,
      category: 0.02
    }
  },

  // ================= LEGAL =================
  contract: {
    category: DOCUMENT_CATEGORIES.LEGAL,
    legacy: false,
    displayName: 'Contract',
    sections: ['parties', 'terms', 'clauses', 'signatures', 'obligations'],
    requiredFields: ['contract_number', 'effective_date'],
    expectedFields: ['contract_number', 'counterparty', 'effective_date', 'contract_value', 'contract_type'],
    fieldTypes: {
      contract_number: 'number',
      contract_type: 'string',
      contract_value: 'number',
      counterparty: 'number',
      effective_date: 'date',
      expiration_date: 'date',
      governing_law: 'string',
      renewal_date: 'date',
      signatures: 'string',
      termination_clause: 'period',
      vendor_name: 'party'
    },
    fieldAliases: {
      contract_number: ['contract_number', 'contract_no', 'agreement_number', 'contract_id', 'ref_no', 'agreement_no', 'contract_ref'],
      contract_type: ['contract_type', 'type_of_contract', 'agreement_type', 'contract_category', 'nature_of_agreement'],
      contract_value: ['contract_value', 'value', 'agreement_value', 'total_value', 'contract_amount', 'deal_value', 'contract_price'],
      counterparty: ['counterparty', 'other_party', 'party_b', 'second_party', 'vendor_name', 'contractor', 'supplier', 'client'],
      effective_date: ['effective_date', 'start_date', 'commencement_date', 'contract_date', 'date_of_agreement', 'dated', 'date_executed'],
      expiration_date: ['expiration_date', 'expiry_date', 'end_date', 'termination_date', 'valid_until', 'contract_end'],
      renewal_date: ['renewal_date', 'renew_by', 'extension_date', 'auto_renewal', 'renewal_term'],
      vendor_name: ['vendor_name', 'party_a', 'first_party', 'company', 'employer', 'client', 'contractor_name'],
      governing_law: ['governing_law', 'jurisdiction', 'applicable_law', 'law_of', 'venue'],
      termination_clause: ['termination_clause', 'termination', 'termination_for_cause', 'termination_for_convenience'],
      signatures: ['signatures', 'signed_by', 'parties_signatures', 'execution', 'authorized_signatories']
    },
    fieldWeights: {
      vendor_name: 0.06, date: 0.03, currency: 0.02, total_amount: 0.05,
      contract_number: 0.12, contract_type: 0.06, counterparty: 0.10,
      effective_date: 0.10, expiration_date: 0.08, renewal_date: 0.05,
      contract_value: 0.15, governing_law: 0.04, termination_clause: 0.04,
      signatures: 0.06, category: 0.02
    }
  },

  'lease-agreement': {
    category: DOCUMENT_CATEGORIES.LEGAL,
    legacy: false,
    displayName: 'Lease Agreement',
    sections: ['parties', 'property', 'terms', 'rent', 'deposit', 'clauses'],
    requiredFields: ['lessor', 'lessee', 'property_address'],
    expectedFields: ['lessor', 'lessee', 'property_address', 'lease_term', 'monthly_rent', 'security_deposit', 'start_date', 'end_date'],
    fieldTypes: {
      end_date: 'date',
      lease_term: 'period',
      lessee: 'string',
      lessor: 'string',
      maintenance_responsibility: 'string',
      monthly_rent: 'number',
      parking: 'string',
      pet_policy: 'string',
      property_address: 'record',
      renewal_option: 'date',
      security_deposit: 'number',
      start_date: 'date',
      utilities_included: 'string'
    },
    fieldAliases: {
      lessor: ['lessor', 'landlord', 'owner', 'property_owner', 'leasing_party', 'lessor_name'],
      lessee: ['lessee', 'tenant', 'renter', 'occupant', 'tenant_name', 'leasing_party_b'],
      property_address: ['property_address', 'premises', 'leased_property', 'property_location', 'rental_address', 'address_of_premises'],
      lease_term: ['lease_term', 'term', 'duration', 'lease_duration', 'tenancy_period', 'length_of_lease'],
      monthly_rent: ['monthly_rent', 'rent', 'rental_amount', 'lease_payment', 'monthly_payment', 'base_rent'],
      security_deposit: ['security_deposit', 'deposit', 'damage_deposit', 'security', 'rental_deposit'],
      start_date: ['start_date', 'lease_start', 'commencement_date', 'possession_date', 'move_in_date'],
      end_date: ['end_date', 'lease_end', 'expiration_date', 'termination_date', 'move_out_date'],
      renewal_option: ['renewal_option', 'renewal', 'option_to_renew', 'extension_option'],
      maintenance_responsibility: ['maintenance_responsibility', 'maintenance', 'repairs', 'upkeep', 'property_maintenance'],
      utilities_included: ['utilities_included', 'utilities', 'included_utilities', 'utility_provision'],
      pet_policy: ['pet_policy', 'pets', 'pet_deposit', 'pet_rent', 'animals'],
      parking: ['parking', 'parking_space', 'parking_included', 'assigned_parking']
    },
    fieldWeights: {
      lessor: 0.10, lessee: 0.10, property_address: 0.12,
      lease_term: 0.08, monthly_rent: 0.10, security_deposit: 0.06,
      start_date: 0.08, end_date: 0.06, renewal_option: 0.04,
      maintenance_responsibility: 0.04, utilities_included: 0.03,
      pet_policy: 0.02, parking: 0.02, category: 0.02
    },
    promptHints: ['lease agreement', 'rental agreement', 'lessor', 'lessee', 'tenant', 'landlord', 'security deposit', 'monthly rent', 'lease term', 'property address']
  },

  nda: {
    category: DOCUMENT_CATEGORIES.LEGAL,
    legacy: false,
    displayName: 'Non-Disclosure Agreement',
    sections: ['parties', 'confidentiality_terms', 'duration', 'scope', 'return_period'],
    requiredFields: ['disclosing_party', 'receiving_party', 'effective_date'],
    expectedFields: ['disclosing_party', 'receiving_party', 'effective_date', 'term_years', 'jurisdiction', 'mutual_nda'],
    fieldTypes: {
      disclosing_party: 'party',
      effective_date: 'date',
      exclusions: 'string',
      jurisdiction: 'string',
      mutual_nda: 'boolean',
      permitted_disclosures: 'string',
      receiving_party: 'party',
      remedies: 'string',
      return_period: 'period',
      scope: 'string',
      term_years: 'number'
    },
    fieldAliases: {
      disclosing_party: ['disclosing_party', 'discloser', 'owner', 'proprietary_party', 'party_a', 'information_owner'],
      receiving_party: ['receiving_party', 'recipient', 'recipient_party', 'party_b', 'information_recipient'],
      effective_date: ['effective_date', 'date', 'agreement_date', 'dated', 'execution_date'],
      term_years: ['term_years', 'term', 'duration', 'confidentiality_period', 'survival_period', 'years'],
      jurisdiction: ['jurisdiction', 'governing_law', 'applicable_law', 'venue', 'law_of'],
      mutual_nda: ['mutual_nda', 'mutual', 'bilateral', 'reciprocal', 'two_way'],
      return_period: ['return_period', 'return_of_information', 'destruction_period', 'return_deadline'],
      scope: ['scope', 'scope_of_confidentiality', 'covered_information', 'definition_of_confidential', 'confidential_information'],
      exclusions: ['exclusions', 'excluded_information', 'public_information', 'prior_knowledge'],
      permitted_disclosures: ['permitted_disclosures', 'permitted_recipients', 'need_to_know', 'authorized_disclosure'],
      remedies: ['remedies', 'injunctive_relief', 'breach_remedies', 'liquidated_damages']
    },
    fieldWeights: {
      disclosing_party: 0.12, receiving_party: 0.12, effective_date: 0.08,
      term_years: 0.08, jurisdiction: 0.06, mutual_nda: 0.06,
      return_period: 0.05, scope: 0.10, exclusions: 0.05,
      permitted_disclosures: 0.05, remedies: 0.06, category: 0.02
    },
    promptHints: ['non-disclosure', 'NDA', 'confidential information', 'disclosing party', 'receiving party', 'proprietary', 'trade secret', 'term', 'mutual']
  },

  'service-agreement': {
    category: DOCUMENT_CATEGORIES.LEGAL,
    legacy: false,
    displayName: 'Service Agreement',
    sections: ['parties', 'services', 'contract_value', 'payment_terms', 'term', 'key_contacts', 'termination', 'governing_law', 'signatures'],
    requiredFields: ['provider', 'client', 'service_description'],
    expectedFields: ['provider', 'client', 'service_description', 'start_date', 'end_date', 'payment_terms', 'total_contract_amount'],
    fieldTypes: {
      acceptance_criteria: 'string',
      client: 'string',
      end_date: 'date',
      hourly_rate: 'number',
      intellectual_property: 'record',
      key_contacts: 'string',
      payment_terms: 'period',
      provider: 'string',
      service_description: 'record',
      sla: 'string',
      start_date: 'date',
      total_contract_amount: 'period'
    },
    fieldAliases: {
      provider: ['provider', 'service_provider_name', 'service_provider', 'vendor_name', 'issuer_name', 'contractor', 'consultant'],
      client: ['client', 'client_name', 'buyer_name', 'customer_name', 'recipient_name', 'engaging_party'],
      service_description: ['service_description', 'description', 'scope_of_work', 'services_description', 'sow', 'deliverables', 'work_description'],
      start_date: ['start_date', 'effective_date', 'commencement_date', 'service_start'],
      end_date: ['end_date', 'expiry_date', 'termination_date', 'service_end', 'completion_date'],
      payment_terms: ['payment_terms', 'payment_schedule', 'billing_terms', 'invoicing_terms', 'fee_structure'],
      total_contract_amount: ['total_contract_amount', 'contract_value', 'total_amount', 'agreement_value', 'contract_price', 'fee'],
      hourly_rate: ['hourly_rate', 'rate', 'billing_rate', 'hourly_fee', 'man_hour_rate'],
      sla: ['sla', 'service_level_agreement', 'service_levels', 'uptime_guarantee', 'response_time', 'performance_standards'],
      key_contacts: ['key_contacts', 'contacts', 'account_manager', 'project_manager', 'primary_contact'],
      acceptance_criteria: ['acceptance_criteria', 'acceptance', 'completion_criteria', 'sign_off_criteria'],
      intellectual_property: ['intellectual_property', 'ip_rights', 'ownership', 'work_for_hire', 'ip_ownership']
    },
    fieldWeights: {
      provider: 0.10, client: 0.10, service_description: 0.15,
      start_date: 0.06, end_date: 0.05, payment_terms: 0.08,
      total_contract_amount: 0.10, hourly_rate: 0.04, sla: 0.06,
      key_contacts: 0.04, acceptance_criteria: 0.04,
      intellectual_property: 0.04, category: 0.02
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
    fieldTypes: {
      attorney: 'period',
      case_number: 'number',
      case_title: 'string',
      court_name: 'party',
      document_type: 'string',
      filing_date: 'date',
      hearing_date: 'date',
      judge: 'string',
      jurisdiction: 'string',
      parties: 'string',
      relief_sought: 'string',
      ruling: 'string'
    },
    fieldAliases: {
      case_number: ['case_number', 'case_no', 'docket_number', 'docket', 'case_id', 'cause_number'],
      court_name: ['court_name', 'court', 'tribunal', 'judicial_body', 'court_of', 'district_court'],
      judge: ['judge', 'presiding_judge', 'honorable', 'judge_name', 'magistrate', 'justice'],
      parties: ['parties', 'plaintiff', 'defendant', 'petitioner', 'respondent', 'appellant', 'appellee', 'litigants'],
      filing_date: ['filing_date', 'filed_date', 'date_filed', 'submission_date', 'date_of_filing'],
      document_type: ['document_type', 'filing_type', 'motion_type', 'pleading_type', 'document_category'],
      hearing_date: ['hearing_date', 'hearing', 'trial_date', 'court_date', 'appearance_date', 'scheduling_conference'],
      jurisdiction: ['jurisdiction', 'venue', 'judicial_district', 'circuit', 'county'],
      case_title: ['case_title', 'caption', 'case_name', 'style_of_case', 'matter_of'],
      attorney: ['attorney', 'counsel', 'representative', 'lawyer', 'legal_representative'],
      ruling: ['ruling', 'order', 'judgment', 'decision', 'verdict', 'finding', 'decree'],
      relief_sought: ['relief_sought', 'prayer_for_relief', 'demands', 'claims', 'damages_sought']
    },
    fieldWeights: {
      case_number: 0.15, court_name: 0.10, judge: 0.08,
      parties: 0.12, filing_date: 0.08, document_type: 0.08,
      hearing_date: 0.06, jurisdiction: 0.05, case_title: 0.08,
      attorney: 0.05, ruling: 0.06, relief_sought: 0.04, category: 0.02
    },
    promptHints: ['court', 'case number', 'docket', 'plaintiff', 'defendant', 'filing', 'motion', 'judgment', 'subpoena', 'hearing', 'jurisdiction']
  },

  'property-deed': {
    category: DOCUMENT_CATEGORIES.LEGAL,
    legacy: false,
    displayName: 'Property Deed',
    sections: ['property', 'grantor', 'grantee', 'terms', 'encumbrances'],
    requiredFields: ['property_address', 'grantor', 'grantee', 'recording_date'],
    expectedFields: ['property_address', 'grantor', 'grantee', 'recording_date', 'recording_number', 'property_description', 'consideration'],
    fieldTypes: {
      consideration: 'string',
      county: 'number',
      deed_type: 'string',
      encumbrances: 'array',
      grantee: 'string',
      grantor: 'period',
      property_address: 'record',
      property_description: 'record',
      recording_date: 'date',
      recording_number: 'date',
      tax_parcel_id: 'number'
    },
    fieldAliases: {
      property_address: ['property_address', 'property_location', 'premises', 'real_property', 'subject_property'],
      grantor: ['grantor', 'seller', 'transferor', 'conveying_party', 'party_a', 'previous_owner'],
      grantee: ['grantee', 'buyer', 'transferee', 'receiving_party', 'party_b', 'new_owner'],
      recording_date: ['recording_date', 'recorded_date', 'date_recorded', 'filing_date', 'registry_date'],
      recording_number: ['recording_number', 'book_and_page', 'instrument_number', 'document_number', 'recording_id'],
      property_description: ['property_description', 'legal_description', 'metes_and_bounds', 'lot_and_block', 'parcel_description'],
      consideration: ['consideration', 'purchase_price', 'amount', 'valuable_consideration', 'price_paid'],
      deed_type: ['deed_type', 'type_of_deed', 'warranty_deed', 'quitclaim_deed', 'grant_deed', 'special_warranty'],
      encumbrances: ['encumbrances', 'liens', 'easements', 'restrictions', 'covenants', 'mortgage', 'outstanding_liens'],
      tax_parcel_id: ['tax_parcel_id', 'parcel_number', 'apn', 'assessors_parcel_number', 'property_id'],
      county: ['county', 'recording_county', 'jurisdiction', 'registry_of_deeds']
    },
    fieldWeights: {
      property_address: 0.12, grantor: 0.10, grantee: 0.10,
      recording_date: 0.08, recording_number: 0.06,
      property_description: 0.08, consideration: 0.06,
      deed_type: 0.06, encumbrances: 0.06, tax_parcel_id: 0.05,
      county: 0.04, category: 0.02
    },
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
    fieldTypes: {
      certifications: 'array',
      education: 'string',
      email: 'string',
      experience: 'string',
      full_name: 'string',
      languages: 'number',
      linkedin: 'string',
      phone: 'string',
      portfolio: 'string',
      references: 'array',
      skills: 'array',
      summary: 'number'
    },
    fieldAliases: {
      full_name: ['full_name', 'name', 'candidate_name', 'applicant_name', 'contact_name'],
      email: ['email', 'email_address', 'e_mail', 'contact_email'],
      phone: ['phone', 'phone_number', 'telephone', 'mobile', 'cell', 'contact_number'],
      experience: ['experience', 'work_experience', 'employment_history', 'professional_experience', 'career_history', 'jobs'],
      education: ['education', 'academic_background', 'qualifications', 'degrees', 'academic_history', 'schooling'],
      skills: ['skills', 'technical_skills', 'competencies', 'expertise', 'proficiencies', 'capabilities'],
      certifications: ['certifications', 'certificates', 'professional_certifications', 'licenses', 'accreditations'],
      summary: ['summary', 'professional_summary', 'objective', 'profile', 'career_summary', 'overview'],
      linkedin: ['linkedin', 'linkedin_url', 'linkedin_profile', 'professional_profile'],
      portfolio: ['portfolio', 'portfolio_url', 'website', 'personal_website', 'github'],
      languages: ['languages', 'language_proficiency', 'spoken_languages', 'bilingual', 'multilingual'],
      references: ['references', 'professional_references', 'referees', 'recommendations']
    },
    fieldWeights: {
      full_name: 0.10, email: 0.08, phone: 0.06,
      experience: 0.20, education: 0.15, skills: 0.15,
      certifications: 0.06, summary: 0.08, linkedin: 0.03,
      portfolio: 0.02, languages: 0.03, references: 0.02, category: 0.02
    },
    promptHints: ['resume', 'CV', 'curriculum vitae', 'professional summary', 'work experience', 'education', 'skills', 'certifications', 'contact information']
  },

  'employment-contract': {
    category: DOCUMENT_CATEGORIES.HR,
    legacy: false,
    displayName: 'Employment Contract',
    sections: ['parties', 'position', 'compensation', 'terms', 'benefits', 'termination'],
    requiredFields: ['employee_name', 'employer_name', 'start_date', 'position'],
    expectedFields: ['employee_name', 'employer_name', 'start_date', 'position', 'salary', 'employment_type', 'benefits'],
    fieldTypes: {
      benefits: 'string',
      employee_name: 'party',
      employer_name: 'party',
      employment_type: 'string',
      intellectual_property: 'record',
      position: 'string',
      probation_period: 'period',
      reporting_to: 'period',
      salary: 'string',
      start_date: 'date',
      termination_notice: 'period',
      work_location: 'string'
    },
    fieldAliases: {
      employee_name: ['employee_name', 'employee', 'staff_name', 'worker_name', 'hire_name'],
      employer_name: ['employer_name', 'company', 'organization', 'employer', 'hiring_company'],
      start_date: ['start_date', 'commencement_date', 'date_of_hire', 'beginning_date', 'first_day'],
      position: ['position', 'job_title', 'role', 'designation', 'position_title', 'job_role'],
      salary: ['salary', 'compensation', 'base_salary', 'annual_salary', 'wages', 'pay', 'remuneration'],
      employment_type: ['employment_type', 'type_of_employment', 'full_time', 'part_time', 'contract', 'permanent', 'temporary'],
      benefits: ['benefits', 'employee_benefits', 'fringe_benefits', 'perks', 'benefit_package'],
      probation_period: ['probation_period', 'probation', 'trial_period', 'probationary_period', 'evaluation_period'],
      work_location: ['work_location', 'location', 'place_of_work', 'office_location', 'remote_work'],
      reporting_to: ['reporting_to', 'supervisor', 'manager', 'reports_to', 'reporting_manager', 'director'],
      termination_notice: ['termination_notice', 'notice_period', 'resignation_notice', 'termination_clause'],
      intellectual_property: ['intellectual_property', 'ip_assignment', 'invention_assignment', 'work_product']
    },
    fieldWeights: {
      employee_name: 0.10, employer_name: 0.10, start_date: 0.08,
      position: 0.12, salary: 0.12, employment_type: 0.06,
      benefits: 0.06, probation_period: 0.04, work_location: 0.04,
      reporting_to: 0.05, termination_notice: 0.05,
      intellectual_property: 0.04, category: 0.02
    },
    promptHints: ['employment contract', 'offer of employment', 'salary', 'position', 'job title', 'start date', 'probation', 'benefits', 'termination clause']
  },

  'offer-letter': {
    category: DOCUMENT_CATEGORIES.HR,
    legacy: false,
    displayName: 'Offer Letter',
    sections: ['candidate', 'position', 'compensation', 'start_date', 'conditions'],
    requiredFields: ['candidate_name', 'position', 'start_date'],
    expectedFields: ['candidate_name', 'position', 'start_date', 'salary', 'reporting_manager', 'employment_type', 'acceptance_deadline'],
    fieldTypes: {
      acceptance_deadline: 'date',
      benefits_overview: 'record',
      candidate_name: 'party',
      employment_type: 'string',
      equity: 'string',
      offer_date: 'date',
      position: 'string',
      relocation: 'string',
      reporting_manager: 'number',
      salary: 'string',
      signing_bonus: 'number',
      start_date: 'date'
    },
    fieldAliases: {
      candidate_name: ['candidate_name', 'applicant_name', 'prospective_employee', 'new_hire_name', 'offer_recipient'],
      position: ['position', 'job_title', 'role', 'offered_position', 'position_offered'],
      start_date: ['start_date', 'commencement_date', 'joining_date', 'date_of_joining', 'first_day'],
      salary: ['salary', 'compensation', 'offered_salary', 'annual_salary', 'base_pay', 'remuneration'],
      reporting_manager: ['reporting_manager', 'supervisor', 'manager', 'reports_to', 'team_lead', 'director'],
      employment_type: ['employment_type', 'type', 'full_time', 'part_time', 'contract', 'permanent'],
      acceptance_deadline: ['acceptance_deadline', 'respond_by', 'deadline', 'offer_expiry', 'acceptance_date'],
      benefits_overview: ['benefits_overview', 'benefits', 'benefit_summary', 'perks', 'compensation_package'],
      equity: ['equity', 'stock_options', 'rsu', 'equity_grant', 'share_options', 'ownership'],
      relocation: ['relocation', 'relocation_package', 'moving_allowance', 'relocation_assistance'],
      signing_bonus: ['signing_bonus', 'joining_bonus', 'sign_on_bonus', 'welcome_bonus'],
      offer_date: ['offer_date', 'date_of_offer', 'letter_date', 'dated']
    },
    fieldWeights: {
      candidate_name: 0.12, position: 0.12, start_date: 0.10,
      salary: 0.12, reporting_manager: 0.06, employment_type: 0.06,
      acceptance_deadline: 0.08, benefits_overview: 0.06,
      equity: 0.04, relocation: 0.03, signing_bonus: 0.04,
      offer_date: 0.04, category: 0.02
    },
    promptHints: ['offer letter', 'job offer', 'congratulations', 'position', 'salary', 'start date', 'reporting to', 'acceptance', 'employment type', 'benefits overview']
  },

  'employee-record': {
    category: DOCUMENT_CATEGORIES.HR,
    legacy: false,
    displayName: 'Employee Record',
    sections: ['personal_info', 'employment_history', 'benefits', 'performance', 'contact'],
    requiredFields: ['employee_id', 'full_name', 'hire_date'],
    expectedFields: ['employee_id', 'full_name', 'hire_date', 'department', 'position', 'status', 'benefits'],
    fieldTypes: {
      benefits: 'string',
      department: 'string',
      emergency_contact: 'string',
      employee_id: 'string',
      full_name: 'string',
      hire_date: 'date',
      manager: 'number',
      position: 'string',
      salary_grade: 'number',
      status: 'string',
      termination_date: 'period',
      work_location: 'string'
    },
    fieldAliases: {
      employee_id: ['employee_id', 'emp_id', 'staff_id', 'employee_number', 'personnel_number', 'id_number'],
      full_name: ['full_name', 'name', 'employee_name', 'staff_name'],
      hire_date: ['hire_date', 'date_of_hire', 'employment_start', 'joining_date', 'date_joined'],
      department: ['department', 'dept', 'division', 'business_unit', 'team'],
      position: ['position', 'job_title', 'role', 'designation', 'current_position'],
      status: ['status', 'employment_status', 'active', 'inactive', 'terminated', 'on_leave', 'suspended'],
      benefits: ['benefits', 'benefit_enrollment', 'health_insurance', 'retirement_plan', 'benefits_package'],
      salary_grade: ['salary_grade', 'pay_grade', 'salary_band', 'compensation_level', 'grade'],
      manager: ['manager', 'supervisor', 'reporting_to', 'direct_manager'],
      emergency_contact: ['emergency_contact', 'emergency_contact_name', 'ice_contact', 'next_of_kin'],
      work_location: ['work_location', 'office', 'location', 'site', 'remote_status'],
      termination_date: ['termination_date', 'separation_date', 'last_day', 'end_date', 'resignation_date']
    },
    fieldWeights: {
      employee_id: 0.10, full_name: 0.10, hire_date: 0.08,
      department: 0.08, position: 0.10, status: 0.08,
      benefits: 0.06, salary_grade: 0.05, manager: 0.06,
      emergency_contact: 0.06, work_location: 0.04,
      termination_date: 0.04, category: 0.02
    },
    promptHints: ['employee record', 'personnel file', 'employee ID', 'hire date', 'department', 'job classification', 'benefits enrollment', 'emergency contact']
  },

  'performance-review': {
    category: DOCUMENT_CATEGORIES.HR,
    legacy: false,
    displayName: 'Performance Review',
    sections: ['employee', 'reviewer', 'ratings', 'goals', 'feedback', 'development'],
    requiredFields: ['employee_name', 'reviewer_name', 'review_period'],
    expectedFields: ['employee_name', 'reviewer_name', 'review_period', 'review_date', 'overall_rating', 'goals', 'strengths', 'improvements'],
    fieldTypes: {
      development_plan: 'string',
      employee_name: 'party',
      goals: 'string',
      improvements: 'string',
      overall_rating: 'string',
      peer_feedback: 'number',
      review_date: 'date',
      review_period: 'period',
      reviewer_name: 'party',
      self_assessment: 'string',
      strengths: 'string'
    },
    fieldAliases: {
      employee_name: ['employee_name', 'reviewee', 'staff_member', 'evaluated_employee', 'subject'],
      reviewer_name: ['reviewer_name', 'reviewer', 'evaluator', 'manager', 'supervisor', 'assessor'],
      review_period: ['review_period', 'period', 'evaluation_period', 'review_cycle', 'appraisal_period', 'performance_year'],
      review_date: ['review_date', 'date_of_review', 'evaluation_date', 'date_completed', 'review_completed'],
      overall_rating: ['overall_rating', 'rating', 'performance_rating', 'score', 'grade', 'appraisal_score'],
      goals: ['goals', 'objectives', 'performance_goals', 'targets', 'kpis', 'okrs', 'development_goals'],
      strengths: ['strengths', 'key_strengths', 'achievements', 'accomplishments', 'highlights', 'wins'],
      improvements: ['improvements', 'areas_for_improvement', 'development_areas', 'weaknesses', 'growth_areas', 'opportunities'],
      development_plan: ['development_plan', 'action_plan', 'idp', 'individual_development_plan', 'training_plan'],
      peer_feedback: ['peer_feedback', '360_feedback', 'colleague_feedback', 'team_feedback'],
      self_assessment: ['self_assessment', 'self_evaluation', 'employee_comments', 'self_review']
    },
    fieldWeights: {
      employee_name: 0.10, reviewer_name: 0.08, review_period: 0.08,
      review_date: 0.06, overall_rating: 0.10, goals: 0.12,
      strengths: 0.10, improvements: 0.10, development_plan: 0.08,
      peer_feedback: 0.04, self_assessment: 0.06, category: 0.02
    },
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
    fieldTypes: {
      allergies: 'array',
      chief_complaint: 'string',
      date_of_birth: 'date',
      diagnosis: 'string',
      follow_up: 'string',
      history_of_present_illness: 'period',
      medical_record_number: 'number',
      medications: 'array',
      patient_name: 'party',
      provider_name: 'party',
      report_date: 'date',
      treatment_plan: 'string',
      vital_signs: 'array'
    },
    fieldAliases: {
      patient_name: ['patient_name', 'patient', 'name', 'client_name', 'subject'],
      date_of_birth: ['date_of_birth', 'dob', 'birth_date', 'date_of_birth', 'born'],
      medical_record_number: ['medical_record_number', 'mrn', 'patient_id', 'record_number', 'chart_number', 'health_record_number'],
      provider_name: ['provider_name', 'physician', 'doctor', 'attending', 'clinician', 'healthcare_provider', 'referring_physician'],
      diagnosis: ['diagnosis', 'primary_diagnosis', 'diagnostic_impression', 'assessment', 'clinical_diagnosis', 'findings'],
      treatment_plan: ['treatment_plan', 'plan', 'management_plan', 'care_plan', 'recommended_treatment', 'intervention'],
      report_date: ['report_date', 'date', 'date_of_report', 'document_date', 'dictation_date'],
      chief_complaint: ['chief_complaint', 'complaint', 'presenting_complaint', 'reason_for_visit', 'symptoms'],
      history_of_present_illness: ['history_of_present_illness', 'hpi', 'history', 'clinical_history', 'present_illness'],
      vital_signs: ['vital_signs', 'vitals', 'bp', 'blood_pressure', 'heart_rate', 'temperature', 'respiratory_rate', 'spo2'],
      medications: ['medications', 'current_medications', 'meds', 'prescribed_drugs', 'medication_list'],
      allergies: ['allergies', 'allergic_reactions', 'drug_allergies', 'known_allergies'],
      follow_up: ['follow_up', 'follow_up_plan', 'next_appointment', 'review_date', 'recheck']
    },
    fieldWeights: {
      patient_name: 0.10, date_of_birth: 0.06, medical_record_number: 0.06,
      provider_name: 0.08, diagnosis: 0.15, treatment_plan: 0.10,
      report_date: 0.06, chief_complaint: 0.08,
      history_of_present_illness: 0.06, vital_signs: 0.06,
      medications: 0.05, allergies: 0.04, follow_up: 0.04, category: 0.02
    },
    promptHints: ['medical report', 'clinical report', 'diagnosis', 'treatment plan', 'physician', 'patient', 'medical history', 'symptoms', 'findings', 'recommendations']
  },

  'lab-result': {
    category: DOCUMENT_CATEGORIES.HEALTHCARE,
    legacy: false,
    displayName: 'Lab Result',
    sections: ['patient', 'test_info', 'results', 'reference_ranges', 'provider', 'specimen'],
    requiredFields: ['patient_name', 'test_name', 'test_date', 'ordering_provider'],
    expectedFields: ['patient_name', 'test_name', 'test_date', 'ordering_provider', 'results', 'reference_ranges', 'lab_name'],
    fieldTypes: {
      abnormal_flags: 'string',
      collection_time: 'date',
      lab_name: 'string',
      method: 'string',
      ordering_provider: 'date',
      patient_name: 'party',
      reference_ranges: 'string',
      results: 'string',
      specimen_id: 'string',
      specimen_type: 'string',
      test_date: 'date',
      test_name: 'string',
      units: 'number'
    },
    fieldAliases: {
      patient_name: ['patient_name', 'patient', 'subject_name', 'client'],
      test_name: ['test_name', 'test', 'assay', 'analysis', 'examination', 'panel', 'test_panel'],
      test_date: ['test_date', 'date', 'date_of_test', 'collection_date', 'specimen_date', 'draw_date'],
      ordering_provider: ['ordering_provider', 'ordering_physician', 'referring_provider', 'doctor', 'clinician', 'ordered_by'],
      results: ['results', 'test_results', 'findings', 'values', 'measurements', 'analytical_results'],
      reference_ranges: ['reference_ranges', 'reference_range', 'normal_range', 'expected_range', 'standard_range', 'range'],
      lab_name: ['lab_name', 'laboratory', 'testing_facility', 'lab', 'diagnostic_center', 'pathology_lab'],
      specimen_type: ['specimen_type', 'specimen', 'sample', 'sample_type', 'material', 'blood', 'urine', 'tissue'],
      specimen_id: ['specimen_id', 'sample_id', 'accession_number', 'lab_id', 'specimen_number'],
      collection_time: ['collection_time', 'time_of_collection', 'draw_time', 'sample_time'],
      abnormal_flags: ['abnormal_flags', 'flag', 'abnormal', 'critical', 'high', 'low', 'out_of_range'],
      units: ['units', 'unit_of_measure', 'measurement_unit', 'uom'],
      method: ['method', 'test_method', 'methodology', 'analytical_method', 'technique']
    },
    fieldWeights: {
      patient_name: 0.10, test_name: 0.12, test_date: 0.08,
      ordering_provider: 0.08, results: 0.20, reference_ranges: 0.10,
      lab_name: 0.06, specimen_type: 0.05, specimen_id: 0.04,
      collection_time: 0.03, abnormal_flags: 0.06, units: 0.03,
      method: 0.03, category: 0.02
    },
    promptHints: ['laboratory', 'lab result', 'test result', 'specimen', 'reference range', 'abnormal', 'critical value', 'pathology', 'blood test', 'urinalysis', 'culture']
  },

  prescription: {
    category: DOCUMENT_CATEGORIES.HEALTHCARE,
    legacy: false,
    displayName: 'Prescription',
    sections: ['patient', 'medication', 'dosage', 'provider', 'pharmacy', 'instructions'],
    requiredFields: ['patient_name', 'medication_name', 'prescriber_name', 'prescription_date'],
    expectedFields: ['patient_name', 'medication_name', 'dosage', 'frequency', 'prescriber_name', 'prescription_date', 'pharmacy', 'refills'],
    fieldTypes: {
      dea_number: 'number',
      dosage: 'number',
      frequency: 'number',
      generic_substitution: 'boolean',
      instructions: 'string',
      medication_name: 'string',
      ndc: 'string',
      patient_name: 'party',
      pharmacy: 'string',
      prescriber_name: 'string',
      prescription_date: 'date',
      quantity: 'number',
      refills: 'string'
    },
    fieldAliases: {
      patient_name: ['patient_name', 'patient', 'for', 'prescribed_to', 'client'],
      medication_name: ['medication_name', 'medication', 'drug', 'medicine', 'prescribed_medication', 'drug_name', 'product'],
      dosage: ['dosage', 'dose', 'strength', 'amount', 'quantity', 'mg', 'mcg', 'units'],
      frequency: ['frequency', 'sig', 'directions', 'how_often', 'administration', 'schedule', 'times_per_day'],
      prescriber_name: ['prescriber_name', 'prescriber', 'prescribing_physician', 'doctor', 'physician', 'provider', 'ordered_by'],
      prescription_date: ['prescription_date', 'date', 'date_written', 'written_date', 'issue_date', 'rx_date'],
      pharmacy: ['pharmacy', 'dispensing_pharmacy', 'pharmacy_name', 'drugstore', 'dispensed_by'],
      refills: ['refills', 'number_of_refills', 'refill_quantity', 'refill_count', 'authorized_refills'],
      quantity: ['quantity', 'qty', 'dispensed_quantity', 'amount_dispensed', 'supply'],
      ndc: ['ndc', 'national_drug_code', 'drug_code', 'product_code'],
      dea_number: ['dea_number', 'dea', 'dea_id', 'controlled_substance_registration'],
      instructions: ['instructions', 'directions', 'patient_instructions', 'special_instructions', 'counseling'],
      generic_substitution: ['generic_substitution', 'generic', 'substitution_allowed', 'dispense_as_written', 'daw']
    },
    fieldWeights: {
      patient_name: 0.10, medication_name: 0.15, dosage: 0.12,
      frequency: 0.10, prescriber_name: 0.10, prescription_date: 0.08,
      pharmacy: 0.06, refills: 0.06, quantity: 0.05,
      ndc: 0.03, dea_number: 0.03, instructions: 0.05,
      generic_substitution: 0.02, category: 0.02
    },
    promptHints: ['prescription', 'Rx', 'medication', 'dosage', 'sig', 'refills', 'prescriber', 'pharmacy', 'NDC', 'quantity', 'directions', 'PRN']
  },

  'patient-intake': {
    category: DOCUMENT_CATEGORIES.HEALTHCARE,
    legacy: false,
    displayName: 'Patient Intake Form',
    sections: ['patient_info', 'medical_history', 'insurance', 'emergency_contact', 'consent'],
    requiredFields: ['patient_name', 'date_of_birth'],
    expectedFields: ['patient_name', 'date_of_birth', 'address', 'phone', 'insurance_provider', 'policy_number', 'emergency_contact', 'reason_for_visit'],
    fieldTypes: {
      address: 'string',
      allergies: 'array',
      consent: 'string',
      current_medications: 'number',
      date_of_birth: 'date',
      emergency_contact: 'string',
      family_history: 'period',
      insurance_provider: 'string',
      medical_history: 'period',
      patient_name: 'party',
      phone: 'string',
      policy_number: 'number',
      primary_care_physician: 'string',
      reason_for_visit: 'string',
      social_history: 'period'
    },
    fieldAliases: {
      patient_name: ['patient_name', 'name', 'full_name', 'client_name', 'patient'],
      date_of_birth: ['date_of_birth', 'dob', 'birth_date', 'born', 'date_of_birth'],
      address: ['address', 'home_address', 'residence', 'mailing_address', 'street_address'],
      phone: ['phone', 'phone_number', 'telephone', 'mobile', 'cell_phone', 'contact_number'],
      insurance_provider: ['insurance_provider', 'insurance', 'insurance_company', 'carrier', 'payer', 'health_plan'],
      policy_number: ['policy_number', 'policy_no', 'policy_id', 'insurance_id', 'member_id', 'subscriber_id'],
      emergency_contact: ['emergency_contact', 'emergency_contact_name', 'ice', 'next_of_kin', 'emergency_person'],
      reason_for_visit: ['reason_for_visit', 'chief_complaint', 'purpose_of_visit', 'presenting_problem', 'symptoms'],
      primary_care_physician: ['primary_care_physician', 'pcp', 'primary_doctor', 'family_physician', 'referring_doctor'],
      medical_history: ['medical_history', 'past_medical_history', 'pmh', 'previous_conditions', 'diagnoses'],
      current_medications: ['current_medications', 'medications', 'meds', 'current_meds', 'drug_list'],
      allergies: ['allergies', 'allergic_reactions', 'drug_allergies', 'food_allergies', 'latex_allergy'],
      family_history: ['family_history', 'fh', 'family_medical_history', 'hereditary_conditions'],
      social_history: ['social_history', 'sh', 'lifestyle', 'smoking', 'alcohol', 'occupation'],
      consent: ['consent', 'informed_consent', 'authorization', 'hipaa_consent', 'treatment_consent', 'release']
    },
    fieldWeights: {
      patient_name: 0.10, date_of_birth: 0.08, address: 0.06,
      phone: 0.06, insurance_provider: 0.08, policy_number: 0.06,
      emergency_contact: 0.08, reason_for_visit: 0.08,
      primary_care_physician: 0.04, medical_history: 0.08,
      current_medications: 0.06, allergies: 0.06,
      family_history: 0.04, social_history: 0.03,
      consent: 0.04, category: 0.02
    },
    promptHints: ['patient intake', 'registration form', 'medical history', 'allergies', 'medications', 'insurance card', 'emergency contact', 'reason for visit', 'consent', 'HIPAA']
  },

  // ================= INSURANCE =================
  'insurance-claim': {
    category: DOCUMENT_CATEGORIES.INSURANCE,
    legacy: false,
    displayName: 'Insurance Claim',
    sections: ['claim_information', 'incident_details', 'vehicle_information', 'damage_assessment', 'supporting_documents'],
    requiredFields: ['claim_number', 'policy_number', 'incident_date'],
    expectedFields: ['claim_number', 'policy_number', 'incident_date', 'claim_status', 'location', 'primary_damage', 'estimated_repair_cost'],
    fieldTypes: {
      adjuster_name: 'party',
      claim_number: 'number',
      claim_status: 'string',
      claimant_name: 'party',
      coverage_type: 'number',
      deductible: 'number',
      estimated_repair_cost: 'number',
      incident_date: 'date',
      location: 'string',
      police_report_number: 'number',
      policy_number: 'number',
      primary_damage: 'number',
      vehicle_make: 'string',
      vehicle_model: 'string',
      vehicle_year: 'number',
      vin: 'string'
    },
    fieldAliases: {
      claim_number: ['claim_number', 'claim_no', 'claim_id', 'claim_reference', 'file_number'],
      policy_number: ['policy_number', 'policy_no', 'policy_id', 'policy_ref', 'certificate_number'],
      incident_date: ['incident_date', 'accident_date', 'date_of_incident', 'event_date', 'loss_date', 'date_of_loss'],
      location: ['location', 'incident_location', 'accident_location', 'loss_location', 'place_of_incident'],
      primary_damage: ['primary_damage', 'damage_description', 'main_damage', 'extent_of_damage', 'damaged_areas'],
      estimated_repair_cost: ['estimated_repair_cost', 'repair_cost', 'estimated_cost', 'repair_estimate', 'cost_of_repairs', 'damage_estimate'],
      claim_status: ['claim_status', 'status', 'claim_state', 'resolution_status', 'settlement_status'],
      claimant_name: ['claimant_name', 'insured_name', 'policyholder', 'claimant', 'insured_party'],
      adjuster_name: ['adjuster_name', 'claims_adjuster', 'adjuster', 'claim_handler', 'investigator'],
      deductible: ['deductible', 'policy_deductible', 'excess', 'deductible_amount'],
      coverage_type: ['coverage_type', 'type_of_coverage', 'policy_type', 'coverage', 'insurance_type'],
      vehicle_make: ['vehicle_make', 'make', 'manufacturer', 'car_make', 'vehicle_brand'],
      vehicle_model: ['vehicle_model', 'model', 'car_model', 'vehicle_type'],
      vehicle_year: ['vehicle_year', 'year', 'model_year', 'manufacture_year'],
      vin: ['vin', 'vehicle_identification_number', 'chassis_number', 'serial_number'],
      police_report_number: ['police_report_number', 'incident_report_number', 'police_reference', 'report_number']
    },
    fieldWeights: {
      claim_number: 0.12, policy_number: 0.10, incident_date: 0.10,
      location: 0.06, primary_damage: 0.10, estimated_repair_cost: 0.08,
      claim_status: 0.06, claimant_name: 0.08, adjuster_name: 0.04,
      deductible: 0.05, coverage_type: 0.05, vehicle_make: 0.03,
      vehicle_model: 0.03, vehicle_year: 0.02, vin: 0.03,
      police_report_number: 0.03, category: 0.02
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
    fieldTypes: {
      adjuster_name: 'party',
      claim_number: 'number',
      claim_status: 'string',
      claimant_name: 'party',
      coverage_type: 'number',
      deductible: 'number',
      estimated_repair_cost: 'number',
      incident_date: 'date',
      location: 'string',
      police_report_number: 'number',
      policy_number: 'number',
      primary_damage: 'number',
      vehicle_make: 'string',
      vehicle_model: 'string',
      vehicle_year: 'number',
      vin: 'string'
    },
    fieldAliases: {
      claim_number: ['claim_number', 'claim_no', 'claim_id', 'claim_reference', 'file_number'],
      policy_number: ['policy_number', 'policy_no', 'policy_id', 'policy_ref', 'certificate_number'],
      incident_date: ['incident_date', 'accident_date', 'date_of_incident', 'event_date', 'loss_date', 'date_of_loss'],
      location: ['location', 'incident_location', 'accident_location', 'loss_location', 'place_of_incident'],
      primary_damage: ['primary_damage', 'damage_description', 'main_damage', 'extent_of_damage', 'damaged_areas'],
      estimated_repair_cost: ['estimated_repair_cost', 'repair_cost', 'estimated_cost', 'repair_estimate', 'cost_of_repairs', 'damage_estimate'],
      claim_status: ['claim_status', 'status', 'claim_state', 'resolution_status', 'settlement_status'],
      claimant_name: ['claimant_name', 'insured_name', 'policyholder', 'claimant', 'insured_party'],
      adjuster_name: ['adjuster_name', 'claims_adjuster', 'adjuster', 'claim_handler', 'investigator'],
      deductible: ['deductible', 'policy_deductible', 'excess', 'deductible_amount'],
      coverage_type: ['coverage_type', 'type_of_coverage', 'policy_type', 'coverage', 'insurance_type'],
      vehicle_make: ['vehicle_make', 'make', 'manufacturer', 'car_make', 'vehicle_brand'],
      vehicle_model: ['vehicle_model', 'model', 'car_model', 'vehicle_type'],
      vehicle_year: ['vehicle_year', 'year', 'model_year', 'manufacture_year'],
      vin: ['vin', 'vehicle_identification_number', 'chassis_number', 'serial_number'],
      police_report_number: ['police_report_number', 'incident_report_number', 'police_reference', 'report_number']
    },
    fieldWeights: {
            claim_number: 0.12, policy_number: 0.10, incident_date: 0.10,
      location: 0.06, primary_damage: 0.10, estimated_repair_cost: 0.08,
      claim_status: 0.06, claimant_name: 0.08, adjuster_name: 0.04,
      deductible: 0.05, coverage_type: 0.05, vehicle_make: 0.03,
      vehicle_model: 0.03, vehicle_year: 0.02, vin: 0.03,
      police_report_number: 0.03, category: 0.02
    },
    promptHints: ['insurance claim', 'claim form', 'claim number', 'policy number', 'incident', 'accident', 'damage', 'repair estimate', 'vehicle', 'property', 'liability', 'coverage', 'deductible']
  },

  // ================= LOGISTICS =================
  'bill-of-lading': {
    category: DOCUMENT_CATEGORIES.LOGISTICS,
    legacy: false,
    displayName: 'Bill of Lading',
    sections: ['shipment', 'carrier', 'cargo', 'route', 'parties', 'terms'],
    requiredFields: ['bol_number', 'shipper', 'consignee', 'vessel', 'port_of_loading'],
    expectedFields: ['bol_number', 'shipper', 'consignee', 'notify_party', 'vessel', 'voyage_number', 'port_of_loading', 'port_of_discharge', 'cargo_description'],
    fieldTypes: {
      bol_number: 'number',
      cargo_description: 'record',
      consignee: 'string',
      container_number: 'number',
      freight_terms: 'period',
      gross_weight: 'number',
      notify_party: 'party',
      number_of_packages: 'number',
      place_of_delivery: 'date',
      place_of_receipt: 'date',
      port_of_discharge: 'string',
      port_of_loading: 'string',
      shipper: 'string',
      vessel: 'string',
      voyage_number: 'number'
    },
    fieldAliases: {
      bol_number: ['bol_number', 'bl_number', 'bill_of_lading_no', 'bol_no', 'bl_no', 'b_l_number', 'shipping_reference'],
      shipper: ['shipper', 'shipper_name', 'exporter', 'sender', 'consignor', 'loading_party'],
      consignee: ['consignee', 'consignee_name', 'importer', 'receiver', 'recipient', 'notify_party'],
      notify_party: ['notify_party', 'notify', 'second_notify', 'also_notify', 'contact_party'],
      vessel: ['vessel', 'vessel_name', 'ship_name', 'carrier_vessel', 'ss', 'm_v'],
      voyage_number: ['voyage_number', 'voyage', 'voy_no', 'voyage_no', 'trip_number'],
      port_of_loading: ['port_of_loading', 'pol', 'loading_port', 'port_of_departure', 'origin_port', 'load_port'],
      port_of_discharge: ['port_of_discharge', 'pod', 'discharge_port', 'port_of_arrival', 'destination_port', 'unload_port'],
      cargo_description: ['cargo_description', 'description_of_goods', 'commodity', 'cargo', 'goods_description', 'product_description'],
      container_number: ['container_number', 'container_no', 'container_id', 'seal_number', 'seal_no', 'container_ref'],
      gross_weight: ['gross_weight', 'gross_wt', 'total_weight', 'weight', 'kg', 'lbs'],
      number_of_packages: ['number_of_packages', 'packages', 'no_of_packages', 'package_count', 'quantity'],
      freight_terms: ['freight_terms', 'freight', 'freight_charges', 'freight_payable_at', 'incoterms', 'fob', 'cif'],
      place_of_receipt: ['place_of_receipt', 'receipt_location', 'cargo_received_at', 'origin'],
      place_of_delivery: ['place_of_delivery', 'final_destination', 'delivery_location', 'cargo_delivered_to']
    },
    fieldWeights: {
      bol_number: 0.12, shipper: 0.10, consignee: 0.10,
      notify_party: 0.04, vessel: 0.08, voyage_number: 0.04,
      port_of_loading: 0.08, port_of_discharge: 0.08,
      cargo_description: 0.10, container_number: 0.05,
      gross_weight: 0.04, number_of_packages: 0.04,
      freight_terms: 0.05, place_of_receipt: 0.03,
      place_of_delivery: 0.03, category: 0.02
    },
    promptHints: ['bill of lading', 'B/L', 'shipper', 'consignee', 'notify party', 'vessel', 'port of loading', 'port of discharge', 'freight', 'cargo', 'container number', 'master B/L']
  },

  'shipping-manifest': {
    category: DOCUMENT_CATEGORIES.LOGISTICS,
    legacy: false,
    displayName: 'Shipping Manifest',
    sections: ['vessel', 'cargo_list', 'ports', 'parties', 'voyage_info'],
    requiredFields: ['manifest_number', 'vessel_name', 'voyage_number'],
    expectedFields: ['manifest_number', 'vessel_name', 'voyage_number', 'port_of_loading', 'port_of_discharge', 'cargo_items', 'total_weight'],
    fieldTypes: {
      cargo_items: 'array',
      date_of_arrival: 'date',
      date_of_departure: 'date',
      flag_state: 'string',
      imo_number: 'number',
      manifest_number: 'number',
      master_name: 'party',
      number_of_bills: 'number',
      port_of_discharge: 'string',
      port_of_loading: 'string',
      total_weight: 'period',
      vessel_name: 'string',
      voyage_number: 'number'
    },
    fieldAliases: {
      manifest_number: ['manifest_number', 'manifest_no', 'manifest_id', 'cargo_manifest_no', 'shipping_manifest_no'],
      vessel_name: ['vessel_name', 'vessel', 'ship_name', 'carrier', 'ss', 'm_v', 'imo_name'],
      voyage_number: ['voyage_number', 'voyage', 'voy_no', 'trip', 'sailing_number'],
      port_of_loading: ['port_of_loading', 'pol', 'loading_port', 'origin_port', 'departure_port'],
      port_of_discharge: ['port_of_discharge', 'pod', 'discharge_port', 'destination_port', 'arrival_port'],
      cargo_items: ['cargo_items', 'cargo_list', 'cargo_manifest', 'bill_of_lading_list', 'consignments', 'shipments'],
      total_weight: ['total_weight', 'aggregate_weight', 'gross_tonnage', 'combined_weight', 'manifest_weight'],
      imo_number: ['imo_number', 'imo', 'imo_no', 'ship_imo', 'vessel_imo'],
      flag_state: ['flag_state', 'flag', 'registry', 'vessel_flag', 'country_of_registry'],
      master_name: ['master_name', 'captain', 'ship_master', 'master_of_vessel', 'commanding_officer'],
      number_of_bills: ['number_of_bills', 'bol_count', 'number_of_bl', 'bills_attached'],
      date_of_departure: ['date_of_departure', 'sailing_date', 'departure_date', 'etd', 'estimated_departure'],
      date_of_arrival: ['date_of_arrival', 'arrival_date', 'eta', 'estimated_arrival', 'port_call_date']
    },
    fieldWeights: {
      manifest_number: 0.10, vessel_name: 0.12, voyage_number: 0.08,
      port_of_loading: 0.08, port_of_discharge: 0.08,
      cargo_items: 0.20, total_weight: 0.06, imo_number: 0.04,
      flag_state: 0.03, master_name: 0.04, number_of_bills: 0.03,
      date_of_departure: 0.05, date_of_arrival: 0.05, category: 0.02
    },
    promptHints: ['manifest', 'cargo manifest', 'vessel', 'voyage', 'IMO number', 'port of loading', 'port of discharge', 'consignee list', 'container manifest', 'master manifest']
  },

  'delivery-note': {
    category: DOCUMENT_CATEGORIES.LOGISTICS,
    legacy: false,
    displayName: 'Delivery Note',
    sections: ['order', 'items', 'delivery', 'recipient', 'carrier'],
    requiredFields: ['delivery_note_number', 'recipient_name', 'delivery_date'],
    expectedFields: ['delivery_note_number', 'order_reference', 'recipient_name', 'delivery_address', 'delivery_date', 'items_delivered', 'carrier'],
    fieldTypes: {
      carrier: 'string',
      condition: 'string',
      delivery_address: 'date',
      delivery_date: 'date',
      delivery_instructions: 'date',
      delivery_note_number: 'date',
      items_delivered: 'array',
      number_of_packages: 'number',
      number_of_pallets: 'number',
      order_reference: 'date',
      recipient_name: 'string',
      recipient_signature: 'string',
      tracking_number: 'number',
      weight: 'number'
    },
    fieldAliases: {
      delivery_note_number: ['delivery_note_number', 'dn_number', 'delivery_no', 'delivery_note_no', 'dn_no', 'delivery_reference'],
      order_reference: ['order_reference', 'order_number', 'po_reference', 'sales_order', 'order_id', 'reference_order'],
      recipient_name: ['recipient_name', 'delivered_to', 'consignee', 'receiver', 'customer_name', 'addressee'],
      delivery_address: ['delivery_address', 'delivery_location', 'ship_to_address', 'destination_address', 'drop_off_location'],
      delivery_date: ['delivery_date', 'date_delivered', 'delivery_on', 'shipped_date', 'dispatch_date', 'date_of_delivery'],
      items_delivered: ['items_delivered', 'delivered_items', 'goods_delivered', 'products_delivered', 'shipment_contents', 'packages'],
      carrier: ['carrier', 'shipping_company', 'transporter', 'logistics_provider', 'courier', 'delivery_service', 'freight_carrier'],
      tracking_number: ['tracking_number', 'tracking_no', 'waybill_number', 'consignment_no', 'tracking_id', 'shipment_id'],
      number_of_pallets: ['number_of_pallets', 'pallets', 'pallet_count', 'skids'],
      number_of_packages: ['number_of_packages', 'packages', 'parcel_count', 'cartons', 'boxes'],
      weight: ['weight', 'total_weight', 'gross_weight', 'net_weight', 'shipment_weight'],
      condition: ['condition', 'goods_condition', 'delivery_condition', 'damaged', 'intact', 'checked'],
      recipient_signature: ['recipient_signature', 'signed_by', 'received_by', 'acknowledgment', 'proof_of_delivery', 'pod'],
      delivery_instructions: ['delivery_instructions', 'special_instructions', 'handling_instructions', 'delivery_notes']
    },
    fieldWeights: {
      delivery_note_number: 0.10, order_reference: 0.06, recipient_name: 0.10,
      delivery_address: 0.08, delivery_date: 0.08, items_delivered: 0.20,
      carrier: 0.06, tracking_number: 0.05, number_of_pallets: 0.03,
      number_of_packages: 0.04, weight: 0.04, condition: 0.04,
      recipient_signature: 0.05, delivery_instructions: 0.03, category: 0.02
    },
    promptHints: ['delivery note', 'delivery receipt', 'proof of delivery', 'POD', 'consignment', 'items delivered', 'recipient signature', 'delivery date', 'order reference']
  },

  'customs-document': {
    category: DOCUMENT_CATEGORIES.LOGISTICS,
    legacy: false,
    displayName: 'Customs Document',
    sections: ['declaration', 'goods', 'duties', 'parties', 'shipment'],
    requiredFields: ['declaration_number', 'importer', 'exporter', 'country_of_origin'],
    expectedFields: ['declaration_number', 'importer', 'exporter', 'country_of_origin', 'hs_codes', 'customs_value', 'duties_taxes', 'port_of_entry'],
    fieldTypes: {
      container_numbers: 'number',
      country_of_origin: 'number',
      currency: 'string',
      customs_broker: 'period',
      customs_value: 'period',
      declaration_number: 'number',
      duties_taxes: 'number',
      entry_type: 'string',
      exporter: 'string',
      gross_mass: 'number',
      hs_codes: 'array',
      importer: 'string',
      incoterms: 'period',
      mode_of_transport: 'string',
      net_mass: 'number',
      port_of_entry: 'string'
    },
    fieldAliases: {
      declaration_number: ['declaration_number', 'entry_number', 'customs_entry_no', 'declaration_id', 'customs_ref', 'entry_id'],
      importer: ['importer', 'importer_of_record', 'consignee', 'importing_party', 'broker'],
      exporter: ['exporter', 'shipper', 'exporting_party', 'consignor', 'seller'],
      country_of_origin: ['country_of_origin', 'origin_country', 'manufactured_in', 'made_in', 'co', 'coo'],
      hs_codes: ['hs_codes', 'harmonized_code', 'tariff_code', 'hs_code', 'commodity_code', 'classification_code'],
      customs_value: ['customs_value', 'declared_value', 'cif_value', 'fob_value', 'dutiable_value', 'transaction_value'],
      duties_taxes: ['duties_taxes', 'customs_duties', 'tariff_duties', 'import_tax', 'vat_duty', 'excise'],
      port_of_entry: ['port_of_entry', 'entry_port', 'customs_port', 'border_crossing', 'port_of_import'],
      incoterms: ['incoterms', 'delivery_terms', 'trade_terms', 'fob', 'cif', 'ddp', 'exw'],
      mode_of_transport: ['mode_of_transport', 'transport_mode', 'by_sea', 'by_air', 'by_road', 'by_rail'],
      container_numbers: ['container_numbers', 'container_ids', 'seal_numbers', 'container_refs'],
      gross_mass: ['gross_mass', 'gross_weight', 'total_weight', 'kg', 'metric_tons'],
      net_mass: ['net_mass', 'net_weight', 'product_weight'],
      currency: ['currency', 'declaration_currency', 'value_currency', 'usd', 'eur', 'gbp'],
      customs_broker: ['customs_broker', 'broker', 'customs_agent', 'clearing_agent', 'broker_name'],
      entry_type: ['entry_type', 'type_of_entry', 'consumption_entry', 'warehouse_entry', 'temporary_entry']
    },
    fieldWeights: {
      declaration_number: 0.12, importer: 0.10, exporter: 0.10,
      country_of_origin: 0.08, hs_codes: 0.12, customs_value: 0.10,
      duties_taxes: 0.08, port_of_entry: 0.06, incoterms: 0.04,
      mode_of_transport: 0.04, container_numbers: 0.04,
      gross_mass: 0.03, net_mass: 0.02, currency: 0.02,
      customs_broker: 0.03, entry_type: 0.03, category: 0.02
    },
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
    fieldTypes: {
      appraiser_name: 'party',
      cap_rate: 'number',
      comparable_sales: 'array',
      condition_rating: 'string',
      estimated_value: 'number',
      lot_size: 'number',
      neighborhood: 'string',
      property_address: 'record',
      property_type: 'record',
      square_footage: 'number',
      valuation_date: 'date',
      valuation_method: 'date',
      year_built: 'number',
      zoning: 'string'
    },
    fieldAliases: {
      property_address: ['property_address', 'subject_property', 'property_location', 'address', 'premises'],
      valuation_date: ['valuation_date', 'date_of_valuation', 'appraisal_date', 'date_of_appraisal', 'effective_date', 'as_of_date'],
      appraiser_name: ['appraiser_name', 'appraiser', 'valuer', 'appraisal_firm', 'licensed_appraiser'],
      estimated_value: ['estimated_value', 'market_value', 'appraised_value', 'value_conclusion', 'opinion_of_value', 'estimated_worth'],
      property_type: ['property_type', 'type_of_property', 'residential', 'commercial', 'industrial', 'land', 'condo', 'single_family'],
      square_footage: ['square_footage', 'sq_ft', 'area', 'gross_floor_area', 'gla', 'living_area', 'building_size'],
      valuation_method: ['valuation_method', 'approach', 'sales_comparison_approach', 'income_approach', 'cost_approach', 'method'],
      comparable_sales: ['comparable_sales', 'comps', 'comparables', 'comparable_properties', 'market_comps'],
      cap_rate: ['cap_rate', 'capitalization_rate', 'yield', 'return_rate', 'income_yield'],
      condition_rating: ['condition_rating', 'condition', 'property_condition', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
      year_built: ['year_built', 'construction_year', 'age', 'built', 'year_of_construction'],
      lot_size: ['lot_size', 'land_area', 'acreage', 'site_area', 'plot_size', 'square_feet_lot'],
      zoning: ['zoning', 'zoning_classification', 'land_use', 'zoning_district', 'permitted_use'],
      neighborhood: ['neighborhood', 'area', 'market_area', 'submarket', 'district']
    },
    fieldWeights: {
      property_address: 0.12, valuation_date: 0.08, appraiser_name: 0.08,
      estimated_value: 0.15, property_type: 0.06, square_footage: 0.06,
      valuation_method: 0.06, comparable_sales: 0.10, cap_rate: 0.05,
      condition_rating: 0.04, year_built: 0.04, lot_size: 0.04,
      zoning: 0.04, neighborhood: 0.04, category: 0.02
    },
    promptHints: ['appraisal', 'valuation', 'comparable sales', 'market value', 'appraiser', 'property type', 'square footage', 'condition', 'neighborhood', 'cap rate']
  },

  'inspection-report': {
    category: DOCUMENT_CATEGORIES.REAL_ESTATE,
    legacy: false,
    displayName: 'Inspection Report',
    sections: ['property', 'inspector', 'findings', 'recommendations', 'systems'],
    requiredFields: ['property_address', 'inspection_date', 'inspector_name'],
    expectedFields: ['property_address', 'inspection_date', 'inspector_name', 'inspector_license', 'findings', 'recommendations', 'systems_checked'],
    fieldTypes: {
      electrical: 'string',
      findings: 'array',
      hvac: 'string',
      inspection_date: 'date',
      inspector_license: 'period',
      inspector_name: 'party',
      overall_condition: 'string',
      plumbing: 'string',
      property_address: 'record',
      recommendations: 'array',
      roof: 'string',
      safety_concerns: 'string',
      structural: 'string',
      systems_checked: 'array'
    },
    fieldAliases: {
      property_address: ['property_address', 'inspected_property', 'subject_property', 'address', 'premises'],
      inspection_date: ['inspection_date', 'date_of_inspection', 'inspected_on', 'report_date', 'inspection_completed'],
      inspector_name: ['inspector_name', 'inspector', 'home_inspector', 'inspection_firm', 'certified_inspector'],
      inspector_license: ['inspector_license', 'license_number', 'certification', 'credentials', 'license', 'inspector_id'],
      findings: ['findings', 'deficiencies', 'defects', 'issues', 'problems', 'observations', 'concerns'],
      recommendations: ['recommendations', 'recommended_repairs', 'suggested_actions', 'advice', 'next_steps'],
      systems_checked: ['systems_checked', 'systems', 'components', 'inspected_systems', 'areas_inspected'],
      structural: ['structural', 'foundation', 'framing', 'load_bearing', 'basement', 'crawl_space'],
      roof: ['roof', 'roofing', 'roof_condition', 'shingles', 'tiles', 'roof_age'],
      plumbing: ['plumbing', 'water_system', 'pipes', 'fixtures', 'drainage', 'water_heater'],
      electrical: ['electrical', 'wiring', 'electrical_panel', 'outlets', 'circuits', 'electrical_system'],
      hvac: ['hvac', 'heating', 'cooling', 'air_conditioning', 'furnace', 'heat_pump', 'ductwork'],
      overall_condition: ['overall_condition', 'general_condition', 'summary', 'inspection_summary', 'overall_assessment'],
      safety_concerns: ['safety_concerns', 'safety_issues', 'hazards', 'safety_hazards', 'immediate_concerns']
    },
    fieldWeights: {
      property_address: 0.10, inspection_date: 0.08, inspector_name: 0.08,
      inspector_license: 0.04, findings: 0.15, recommendations: 0.10,
      systems_checked: 0.08, structural: 0.05, roof: 0.05,
      plumbing: 0.05, electrical: 0.05, hvac: 0.05,
      overall_condition: 0.06, safety_concerns: 0.06, category: 0.02
    },
    promptHints: ['home inspection', 'property inspection', 'inspector', 'structural', 'roof', 'plumbing', 'electrical', 'HVAC', 'foundation', 'deficiencies', 'recommendations']
  },

  'mortgage-document': {
    category: DOCUMENT_CATEGORIES.REAL_ESTATE,
    legacy: false,
    displayName: 'Mortgage Document',
    sections: ['borrower', 'lender', 'property', 'terms', 'payment_schedule', 'escrow'],
    requiredFields: ['borrower_name', 'lender_name', 'loan_amount', 'property_address'],
    expectedFields: ['borrower_name', 'lender_name', 'loan_amount', 'property_address', 'interest_rate', 'loan_term', 'monthly_payment', 'loan_number'],
    fieldTypes: {
      borrower_name: 'party',
      closing_costs: 'number',
      escrow: 'string',
      interest_rate: 'number',
      lender_name: 'party',
      loan_amount: 'number',
      loan_number: 'number',
      loan_term: 'period',
      loan_type: 'string',
      maturity_date: 'date',
      monthly_payment: 'number',
      origination_date: 'date',
      pmi: 'string',
      prepayment_penalty: 'number',
      property_address: 'record'
    },
    fieldAliases: {
      borrower_name: ['borrower_name', 'borrower', 'mortgagor', 'loan_applicant', 'debtor', 'customer'],
      lender_name: ['lender_name', 'lender', 'mortgagee', 'loan_originator', 'creditor', 'bank', 'financial_institution'],
      loan_amount: ['loan_amount', 'principal', 'loan_principal', 'mortgage_amount', 'amount_financed', 'loan_sum'],
      property_address: ['property_address', 'subject_property', 'mortgaged_property', 'collateral_property', 'secured_property'],
      interest_rate: ['interest_rate', 'rate', 'note_rate', 'contract_rate', 'annual_rate', 'apr'],
      loan_term: ['loan_term', 'term', 'maturity', 'loan_duration', 'amortization', 'years', 'months'],
      monthly_payment: ['monthly_payment', 'payment', 'monthly_mortgage', 'p_i', 'principal_and_interest', 'emi'],
      loan_number: ['loan_number', 'loan_id', 'account_number', 'mortgage_number', 'loan_reference'],
      origination_date: ['origination_date', 'closing_date', 'funding_date', 'disbursement_date', 'loan_date'],
      maturity_date: ['maturity_date', 'due_date', 'loan_due', 'final_payment_date', 'balloon_date'],
      loan_type: ['loan_type', 'type', 'conventional', 'fha', 'va', 'usda', 'jumbo', 'fixed', 'arm'],
      escrow: ['escrow', 'escrow_account', 'impounds', 'escrow_payment', 'tax_and_insurance'],
      pmi: ['pmi', 'private_mortgage_insurance', 'mortgage_insurance', 'mi', 'mip'],
      closing_costs: ['closing_costs', 'closing_fees', 'settlement_charges', 'loan_costs', 'origination_fees'],
      prepayment_penalty: ['prepayment_penalty', 'early_repayment_fee', 'prepayment_clause', 'yield_maintenance']
    },
    fieldWeights: {
      borrower_name: 0.10, lender_name: 0.10, loan_amount: 0.12,
      property_address: 0.10, interest_rate: 0.10, loan_term: 0.08,
      monthly_payment: 0.08, loan_number: 0.06, origination_date: 0.05,
      maturity_date: 0.05, loan_type: 0.04, escrow: 0.04,
      pmi: 0.03, closing_costs: 0.03, prepayment_penalty: 0.02, category: 0.02
    },
    promptHints: ['mortgage', 'deed of trust', 'promissory note', 'loan amount', 'interest rate', 'APR', 'principal', 'escrow', 'PMI', 'closing costs', 'lender', 'mortgagor']
  },

  'land-registry': {
    category: DOCUMENT_CATEGORIES.REAL_ESTATE,
    legacy: false,
    displayName: 'Land Registry Record',
    sections: ['property', 'owner', 'encumbrances', 'history', 'legal_description'],
    requiredFields: ['property_id', 'owner_name', 'registration_date'],
    expectedFields: ['property_id', 'owner_name', 'registration_date', 'property_address', 'land_area', 'title_number', 'encumbrances'],
    fieldTypes: {
      boundaries: 'array',
      encumbrances: 'array',
      land_area: 'number',
      owner_name: 'party',
      previous_owners: 'array',
      property_address: 'record',
      property_id: 'record',
      registration_date: 'date',
      survey_reference: 'string',
      tenure: 'string',
      title_number: 'number',
      zoning: 'string'
    },
    fieldAliases: {
      property_id: ['property_id', 'parcel_number', 'apn', 'assessors_parcel_number', 'property_reference', 'cadastral_id'],
      owner_name: ['owner_name', 'registered_owner', 'proprietor', 'title_holder', 'land_owner', 'current_owner'],
      registration_date: ['registration_date', 'date_registered', 'registered_on', 'entry_date', 'recorded_date'],
      property_address: ['property_address', 'property_location', 'land_address', 'situated_at', 'location'],
      land_area: ['land_area', 'area', 'acreage', 'hectares', 'square_meters', 'sq_ft', 'lot_size'],
      title_number: ['title_number', 'title_ref', 'folio_number', 'title_id', 'deed_reference', 'register_reference'],
      encumbrances: ['encumbrances', 'liens', 'easements', 'restrictions', 'covenants', 'charges', 'mortgages', 'burdens'],
      previous_owners: ['previous_owners', 'prior_owners', 'chain_of_title', 'ownership_history', 'transfers'],
      zoning: ['zoning', 'land_use', 'zoning_classification', 'permitted_use', 'planning_zone'],
      tenure: ['tenure', 'tenure_type', 'freehold', 'leasehold', 'commonhold', 'fee_simple'],
      boundaries: ['boundaries', 'boundary_description', 'land_boundaries', 'perimeter', 'adjoining_properties'],
      survey_reference: ['survey_reference', 'survey_plan', 'cadastral_survey', 'boundary_survey', 'registered_survey']
    },
    fieldWeights: {
      property_id: 0.12, owner_name: 0.12, registration_date: 0.08,
      property_address: 0.08, land_area: 0.06, title_number: 0.08,
      encumbrances: 0.10, previous_owners: 0.06, zoning: 0.05,
      tenure: 0.05, boundaries: 0.05, survey_reference: 0.04, category: 0.02
    },
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
    fieldTypes: {
      academic_standing: 'string',
      courses: 'array',
      credits_earned: 'number',
      degree_conferred: 'string',
      gpa: 'number',
      grades: 'number',
      graduation_date: 'date',
      honors: 'string',
      institution_name: 'party',
      program: 'string',
      semester_dates: 'date',
      student_id: 'string',
      student_name: 'party'
    },
    fieldAliases: {
      student_name: ['student_name', 'name', 'student', 'learner', 'candidate'],
      institution_name: ['institution_name', 'university', 'college', 'school', 'academic_institution', 'educational_institution'],
      student_id: ['student_id', 'student_number', 'id_number', 'registration_number', 'roll_number', 'enrollment_id'],
      program: ['program', 'degree_program', 'major', 'course_of_study', 'field_of_study', 'program_name'],
      courses: ['courses', 'course_list', 'subjects', 'classes', 'modules', 'academic_record', 'transcript_entries'],
      grades: ['grades', 'marks', 'scores', 'letter_grades', 'numeric_grades', 'results'],
      gpa: ['gpa', 'grade_point_average', 'cgpa', 'cumulative_gpa', 'overall_gpa', 'academic_average'],
      credits_earned: ['credits_earned', 'credit_hours', 'units', 'credits', 'total_credits', 'earned_credits'],
      graduation_date: ['graduation_date', 'date_of_graduation', 'degree_conferred', 'completion_date', 'graduated_on'],
      degree_conferred: ['degree_conferred', 'degree', 'award', 'diploma_awarded', 'certificate_awarded'],
      academic_standing: ['academic_standing', 'standing', 'status', 'good_standing', 'probation', 'honors'],
      semester_dates: ['semester_dates', 'term_dates', 'academic_periods', 'enrollment_dates'],
      honors: ['honors', 'distinction', 'cum_laude', 'magna_cum_laude', 'summa_cum_laude', 'deans_list']
    },
    fieldWeights: {
      student_name: 0.10, institution_name: 0.10, student_id: 0.08,
      program: 0.08, courses: 0.15, grades: 0.10, gpa: 0.10,
      credits_earned: 0.06, graduation_date: 0.06,
      degree_conferred: 0.06, academic_standing: 0.04,
      semester_dates: 0.03, honors: 0.03, category: 0.02
    },
    promptHints: ['transcript', 'academic record', 'GPA', 'credit hours', 'course code', 'semester', 'grade', 'cumulative GPA', 'major', 'degree program', 'official transcript']
  },

  certificate: {
    category: DOCUMENT_CATEGORIES.EDUCATION,
    legacy: false,
    displayName: 'Certificate',
    sections: ['recipient', 'institution', 'credential', 'date', 'verification'],
    requiredFields: ['recipient_name', 'institution_name', 'credential_name', 'issue_date'],
    expectedFields: ['recipient_name', 'institution_name', 'credential_name', 'issue_date', 'credential_id', 'field_of_study', 'completion_date'],
    fieldTypes: {
      accreditation: 'number',
      ceu_credits: 'number',
      completion_date: 'date',
      credential_id: 'string',
      credential_name: 'string',
      expiration_date: 'date',
      field_of_study: 'string',
      institution_name: 'party',
      issue_date: 'date',
      recipient_name: 'string',
      verification_url: 'string'
    },
    fieldAliases: {
      recipient_name: ['recipient_name', 'awarded_to', 'graduate_name', 'student_name', 'participant_name', 'name'],
      institution_name: ['institution_name', 'issuing_institution', 'organization', 'training_provider', 'accrediting_body', 'school'],
      credential_name: ['credential_name', 'certificate_name', 'certification', 'credential', 'qualification', 'award'],
      issue_date: ['issue_date', 'date_issued', 'issued_on', 'award_date', 'date_of_issue', 'certification_date'],
      credential_id: ['credential_id', 'certificate_number', 'certification_id', 'serial_number', 'reference_number', 'verification_code'],
      field_of_study: ['field_of_study', 'subject', 'area', 'specialization', 'discipline', 'topic'],
      completion_date: ['completion_date', 'date_completed', 'finished_on', 'program_end', 'course_end_date'],
      expiration_date: ['expiration_date', 'expiry_date', 'valid_until', 'renewal_date', 'certification_expiry'],
      ceu_credits: ['ceu_credits', 'continuing_education_units', 'credits', 'contact_hours', 'pd_hours'],
      accreditation: ['accreditation', 'accredited_by', 'recognized_by', 'endorsed_by', 'certifying_body'],
      verification_url: ['verification_url', 'verify_at', 'validation_link', 'credential_url', 'digital_credential']
    },
    fieldWeights: {
      recipient_name: 0.12, institution_name: 0.10, credential_name: 0.15,
      issue_date: 0.10, credential_id: 0.08, field_of_study: 0.08,
      completion_date: 0.06, expiration_date: 0.05, ceu_credits: 0.04,
      accreditation: 0.05, verification_url: 0.04, category: 0.02
    },
    promptHints: ['certificate', 'certification', 'completed', 'awarded', 'credential', 'training', 'professional development', 'CEU', 'continuing education', 'accredited']
  },

  diploma: {
    category: DOCUMENT_CATEGORIES.EDUCATION,
    legacy: false,
    displayName: 'Diploma',
    sections: ['graduate', 'institution', 'degree', 'date', 'honors'],
    requiredFields: ['graduate_name', 'institution_name', 'degree_name', 'graduation_date'],
    expectedFields: ['graduate_name', 'institution_name', 'degree_name', 'graduation_date', 'major', 'honors', 'degree_type'],
    fieldTypes: {
      degree_name: 'string',
      degree_type: 'string',
      graduate_name: 'string',
      graduation_date: 'date',
      honors: 'string',
      institution_name: 'party',
      major: 'string',
      registrar: 'string',
      seal: 'string',
      thesis_title: 'string',
      transcript_included: 'boolean'
    },
    fieldAliases: {
      graduate_name: ['graduate_name', 'name', 'graduate', 'recipient', 'degree_holder', 'alumnus'],
      institution_name: ['institution_name', 'university', 'college', 'school', 'conferring_institution', 'academic_institution'],
      degree_name: ['degree_name', 'degree', 'title', 'academic_degree', 'qualification', 'diploma_title'],
      graduation_date: ['graduation_date', 'date_of_graduation', 'conferred_on', 'degree_date', 'graduated', 'date_awarded'],
      major: ['major', 'field_of_study', 'concentration', 'specialization', 'subject', 'discipline'],
      honors: ['honors', 'distinction', 'cum_laude', 'magna_cum_laude', 'summa_cum_laude', 'with_honors', 'first_class'],
      degree_type: ['degree_type', 'type', 'bachelor', 'master', 'doctorate', 'phd', 'associate', 'undergraduate', 'graduate'],
      thesis_title: ['thesis_title', 'dissertation', 'thesis', 'capstone', 'final_project'],
      registrar: ['registrar', 'university_registrar', 'registrars_office', 'academic_registrar'],
      seal: ['seal', 'official_seal', 'university_seal', 'embossed_seal', 'stamp'],
      transcript_included: ['transcript_included', 'enclosed_transcript', 'academic_record']
    },
    fieldWeights: {
      graduate_name: 0.12, institution_name: 0.12, degree_name: 0.15,
      graduation_date: 0.10, major: 0.10, honors: 0.08,
      degree_type: 0.08, thesis_title: 0.04, registrar: 0.04,
      seal: 0.03, transcript_included: 0.03, category: 0.02
    },
    promptHints: ['diploma', 'degree', 'bachelor', 'master', 'doctorate', 'graduated', 'cum laude', 'magna cum laude', 'conferred', 'registrar', 'seal', 'graduation']
  },

  'student-record': {
    category: DOCUMENT_CATEGORIES.EDUCATION,
    legacy: false,
    displayName: 'Student Record',
    sections: ['student', 'enrollment', 'grades', 'attendance', 'disciplinary', 'contact'],
    requiredFields: ['student_name', 'student_id', 'institution_name'],
    expectedFields: ['student_name', 'student_id', 'institution_name', 'enrollment_date', 'program', 'status', 'contact_info'],
    fieldTypes: {
      academic_standing: 'string',
      advisor: 'string',
      attendance: 'string',
      contact_info: 'record',
      credits_attempted: 'number',
      credits_earned: 'number',
      disciplinary_record: 'record',
      enrollment_date: 'date',
      institution_name: 'party',
      major: 'string',
      minor: 'string',
      program: 'string',
      status: 'string',
      student_id: 'string',
      student_name: 'party'
    },
    fieldAliases: {
      student_name: ['student_name', 'name', 'pupil', 'learner', 'enrollee'],
      student_id: ['student_id', 'student_number', 'id', 'registration_number', 'enrollment_id', 'roll_no'],
      institution_name: ['institution_name', 'school', 'academy', 'educational_institution', 'campus'],
      enrollment_date: ['enrollment_date', 'date_enrolled', 'admission_date', 'start_date', 'date_of_entry'],
      program: ['program', 'course', 'program_of_study', 'curriculum', 'track', 'pathway'],
      status: ['status', 'enrollment_status', 'active', 'inactive', 'withdrawn', 'graduated', 'suspended', 'on_leave'],
      contact_info: ['contact_info', 'contact', 'address', 'phone', 'email', 'guardian_contact', 'parent_contact'],
      academic_standing: ['academic_standing', 'standing', 'gpa', 'academic_status', 'good_standing', 'probation'],
      attendance: ['attendance', 'attendance_rate', 'absences', 'tardies', 'presence'],
      disciplinary_record: ['disciplinary_record', 'disciplinary_actions', 'violations', 'conduct', 'behavior'],
      advisor: ['advisor', 'academic_advisor', 'counselor', 'mentor', 'supervisor'],
      major: ['major', 'concentration', 'specialization', 'primary_field'],
      minor: ['minor', 'secondary_field', 'minor_concentration'],
      credits_attempted: ['credits_attempted', 'attempted_credits', 'enrolled_credits'],
      credits_earned: ['credits_earned', 'earned_credits', 'completed_credits']
    },
    fieldWeights: {
      student_name: 0.10, student_id: 0.10, institution_name: 0.08,
      enrollment_date: 0.08, program: 0.08, status: 0.08,
      contact_info: 0.06, academic_standing: 0.06, attendance: 0.06,
      disciplinary_record: 0.05, advisor: 0.05, major: 0.06,
      minor: 0.03, credits_attempted: 0.04, credits_earned: 0.04, category: 0.02
    },
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
    fieldTypes: {
      country_code: 'number',
      date_of_birth: 'date',
      expiry_date: 'date',
      full_name: 'string',
      height: 'number',
      issue_date: 'date',
      issuing_authority: 'string',
      mrz: 'string',
      nationality: 'string',
      passport_number: 'number',
      passport_type: 'string',
      photo: 'period',
      place_of_birth: 'date',
      sex: 'string',
      signature: 'string'
    },
    fieldAliases: {
      full_name: ['full_name', 'name', 'surname', 'given_names', 'family_name', 'passport_name'],
      passport_number: ['passport_number', 'passport_no', 'pp_no', 'document_number', 'travel_document_number', 'pp_number'],
      nationality: ['nationality', 'citizenship', 'country_of_citizenship', 'national_status', 'citizen_of'],
      date_of_birth: ['date_of_birth', 'dob', 'birth_date', 'born', 'date_of_birth'],
      place_of_birth: ['place_of_birth', 'birth_place', 'pob', 'born_in', 'city_of_birth'],
      issue_date: ['issue_date', 'date_of_issue', 'issued_on', 'date_issued', 'passport_issued'],
      expiry_date: ['expiry_date', 'date_of_expiry', 'expiration_date', 'valid_until', 'expires_on', 'passport_expiry'],
      issuing_authority: ['issuing_authority', 'authority', 'issued_by', 'passport_office', 'government', 'country_of_issue'],
      mrz: ['mrz', 'machine_readable_zone', 'machine_readable', 'mrz_line_1', 'mrz_line_2'],
      sex: ['sex', 'gender', 'male', 'female', 'm', 'f', 'x'],
      height: ['height', 'passport_height', 'stature'],
      signature: ['signature', 'holder_signature', 'passport_signature'],
      photo: ['photo', 'passport_photo', 'biometric_photo', 'facial_image'],
      passport_type: ['passport_type', 'type', 'p_type', 'ordinary', 'diplomatic', 'official', 'emergency'],
      country_code: ['country_code', 'issuing_country_code', 'nationality_code', 'iso_code']
    },
    fieldWeights: {
      full_name: 0.10, passport_number: 0.15, nationality: 0.08,
      date_of_birth: 0.08, place_of_birth: 0.04, issue_date: 0.08,
      expiry_date: 0.10, issuing_authority: 0.08, mrz: 0.08,
      sex: 0.03, height: 0.02, signature: 0.02,
      photo: 0.02, passport_type: 0.04, country_code: 0.03, category: 0.02
    },
    promptHints: ['passport', 'travel document', 'nationality', 'place of birth', 'issuing authority', 'MRZ', 'machine readable zone', 'biometric', 'visa pages', 'passport number']
  },

  'drivers-license': {
    category: DOCUMENT_CATEGORIES.GOVERNMENT,
    legacy: false,
    displayName: "Driver's License",
    sections: ['personal_info', 'license_info', 'restrictions', 'endorsements'],
    requiredFields: ['full_name', 'license_number', 'date_of_birth', 'issue_date', 'expiry_date', 'issuing_state'],
    expectedFields: ['full_name', 'license_number', 'date_of_birth', 'address', 'issue_date', 'expiry_date', 'issuing_state', 'class', 'restrictions'],
    fieldTypes: {
      address: 'string',
      class: 'string',
      date_of_birth: 'date',
      endorsements: 'array',
      expiry_date: 'date',
      eye_color: 'string',
      full_name: 'string',
      hair_color: 'string',
      height: 'number',
      issue_date: 'date',
      issuing_state: 'string',
      license_number: 'number',
      organ_donor: 'boolean',
      real_id: 'boolean',
      restrictions: 'array',
      sex: 'string',
      weight: 'number'
    },
    fieldAliases: {
      full_name: ['full_name', 'name', 'driver_name', 'licensee_name', 'holder_name'],
      license_number: ['license_number', 'dl_number', 'drivers_license_no', 'license_id', 'dl_id', 'license_no'],
      date_of_birth: ['date_of_birth', 'dob', 'birth_date', 'born'],
      address: ['address', 'residence', 'home_address', 'mailing_address', 'current_address'],
      issue_date: ['issue_date', 'date_issued', 'issued_on', 'license_issued'],
      expiry_date: ['expiry_date', 'expiration_date', 'valid_until', 'license_expires', 'renewal_date'],
      issuing_state: ['issuing_state', 'state', 'issuing_authority', 'dmv', 'department_of_motor_vehicles', 'licensing_state'],
      class: ['class', 'license_class', 'class_of_license', 'category', 'vehicle_class', 'cdl_class'],
      restrictions: ['restrictions', 'license_restrictions', 'driving_restrictions', 'limitations', 'corrective_lenses', 'daylight_only'],
      endorsements: ['endorsements', 'license_endorsements', 'special_endorsements', 'hazmat', 'motorcycle', 'tanker'],
      sex: ['sex', 'gender', 'male', 'female', 'm', 'f'],
      height: ['height', 'stature', 'license_height'],
      weight: ['weight', 'license_weight'],
      eye_color: ['eye_color', 'eyes', 'eye_colour'],
      hair_color: ['hair_color', 'hair', 'hair_colour'],
      organ_donor: ['organ_donor', 'donor', 'organ_donation', 'donor_status'],
      real_id: ['real_id', 'real_id_compliant', 'star', 'federal_compliance', 'enhanced_id']
    },
    fieldWeights: {
      full_name: 0.10, license_number: 0.15, date_of_birth: 0.08,
      address: 0.06, issue_date: 0.06, expiry_date: 0.10,
      issuing_state: 0.08, class: 0.08, restrictions: 0.05,
      endorsements: 0.04, sex: 0.03, height: 0.02,
      weight: 0.02, eye_color: 0.02, hair_color: 0.02,
      organ_donor: 0.02, real_id: 0.03, category: 0.02
    },
    promptHints: ["driver's license", 'DL', 'motor vehicle', 'class', 'endorsement', 'restriction', 'DL number', 'issuing state', 'expiration', 'organ donor', 'REAL ID']
  },

  'national-id': {
    category: DOCUMENT_CATEGORIES.GOVERNMENT,
    legacy: false,
    displayName: 'National ID',
    sections: ['personal_info', 'document_info', 'issuing_authority', 'biometrics'],
    requiredFields: ['full_name', 'id_number', 'nationality', 'date_of_birth', 'issue_date'],
    expectedFields: ['full_name', 'id_number', 'nationality', 'date_of_birth', 'place_of_birth', 'issue_date', 'expiry_date', 'issuing_authority'],
    fieldTypes: {
      address: 'string',
      card_number: 'number',
      date_of_birth: 'date',
      expiry_date: 'date',
      fingerprint: 'string',
      full_name: 'string',
      id_number: 'number',
      issue_date: 'date',
      issuing_authority: 'string',
      nationality: 'string',
      photo: 'period',
      place_of_birth: 'date',
      sex: 'string',
      signature: 'string',
      version: 'string'
    },
    fieldAliases: {
      full_name: ['full_name', 'name', 'citizen_name', 'resident_name', 'holder_name'],
      id_number: ['id_number', 'national_id', 'nin', 'national_identification_number', 'id_no', 'identity_number', 'ssn', 'social_security_number'],
      nationality: ['nationality', 'citizenship', 'country', 'national_status', 'citizen_of'],
      date_of_birth: ['date_of_birth', 'dob', 'birth_date', 'born'],
      place_of_birth: ['place_of_birth', 'birth_place', 'pob', 'born_in'],
      issue_date: ['issue_date', 'date_issued', 'issued_on', 'date_of_issue'],
      expiry_date: ['expiry_date', 'expiration_date', 'valid_until', 'expires_on', 'card_expiry'],
      issuing_authority: ['issuing_authority', 'authority', 'issued_by', 'government_agency', 'ministry', 'department'],
      sex: ['sex', 'gender', 'male', 'female', 'm', 'f', 'x'],
      address: ['address', 'residence', 'registered_address', 'home_address'],
      photo: ['photo', 'id_photo', 'biometric_photo', 'facial_image', 'portrait'],
      signature: ['signature', 'holder_signature', 'digital_signature'],
      fingerprint: ['fingerprint', 'biometric_data', 'biometrics', 'digital_fingerprint'],
      card_number: ['card_number', 'card_no', 'document_number', 'serial_number'],
      version: ['version', 'id_version', 'card_version', 'series']
    },
    fieldWeights: {
      full_name: 0.10, id_number: 0.18, nationality: 0.08,
      date_of_birth: 0.08, place_of_birth: 0.04, issue_date: 0.06,
      expiry_date: 0.08, issuing_authority: 0.08, sex: 0.03,
      address: 0.05, photo: 0.03, signature: 0.02,
      fingerprint: 0.02, card_number: 0.04, version: 0.02, category: 0.02
    },
    promptHints: ['national ID', 'identity card', 'ID card', 'citizen', 'national identification number', 'NIN', 'SSN', 'social security', 'resident card', 'government ID']
  },

  permit: {
    category: DOCUMENT_CATEGORIES.GOVERNMENT,
    legacy: false,
    displayName: 'Permit',
    sections: ['holder', 'permit_info', 'conditions', 'issuing_authority', 'scope'],
    requiredFields: ['permit_number', 'holder_name', 'permit_type', 'issue_date', 'issuing_authority'],
    expectedFields: ['permit_number', 'holder_name', 'permit_type', 'issue_date', 'expiry_date', 'issuing_authority', 'conditions', 'scope'],
    fieldTypes: {
      bond_amount: 'number',
      conditions: 'array',
      expiry_date: 'date',
      fee_paid: 'number',
      holder_name: 'party',
      inspection_required: 'date',
      issue_date: 'date',
      issuing_authority: 'string',
      permit_number: 'number',
      permit_type: 'string',
      project_address: 'string',
      scope: 'string'
    },
    fieldAliases: {
      permit_number: ['permit_number', 'permit_no', 'permit_id', 'license_number', 'authorization_number', 'reference'],
      holder_name: ['holder_name', 'permit_holder', 'applicant_name', 'authorized_party', 'licensee'],
      permit_type: ['permit_type', 'type', 'kind', 'category', 'building_permit', 'work_permit', 'environmental_permit', 'zoning_permit'],
      issue_date: ['issue_date', 'date_issued', 'issued_on', 'granted_on', 'date_of_issue'],
      expiry_date: ['expiry_date', 'expiration_date', 'valid_until', 'expires_on', 'permit_expiry', 'renewal_date'],
      issuing_authority: ['issuing_authority', 'authority', 'issued_by', 'permitting_body', 'agency', 'department', 'municipality'],
      conditions: ['conditions', 'permit_conditions', 'terms', 'stipulations', 'requirements', 'restrictions'],
      scope: ['scope', 'scope_of_work', 'authorized_activity', 'permitted_use', 'description', 'project_description'],
      project_address: ['project_address', 'site_address', 'location', 'work_site', 'premises'],
      fee_paid: ['fee_paid', 'permit_fee', 'application_fee', 'paid_amount', 'cost'],
      inspection_required: ['inspection_required', 'inspections', 'mandatory_inspection', 'site_visit'],
      bond_amount: ['bond_amount', 'surety_bond', 'performance_bond', 'security_deposit']
    },
    fieldWeights: {
      permit_number: 0.12, holder_name: 0.10, permit_type: 0.12,
      issue_date: 0.08, expiry_date: 0.08, issuing_authority: 0.10,
      conditions: 0.08, scope: 0.08, project_address: 0.06,
      fee_paid: 0.03, inspection_required: 0.04, bond_amount: 0.03, category: 0.02
    },
    promptHints: ['permit', 'authorization', 'license', 'building permit', 'work permit', 'environmental permit', 'zoning', 'conditional use', 'issuing authority', 'valid period']
  },

  license: {
    category: DOCUMENT_CATEGORIES.GOVERNMENT,
    legacy: false,
    displayName: 'License',
    sections: ['holder', 'license_info', 'conditions', 'issuing_authority', 'scope'],
    requiredFields: ['license_number', 'holder_name', 'license_type', 'issue_date', 'issuing_authority'],
    expectedFields: ['license_number', 'holder_name', 'license_type', 'issue_date', 'expiry_date', 'issuing_authority', 'conditions', 'scope'],
    fieldTypes: {
      accreditation: 'number',
      conditions: 'array',
      continuing_education: 'string',
      disciplinary_actions: 'string',
      expiry_date: 'date',
      holder_name: 'party',
      insurance: 'string',
      issue_date: 'date',
      issuing_authority: 'string',
      license_number: 'number',
      license_type: 'string',
      renewal_date: 'date',
      scope: 'string'
    },
    fieldAliases: {
      license_number: ['license_number', 'license_no', 'license_id', 'registration_number', 'cert_number', 'ref'],
      holder_name: ['holder_name', 'licensee', 'licensed_party', 'practitioner_name', 'business_name'],
      license_type: ['license_type', 'type', 'category', 'professional_license', 'business_license', 'drivers_license', 'trade_license'],
      issue_date: ['issue_date', 'date_issued', 'issued_on', 'granted_on', 'licensed_on'],
      expiry_date: ['expiry_date', 'expiration_date', 'valid_until', 'expires_on', 'license_expiry', 'renewal_due'],
      issuing_authority: ['issuing_authority', 'authority', 'licensing_board', 'regulatory_body', 'state_board', 'department'],
      conditions: ['conditions', 'license_conditions', 'terms', 'restrictions', 'limitations', 'provisional'],
      scope: ['scope', 'scope_of_practice', 'authorized_services', 'permitted_activity', 'practice_area', 'specialization'],
      renewal_date: ['renewal_date', 'renew_by', 'next_renewal', 'renewal_period'],
      continuing_education: ['continuing_education', 'ce_hours', 'ce_credits', 'professional_development', 'cme'],
      disciplinary_actions: ['disciplinary_actions', 'sanctions', 'violations', 'complaints', 'board_actions'],
      insurance: ['insurance', 'malpractice_insurance', 'liability_coverage', 'professional_insurance'],
      accreditation: ['accreditation', 'accredited_by', 'recognized', 'certified', 'approved']
    },
    fieldWeights: {
      license_number: 0.12, holder_name: 0.10, license_type: 0.12,
      issue_date: 0.08, expiry_date: 0.08, issuing_authority: 0.10,
      conditions: 0.06, scope: 0.08, renewal_date: 0.05,
      continuing_education: 0.04, disciplinary_actions: 0.04,
      insurance: 0.04, accreditation: 0.04, category: 0.02
    },
    promptHints: ['license', 'business license', 'professional license', 'renewal', 'license number', 'issuing board', 'practicing', 'certified', 'accredited', 'valid through']
  },

  // ================= FALLBACK =================
  unknown: {
    category: DOCUMENT_CATEGORIES.OTHER,
    legacy: false,
    displayName: 'Unknown Document',
    sections: ['general'],
    requiredFields: [],
    expectedFields: ['notes'],
    fieldTypes: {
      confidence: 'string',
      document_type_guess: 'string',
      notes: 'string'
    },
    fieldAliases: {
      notes: ['notes', 'description', 'summary', 'content', 'extracted_text', 'observations'],
      document_type_guess: ['document_type_guess', 'detected_type', 'probable_type', 'assumed_category'],
      confidence: ['confidence', 'extraction_confidence', 'certainty', 'score']
    },
    fieldWeights: {
      notes: 0.50, document_type_guess: 0.30, confidence: 0.20
    },
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

// NEW: Get all possible alias variations for a field (useful for fuzzy matching)
export function getFieldAliases(type, fieldName) {
  const info = getDocumentTypeInfo(type);
  if (!info.fieldAliases || !info.fieldAliases[fieldName]) return [fieldName];
  return [fieldName, ...info.fieldAliases[fieldName]];
}

// NEW: Get field weight for scoring confidence
export function getFieldWeight(type, fieldName) {
  const info = getDocumentTypeInfo(type);
  if (!info.fieldWeights) return 0.02; // default weight
  return info.fieldWeights[fieldName] || 0.01; // fallback for unknown fields
}

// NEW: Get all weighted fields for a document type
export function getWeightedFields(type) {
  const info = getDocumentTypeInfo(type);
  return info.fieldWeights || {};
}

// NEW: Calculate extraction confidence score based on field presence and weights
export function calculateExtractionConfidence(type, extractedFields) {
  const info = getDocumentTypeInfo(type);
  if (!info.fieldWeights) return 0;
  
  const weights = info.fieldWeights;
  const presentFields = Object.keys(extractedFields).filter(k => 
    extractedFields[k] !== null && 
    extractedFields[k] !== undefined && 
    extractedFields[k] !== ''
  );
  
  let totalPossible = Object.values(weights).reduce((a, b) => a + b, 0);
  let actualScore = presentFields.reduce((sum, field) => {
    return sum + (weights[field] || 0);
  }, 0);
  
  return totalPossible > 0 ? Math.min(1, actualScore / totalPossible) : 0;
}

// NEW: Flexible field matching — tries aliases when exact match fails
export function matchFieldName(rawFieldName, type) {
  const info = getDocumentTypeInfo(type);
  const normalized = rawFieldName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  
  // Direct match
  if (info.fieldAliases && info.fieldAliases[normalized]) return normalized;
  if (info.fieldWeights && info.fieldWeights[normalized]) return normalized;
  
  // Alias match
  if (info.fieldAliases) {
    for (const [canonical, aliases] of Object.entries(info.fieldAliases)) {
      if (canonical === normalized) return canonical;
      if (aliases.some(a => a.toLowerCase().replace(/[^a-z0-9_]/g, '_') === normalized)) {
        return canonical;
      }
    }
  }
  
  // Fuzzy match on aliases
  if (info.fieldAliases) {
    for (const [canonical, aliases] of Object.entries(info.fieldAliases)) {
      for (const alias of aliases) {
        const aliasNorm = alias.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        // Simple substring match for flexibility
        if (normalized.includes(aliasNorm) || aliasNorm.includes(normalized)) {
          return canonical;
        }
      }
    }
  }
  
  return null; // No match found
}
import { z } from 'zod';
import { 
  isLegacyType, 
  getDocumentTypeInfo, 
  getFieldAliases, 
  getFieldWeight,
  calculateExtractionConfidence,
  matchFieldName,
  DOCUMENT_CATEGORIES 
} from './documentRegistry.js';

// ================= BASE SCHEMAS =================

const TaxDetailSchema = z.object({
  type: z.string().default('Unknown'),
  rate: z.number().nullable().default(null),
  amount: z.number().min(0).default(0)
}).passthrough();  

const LineItemSchema = z.object({
  description: z.string().default('Unknown item'),
  quantity: z.number().min(1).default(1),
  unit_price: z.number().min(0).nullable().default(null),
  total: z.number().min(0).nullable().default(null),
  date: z.string().nullable().optional().default(null),
  sku: z.string().nullable().optional().default(null),
  category: z.string().nullable().optional().default(null),
  tax_amount: z.number().min(0).nullable().optional().default(0),
});

const TransactionSchema = z.object({
  date: z.string().nullable().optional().default(null),
  description: z.string().default(''),
  reference: z.string().nullable().optional().default(null),
  transaction_type: z.string().nullable().optional().default(null),
  debit: z.number().nullable().optional().default(null),
  credit: z.number().nullable().optional().default(null),
  balance: z.number().nullable().default(null),
  category: z.string().nullable().optional().default(null)
});

const ReceiptItemSchema = z.object({
  description: z.string().default('Unknown item'),
  quantity: z.number().min(1).default(1),
  price: z.number().min(0).nullable().default(null),
  total: z.number().min(0).nullable().default(null)
});

const PeriodSchema = z.union([
  z.object({
    from: z.string().nullable().optional().default(null),
    to: z.string().nullable().optional().default(null)
  }),
  z.null()
]).transform(val => val || { from: null, to: null });

// ================= SECTION SCHEMAS =================

const SectionItemSchema = z.record(z.any()).default({});

const SectionSchema = z.object({
  section_type: z.string(),
  section_title: z.string().optional().default(''),
  fields: z.record(z.any()).default({}),
  items: z.array(SectionItemSchema).nullable().optional().default([]),
  text: z.string().optional().default('')
});

// ================= PARTY SCHEMAS =================

const IssuerSchema = z.object({
  name: z.string().nullable().optional().default(null),
  address: z.string().nullable().optional().default(null),
  tax_id: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  website: z.string().nullable().optional().default(null),
  registration_number: z.string().nullable().optional().default(null),
  id_number: z.string().nullable().optional().default(null)
});

const RecipientSchema = z.object({
  name: z.string().nullable().optional().default(null),
  address: z.string().nullable().optional().default(null),
  tax_id: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  id_number: z.string().nullable().optional().default(null),
  date_of_birth: z.string().nullable().optional().default(null)
});

// ================= CONFIDENCE SCHEMA =================

const ConfidenceScoreSchema = z.object({
  overall: z.number().min(0).max(1),
  completeness: z.number().min(0).max(100).optional(),
  breakdown: z.record(z.number().min(0).max(1)).optional(),
  flags: z.object({
  low_confidence_fields: z.array(z.string()).nullable().optional().default([]),
  missing_required_fields: z.array(z.string()).nullable().optional().default([]),
  invalid_dates: z.array(z.string()).nullable().optional().default([]),
  math_issue: z.boolean().nullable().optional().default(false),
  balance_mismatch: z.boolean().nullable().optional().default(false)
}).nullable().optional(),
  status: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  requiresReview: z.boolean(),
  reviewReason: z.string().nullable().optional(),
  extractedFieldCount: z.number().optional(),
  totalPossibleFields: z.number().optional()
}).optional();

// ================= LEGACY FIELD COLLECTIONS =================
// Grouped by document category for cleaner organization

const FinancialLegacyFields = {
  // Invoice
  invoice_number: z.string().nullable().optional().default(null),
  po_number: z.string().nullable().optional().default(null),
  reference_number: z.string().nullable().optional().default(null),
  buyer_name: z.string().nullable().optional().default(null),
  buyer_address: z.string().nullable().optional().default(null),
  buyer_tax_id: z.string().nullable().optional().default(null),
  buyer_email: z.string().nullable().optional().default(null),
  invoice_date: z.string().nullable().optional().default(null),
  due_date: z.string().nullable().optional().default(null),
  payment_date: z.string().nullable().optional().default(null),
  line_items: z.array(LineItemSchema).nullable().optional().default([]),
  subtotal: z.number().nullable().optional().default(null),
  discount_amount: z.number().min(0).nullable().optional().default(0),
  tax_details: z.array(TaxDetailSchema).nullable().optional().default([]),
  shipping_amount: z.number().min(0).nullable().optional().default(0),
  amount_due: z.number().nullable().optional().default(null),
 amount_paid: z.number().min(0).nullable().optional().default(0),
  payment_status: z.enum(['PAID', 'UNPAID', 'PARTIAL', 'OVERDUE', 'UNKNOWN']).nullable().optional().default(null),
  payment_method: z.string().nullable().optional().default(null),
  payment_terms: z.string().nullable().optional().default(null),
  purchase_order_reference: z.string().nullable().optional().default(null),
  service_period: PeriodSchema.default({}),
  late_fee: z.number().nullable().optional().default(null),
  invoice_status: z.enum(['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'UNKNOWN']).nullable().optional().default(null),
  
  // Receipt
  receipt_number: z.string().nullable().optional().default(null),
  items: z.array(ReceiptItemSchema).nullable().optional().default([]),
 change_given: z.number().min(0).nullable().optional().default(0),
  cashier_name: z.string().nullable().optional().default(null),
  store_location: z.string().nullable().optional().default(null),
  terminal_id: z.string().nullable().optional().default(null),
  
  // Bank Statement
  account_number: z.string().nullable().optional().default(null),
  statement_period: PeriodSchema.default({}),
  opening_balance: z.number().nullable().optional().default(null),
  closing_balance: z.number().nullable().optional().default(null),
  transactions: z.array(TransactionSchema).nullable().optional().default([]),
  account_name: z.string().nullable().optional().default(null),
  bank_name: z.string().nullable().optional().default(null),
  branch_name: z.string().nullable().optional().default(null),
  routing_number: z.string().nullable().optional().default(null),
  swift_code: z.string().nullable().optional().default(null),
  iban: z.string().nullable().optional().default(null),
  account_type: z.string().nullable().optional().default(null),
  
  // Credit Card Statement
  cardholder_name: z.string().nullable().optional().default(null),
  previous_balance: z.number().nullable().optional().default(null),
  credit_limit: z.number().nullable().optional().default(null),
  minimum_payment: z.number().nullable().optional().default(null),
  annual_percentage_rate: z.number().nullable().optional().default(null),
  rewards_points: z.number().nullable().optional().default(null),
  cash_advance: z.number().nullable().optional().default(null),
  fees_charged: z.number().nullable().optional().default(null),
  
  // Purchase Order
  order_date: z.string().nullable().optional().default(null),
  delivery_date: z.string().nullable().optional().default(null),
  ship_to: z.string().nullable().optional().default(null),
  buyer_company: z.string().nullable().optional().default(null),
  supplier_name: z.string().nullable().optional().default(null),
  supplier_contact: z.string().nullable().optional().default(null),
  expected_total: z.number().nullable().optional().default(null),
  
  // Expense Report
  employee_id: z.string().nullable().optional().default(null),
  department: z.string().nullable().optional().default(null),
  submission_date: z.string().nullable().optional().default(null),
  expense_items: z.array(z.record(z.any())).nullable().optional().default([]),
  total_reimbursement: z.number().nullable().optional().default(null),
  approval_status: z.string().nullable().optional().default(null),
  approver_name: z.string().nullable().optional().default(null),
  approval_date: z.string().nullable().optional().default(null),
  expense_period: PeriodSchema.default({}),
  purpose: z.string().nullable().optional().default(null),
  policy_violations: z.array(z.string()).nullable().optional().default([]),
  
  // Tax Form
  tax_id: z.string().nullable().optional().default(null),
  tax_year: z.string().nullable().optional().default(null),
  filing_status: z.string().nullable().optional().default(null),
  income: z.number().nullable().optional().default(null),
  taxable_income: z.number().nullable().optional().default(null),
  tax_due: z.number().nullable().optional().default(null),
  refund: z.number().nullable().optional().default(null),
  withholding: z.number().nullable().optional().default(null),
  deductions: z.number().nullable().optional().default(null),
  credits: z.number().nullable().optional().default(null),
  form_type: z.string().nullable().optional().default(null),
  preparer_name: z.string().nullable().optional().default(null),
  preparer_id: z.string().nullable().optional().default(null),
  
  // Payroll Report
  pay_period: PeriodSchema.default({}),
  pay_date: z.string().nullable().optional().default(null),
  employees: z.array(z.record(z.any())).nullable().optional().default([]),
  gross_pay_total: z.number().nullable().optional().default(null),
  deductions_total: z.number().nullable().optional().default(null),
  net_pay_total: z.number().nullable().optional().default(null),
  federal_tax: z.number().nullable().optional().default(null),
  state_tax: z.number().nullable().optional().default(null),
  social_security: z.number().nullable().optional().default(null),
  medicare: z.number().nullable().optional().default(null),
  retirement_401k: z.number().nullable().optional().default(null),
  health_insurance: z.number().nullable().optional().default(null),
  employee_count: z.number().nullable().optional().default(null),
  
  // Utility Bill
  bill_number: z.string().nullable().optional().default(null),
  usage_amount: z.union([z.string(), z.number()]).nullable().optional().default(null),
  usage_period: PeriodSchema.default({}),
  current_charges: z.number().min(0).nullable().optional().default(0),
  meter_number: z.string().nullable().optional().default(null),
  customer_number: z.string().nullable().optional().default(null),
  tariff_plan: z.string().nullable().optional().default(null),
  units_consumed: z.number().nullable().optional().default(null)
};

const LegalLegacyFields = {
  // Contract
  contract_number: z.string().nullable().optional().default(null),
  contract_type: z.string().nullable().optional().default(null),
  counterparty: z.string().nullable().optional().default(null),
  contract_value: z.number().nullable().optional().default(null),
  renewal_date: z.string().nullable().optional().default(null),
  governing_law: z.string().nullable().optional().default(null),
  termination_clause: z.string().nullable().optional().default(null),
  signatures: z.array(z.record(z.any())).nullable().optional().default([]),
  
  // Lease Agreement
  lessor: z.string().nullable().optional().default(null),
  lessee: z.string().nullable().optional().default(null),
  lease_term: z.string().nullable().optional().default(null),
  monthly_rent: z.number().nullable().optional().default(null),
  security_deposit: z.number().nullable().optional().default(null),
  renewal_option: z.string().nullable().optional().default(null),
  maintenance_responsibility: z.string().nullable().optional().default(null),
  utilities_included: z.boolean().nullable().optional().default(null),
  pet_policy: z.string().nullable().optional().default(null),
  parking: z.string().nullable().optional().default(null),
  
  // NDA
  disclosing_party: z.string().nullable().optional().default(null),
  receiving_party: z.string().nullable().optional().default(null),
  term_years: z.number().nullable().optional().default(null),
  jurisdiction: z.string().nullable().optional().default(null),
  mutual_nda: z.boolean().nullable().optional().default(null),
  return_period: z.string().nullable().optional().default(null),
  scope: z.string().nullable().optional().default(null),
  exclusions: z.string().nullable().optional().default(null),
  permitted_disclosures: z.string().nullable().optional().default(null),
  remedies: z.string().nullable().optional().default(null),
  
  // Service Agreement
  provider: z.string().nullable().optional().default(null),
  client: z.string().nullable().optional().default(null),
  service_description: z.string().nullable().optional().default(null),
  hourly_rate: z.number().nullable().optional().default(null),
  sla: z.string().nullable().optional().default(null),
  key_contacts: z.array(z.record(z.any())).nullable().optional().default([]),
  acceptance_criteria: z.string().nullable().optional().default(null),
  intellectual_property: z.string().nullable().optional().default(null),
  
  // Court Document
  case_number: z.string().nullable().optional().default(null),
  court_name: z.string().nullable().optional().default(null),
  judge: z.string().nullable().optional().default(null),
  parties: z.array(z.record(z.any())).nullable().optional().default([]),
  document_type: z.string().nullable().optional().default(null),
  hearing_date: z.string().nullable().optional().default(null),
  case_title: z.string().nullable().optional().default(null),
  attorney: z.string().nullable().optional().default(null),
  ruling: z.string().nullable().optional().default(null),
  relief_sought: z.string().nullable().optional().default(null),
  
  // Property Deed
  grantor: z.string().nullable().optional().default(null),
  grantee: z.string().nullable().optional().default(null),
  recording_date: z.string().nullable().optional().default(null),
  recording_number: z.string().nullable().optional().default(null),
  property_description: z.string().nullable().optional().default(null),
  consideration: z.number().nullable().optional().default(null),
  deed_type: z.string().nullable().optional().default(null),
  encumbrances: z.array(z.string()).nullable().optional().default([]),
  tax_parcel_id: z.string().nullable().optional().default(null),
  county: z.string().nullable().optional().default(null)
};

const HRLegacyFields = {
  // Resume
  full_name: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  experience: z.array(z.record(z.any())).nullable().optional().default([]),
  education: z.array(z.record(z.any())).nullable().optional().default([]),
  skills: z.array(z.string()).nullable().optional().default([]),
  certifications: z.array(z.string()).nullable().optional().default([]),
  summary: z.string().nullable().optional().default(null),
  linkedin: z.string().nullable().optional().default(null),
  portfolio: z.string().nullable().optional().default(null),
  languages: z.array(z.string()).nullable().optional().default([]),
  references: z.array(z.record(z.any())).nullable().optional().default([]),
  
  // Employment Contract
  employee_name: z.string().nullable().optional().default(null),
  employer_name: z.string().nullable().optional().default(null),
  position: z.string().nullable().optional().default(null),
  salary: z.number().nullable().optional().default(null),
  employment_type: z.string().nullable().optional().default(null),
  benefits: z.array(z.string()).nullable().optional().default([]),
  probation_period: z.string().nullable().optional().default(null),
  work_location: z.string().nullable().optional().default(null),
  reporting_to: z.string().nullable().optional().default(null),
  termination_notice: z.string().nullable().optional().default(null),
  intellectual_property: z.string().nullable().optional().default(null),
  
  // Offer Letter
  candidate_name: z.string().nullable().optional().default(null),
  reporting_manager: z.string().nullable().optional().default(null),
  acceptance_deadline: z.string().nullable().optional().default(null),
  benefits_overview: z.string().nullable().optional().default(null),
  equity: z.string().nullable().optional().default(null),
  relocation: z.string().nullable().optional().default(null),
  signing_bonus: z.number().nullable().optional().default(null),
  offer_date: z.string().nullable().optional().default(null),
  
  // Employee Record
  employee_id: z.string().nullable().optional().default(null),
  hire_date: z.string().nullable().optional().default(null),
  department: z.string().nullable().optional().default(null),
  status: z.string().nullable().optional().default(null),
  salary_grade: z.string().nullable().optional().default(null),
  manager: z.string().nullable().optional().default(null),
  emergency_contact: z.string().nullable().optional().default(null),
  termination_date: z.string().nullable().optional().default(null),
  
  // Performance Review
  reviewer_name: z.string().nullable().optional().default(null),
  review_period: PeriodSchema.default({}),
  review_date: z.string().nullable().optional().default(null),
  overall_rating: z.string().nullable().optional().default(null),
  goals: z.array(z.string()).nullable().optional().default([]),
  strengths: z.array(z.string()).nullable().optional().default([]),
  improvements: z.array(z.string()).nullable().optional().default([]),
  development_plan: z.string().nullable().optional().default(null),
  peer_feedback: z.string().nullable().optional().default(null),
  self_assessment: z.string().nullable().optional().default(null)
};

const HealthcareLegacyFields = {
  // Medical Report
  patient_name: z.string().nullable().optional().default(null),
  date_of_birth: z.string().nullable().optional().default(null),
  medical_record_number: z.string().nullable().optional().default(null),
  provider_name: z.string().nullable().optional().default(null),
  diagnosis: z.string().nullable().optional().default(null),
  treatment_plan: z.string().nullable().optional().default(null),
  report_date: z.string().nullable().optional().default(null),
  chief_complaint: z.string().nullable().optional().default(null),
  history_of_present_illness: z.string().nullable().optional().default(null),
  vital_signs: z.record(z.any()).default({}),
  medications: z.array(z.string()).nullable().optional().default([]),
  allergies: z.array(z.string()).nullable().optional().default([]),
  follow_up: z.string().nullable().optional().default(null),
  
  // Lab Result
  test_name: z.string().nullable().optional().default(null),
  test_date: z.string().nullable().optional().default(null),
  ordering_provider: z.string().nullable().optional().default(null),
  results: z.array(z.record(z.any())).nullable().optional().default([]),
  reference_ranges: z.array(z.record(z.any())).nullable().optional().default([]),
  lab_name: z.string().nullable().optional().default(null),
  specimen_type: z.string().nullable().optional().default(null),
  specimen_id: z.string().nullable().optional().default(null),
  collection_time: z.string().nullable().optional().default(null),
  abnormal_flags: z.array(z.string()).nullable().optional().default([]),
  units: z.string().nullable().optional().default(null),
  method: z.string().nullable().optional().default(null),
  
  // Prescription
  medication_name: z.string().nullable().optional().default(null),
  dosage: z.string().nullable().optional().default(null),
  frequency: z.string().nullable().optional().default(null),
  prescriber_name: z.string().nullable().optional().default(null),
  prescription_date: z.string().nullable().optional().default(null),
  pharmacy: z.string().nullable().optional().default(null),
  refills: z.number().nullable().optional().default(null),
  quantity: z.number().nullable().optional().default(null),
  ndc: z.string().nullable().optional().default(null),
  dea_number: z.string().nullable().optional().default(null),
  instructions: z.string().nullable().optional().default(null),
  generic_substitution: z.boolean().nullable().optional().default(null),
  
  // Patient Intake
  address: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  insurance_provider: z.string().nullable().optional().default(null),
  policy_number: z.string().nullable().optional().default(null),
  emergency_contact: z.string().nullable().optional().default(null),
  reason_for_visit: z.string().nullable().optional().default(null),
  primary_care_physician: z.string().nullable().optional().default(null),
  medical_history: z.array(z.string()).nullable().optional().default([]),
  current_medications: z.array(z.string()).nullable().optional().default([]),
  family_history: z.string().nullable().optional().default(null),
  social_history: z.string().nullable().optional().default(null),
  consent: z.boolean().nullable().optional().default(null)
};

const InsuranceLegacyFields = {
  // Insurance Claim
  claim_number: z.string().nullable().optional().default(null),
  policy_number: z.string().nullable().optional().default(null),
  incident_date: z.string().nullable().optional().default(null),
  claim_status: z.string().nullable().optional().default(null),
  location: z.string().nullable().optional().default(null),
  primary_damage: z.string().nullable().optional().default(null),
  estimated_repair_cost: z.number().nullable().optional().default(null),
  claimant_name: z.string().nullable().optional().default(null),
  adjuster_name: z.string().nullable().optional().default(null),
  deductible: z.number().nullable().optional().default(null),
  coverage_type: z.string().nullable().optional().default(null),
  vehicle_make: z.string().nullable().optional().default(null),
  vehicle_model: z.string().nullable().optional().default(null),
  vehicle_year: z.number().nullable().optional().default(null),
  vin: z.string().nullable().optional().default(null),
  police_report_number: z.string().nullable().optional().default(null)
};

const LogisticsLegacyFields = {
  // Bill of Lading
  bol_number: z.string().nullable().optional().default(null),
  shipper: z.string().nullable().optional().default(null),
  consignee: z.string().nullable().optional().default(null),
  notify_party: z.string().nullable().optional().default(null),
  vessel: z.string().nullable().optional().default(null),
  voyage_number: z.string().nullable().optional().default(null),
  port_of_loading: z.string().nullable().optional().default(null),
  port_of_discharge: z.string().nullable().optional().default(null),
  cargo_description: z.string().nullable().optional().default(null),
  container_number: z.string().nullable().optional().default(null),
  gross_weight: z.number().nullable().optional().default(null),
  number_of_packages: z.number().nullable().optional().default(null),
  freight_terms: z.string().nullable().optional().default(null),
  place_of_receipt: z.string().nullable().optional().default(null),
  place_of_delivery: z.string().nullable().optional().default(null),
  
  // Shipping Manifest
  manifest_number: z.string().nullable().optional().default(null),
  vessel_name: z.string().nullable().optional().default(null),
  cargo_items: z.array(z.record(z.any())).nullable().optional().default([]),
  total_weight: z.number().nullable().optional().default(null),
  imo_number: z.string().nullable().optional().default(null),
  flag_state: z.string().nullable().optional().default(null),
  master_name: z.string().nullable().optional().default(null),
  number_of_bills: z.number().nullable().optional().default(null),
  date_of_departure: z.string().nullable().optional().default(null),
  date_of_arrival: z.string().nullable().optional().default(null),
  
  // Delivery Note
  delivery_note_number: z.string().nullable().optional().default(null),
  order_reference: z.string().nullable().optional().default(null),
  recipient_name: z.string().nullable().optional().default(null),
  delivery_address: z.string().nullable().optional().default(null),
  items_delivered: z.array(z.record(z.any())).nullable().optional().default([]),
  carrier: z.string().nullable().optional().default(null),
  tracking_number: z.string().nullable().optional().default(null),
  number_of_pallets: z.number().nullable().optional().default(null),
  weight: z.number().nullable().optional().default(null),
  condition: z.string().nullable().optional().default(null),
  recipient_signature: z.string().nullable().optional().default(null),
  delivery_instructions: z.string().nullable().optional().default(null),
  
  // Customs Document
  declaration_number: z.string().nullable().optional().default(null),
  importer: z.string().nullable().optional().default(null),
  exporter: z.string().nullable().optional().default(null),
  country_of_origin: z.string().nullable().optional().default(null),
  hs_codes: z.array(z.string()).nullable().optional().default([]),
  customs_value: z.number().nullable().optional().default(null),
  duties_taxes: z.number().nullable().optional().default(null),
  port_of_entry: z.string().nullable().optional().default(null),
  incoterms: z.string().nullable().optional().default(null),
  mode_of_transport: z.string().nullable().optional().default(null),
  container_numbers: z.array(z.string()).nullable().optional().default([]),
  gross_mass: z.number().nullable().optional().default(null),
  net_mass: z.number().nullable().optional().default(null),
  customs_broker: z.string().nullable().optional().default(null),
  entry_type: z.string().nullable().optional().default(null)
};

const RealEstateLegacyFields = {
  // Property Valuation
  valuation_date: z.string().nullable().optional().default(null),
  appraiser_name: z.string().nullable().optional().default(null),
  estimated_value: z.number().nullable().optional().default(null),
  property_type: z.string().nullable().optional().default(null),
  square_footage: z.number().nullable().optional().default(null),
  valuation_method: z.string().nullable().optional().default(null),
  comparable_sales: z.array(z.record(z.any())).nullable().optional().default([]),
  cap_rate: z.number().nullable().optional().default(null),
  condition_rating: z.string().nullable().optional().default(null),
  year_built: z.number().nullable().optional().default(null),
  lot_size: z.string().nullable().optional().default(null),
  zoning: z.string().nullable().optional().default(null),
  neighborhood: z.string().nullable().optional().default(null),
  
  // Inspection Report
  inspection_date: z.string().nullable().optional().default(null),
  inspector_name: z.string().nullable().optional().default(null),
  inspector_license: z.string().nullable().optional().default(null),
  findings: z.array(z.string()).nullable().optional().default([]),
  recommendations: z.array(z.string()).nullable().optional().default([]),
  systems_checked: z.array(z.string()).nullable().optional().default([]),
  structural: z.string().nullable().optional().default(null),
  roof: z.string().nullable().optional().default(null),
  plumbing: z.string().nullable().optional().default(null),
  electrical: z.string().nullable().optional().default(null),
  hvac: z.string().nullable().optional().default(null),
  overall_condition: z.string().nullable().optional().default(null),
  safety_concerns: z.array(z.string()).nullable().optional().default([]),
  
  // Mortgage Document
  borrower_name: z.string().nullable().optional().default(null),
  lender_name: z.string().nullable().optional().default(null),
  loan_amount: z.number().nullable().optional().default(null),
  interest_rate: z.number().nullable().optional().default(null),
  loan_term: z.string().nullable().optional().default(null),
  monthly_payment: z.number().nullable().optional().default(null),
  loan_number: z.string().nullable().optional().default(null),
  origination_date: z.string().nullable().optional().default(null),
  maturity_date: z.string().nullable().optional().default(null),
  loan_type: z.string().nullable().optional().default(null),
  escrow: z.number().nullable().optional().default(null),
  pmi: z.number().nullable().optional().default(null),
  closing_costs: z.number().nullable().optional().default(null),
  prepayment_penalty: z.string().nullable().optional().default(null),
  
  // Land Registry
  property_id: z.string().nullable().optional().default(null),
  owner_name: z.string().nullable().optional().default(null),
  registration_date: z.string().nullable().optional().default(null),
  land_area: z.string().nullable().optional().default(null),
  title_number: z.string().nullable().optional().default(null),
  encumbrances: z.array(z.string()).nullable().optional().default([]),
  previous_owners: z.array(z.string()).nullable().optional().default([]),
  tenure: z.string().nullable().optional().default(null),
  boundaries: z.string().nullable().optional().default(null),
  survey_reference: z.string().nullable().optional().default(null)
};

const EducationLegacyFields = {
  // Transcript
  institution_name: z.string().nullable().optional().default(null),
  student_id: z.string().nullable().optional().default(null),
  program: z.string().nullable().optional().default(null),
  courses: z.array(z.record(z.any())).nullable().optional().default([]),
  grades: z.array(z.record(z.any())).nullable().optional().default([]),
  gpa: z.number().nullable().optional().default(null),
  credits_earned: z.number().nullable().optional().default(null),
  graduation_date: z.string().nullable().optional().default(null),
  degree_conferred: z.string().nullable().optional().default(null),
  academic_standing: z.string().nullable().optional().default(null),
  semester_dates: z.array(PeriodSchema).nullable().optional().default([]),
  honors: z.string().nullable().optional().default(null),
  
  // Certificate
  recipient_name: z.string().nullable().optional().default(null),
  credential_name: z.string().nullable().optional().default(null),
  issue_date: z.string().nullable().optional().default(null),
  credential_id: z.string().nullable().optional().default(null),
  field_of_study: z.string().nullable().optional().default(null),
  completion_date: z.string().nullable().optional().default(null),
  expiration_date: z.string().nullable().optional().default(null),
  ceu_credits: z.number().nullable().optional().default(null),
  accreditation: z.string().nullable().optional().default(null),
  verification_url: z.string().nullable().optional().default(null),
  
  // Diploma
  graduate_name: z.string().nullable().optional().default(null),
  degree_name: z.string().nullable().optional().default(null),
  major: z.string().nullable().optional().default(null),
  degree_type: z.string().nullable().optional().default(null),
  thesis_title: z.string().nullable().optional().default(null),
  registrar: z.string().nullable().optional().default(null),
  seal: z.string().nullable().optional().default(null),
  transcript_included: z.boolean().nullable().optional().default(null),
  
  // Student Record
  enrollment_date: z.string().nullable().optional().default(null),
  status: z.string().nullable().optional().default(null),
  contact_info: z.string().nullable().optional().default(null),
  attendance: z.string().nullable().optional().default(null),
  disciplinary_record: z.array(z.string()).nullable().optional().default([]),
  advisor: z.string().nullable().optional().default(null),
  minor: z.string().nullable().optional().default(null),
  credits_attempted: z.number().nullable().optional().default(null)
};

const GovernmentLegacyFields = {
  // Passport
  passport_number: z.string().nullable().optional().default(null),
  nationality: z.string().nullable().optional().default(null),
  place_of_birth: z.string().nullable().optional().default(null),
  issuing_authority: z.string().nullable().optional().default(null),
  mrz: z.string().nullable().optional().default(null),
  sex: z.string().nullable().optional().default(null),
  height: z.string().nullable().optional().default(null),
  signature: z.string().nullable().optional().default(null),
  photo: z.string().nullable().optional().default(null),
  passport_type: z.string().nullable().optional().default(null),
  country_code: z.string().nullable().optional().default(null),
  
  // Driver's License
  license_number: z.string().nullable().optional().default(null),
  issuing_state: z.string().nullable().optional().default(null),
  license_class: z.string().nullable().optional().default(null),
  restrictions: z.string().nullable().optional().default(null),
  endorsements: z.string().nullable().optional().default(null),
  weight: z.string().nullable().optional().default(null),
  eye_color: z.string().nullable().optional().default(null),
  hair_color: z.string().nullable().optional().default(null),
  organ_donor: z.boolean().nullable().optional().default(null),
  real_id: z.boolean().nullable().optional().default(null),
  
  // National ID
  id_number: z.string().nullable().optional().default(null),
  fingerprint: z.string().nullable().optional().default(null),
  card_number: z.string().nullable().optional().default(null),
  version: z.string().nullable().optional().default(null),
  
  // Permit
  permit_number: z.string().nullable().optional().default(null),
  permit_type: z.string().nullable().optional().default(null),
  conditions: z.string().nullable().optional().default(null),
  scope: z.string().nullable().optional().default(null),
  project_address: z.string().nullable().optional().default(null),
  fee_paid: z.number().nullable().optional().default(null),
  inspection_required: z.boolean().nullable().optional().default(null),
  bond_amount: z.number().nullable().optional().default(null),
  
  // License
  license_type: z.string().nullable().optional().default(null),
  renewal_date: z.string().nullable().optional().default(null),
  continuing_education: z.string().nullable().optional().default(null),
  disciplinary_actions: z.array(z.string()).nullable().optional().default([]),
  insurance: z.string().nullable().optional().default(null),
  accreditation: z.string().nullable().optional().default(null)
};

// ================= MAIN FLEXIBLE SCHEMA =================

export const FlexibleDocumentSchema = z.object({
  // Document identity
  document_type: z.string().default('unknown'),
  document_subtype: z.string().nullable().optional().default(null),
  document_category: z.string().default('other'),
  
  // Parties (generic — works for all document types)
  issuer: IssuerSchema.default({}),
  recipient: RecipientSchema.default({}),

  buyer: z.object({
  name: z.string().nullable().optional().default(null),
  address: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  tax_id: z.string().nullable().optional().default(null),
  contact_person: z.string().nullable().optional().default(null)
}).nullable().optional().default({}),

seller: z.object({
  name: z.string().nullable().optional().default(null),
  address: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  tax_id: z.string().nullable().optional().default(null),
  contact_person: z.string().nullable().optional().default(null)
}).nullable().optional().default({}),

customer: z.object({
  name: z.string().nullable().optional().default(null),
  address: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  tax_id: z.string().nullable().optional().default(null)
}).nullable().optional().default({}),

supplier: z.object({
  name: z.string().nullable().optional().default(null),
  address: z.string().nullable().optional().default(null),  
  email: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  tax_id: z.string().nullable().optional().default(null),
  contact_person: z.string().nullable().optional().default(null)
}).nullable().optional().default({}),

  issue_date: z.string().nullable().optional().default(null),
  effective_date: z.string().nullable().optional().default(null),
  expiry_date: z.string().nullable().optional().default(null),
  total_amount: z.number().nullable().optional().default(null),
  currency: z.string().default('USD'),
  tax_amount: z.number().min(0).nullable().optional().default(0),
  sections: z.array(SectionSchema).default([]),
  specific_fields: z.record(z.union([
  z.string(),
  z.number(),
  z.boolean()
])).default({}),
  
  // Common legacy fields (present on all documents for backward compat)
  vendor_name: z.string().nullable().optional().default(null),
  vendor_address: z.string().nullable().optional().default(null),
  vendor_tax_id: z.string().nullable().optional().default(null),
  vendor_email: z.string().nullable().optional().default(null),
  vendor_phone: z.string().nullable().optional().default(null),
  vendor_website: z.string().nullable().optional().default(null),
  vendor_registration_number: z.string().nullable().optional().default(null),
  
  date: z.string().nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
  document_source: z.string().nullable().optional().default(null),
  document_id: z.string().nullable().optional().default(null),
  document_title: z.string().nullable().optional().default(null),
  created_date: z.string().nullable().optional().default(null),
  updated_date: z.string().nullable().optional().default(null),
  country: z.string().nullable().optional().default(null),
  state: z.string().nullable().optional().default(null),
  language: z.string().nullable().optional().default(null),
  
  // Category-specific legacy fields (all optional, populated by mapper)
  ...FinancialLegacyFields,
  ...LegalLegacyFields,
  ...HRLegacyFields,
  ...HealthcareLegacyFields,
  ...InsuranceLegacyFields,
  ...LogisticsLegacyFields,
  ...RealEstateLegacyFields,
  ...EducationLegacyFields,
  ...GovernmentLegacyFields,
  
  // Classification
  category: z.string().default('Uncategorized'),
  
  // Confidence — injected by pipeline, not defaulted
  confidence_scores: ConfidenceScoreSchema,
  
  // Metadata
  _schema_version: z.string().default('v8-flexible'),
  _source: z.object({
    aws: z.boolean().default(false),
    gpt: z.boolean().default(false)
  }).optional()
});

// ================= FIELD ALIAS RESOLUTION =================

/**
 * Resolves raw field names from extraction output to canonical field names
 * using the document registry's alias definitions.
 */
export function resolveFieldAliases(rawData, docType) {
  const resolved = {};
  const info = getDocumentTypeInfo(docType);
  
  for (const [rawKey, value] of Object.entries(rawData)) {
    // Skip null/empty values
    if (value === null || value === undefined || value === '') continue;
    
    // Try exact match first
    const canonical = matchFieldName(rawKey, docType);
    
    if (canonical) {
      resolved[canonical] = value;
    } else {
      // Keep as-is if no alias match (might be a custom field)
      resolved[rawKey] = value;
    }
  }
  
  return resolved;
}


// ================= SCHEMA WITH TRANSFORM =================

export const DocumentSchema = FlexibleDocumentSchema.transform((data) => {
  const stripNulls = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(stripNulls).filter(v => v !== null && v !== undefined);
    }
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleaned = stripNulls(value);
        if (cleaned !== null && cleaned !== undefined && cleaned !== '' && 
            !(Array.isArray(cleaned) && cleaned.length === 0) &&
            !(typeof cleaned === 'object' && Object.keys(cleaned).length === 0)) {
          result[key] = cleaned;
        }
      }
      return result;
    }
    return obj;
  };
  
  // Always preserve these critical fields even if null
    const alwaysPreserve = [
    'document_type', 'document_category', 'currency', 
    'sections', 'specific_fields', 'issuer', 'recipient', 
    'confidence_scores', '_schema_version', '_source',
    'line_items', 'items', 'transactions', 'tax_details'
  ];
  
  const stripped = stripNulls(data);
  
  for (const key of alwaysPreserve) {
    if (!(key in stripped) && key in data) {
      stripped[key] = data[key];
    }
  }
  
  return stripped;
});

// ================= LEGACY SCHEMA (for explicit backward compat) =================

export const LegacyDocumentSchema = z.object({
  document_type: z.enum([
    'invoice', 'receipt', 'bank-statement', 'utility-bill',
    'purchase-order', 'contract', 'credit-card-statement',
    'expense-report', 'tax-form', 'payroll-report', 'unknown'
  ]).default('unknown'),
  
  // Only the core legacy fields
  vendor_name: z.string().nullable().optional(),
  total_amount: z.number().nullable().optional(),
  date: z.string().nullable().optional(),
  line_items: z.array(LineItemSchema).default([]),
  transactions: z.array(TransactionSchema).default([]),
  confidence_scores: ConfidenceScoreSchema
});

// ================= TYPE GUARDS =================

export function isValidDocumentType(type) {
  return getDocumentTypeInfo(type).displayName !== 'Unknown Document';
}

export function getLegacyFieldsForType(type) {
  const info = getDocumentTypeInfo(type);
  if (!info.legacy) return [];
  
  // Return the list of legacy field names that should be populated
  return info.expectedFields || [];
}

export function shouldUseLegacyOutput(type) {
  return isLegacyType(type);
}
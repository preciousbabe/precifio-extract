import { z } from 'zod';
import { isLegacyType } from './documentRegistry.js';

// ================= BASE SCHEMAS =================

const TaxDetailSchema = z.object({
  type: z.string().default('Unknown'),
  rate: z.number().nullable().default(null),
  amount: z.number().min(0).default(0)
});

const LineItemSchema = z.object({
  description: z.string().default('Unknown item'),
  quantity: z.number().min(1).default(1),
  unit_price: z.number().min(0).nullable().default(null),
  total: z.number().min(0).nullable().default(null),
  sku: z.string().nullable().optional().default(null),
  category: z.string().nullable().optional().default(null),
  tax_amount: z.number().min(0).optional().default(0)
});

const TransactionSchema = z.object({
  date: z.string().nullable().optional().default(null),
  description: z.string().default(''),
  reference: z.string().nullable().optional().default(null),
  transaction_type: z.string().nullable().optional().default(null),
  debit: z.number().nullable().optional().default(null),
  credit: z.number().nullable().optional().default(null),
  balance: z.number().nullable().optional().default(null),
  category: z.string().nullable().optional().default(null)
});

const ReceiptItemSchema = z.object({
  description: z.string().default('Unknown item'),
  quantity: z.number().min(1).default(1),
  price: z.number().min(0).nullable().default(null),
  total: z.number().min(0).nullable().default(null)
});

const PeriodSchema = z.object({
  from: z.string().nullable().optional().default(null),
  to: z.string().nullable().optional().default(null)
});

// ================= NEW: FLEXIBLE SECTION SCHEMA =================

const SectionItemSchema = z.record(z.any()).default({});

const SectionSchema = z.object({
  section_type: z.string(),
  section_title: z.string().optional().default(''),
  fields: z.record(z.any()).default({}),
  items: z.array(SectionItemSchema).default([]),
  text: z.string().optional().default('')
});

// ================= NEW: ISSUER/RECIPIENT SCHEMAS =================

const IssuerSchema = z.object({
  name: z.string().nullable().optional().default(null),
  address: z.string().nullable().optional().default(null),
  tax_id: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  website: z.string().nullable().optional().default(null),
  registration_number: z.string().nullable().optional().default(null),
  id_number: z.string().nullable().optional().default(null) // For gov IDs, employee IDs, etc.
});

const RecipientSchema = z.object({
  name: z.string().nullable().optional().default(null),
  address: z.string().nullable().optional().default(null),
  tax_id: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  id_number: z.string().nullable().optional().default(null),
  date_of_birth: z.string().nullable().optional().default(null)
});

// ================= CONFIDENCE SCHEMA (unchanged) =================

const ConfidenceScoreSchema = z.object({
  overall: z.number().min(0).max(1),
  completeness: z.number().min(0).max(100).optional(),
  breakdown: z.record(z.number().min(0).max(1)).optional(),
  flags: z.object({
    low_confidence_fields: z.array(z.string()).default([]),
    missing_required_fields: z.array(z.string()).default([]),
    invalid_dates: z.array(z.string()).default([]),
    math_issue: z.boolean().default(false),
    balance_mismatch: z.boolean().default(false)
  }).optional(),
  status: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  requiresReview: z.boolean(),
  reviewReason: z.string().nullable().optional(),
  extractedFieldCount: z.number().optional(),
  totalPossibleFields: z.number().optional()
}).optional();


export const FlexibleDocumentSchema = z.object({
  // Document identity
  document_type: z.string().default('unknown'),
  document_subtype: z.string().nullable().optional().default(null),
  document_category: z.string().default('other'),
  
  // Parties (generic — works for all document types)
  issuer: IssuerSchema.default({}),
  recipient: RecipientSchema.default({}),
  
  // Common dates
  issue_date: z.string().nullable().optional().default(null),
  effective_date: z.string().nullable().optional().default(null),
  expiry_date: z.string().nullable().optional().default(null),
  
  // Financial (if applicable)
  total_amount: z.number().nullable().optional().default(null),
  currency: z.string().default('USD'),
  tax_amount: z.number().min(0).optional().default(0),
  
  // Flexible sections (THE KEY TO EXTENSIBILITY)
  sections: z.array(SectionSchema).default([]),
  
  // Type-specific fields that don't fit sections
  specific_fields: z.record(z.any()).default({}),
  
  // Legacy compatibility fields (populated by mapper for old UI)
  // These are optional — only present for legacy types
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
  
  // Legacy invoice fields
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
  line_items: z.array(LineItemSchema).default([]),
  subtotal: z.number().nullable().optional().default(null),
  discount_amount: z.number().min(0).optional().default(0),
  tax_details: z.array(TaxDetailSchema).default([]).optional(),
  shipping_amount: z.number().min(0).optional().default(0),
  amount_due: z.number().nullable().optional().default(null),
  amount_paid: z.number().min(0).optional().default(0),
  payment_status: z.enum(['PAID', 'UNPAID', 'PARTIAL', 'OVERDUE', 'UNKNOWN']).nullable().optional().default(null),
  payment_method: z.string().nullable().optional().default(null),
  payment_terms: z.string().nullable().optional().default(null),
  purchase_order_reference: z.string().nullable().optional().default(null),
  service_period: PeriodSchema.default({}),
  late_fee: z.number().nullable().optional().default(null),
  invoice_status: z.enum(['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'UNKNOWN']).nullable().optional().default(null),
  
  // Legacy receipt fields
  receipt_number: z.string().nullable().optional().default(null),
  items: z.array(ReceiptItemSchema).default([]),
  change_given: z.number().min(0).optional().default(0),
  cashier_name: z.string().nullable().optional().default(null),
  store_location: z.string().nullable().optional().default(null),
  terminal_id: z.string().nullable().optional().default(null),
  
  // Legacy bank statement fields
  account_number: z.string().nullable().optional().default(null),
  statement_period: PeriodSchema.default({}),
  opening_balance: z.number().nullable().optional().default(null),
  closing_balance: z.number().nullable().optional().default(null),
  transactions: z.array(TransactionSchema).default([]),
  account_name: z.string().nullable().optional().default(null),
  bank_name: z.string().nullable().optional().default(null),
  branch_name: z.string().nullable().optional().default(null),
  routing_number: z.string().nullable().optional().default(null),
  swift_code: z.string().nullable().optional().default(null),
  iban: z.string().nullable().optional().default(null),
  account_type: z.string().nullable().optional().default(null),
  
  // Legacy utility bill fields
  bill_number: z.string().nullable().optional().default(null),
  usage_amount: z.union([z.string(), z.number()]).nullable().optional().default(null),
  usage_period: PeriodSchema.default({}),
  previous_balance: z.number().min(0).optional().default(0),
  current_charges: z.number().min(0).optional().default(0),
  meter_number: z.string().nullable().optional().default(null),
  customer_number: z.string().nullable().optional().default(null),
  tariff_plan: z.string().nullable().optional().default(null),
  units_consumed: z.number().nullable().optional().default(null),
  
  // Legacy purchase order fields
  order_date: z.string().nullable().optional().default(null),
  delivery_date: z.string().nullable().optional().default(null),
  ship_to: z.string().nullable().optional().default(null),
  buyer_company: z.string().nullable().optional().default(null),
  supplier_name: z.string().nullable().optional().default(null),
  supplier_contact: z.string().nullable().optional().default(null),
  expected_total: z.number().nullable().optional().default(null),
  
  // Legacy contract fields
  contract_number: z.string().nullable().optional().default(null),
  contract_type: z.string().nullable().optional().default(null),
  counterparty: z.string().nullable().optional().default(null),
  contract_value: z.number().nullable().optional().default(null),
  renewal_date: z.string().nullable().optional().default(null),
  
   // Classification
  category: z.string().default('Uncategorized'),
  
  // Confidence — injected by pipeline, not defaulted
  confidence_scores: ConfidenceScoreSchema,
  
  // Metadata
  _schema_version: z.string().default('v7-flexible'),
  _source: z.object({
    aws: z.boolean().default(false),
    gpt: z.boolean().default(false)
  }).optional()
});

// ================= LEGACY SCHEMA (for backward compat) =================
// Keep the old schema for any code that explicitly needs it
export const LegacyDocumentSchema = z.object({
  document_type: z.enum([
    'invoice', 'receipt', 'bank-statement', 'utility-bill',
    'purchase-order', 'contract', 'unknown'
  ]).default('unknown'),
  
});



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
  const alwaysPreserve = ['document_type', 'document_category', 'currency', 'sections', 'specific_fields', 'issuer', 'recipient', 'confidence_scores', '_schema_version', '_source'];
  const stripped = stripNulls(data);
  
  for (const key of alwaysPreserve) {
    if (!(key in stripped) && key in data) {
      stripped[key] = data[key];
    }
  }
  
  
  return stripped;
});
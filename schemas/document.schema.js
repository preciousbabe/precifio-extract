import { z } from 'zod';

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
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  balance: z.number().nullable().optional().default(null)
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

// Confidence engine output schema
const ConfidenceScoreSchema = z.object({
  overall: z.number().min(0).max(1).default(0),
  breakdown: z.record(z.number().min(0).max(1)).default({}),
  flags: z.object({
    low_confidence_fields: z.array(z.string()).default([])
  }).default({ low_confidence_fields: [] }),
  status: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('LOW'),
  requiresReview: z.boolean().default(true)
}).default({
  overall: 0,
  breakdown: {},
  flags: { low_confidence_fields: [] },
  status: 'LOW',
  requiresReview: true
});

export const DocumentSchema = z.object({
  // ================= CORE (all documents) =================
  document_type: z.enum([
    'invoice',
    'receipt',
    'bank-statement',
    'contract',
    'utility-bill',
    'purchase-order',
    'unknown'
  ]).default('unknown'),

  vendor_name: z.string().nullable().default(null),
  vendor_address: z.string().nullable().optional().default(null),
  vendor_tax_id: z.string().nullable().optional().default(null),
  vendor_email: z.string().nullable().optional().default(null),
  vendor_phone: z.string().nullable().optional().default(null),

  date: z.string().nullable().optional().default(null),
  currency: z.string().default('USD'),
  total_amount: z.number().nullable().default(null),
  notes: z.string().nullable().optional().default(null),

  // ================= INVOICE-SPECIFIC =================
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
  tax_amount: z.number().min(0).default(0),
  tax_details: z.array(TaxDetailSchema).default([]).optional(),
  shipping_amount: z.number().min(0).optional().default(0),
  amount_due: z.number().nullable().optional().default(null),
  amount_paid: z.number().min(0).optional().default(0),

  payment_status: z.enum([
    'PAID', 'UNPAID', 'PARTIAL', 'OVERDUE', 'UNKNOWN'
  ]).default('UNKNOWN'),
  payment_method: z.string().nullable().optional().default(null),
  payment_terms: z.string().nullable().optional().default(null),

  // ================= RECEIPT-SPECIFIC =================
  receipt_number: z.string().nullable().optional().default(null),
  items: z.array(ReceiptItemSchema).default([]),
  change_given: z.number().min(0).optional().default(0),

  // ================= BANK STATEMENT-SPECIFIC =================
  account_number: z.string().nullable().optional().default(null),
  statement_period: PeriodSchema.default({}),
  opening_balance: z.number().nullable().optional().default(null),
  closing_balance: z.number().nullable().optional().default(null),
  transactions: z.array(TransactionSchema).default([]),

  // ================= UTILITY BILL-SPECIFIC =================
  bill_number: z.string().nullable().optional().default(null),
  usage_amount: z.union([z.string(), z.number()]).nullable().optional().default(null),
  usage_period: PeriodSchema.default({}),
  previous_balance: z.number().min(0).optional().default(0),
  current_charges: z.number().min(0).optional().default(0),

  // ================= PURCHASE ORDER-SPECIFIC =================
  order_date: z.string().nullable().optional().default(null),
  delivery_date: z.string().nullable().optional().default(null),
  ship_to: z.string().nullable().optional().default(null),

  // ================= CLASSIFICATION =================
  category: z.enum([
    'Office Supplies',
    'Utilities',
    'Professional Services',
    'Travel & Entertainment',
    'Software & Technology',
    'Marketing & Advertising',
    'Rent & Facilities',
    'Insurance',
    'Taxes & Government',
    'Banking & Finance',
    'Raw Materials',
    'Equipment',
    'Maintenance & Repairs',
    'Telecommunications',
    'Shipping & Logistics',
    'Uncategorized'
  ]).default('Uncategorized'),

  // ================= CONFIDENCE =================
  confidence_scores: ConfidenceScoreSchema
});
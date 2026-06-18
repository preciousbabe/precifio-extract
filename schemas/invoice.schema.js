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

// Confidence engine output schema
const ConfidenceScoreSchema = z.object({
  overall: z.number().min(0).max(1).default(0),
  breakdown: z.object({
    invoice_number: z.number().min(0).max(1).default(0),
    vendor_name: z.number().min(0).max(1).default(0),
    total_amount: z.number().min(0).max(1).default(0),
    invoice_date: z.number().min(0).max(1).default(0),
    line_items: z.number().min(0).max(1).default(0),
    financialConsistency: z.number().min(0).max(1).default(0),
    structure: z.number().min(0).max(1).default(0),
  }).default({}),
  flags: z.object({
    low_confidence_fields: z.array(z.string()).default([])
  }).default({ low_confidence_fields: [] }),
  status: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('LOW')
}).default({
  overall: 0,
  breakdown: {},
  flags: { low_confidence_fields: [] },
  status: 'LOW'
});

export const InvoiceSchema = z.object({
  // ================= CORE =================
  invoice_number: z.string().nullable().default(null),
  po_number: z.string().nullable().optional().default(null),
  reference_number: z.string().nullable().optional().default(null),

  // ================= PARTIES =================
  vendor_name: z.string().nullable().default(null),
  vendor_address: z.string().nullable().optional().default(null),
  vendor_tax_id: z.string().nullable().optional().default(null),
  vendor_email: z.string().nullable().optional().default(null),
  vendor_phone: z.string().nullable().optional().default(null),

  buyer_name: z.string().nullable().optional().default(null),
  buyer_address: z.string().nullable().optional().default(null),
  buyer_tax_id: z.string().nullable().optional().default(null),
  buyer_email: z.string().nullable().optional().default(null),

  // ================= DATES =================
  invoice_date: z.string().nullable().default(null),
  due_date: z.string().nullable().default(null),
  payment_date: z.string().nullable().optional().default(null),

  // ================= FINANCIALS =================
  line_items: z.array(LineItemSchema).default([]),

  subtotal: z.number().nullable().default(null),
  discount_amount: z.number().min(0).optional().default(0),
  tax_amount: z.number().min(0).default(0),

  tax_details: z.array(TaxDetailSchema).default([]).optional(),
  shipping_amount: z.number().min(0).optional().default(0),

  total_amount: z.number().nullable().default(null),
  amount_due: z.number().nullable().optional().default(null),
  amount_paid: z.number().min(0).optional().default(0),

  // ================= CURRENCY =================
  currency: z.string().default('USD'),

  payment_status: z.enum([
    'PAID',
    'UNPAID',
    'PARTIAL',
    'OVERDUE',
    'UNKNOWN'
  ]).default('UNKNOWN'),

  payment_method: z.string().nullable().optional().default(null),
  payment_terms: z.string().nullable().optional().default(null),

  // ================= CLASSIFICATION =================
  category: z.string().nullable().optional().default('Uncategorized'),
  document_type: z.enum([
    'invoice',
    'receipt',
    'bank-statement',
    'contract',
    'utility-bill',
    'purchase-order'
  ]).default('invoice'),

  // ================= METADATA =================
  notes: z.string().nullable().optional().default(null),

  // ================= CONFIDENCE (engine format) =================
  confidence_scores: ConfidenceScoreSchema
});
import { TextractClient, AnalyzeExpenseCommand, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';

const client = process.env.AWS_ACCESS_KEY_ID &&
               process.env.AWS_SECRET_ACCESS_KEY
  ? new TextractClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    })
  : null;

// Check if AWS is configured
export function isAwsConfigured() {
  return (
    !!process.env.AWS_ACCESS_KEY_ID &&
    !!process.env.AWS_SECRET_ACCESS_KEY
  );
}

// Map document types to Textract features
const DOCUMENT_CONFIG = {
  invoice: { expense: true, tables: true },
  receipt: { expense: true, tables: true },
  'bank-statement': { tables: true, forms: true },
  contract: { tables: true, forms: true },
  'utility-bill': { expense: true, tables: true },
  'purchase-order': { tables: true, forms: true }
};

export async function extractWithAWS(fileBuffer, documentType = 'invoice') {
  if (!client) {
  throw new Error('AWS Textract not configured');
  }
  
  const config = DOCUMENT_CONFIG[documentType] || { expense: true, tables: true };
  
  console.log(`AWS Textract: Processing ${documentType}`);
  
  let result;
  
  if (config.expense) {
    // AnalyzeExpense is specifically for invoices/receipts
    const command = new AnalyzeExpenseCommand({
      Document: { Bytes: fileBuffer }
    });
    result = await client.send(command);
  } else {
    // General document analysis
    const command = new AnalyzeDocumentCommand({
      Document: { Bytes: fileBuffer },
      FeatureTypes: ['TABLES', 'FORMS']
    });
    result = await client.send(command);
  }
  
  return normalizeTextractResult(result, documentType);
}

function normalizeTextractResult(result, documentType) {
  const expenseDocs = result.ExpenseDocuments || [];
  const doc = expenseDocs[0] || {};
  
  // Extract summary fields
  const summaryFields = doc.SummaryFields || [];
  const fieldMap = {};
  
  for (const field of summaryFields) {
    const type = field.Type?.Text || field.LabelDetection?.Text || 'Unknown';
    const value = field.ValueDetection?.Text || '';
    const confidence = field.ValueDetection?.Confidence || 0;
    
    fieldMap[type.toLowerCase()] = { value, confidence };
  }
  
  // Extract line items
  const lineItems = [];
  const itemGroups = doc.LineItemGroups || [];
  
  for (const group of itemGroups) {
    for (const item of (group.LineItems || [])) {
      const itemFields = {};
      
      for (const field of (item.LineItemExpenseFields || [])) {
        const type = field.Type?.Text?.toLowerCase() || '';
        const value = field.ValueDetection?.Text || '';
        itemFields[type] = value;
      }
      
      lineItems.push({
        description: itemFields['item'] || itemFields['description'] || 'Unknown',
        quantity: coerceToNumber(itemFields['quantity'] || '1', 1),
        unit_price: coerceToNumber(itemFields['unit_price'] || itemFields['price'], null),
        total: coerceToNumber(itemFields['amount'] || itemFields['total'], null)
      });
    }
  }
  
  // Calculate confidence
  const allConfidences = summaryFields.map(f => f.ValueDetection?.Confidence || 0);
  const avgConfidence = allConfidences.length > 0 
    ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length 
    : 0;

  return {
    documentType,
    rawAWSData: result,
    extracted: {
      invoice_number: fieldMap['invoice number']?.value || fieldMap['invoice #']?.value || null,
      vendor_name: fieldMap['vendor name']?.value || fieldMap['merchant']?.value || fieldMap['sold by']?.value || null,
      vendor_address: fieldMap['vendor address']?.value || null,
      vendor_tax_id: fieldMap['vendor tax id']?.value || null,
      buyer_name: fieldMap['customer name']?.value || fieldMap['bill to']?.value || null,
      buyer_address: fieldMap['customer address']?.value || null,
      buyer_tax_id: fieldMap['customer tax id']?.value || null,
      invoice_date: formatDate(fieldMap['invoice date']?.value || fieldMap['date']?.value),
      due_date: formatDate(fieldMap['due date']?.value),
      payment_date: formatDate(fieldMap['payment date']?.value),
      line_items: lineItems,
      subtotal: coerceToNumber(fieldMap['subtotal']?.value, null),
      tax_amount: coerceToNumber(fieldMap['tax']?.value || fieldMap['vat']?.value, 0),
      total_amount: coerceToNumber(fieldMap['total']?.value || fieldMap['amount due']?.value, null),
      amount_due: coerceToNumber(fieldMap['amount due']?.value, null),
      amount_paid: coerceToNumber(fieldMap['amount paid']?.value, 0),
      currency: detectCurrency(fieldMap),
      payment_status: detectPaymentStatus(fieldMap),
      payment_method: fieldMap['payment method']?.value || null,
      payment_terms: fieldMap['payment terms']?.value || null,
      tax_details: extractTaxDetails(fieldMap),
      category: inferCategory(documentType, fieldMap),
      confidence: {
        overall: avgConfidence / 100, // Convert to 0-1 scale
        fieldScores: Object.fromEntries(
          Object.entries(fieldMap).map(([k, v]) => [k, (v.confidence || 0) / 100])
        )
      }
    }
  };
}

function detectCurrency(fieldMap) {
  const totalText = fieldMap['total']?.value || '';
  const currencyText = fieldMap['currency']?.value || '';
  
  if (totalText.includes('₦') || currencyText.includes('NGN') || currencyText.includes('Naira')) return 'NGN';
  if (totalText.includes('€') || currencyText.includes('EUR')) return 'EUR';
  if (totalText.includes('£') || currencyText.includes('GBP')) return 'GBP';
  if (totalText.includes('$') || currencyText.includes('USD') || currencyText.includes('Dollar')) return 'USD';
  
  return 'USD'; // Default
}

function detectPaymentStatus(fieldMap) {
  const status = fieldMap['payment status']?.value?.toLowerCase() || '';
  const amountDue = coerceToNumber(fieldMap['amount due']?.value, null);
  const amountPaid = coerceToNumber(fieldMap['amount paid']?.value, null);
  const total = coerceToNumber(fieldMap['total']?.value, null);
  
  if (status.includes('paid')) return 'PAID';
  if (status.includes('partial')) return 'PARTIAL';
  if (status.includes('unpaid') || status.includes('due')) return 'UNPAID';
  if (status.includes('overdue')) return 'OVERDUE';
  
  if (amountDue === 0) return 'PAID';
  if (amountPaid && total && amountPaid < total) return 'PARTIAL';
  if (amountDue && amountDue > 0) return 'UNPAID';
  
  return 'UNKNOWN';
}

function extractTaxDetails(fieldMap) {
  const details = [];
  
  const tax = coerceToNumber(fieldMap['tax']?.value, null);
  if (tax) details.push({ type: 'Tax', rate: null, amount: tax });
  
  const vat = coerceToNumber(fieldMap['vat']?.value, null);
  if (vat) details.push({ type: 'VAT', rate: null, amount: vat });
  
  const gst = coerceToNumber(fieldMap['gst']?.value, null);
  if (gst) details.push({ type: 'GST', rate: null, amount: gst });
  
  return details;
}

function inferCategory(documentType, fieldMap) {
  const vendor = (fieldMap['vendor name']?.value || '').toLowerCase();
  const desc = (fieldMap['description']?.value || '').toLowerCase();
  
  if (vendor.includes('electric') || vendor.includes('power') || vendor.includes('water') || vendor.includes('utility')) {
    return 'Utilities';
  }
  if (vendor.includes('rent') || vendor.includes('realty') || vendor.includes('properties') || vendor.includes('landlord')) {
    return 'Rent/Lease';
  }
  if (vendor.includes('consult') || vendor.includes('legal') || vendor.includes('account')) {
    return 'Professional Services';
  }
  if (vendor.includes('software') || vendor.includes('tech') || vendor.includes('saas') || vendor.includes('license')) {
    return 'Software/Tech';
  }
  if (desc.includes('marketing') || desc.includes('advert')) {
    return 'Marketing';
  }
  
  const defaults = {
    invoice: 'Operating Expenses',
    receipt: 'Operating Expenses',
    'bank-statement': 'Financial',
    contract: 'Professional Services',
    'utility-bill': 'Utilities',
    'purchase-order': 'Inventory/Supplies'
  };
  
  return defaults[documentType] || 'Uncategorized';
}

function formatDate(dateString) {
  if (!dateString) return null;
  
  // Try common formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // ISO
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // MM-DD-YYYY
    /^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/, // 6 Jun 2026
    /^([A-Za-z]{3})\s(\d{1,2}),?\s(\d{4})$/ // Jun 6, 2026
  ];
  
  for (const format of formats) {
    const match = dateString.match(format);
    if (match) {
      // Return ISO format
      if (format === formats[0]) return dateString;
      if (format === formats[1]) return `${match[3]}-${match[1]}-${match[2]}`;
      if (format === formats[2]) return `${match[3]}-${match[1]}-${match[2]}`;
      // For text months, you'd need a mapper — simplified here
      return dateString;
    }
  }
  
  return dateString;
}

function coerceToNumber(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[₦,$,€,£,\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}
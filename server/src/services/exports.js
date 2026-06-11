import { supabase } from '../config/supabase.js';

export async function exportToCSV(extraction) {
  const headers = ['Field', 'Value'];
  const rows = [
    ['Invoice Number', extraction.invoice_number || ''],
    ['Vendor', extraction.vendor_name || ''],
    ['Buyer', extraction.buyer_name || ''],
    ['Invoice Date', extraction.invoice_date || ''],
    ['Due Date', extraction.due_date || ''],
    ['Subtotal', extraction.subtotal || ''],
    ['Tax', extraction.tax_amount || ''],
    ['Total', extraction.total_amount || ''],
    ['Currency', extraction.currency || ''],
    ['Payment Status', extraction.payment_status || ''],
    ['Category', extraction.category || '']
  ];
  
  extraction.line_items?.forEach((item, i) => {
    rows.push([`Line Item ${i + 1}`, '']);
    rows.push(['Description', item.description]);
    rows.push(['Quantity', item.quantity]);
    rows.push(['Unit Price', item.unit_price]);
    rows.push(['Total', item.total]);
  });
  
  return rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export async function exportToQuickBooks(extraction) {
  // QuickBooks Online API format
  const qbInvoice = {
    Line: extraction.line_items?.map((item, i) => ({
      DetailType: 'SalesItemLineDetail',
      Amount: item.total,
      Description: item.description,
      SalesItemLineDetail: {
        Qty: item.quantity,
        UnitPrice: item.unit_price,
        ItemRef: { name: item.description }
      }
    })) || [],
    
    CustomerRef: {
      name: extraction.buyer_name || 'Unknown Customer'
    },
    
    VendorRef: {
      name: extraction.vendor_name || 'Unknown Vendor'
    },
    
    DocNumber: extraction.invoice_number,
    TxnDate: extraction.invoice_date,
    DueDate: extraction.due_date,
    TotalAmt: extraction.total_amount,
    Balance: extraction.amount_due || extraction.total_amount,
    
    // Custom field for Precifio tracking
    PrivateNote: `Extracted by Precifio AI | Category: ${extraction.category}`
  };
  
  return qbInvoice;
}

export async function exportToXero(extraction) {
  // Xero API format
  const xeroInvoice = {
    Type: 'ACCPAY', // Accounts Payable
    Contact: {
      Name: extraction.vendor_name || 'Unknown Vendor',
      FirstName: extraction.vendor_name?.split(' ')[0] || '',
      LastName: extraction.vendor_name?.split(' ').slice(1).join(' ') || ''
    },
    Date: extraction.invoice_date,
    DueDate: extraction.due_date,
    InvoiceNumber: extraction.invoice_number,
    Reference: extraction.po_number || '',
    Status: extraction.payment_status === 'PAID' ? 'PAID' : 'AUTHORISED',
    LineItems: extraction.line_items?.map(item => ({
      Description: item.description,
      Quantity: item.quantity,
      UnitAmount: item.unit_price,
      LineAmount: item.total,
      TaxType: extraction.tax_details?.[0]?.type || 'NONE',
      TaxAmount: item.tax_amount || 0
    })) || [],
    SubTotal: extraction.subtotal,
    TotalTax: extraction.tax_amount,
    Total: extraction.total_amount
  };
  
  return xeroInvoice;
}

export async function saveExportRecord(extractionId, format, exportData, externalRef = null) {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('exports')
    .insert({
      extraction_id: extractionId,
      export_format: format,
      export_data: exportData,
      external_reference: externalRef,
      status: 'completed'
    })
    .select()
    .single();
  
  if (error) {
    console.warn('Export save failed:', error.message);
    return null;
  }
  
  return data;
}
import { useState } from 'react';
import { ConfidenceBadge } from './ConfidenceBadge';

export function ExtractionResult({ data }) {
  const {
    extraction = {},
    validation = { flags: [] },
    status,
    processingMethod,
    confidence: topLevelConfidence
  } = data;

  const needsReview = status === 'REVIEW_REQUIRED';
  const [exporting, setExporting] = useState(false);

  const fmt = (val) => val != null ? val.toLocaleString() : '—';
  const fmtMoney = (val, currency = 'USD') => 
    val != null ? `${currency} ${val.toLocaleString()}` : '—';
  const fmtDate = (val) => val || '—';

  // Determine which fields to show based on document type
  const docType = extraction.document_type || 'unknown';

  const fieldGroups = {
    invoice: {
      core: ['document_type', 'category', 'invoice_number', 'po_number'],
      parties: ['vendor_name', 'vendor_address', 'vendor_tax_id', 'buyer_name', 'buyer_address', 'buyer_tax_id'],
      dates: ['invoice_date', 'due_date', 'payment_date'],
      financial: ['currency', 'subtotal', 'tax_amount', 'discount_amount', 'shipping_amount', 'total_amount', 'amount_due', 'amount_paid'],
      payment: ['payment_status', 'payment_method', 'payment_terms'],
      items: 'line_items',
      itemColumns: ['description', 'sku', 'quantity', 'unit_price', 'tax_amount', 'total']
    },
    receipt: {
      core: ['document_type', 'category', 'receipt_number'],
      parties: ['vendor_name'],
      dates: ['date'],
      financial: ['currency', 'total_amount', 'tax_amount', 'change_given'],
      payment: ['payment_status', 'payment_method'],
      items: 'items',
      itemColumns: ['description', 'quantity', 'price', 'total']
    },
    'bank-statement': {
      core: ['document_type', 'account_number'],
      parties: ['vendor_name'],
      dates: ['date'],
      financial: ['currency', 'opening_balance', 'closing_balance'],
      items: 'transactions',
      itemColumns: ['date', 'description', 'debit', 'credit', 'balance']
    },
    'utility-bill': {
      core: ['document_type', 'bill_number', 'account_number'],
      parties: ['vendor_name'],
      dates: ['date', 'due_date'],
      financial: ['currency', 'amount_due', 'previous_balance', 'current_charges', 'usage_amount'],
      payment: ['payment_status'],
      items: null,
      itemColumns: []
    },
    'purchase-order': {
      core: ['document_type', 'category', 'po_number'],
      parties: ['vendor_name', 'buyer_name', 'ship_to'],
      dates: ['order_date', 'delivery_date'],
      financial: ['currency', 'subtotal', 'tax_amount', 'total_amount'],
      items: 'line_items',
      itemColumns: ['description', 'sku', 'quantity', 'unit_price', 'tax_amount', 'total']
    },
    unknown: {
      core: ['document_type', 'category'],
      parties: ['vendor_name'],
      dates: ['date'],
      financial: ['currency', 'total_amount'],
      items: null,
      itemColumns: []
    }
  };

  const fields = fieldGroups[docType] || fieldGroups.unknown;

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const csvEscape = (value) => {
    if (value == null) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const handleExport = async (format) => { 
    if (!data.extractionId) {
      if (format === 'csv') exportToCSV();
      return;
    }
    setExporting(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(
        `http://localhost:3001/api/export/${data.extractionId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || ''}`
          },
          body: JSON.stringify({ format })
        }
      );
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const filename = disposition?.split('filename=')[1]?.replace(/"/g, '') || `export.${format}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const exportToCSV = () => {
    try {
      setExporting(true);
      const rows = [['Field', 'Value']];
      
      // Add all non-null fields
      const allFields = [
        ['Document Type', extraction.document_type],
        ['Category', extraction.category],
        ['Invoice Number', extraction.invoice_number],
        ['Receipt Number', extraction.receipt_number],
        ['PO Number', extraction.po_number],
        ['Bill Number', extraction.bill_number],
        ['Account Number', extraction.account_number],
        ['Vendor', extraction.vendor_name],
        ['Buyer', extraction.buyer_name],
        ['Date', extraction.date || extraction.invoice_date],
        ['Due Date', extraction.due_date],
        ['Payment Date', extraction.payment_date],
        ['Order Date', extraction.order_date],
        ['Delivery Date', extraction.delivery_date],
        ['Subtotal', extraction.subtotal],
        ['Tax', extraction.tax_amount],
        ['Total', extraction.total_amount],
        ['Amount Due', extraction.amount_due],
        ['Amount Paid', extraction.amount_paid],
        ['Opening Balance', extraction.opening_balance],
        ['Closing Balance', extraction.closing_balance],
        ['Previous Balance', extraction.previous_balance],
        ['Current Charges', extraction.current_charges],
        ['Usage Amount', extraction.usage_amount],
        ['Change Given', extraction.change_given],
        ['Currency', extraction.currency],
        ['Payment Status', extraction.payment_status],
        ['Payment Method', extraction.payment_method],
        ['Payment Terms', extraction.payment_terms],
        ['Notes', extraction.notes]
      ];

      allFields.forEach(([label, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          rows.push([label, value]);
        }
      });

      // Add items/transactions
      const items = extraction[fields.items] || [];
      if (items.length > 0) {
        rows.push([]);
        rows.push(['Items']);
        if (docType === 'bank-statement') {
          rows.push(['Date', 'Description', 'Debit', 'Credit', 'Balance']);
          items.forEach(item => {
            rows.push([item.date || '', item.description || '', item.debit || '', item.credit || '', item.balance || '']);
          });
        } else if (docType === 'receipt') {
          rows.push(['Description', 'Quantity', 'Price', 'Total']);
          items.forEach(item => {
            rows.push([item.description || '', item.quantity || '', item.price || '', item.total || '']);
          });
        } else {
          rows.push(['Description', 'SKU', 'Qty', 'Unit Price', 'Tax', 'Total']);
          items.forEach(item => {
            rows.push([item.description || '', item.sku || '', item.quantity || '', item.unit_price || '', item.tax_amount || '', item.total || '']);
          });
        }
      }

      const csvContent = rows
        .map(row => row.map(csvEscape).join(','))
        .join('\n');

      downloadFile(
        csvContent,
        `precifio-extract-${extraction.document_type || 'document'}-${extraction.invoice_number || extraction.receipt_number || extraction.bill_number || extraction.po_number || 'doc'}.csv`,
        'text/csv'
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      {/* Processing Method Badge */}
      <div style={{ 
        display: 'inline-block', 
        padding: '4px 12px', 
        borderRadius: '12px',
        background: '#dbeafe',
        color: '#1e40af',
        fontSize: '12px',
        fontWeight: 600,
        marginBottom: '16px'
      }}>
        🔒 Secured by Precifio AI Engine
        {processingMethod ? ` • ${processingMethod}` : ''}
      </div>

      {/* Status Banner */}
      <div style={{
        padding: '16px',
        borderRadius: '8px',
        background: needsReview ? '#fef3c7' : '#dcfce7',
        marginBottom: '24px',
        border: `1px solid ${needsReview ? '#f59e0b' : '#22c55e'}`
      }}>
        <h3 style={{ margin: 0, color: needsReview ? '#92400e' : '#166534' }}>
          {needsReview ? '⚠️ Review Required' : '✅ Auto-Approved'}
        </h3>
        {validation?.flags?.length > 0 && (
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            {validation?.flags?.map((flag, i) => (
              <li key={i} style={{ color: '#92400e', fontSize: '14px' }}>
                <strong>{flag.type}:</strong> {flag.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Document Info */}
      {fields.core && fields.core.length > 0 && (
        <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Document Information</h4>
          {fields.core.includes('document_type') && <Field label="Type" value={extraction.document_type} />}
          {fields.core.includes('category') && <Field label="Category" value={extraction.category} />}
          {fields.core.includes('invoice_number') && <Field label="Invoice #" value={extraction.invoice_number} score={topLevelConfidence?.breakdown?.invoice_number} />}
          {fields.core.includes('receipt_number') && <Field label="Receipt #" value={extraction.receipt_number} />}
          {fields.core.includes('po_number') && <Field label="PO Number" value={extraction.po_number} />}
          {fields.core.includes('bill_number') && <Field label="Bill #" value={extraction.bill_number} />}
          {fields.core.includes('account_number') && <Field label="Account #" value={extraction.account_number} />}
        </div>
      )}

      {/* Parties */}
      {fields.parties && fields.parties.length > 0 && (
        <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Parties</h4>
          {fields.parties.includes('vendor_name') && <Field label="Vendor" value={extraction.vendor_name} score={topLevelConfidence?.breakdown?.vendor_name} />}
          {fields.parties.includes('vendor_address') && <Field label="Vendor Address" value={extraction.vendor_address} />}
          {fields.parties.includes('vendor_tax_id') && <Field label="Vendor Tax ID" value={extraction.vendor_tax_id} />}
          {fields.parties.includes('buyer_name') && <Field label="Buyer" value={extraction.buyer_name} />}
          {fields.parties.includes('buyer_address') && <Field label="Buyer Address" value={extraction.buyer_address} />}
          {fields.parties.includes('buyer_tax_id') && <Field label="Buyer Tax ID" value={extraction.buyer_tax_id} />}
          {fields.parties.includes('ship_to') && <Field label="Ship To" value={extraction.ship_to} />}
        </div>
      )}

      {/* Dates */}
      {fields.dates && fields.dates.length > 0 && (
        <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Dates</h4>
          {fields.dates.includes('date') && <Field label="Date" value={fmtDate(extraction.date)} />}
          {fields.dates.includes('invoice_date') && <Field label="Invoice Date" value={fmtDate(extraction.invoice_date)} />}
          {fields.dates.includes('due_date') && <Field label="Due Date" value={fmtDate(extraction.due_date)} />}
          {fields.dates.includes('payment_date') && <Field label="Payment Date" value={fmtDate(extraction.payment_date)} />}
          {fields.dates.includes('order_date') && <Field label="Order Date" value={fmtDate(extraction.order_date)} />}
          {fields.dates.includes('delivery_date') && <Field label="Delivery Date" value={fmtDate(extraction.delivery_date)} />}
        </div>
      )}

      {/* Financial Summary */}
      {fields.financial && fields.financial.length > 0 && (
        <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Financial Summary</h4>
          {fields.financial.includes('currency') && <Field label="Currency" value={extraction.currency} />}
          {fields.financial.includes('subtotal') && <Field label="Subtotal" value={fmtMoney(extraction.subtotal, extraction.currency)} />}
          {fields.financial.includes('tax_amount') && <Field label="Tax" value={fmtMoney(extraction.tax_amount, extraction.currency)} />}
          {extraction.tax_details?.length > 0 && extraction.tax_details.map((tax, i) => (
            <div key={i} style={{ paddingLeft: '20px', fontSize: '13px', color: '#6b7280' }}>
              {tax.type}: {tax.rate ? `${tax.rate}%` : 'N/A'} = {fmtMoney(tax.amount, extraction.currency)}
            </div>
          ))}
          {fields.financial.includes('discount_amount') && <Field label="Discount" value={fmtMoney(extraction.discount_amount, extraction.currency)} />}
          {fields.financial.includes('shipping_amount') && <Field label="Shipping" value={fmtMoney(extraction.shipping_amount, extraction.currency)} />}
          {fields.financial.includes('total_amount') && <Field label="Total" value={fmtMoney(extraction.total_amount, extraction.currency)} score={topLevelConfidence?.breakdown?.total_amount} />}
          {fields.financial.includes('amount_due') && <Field label="Amount Due" value={fmtMoney(extraction.amount_due, extraction.currency)} />}
          {fields.financial.includes('amount_paid') && <Field label="Amount Paid" value={fmtMoney(extraction.amount_paid, extraction.currency)} />}
          {fields.financial.includes('opening_balance') && <Field label="Opening Balance" value={fmtMoney(extraction.opening_balance, extraction.currency)} />}
          {fields.financial.includes('closing_balance') && <Field label="Closing Balance" value={fmtMoney(extraction.closing_balance, extraction.currency)} />}
          {fields.financial.includes('previous_balance') && <Field label="Previous Balance" value={fmtMoney(extraction.previous_balance, extraction.currency)} />}
          {fields.financial.includes('current_charges') && <Field label="Current Charges" value={fmtMoney(extraction.current_charges, extraction.currency)} />}
          {fields.financial.includes('usage_amount') && <Field label="Usage Amount" value={typeof extraction.usage_amount === 'number' ? extraction.usage_amount : extraction.usage_amount || '—'} />}
          {fields.financial.includes('change_given') && <Field label="Change Given" value={fmtMoney(extraction.change_given, extraction.currency)} />}
        </div>
      )}

      {/* Payment Info */}
      {fields.payment && fields.payment.length > 0 && (
        <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Payment</h4>
          {fields.payment.includes('payment_status') && <Field label="Status" value={extraction.payment_status} />}
          {fields.payment.includes('payment_method') && <Field label="Method" value={extraction.payment_method} />}
          {fields.payment.includes('payment_terms') && <Field label="Terms" value={extraction.payment_terms} />}
        </div>
      )}

      {/* Items / Transactions / Line Items */}
      {fields.items && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>
            {docType === 'bank-statement' ? 'Transactions' : docType === 'receipt' ? 'Items' : 'Line Items'} 
            ({(extraction[fields.items] || []).length})
            <ConfidenceBadge score={topLevelConfidence?.breakdown?.[fields.items]} />
          </h4>
          
          {/* Bank Statement Transactions */}
          {docType === 'bank-statement' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', background: '#f9fafb' }}>
                  <th style={{ padding: '8px' }}>Date</th>
                  <th style={{ padding: '8px' }}>Description</th>
                  <th style={{ padding: '8px' }}>Debit</th>
                  <th style={{ padding: '8px' }}>Credit</th>
                  <th style={{ padding: '8px' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {extraction.transactions?.length ? (
                  extraction.transactions.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px' }}>{item.date || '—'}</td>
                      <td style={{ padding: '8px' }}>{item.description || '—'}</td>
                      <td style={{ padding: '8px' }}>{fmt(item.debit)}</td>
                      <td style={{ padding: '8px' }}>{fmt(item.credit)}</td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{fmt(item.balance)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#9ca3af', padding: '16px' }}>
                      No transactions extracted
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Receipt Items */}
          {docType === 'receipt' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', background: '#f9fafb' }}>
                  <th style={{ padding: '8px' }}>Description</th>
                  <th style={{ padding: '8px' }}>Qty</th>
                  <th style={{ padding: '8px' }}>Price</th>
                  <th style={{ padding: '8px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {extraction.items?.length ? (
                  extraction.items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px' }}>{item.description || '—'}</td>
                      <td style={{ padding: '8px' }}>{fmt(item.quantity)}</td>
                      <td style={{ padding: '8px' }}>{fmtMoney(item.price, extraction.currency)}</td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{fmtMoney(item.total, extraction.currency)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#9ca3af', padding: '16px' }}>
                      No items extracted
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Invoice / Purchase Order Line Items */}
          {docType !== 'bank-statement' && docType !== 'receipt' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', background: '#f9fafb' }}>
                  <th style={{ padding: '8px' }}>Description</th>
                  <th style={{ padding: '8px' }}>SKU</th>
                  <th style={{ padding: '8px' }}>Qty</th>
                  <th style={{ padding: '8px' }}>Price</th>
                  <th style={{ padding: '8px' }}>Tax</th>
                  <th style={{ padding: '8px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {extraction.line_items?.length ? (
                  extraction.line_items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px' }}>{item.description || '—'}</td>
                      <td style={{ padding: '8px' }}>{item.sku || '—'}</td>
                      <td style={{ padding: '8px' }}>{fmt(item.quantity)}</td>
                      <td style={{ padding: '8px' }}>{fmtMoney(item.unit_price, extraction.currency)}</td>
                      <td style={{ padding: '8px' }}>{fmtMoney(item.tax_amount, extraction.currency)}</td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{fmtMoney(item.total, extraction.currency)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af', padding: '16px' }}>
                      No line items extracted
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Notes */}
      {extraction.notes && (
        <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '6px', marginBottom: '24px' }}>
          <strong>Notes:</strong> {extraction.notes}
        </div>
      )}

      {/* Export Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
        <button
          onClick={() => handleExport('csv')}
          disabled={exporting || !data.extractionId}
          style={{
            ...exportButtonStyle,
            background: data.extractionId ? '#1e40af' : '#9ca3af',
            color: '#fff',
            border: 'none',
            cursor: data.extractionId ? 'pointer' : 'not-allowed'
          }}
          title={data.extractionId ? '' : 'Server export unavailable for batch results'}
        >
          📊 {exporting ? 'Exporting...' : 'Export to Excel'}
        </button>

        <button
          onClick={() => handleExport('csv')}
          disabled={exporting}
          style={exportButtonStyle}
        >
          📄 Export to CSV
        </button>

        <button
          onClick={() => handleExport('quickbooks')}
          style={exportButtonStyle}
        >
          🔗 QuickBooks
        </button>

        <button
          onClick={() => handleExport('xero')}
          style={exportButtonStyle}
        >
          🔗 Xero
        </button>
      </div>

      <div style={{
        textAlign: 'center',
        marginTop: '32px',
        padding: '16px',
        borderTop: '1px solid #e5e7eb',
        color: '#9ca3af',
        fontSize: '12px'
      }}>
        🔒 Secured by Precifio AI Engine • Enterprise-grade document intelligence
      </div>
    </div>
  );
}

function Field({ label, value, score }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '10px 12px', 
      background: '#f9fafb', 
      borderRadius: '6px' 
    }}>
      <div>
        <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 500 }}>
          {label}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '2px', color: value === '—' ? '#9ca3af' : '#111827' }}>
          {value}
        </div>
      </div>
      {score != null && <ConfidenceBadge score={score} />}
    </div>
  );
}

const exportButtonStyle = {
  padding: '10px 20px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500
};
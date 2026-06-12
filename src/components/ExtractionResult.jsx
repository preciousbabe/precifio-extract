import { useState } from 'react';
import { ConfidenceBadge } from './ConfidenceBadge';

export function ExtractionResult({ data }) {
  const { extraction, validation, status, processingMethod } = data;
  const needsReview = status === 'REVIEW_REQUIRED';
  const [exporting, setExporting] = useState(false);

  const fmt = (val) => val != null ? val.toLocaleString() : '—';
  const fmtMoney = (val, currency = 'USD') => 
    val != null ? `${currency} ${val.toLocaleString()}` : '—';
  const fmtDate = (val) => val || '—';

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

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const handleExport = async (format) => { 
  if (!data.extractionId) {
    // fallback to client-side CSV
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
    const filename =
      disposition?.split('filename=')[1]?.replace(/"/g, '') ||
      `export.${format}`;

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

    const rows = [
      ['Field', 'Value'],
      ['Document Type', extraction.document_type || ''],
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

    rows.push([]);
    rows.push(['Line Items']);
    rows.push(['Description', 'Quantity', 'Unit Price', 'Total']);

    extraction.line_items?.forEach(item => {
      rows.push([
        item.description || '',
        item.quantity || '',
        item.unit_price || '',
        item.total || ''
      ]);
    });

    const csvContent = rows
      .map(row => row.map(csvEscape).join(','))
      .join('\n');

    downloadFile(
      csvContent,
      `precifio-extract-${extraction.invoice_number || 'document'}.csv`,
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
     {processingMethod && ` • ${processingMethod}`}
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
        {validation.flags.length > 0 && (
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            {validation.flags.map((flag, i) => (
              <li key={i} style={{ color: '#92400e', fontSize: '14px' }}>
                <strong>{flag.type}:</strong> {flag.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Document Info */}
      <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Document Information</h4>
        <Field label="Type" value={extraction.document_type} />
        <Field label="Category" value={extraction.category} />
        <Field label="Invoice #" value={extraction.invoice_number} score={extraction.confidence_scores?.invoice_number} />
        <Field label="PO Number" value={extraction.po_number} />
      </div>

      {/* Parties */}
      <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Parties</h4>
        <Field label="Vendor" value={extraction.vendor_name} score={extraction.confidence_scores?.vendor_name} />
        <Field label="Vendor Address" value={extraction.vendor_address} />
        <Field label="Vendor Tax ID" value={extraction.vendor_tax_id} />
        <Field label="Buyer" value={extraction.buyer_name} />
        <Field label="Buyer Address" value={extraction.buyer_address} />
        <Field label="Buyer Tax ID" value={extraction.buyer_tax_id} />
      </div>

      {/* Dates */}
      <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Dates</h4>
        <Field label="Invoice Date" value={fmtDate(extraction.invoice_date)} />
        <Field label="Due Date" value={fmtDate(extraction.due_date)} />
        <Field label="Payment Date" value={fmtDate(extraction.payment_date)} />
      </div>

      {/* Financial Summary */}
      <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Financial Summary</h4>
        <Field label="Currency" value={extraction.currency} />
        <Field label="Subtotal" value={fmtMoney(extraction.subtotal, extraction.currency)} />
        <Field label="Tax" value={fmtMoney(extraction.tax_amount, extraction.currency)} />
        {extraction.tax_details?.map((tax, i) => (
          <div key={i} style={{ paddingLeft: '20px', fontSize: '13px', color: '#6b7280' }}>
            {tax.type}: {tax.rate ? `${tax.rate}%` : 'N/A'} = {fmtMoney(tax.amount, extraction.currency)}
          </div>
        ))}
        <Field label="Discount" value={fmtMoney(extraction.discount_amount, extraction.currency)} />
        <Field label="Shipping" value={fmtMoney(extraction.shipping_amount, extraction.currency)} />
        <Field label="Total" value={fmtMoney(extraction.total_amount, extraction.currency)} score={extraction.confidence_scores?.total_amount} />
        <Field label="Amount Due" value={fmtMoney(extraction.amount_due, extraction.currency)} />
        <Field label="Amount Paid" value={fmtMoney(extraction.amount_paid, extraction.currency)} />
      </div>

      {/* Payment Info */}
      <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Payment</h4>
        <Field label="Status" value={extraction.payment_status} />
        <Field label="Method" value={extraction.payment_method} />
        <Field label="Terms" value={extraction.payment_terms} />
      </div>

      {/* Line Items */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>
          Line Items ({extraction.line_items?.length || 0})
          <ConfidenceBadge score={extraction.confidence_scores?.line_items} />
        </h4>
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
    <td
      colSpan="6"
      style={{
        textAlign: 'center',
        color: '#9ca3af',
        padding: '16px'
      }}
    >
      No line items extracted
    </td>
  </tr>
)}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {extraction.notes && (
        <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '6px', marginBottom: '24px' }}>
          <strong>Notes:</strong> {extraction.notes}
        </div>
      )}

      {/* Export Buttons (Phase 2) */}
      <div
  style={{
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
    flexWrap: 'wrap'
  }}
>
  <button
    onClick={() => handleExport('csv')}
    disabled={exporting}
    style={{
      ...exportButtonStyle,
      background: '#1e40af',
      color: '#fff',
      border: 'none'
    }}
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

<div
  style={{
    textAlign: 'center',
    marginTop: '32px',
    padding: '16px',
    borderTop: '1px solid #e5e7eb',
    color: '#9ca3af',
    fontSize: '12px'
  }}
>
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


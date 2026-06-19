import { useState, useEffect } from 'react';

export function DocumentSidePanel({ doc, onClose, onRetry, onDelete, onSave, retryingId }) {
  const extraction = doc.extractions?.[0];
  const [data, setData] = useState(extraction?.extracted_data || {});
  const [isEditing, setIsEditing] = useState(doc.mode === 'edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setData(extraction?.extracted_data || {});
    setIsEditing(doc.mode === 'edit');
  }, [doc]);

  const handleChange = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent, index, field, value) => {
    setData(prev => {
      const arr = [...(prev[parent] || [])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, [parent]: arr };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(doc.id, data);
    setSaving(false);
    setIsEditing(false);
  };

  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'number') return val.toLocaleString();
    return String(val);
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.85) return '#16a34a';
    if (score >= 0.65) return '#ca8a04';
    return '#dc2626';
  };

  const confidence = extraction?.confidence_scores || {};
  const flags = extraction?.validation_flags || {};
  const docType = data.document_type || 'unknown';

  // Group fields by relevance to document type
  const fieldGroups = {
    'Document Information': ['document_type', 'category'],
    'Parties': [],
    'Dates': [],
    'Financial Summary': [],
    'Payment': [],
    'Line Items': [],
    'Transactions': [],
    'Other': []
  };

  // Dynamic field mapping based on doc type
  const getRelevantFields = () => {
    const common = ['vendor_name', 'vendor_address', 'vendor_tax_id', 'vendor_email', 'vendor_phone', 'date', 'currency', 'total_amount', 'notes', 'category'];

    const typeSpecific = {
      invoice: ['invoice_number', 'buyer_name', 'buyer_address', 'buyer_tax_id', 'buyer_email', 'invoice_date', 'due_date', 'payment_date', 'subtotal', 'tax_amount', 'shipping_amount', 'discount_amount', 'amount_due', 'amount_paid', 'payment_status', 'payment_method', 'payment_terms', 'line_items'],
      receipt: ['receipt_number', 'payment_method', 'items', 'tax_amount', 'change_given'],
      'bank-statement': ['account_number', 'opening_balance', 'closing_balance', 'transactions'],
      'utility-bill': ['bill_number', 'account_number', 'usage_amount', 'due_date', 'amount_due', 'previous_balance', 'current_charges'],
      'purchase-order': ['po_number', 'buyer_name', 'ship_to', 'order_date', 'delivery_date', 'subtotal', 'tax_amount', 'line_items'],
      unknown: []
    };

    return [...common, ...(typeSpecific[docType] || [])];
  };

  const relevantFields = getRelevantFields();

  // Only show fields that have values OR are in edit mode
  const visibleFields = relevantFields.filter(field => {
    if (isEditing) return true;
    const val = data[field];
    return val !== null && val !== undefined && val !== '' && 
           !(Array.isArray(val) && val.length === 0) &&
           !(typeof val === 'object' && Object.keys(val).length === 0);
  });

  const renderField = (field, label) => {
    const value = data[field];
    const fieldConfidence = confidence?.breakdown?.[field];
    const hasFlag = flags?.flags?.some(f => f.field === field);

    // Skip arrays/objects here, handle separately
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return null;

    return (
      <div key={field} style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid #f3f4f6'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize', marginBottom: '2px' }}>
            {label || field.replace(/_/g, ' ')}
            {hasFlag && <span style={{ color: '#dc2626', marginLeft: '4px' }}>⚠️</span>}
          </div>
          {isEditing ? (
            <input
              type="text"
              value={value ?? ''}
              onChange={(e) => handleChange(field, e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
            />
          ) : (
            <div style={{ fontSize: '14px', color: '#111827', fontWeight: 500 }}>
              {formatValue(value)}
            </div>
          )}
        </div>
        {fieldConfidence !== undefined && !isEditing && (
          <div style={{ 
            marginLeft: '12px',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            background: `${getConfidenceColor(fieldConfidence)}15`,
            color: getConfidenceColor(fieldConfidence)
          }}>
            {Math.round(fieldConfidence * 100)}%
          </div>
        )}
      </div>
    );
  };

  const renderLineItems = () => {
    const items = data.line_items || data.items || [];
    if (!items.length) return null;

    const isInvoice = docType === 'invoice' || docType === 'purchase-order';
    const label = isInvoice ? 'Line Items' : 'Items';

    return (
      <div style={{ marginTop: '16px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 8px', textTransform: 'uppercase' }}>{label}</h4>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Description</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>Qty</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Price</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px' }}>
                    {isEditing ? (
                      <input
                        value={item.description || ''}
                        onChange={(e) => handleNestedChange(isInvoice ? 'line_items' : 'items', i, 'description', e.target.value)}
                        style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                      />
                    ) : (
                      item.description || '—'
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.quantity || 1}
                        onChange={(e) => handleNestedChange(isInvoice ? 'line_items' : 'items', i, 'quantity', Number(e.target.value))}
                        style={{ width: '60px', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', textAlign: 'center' }}
                      />
                    ) : (
                      item.quantity || 1
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.unit_price || item.price || ''}
                        onChange={(e) => handleNestedChange(isInvoice ? 'line_items' : 'items', i, isInvoice ? 'unit_price' : 'price', Number(e.target.value))}
                        style={{ width: '80px', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }}
                      />
                    ) : (
                      formatValue(item.unit_price || item.price)
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>
                    {formatValue(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTransactions = () => {
    const txns = data.transactions || [];
    if (!txns.length || docType !== 'bank-statement') return null;

    return (
      <div style={{ marginTop: '16px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 8px', textTransform: 'uppercase' }}>Transactions</h4>
        <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Date</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Description</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Debit</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Credit</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>{t.date || '—'}</td>
                  <td style={{ padding: '6px 12px' }}>{t.description || '—'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#dc2626' }}>{t.debit > 0 ? t.debit.toLocaleString() : '—'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#16a34a' }}>{t.credit > 0 ? t.credit.toLocaleString() : '—'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 500 }}>{t.balance?.toLocaleString() || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderFlags = () => {
    if (!flags?.flags?.length) return null;

    return (
      <div style={{ 
        marginBottom: '16px', 
        padding: '12px', 
        background: '#fef3c7', 
        borderRadius: '8px',
        border: '1px solid #fde68a'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', marginBottom: '6px' }}>
          ⚠️ Review Required
        </div>
        {flags.flags.map((flag, i) => (
          <div key={i} style={{ fontSize: '12px', color: '#92400e', marginBottom: '2px' }}>
            {flag.type}: {flag.message}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '480px',
      maxWidth: '100vw',
      height: '100vh',
      background: '#fff',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
            {isEditing ? 'Edit Extraction' : 'Document Details'}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>{doc.file_name}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {doc.status === 'failed' && (
            <button 
              onClick={() => onRetry(doc)}
              disabled={retryingId === doc.id}
              style={{ padding: '6px 12px', background: '#1e40af', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: retryingId === doc.id ? 'not-allowed' : 'pointer' }}
            >
              {retryingId === doc.id ? 'Retrying...' : 'Retry'}
            </button>
          )}
          {!isEditing && doc.status !== 'failed' && (
            <button 
              onClick={() => setIsEditing(true)}
              style={{ padding: '6px 12px', background: '#f59e0b', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}
            >
              ✏️ Edit
            </button>
          )}
          {isEditing && (
            <button 
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '6px 12px', background: '#10b981', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving...' : '💾 Save'}
            </button>
          )}
          <button 
            onClick={onClose}
            style={{ 
              padding: '6px', 
              background: 'none', 
              border: 'none', 
              fontSize: '20px', 
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {/* Overall confidence */}
        {confidence?.overall !== undefined && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '16px',
            padding: '10px 12px',
            background: '#f9fafb',
            borderRadius: '8px'
          }}>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>Confidence:</span>
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 700, 
              color: getConfidenceColor(confidence.overall) 
            }}>
              {confidence.status} ({Math.round(confidence.overall * 100)}%)
            </span>
          </div>
        )}

        {/* Validation flags */}
        {renderFlags()}

        {/* Document type badge */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{ 
            padding: '4px 12px', 
            background: '#dbeafe', 
            color: '#1e40af', 
            borderRadius: '9999px', 
            fontSize: '12px', 
            fontWeight: 600,
            textTransform: 'capitalize'
          }}>
            {docType}
          </span>
          {data.category && data.category !== 'Uncategorized' && (
            <span style={{ 
              marginLeft: '8px',
              padding: '4px 12px', 
              background: '#dcfce7', 
              color: '#166534', 
              borderRadius: '9999px', 
              fontSize: '12px', 
              fontWeight: 600
            }}>
              {data.category}
            </span>
          )}
        </div>

        {/* Fields */}
        <div>
          {visibleFields.map(field => renderField(field))}
        </div>

        {/* Line Items */}
        {renderLineItems()}

        {/* Transactions */}
        {renderTransactions()}
      </div>

      {/* Footer */}
      <div style={{ 
        padding: '12px 20px', 
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button 
          onClick={() => {
            if (confirm('Delete this document? This cannot be undone.')) {
              onDelete(doc.id);
            }
          }}
          style={{ 
            padding: '8px 16px', 
            background: '#fee2e2', 
            color: '#991b1b', 
            border: 'none', 
            borderRadius: '6px', 
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          🗑️ Delete
        </button>
        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
          Processed {new Date(doc.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../config/supabase.js';
import { createClient } from '@supabase/supabase-js';
import { DocumentSidePanel } from './DocumentSidePanel.jsx';

const API_BASE = '/.netlify/functions';

export function DocumentList({ userId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(null);
  const downloadMenuRef = useRef(null);

  const getSupabaseWithAuth = () => {
    const stored = localStorage.getItem('precifio_session');
    if (!stored) return supabase;
    try {
      const parsed = JSON.parse(stored);
      return createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${parsed.access_token}` } } }
      );
    } catch { return supabase; }
  };

  useEffect(() => { if (userId) fetchDocuments(); }, [userId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target)) {
        setShowDownloadMenu(null);
      }
    };
    if (showDownloadMenu !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDownloadMenu]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const client = getSupabaseWithAuth();
      const { data, error: docError } = await client
        .from('documents')
        .select(`*, extractions (id, extracted_data, validation_flags, confidence_scores, created_at)`)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (docError) throw docError;
      setDocuments(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (doc) => {
    setRetryingId(doc.id);
    try {
      const response = await fetch(`${API_BASE}/retry-extraction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('precifio_session') || '{}').access_token}`
        },
        body: JSON.stringify({ documentId: doc.id })
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Retry failed');
      await fetchDocuments();
    } catch (err) {
      alert('Failed to retry: ' + err.message);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (docId) => {
    const client = getSupabaseWithAuth();
    const { error } = await client.from('documents').delete().eq('id', docId);
    if (error) {
      alert('Delete failed: ' + error.message);
      return;
    }
    setSelectedDoc(null);
    await fetchDocuments();
  };

  const handleSaveEdit = async (docId, updatedData) => {
    const client = getSupabaseWithAuth();
    try {
      const { error } = await client
        .from('extractions')
        .update({
          extracted_data: updatedData,
          validation_flags: { isValid: true, flags: [], requiresReview: false },
          updated_at: new Date().toISOString()
        })
        .eq('document_id', docId);

      if (error) throw error;

      // Also update document status to completed
      await client
        .from('documents')
        .update({ status: 'completed' })
        .eq('id', docId);

      await fetchDocuments();
      setSelectedDoc(null);
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  };

  // Export functions
  const exportToCSV = (doc, data) => {
    const rows = [];
    const addRow = (label, value) => rows.push(`${label},${value ?? ''}`);

    addRow('Document Type', data.document_type);
    addRow('Vendor', data.vendor_name);
    addRow('Date', data.date);
    addRow('Currency', data.currency);
    addRow('Total', data.total_amount);
    addRow('Category', data.category);

    if (data.document_type === 'invoice') {
      addRow('Invoice #', data.invoice_number);
      addRow('Buyer', data.buyer_name);
      addRow('Due Date', data.due_date);
      addRow('Subtotal', data.subtotal);
      addRow('Tax', data.tax_amount);
      addRow('Amount Due', data.amount_due);
      addRow('Payment Status', data.payment_status);
      (data.line_items || []).forEach((item, i) => {
        addRow(`Item ${i+1} Description`, item.description);
        addRow(`Item ${i+1} Qty`, item.quantity);
        addRow(`Item ${i+1} Price`, item.unit_price);
        addRow(`Item ${i+1} Total`, item.total);
      });
    }

    if (data.document_type === 'receipt') {
      addRow('Receipt #', data.receipt_number);
      addRow('Payment Method', data.payment_method);
      (data.items || []).forEach((item, i) => {
        addRow(`Item ${i+1} Description`, item.description);
        addRow(`Item ${i+1} Qty`, item.quantity);
        addRow(`Item ${i+1} Price`, item.price);
        addRow(`Item ${i+1} Total`, item.total);
      });
    }

    if (data.document_type === 'bank-statement') {
      addRow('Account #', data.account_number);
      addRow('Opening Balance', data.opening_balance);
      addRow('Closing Balance', data.closing_balance);
      (data.transactions || []).forEach((t, i) => {
        addRow(`Txn ${i+1} Date`, t.date);
        addRow(`Txn ${i+1} Description`, t.description);
        addRow(`Txn ${i+1} Debit`, t.debit);
        addRow(`Txn ${i+1} Credit`, t.credit);
        addRow(`Txn ${i+1} Balance`, t.balance);
      });
    }

    if (data.document_type === 'utility-bill') {
      addRow('Bill #', data.bill_number);
      addRow('Account #', data.account_number);
      addRow('Usage', data.usage_amount);
      addRow('Amount Due', data.amount_due);
      addRow('Previous Balance', data.previous_balance);
      addRow('Current Charges', data.current_charges);
    }

    if (data.document_type === 'purchase-order') {
      addRow('PO #', data.po_number);
      addRow('Buyer', data.buyer_name);
      addRow('Ship To', data.ship_to);
      addRow('Order Date', data.order_date);
      addRow('Delivery Date', data.delivery_date);
      (data.line_items || []).forEach((item, i) => {
        addRow(`Item ${i+1} Description`, item.description);
        addRow(`Item ${i+1} Qty`, item.quantity);
        addRow(`Item ${i+1} Price`, item.unit_price);
        addRow(`Item ${i+1} Total`, item.total);
      });
    }

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.file_name.replace(/\.[^/.]+$/, '')}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadMenu(null);
  };

  const exportToExcel = (doc, data) => {
    // For now, export as CSV with .xlsx extension (or use a library like xlsx)
    // If you have the xlsx library installed, use that instead
    exportToCSV(doc, data); // Fallback — replace with xlsx library if available
  };

  const exportToQuickBooks = (doc, data) => {
    // QuickBooks IIF format
    const iif = generateIIF(data);
    const blob = new Blob([iif], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.file_name.replace(/\.[^/.]+$/, '')}_quickbooks.iif`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadMenu(null);
  };

  const exportToXero = (doc, data) => {
    // Xero CSV format
    const rows = [];
    rows.push('ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,AccountCode,TaxType,TrackingName1,TrackingOption1');

    if (data.document_type === 'invoice') {
      (data.line_items || []).forEach(item => {
        rows.push(`${data.buyer_name || data.vendor_name || ''},${data.invoice_number || ''},${data.invoice_date || ''},${data.due_date || ''},${item.description || ''},${item.quantity || 1},${item.unit_price || item.total || 0},200,Sales,`);
      });
    } else {
      rows.push(`${data.vendor_name || ''},,${data.date || ''},,${data.document_type || ''},1,${data.total_amount || 0},200,`);
    }

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.file_name.replace(/\.[^/.]+$/, '')}_xero.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadMenu(null);
  };

  const generateIIF = (data) => {
    let iif = '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
    iif += '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
    iif += '!ENDTRNS\t\t\t\t\t\t\n';

    if (data.document_type === 'invoice') {
      iif += `TRNS\t\tBILL\t${data.invoice_date || ''}\tAccounts Payable\t${data.vendor_name || ''}\t${data.total_amount || 0}\t${data.invoice_number || ''}\n`;
      (data.line_items || []).forEach(item => {
        iif += `SPL\t\tBILL\t${data.invoice_date || ''}\tExpenses\t${item.description || ''}\t${item.total || 0}\t\n`;
      });
      iif += 'ENDTRNS\n';
    } else {
      iif += `TRNS\t\tBILL\t${data.date || ''}\tAccounts Payable\t${data.vendor_name || ''}\t${data.total_amount || 0}\t${data.document_type || ''}\n`;
      iif += `SPL\t\tBILL\t${data.date || ''}\tExpenses\t${data.document_type || ''}\t${data.total_amount || 0}\t\n`;
      iif += 'ENDTRNS\n';
    }

    return iif;
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
      review_required: { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
      processing: { background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' },
      failed: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }
    };
    const style = styles[status] || styles.processing;
    return <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500, textTransform: 'capitalize', ...style }}>{status ? status.replace(/_/g, ' ') : 'Unknown'}</span>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try { return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return '-'; }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '-';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
  };

  const getDocTypeIcon = (fileType) => {
    if (fileType?.includes('pdf')) return '📄';
    if (fileType?.includes('word') || fileType?.includes('docx')) return '📝';
    if (fileType?.includes('sheet') || fileType?.includes('xls')) return '📊';
    if (fileType?.includes('image') || fileType?.includes('png') || fileType?.includes('jpg') || fileType?.includes('jpeg')) return '🖼️';
    return '📄';
  };

  const getDocTypeBg = (fileType) => {
    if (fileType?.includes('pdf')) return '#fee2e2';
    if (fileType?.includes('word') || fileType?.includes('docx')) return '#dbeafe';
    if (fileType?.includes('sheet') || fileType?.includes('xls')) return '#dcfce7';
    return '#dbeafe';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#6b7280' }}>Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px', background: '#fee2e2', borderRadius: '8px', color: '#991b1b' }}>
        <strong>Error:</strong> {error}
        <button onClick={fetchDocuments} style={{ marginLeft: '12px', padding: '4px 12px', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '12px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
        <h3 style={{ margin: '0 0 8px', color: '#374151' }}>No documents yet</h3>
        <p style={{ color: '#6b7280', margin: '0 0 20px' }}>Upload your first document to see it here.</p>
        <a href="#upload" style={{ display: 'inline-block', padding: '10px 20px', background: '#1e40af', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontWeight: 500 }}>Upload Document</a>
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total', value: documents.length },
          { label: 'Completed', value: documents.filter(d => d.status === 'completed').length },
          { label: 'Review', value: documents.filter(d => d.status === 'review_required').length },
          { label: 'Failed', value: documents.filter(d => d.status === 'failed').length }
        ].map((stat, i) => (
          <div key={i} style={{ background: '#fff', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af' }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Document</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Amount</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const extraction = doc.extractions?.[0];
                const extractedData = extraction?.extracted_data || {};
                const docType = extractedData.document_type || doc.document_type || 'unknown';

                // Get amount based on document type
                let amount = null;
                if (docType === 'bank-statement') {
                  amount = extractedData.closing_balance;
                } else if (docType === 'utility-bill') {
                  amount = extractedData.amount_due ?? extractedData.total_amount;
                } else {
                  amount = extractedData.total_amount || extractedData.amount_due;
                }
                const currency = extractedData.currency || 'USD';

                return (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: getDocTypeBg(doc.file_type), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                          {getDocTypeIcon(doc.file_type)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: '#111827', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{doc.file_name}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {formatFileSize(doc.file_size)} {doc.page_count > 1 && `• ${doc.page_count} pages`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '2px 8px', background: '#f3f4f6', borderRadius: '4px', fontSize: '12px', color: '#4b5563', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                        {docType}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>{getStatusBadge(doc.status)}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 500, color: '#111827', fontSize: '14px', whiteSpace: 'nowrap' }}>
                      {amount != null ? `${currency} ${Number(amount).toLocaleString()}` : '-'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDate(doc.created_at)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', position: 'relative', flexWrap: 'wrap' }}>

                        {doc.status === 'failed' && (
                          <button onClick={() => handleRetry(doc)} disabled={retryingId === doc.id}
                            style={{ padding: '6px 12px', background: '#1e40af', border: 'none', borderRadius: '6px', cursor: retryingId === doc.id ? 'not-allowed' : 'pointer', fontSize: '13px', color: '#fff', opacity: retryingId === doc.id ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                            {retryingId === doc.id ? '...' : 'Retry'}
                          </button>
                        )}

                        {/* Edit button for review_required docs */}
                        {doc.status === 'review_required' && (
                          <button onClick={() => setSelectedDoc({ ...doc, mode: 'edit' })}
                            style={{ padding: '6px 12px', background: '#f59e0b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#fff', whiteSpace: 'nowrap' }}>
                            ✏️ Edit
                          </button>
                        )}

                        {/* Export dropdown for completed or review_required docs */}
                        {(doc.status === 'completed' || doc.status === 'review_required') && extraction?.extracted_data && (
                          <div style={{ position: 'relative' }} ref={doc.id === showDownloadMenu ? downloadMenuRef : null}>
                            <button onClick={() => setShowDownloadMenu(showDownloadMenu === doc.id ? null : doc.id)}
                              style={{ padding: '6px 12px', background: '#10b981', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#fff', whiteSpace: 'nowrap' }}>
                              ⬇️ Export
                            </button>

                            {showDownloadMenu === doc.id && (
                              <div style={{
                                position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                                background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, minWidth: '180px',
                                padding: '4px 0'
                              }}>
                                {[
                                  { label: '📊 Excel', fn: () => exportToExcel(doc, extractedData) },
                                  { label: '📄 CSV', fn: () => exportToCSV(doc, extractedData) },
                                  { label: '🔗 QuickBooks', fn: () => exportToQuickBooks(doc, extractedData) },
                                  { label: '🔗 Xero', fn: () => exportToXero(doc, extractedData) },
                                ].map((opt, i) => (
                                  <button key={i} onClick={opt.fn} style={{
                                    display: 'block', width: '100%', padding: '8px 16px', textAlign: 'left',
                                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px',
                                    color: '#374151'
                                  }} onMouseEnter={e => e.target.style.background = '#f3f4f6'} onMouseLeave={e => e.target.style.background = 'none'}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <button onClick={() => { setSelectedDoc({ ...doc, mode: 'view' }); setShowDownloadMenu(null); }}
                          style={{ padding: '6px 12px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Panel */}
      {selectedDoc && (
        <DocumentSidePanel
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onRetry={handleRetry}
          onDelete={handleDelete}
          onSave={handleSaveEdit}
          retryingId={retryingId}
        />
      )}
    </div>
  );
}

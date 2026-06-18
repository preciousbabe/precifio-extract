import { useState, useEffect, useRef } from 'react';
import { supabase } from '../config/supabase.js';
import { createClient } from '@supabase/supabase-js';

const API_BASE = '/.netlify/functions';

export function DocumentList({ userId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(null);

  // Ref for dropdown to detect outside clicks
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

  // Auto-close dropdown on outside click
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

  const handleEdit = (doc) => {
    const extraction = doc.extractions?.[0]?.extracted_data || {};
    setEditForm({ ...extraction });
    setEditingDoc(doc);
    setSelectedDoc(null);
    setShowDownloadMenu(null);
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLineItemChange = (index, field, value) => {
    setEditForm(prev => {
      const items = [...(prev.line_items || [])];
      items[index] = { ...items[index], [field]: field === 'description' || field === 'sku' ? value : parseFloat(value) || 0 };
      return { ...prev, line_items: items };
    });
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const client = getSupabaseWithAuth();
      const extractionId = editingDoc.extractions?.[0]?.id;
      if (!extractionId) throw new Error('No extraction found');

      const { error } = await client
        .from('extractions')
        .update({
          extracted_data: editForm,
          validation_flags: [],
          updated_at: new Date().toISOString()
        })
        .eq('id', extractionId);

      if (error) throw error;

      await client.from('documents').update({ status: 'completed' }).eq('id', editingDoc.id);

      setEditingDoc(null);
      setEditForm({});
      await fetchDocuments();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Download functions
  const downloadCSV = (data, filename) => {
    const headers = ['Field', 'Value'];
    const rows = Object.entries(data)
      .filter(([k]) => !['line_items', 'tax_details', 'confidence_scores', '_source', '_schema_version'].includes(k))
      .map(([k, v]) => [k, v === null ? '' : String(v)]);
    const lineItems = data.line_items?.map((item, i) => [
      `Line Item ${i + 1}`,
      `${item.description} | Qty: ${item.quantity} | Price: ${item.unit_price} | Total: ${item.total}`
    ]) || [];
    const csv = [headers, ...rows, ...lineItems]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click(); URL.revokeObjectURL(url);
    setShowDownloadMenu(null);
  };

  const downloadExcel = (data, filename) => { downloadCSV(data, filename); setShowDownloadMenu(null); };

  const downloadQuickBooks = (data, filename) => {
    const iif = `!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\tCLEAR\tTOPRINT\tNAMEISTAXABLE\tADDR1\tADDR2\tADDR3\tADDR4\tADDR5\tDUEDATE\tTERMS\tPAID
!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\tCLEAR\tQNTY\tPRICE\tINVITEM\tTAXABLE
!ENDTRNS
TRNS\t\tINVOICE\t${data.invoice_date || ''}\tAccounts Receivable\t${data.buyer_name || ''}\t\t${data.total_amount || 0}\t${data.invoice_number || ''}\t${data.notes || ''}\tN\tY\tY\t\t\t\t\t\t\t\t\t
${data.line_items?.map(item => `SPL\t\tINVOICE\t${data.invoice_date || ''}\tIncome\t${data.vendor_name || ''}\t\t-${item.total || 0}\t\t${item.description || ''}\tN\t${item.quantity || 1}\t${item.unit_price || 0}\t${item.description || ''}\tY`).join('\n')}
ENDTRNS`;
    const blob = new Blob([iif], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.iif`; a.click(); URL.revokeObjectURL(url);
    setShowDownloadMenu(null);
  };

  const downloadXero = (data, filename) => {
    const xeroCsv = `*ContactName,EmailAddress,POAddressLine1,POAddressLine2,POAddressLine3,POAddressLine4,POCity,PORegion,POPostalCode,POCountry,*InvoiceNumber,*InvoiceDate,*DueDate,Total,InventoryItemCode,Description,*Quantity,*UnitAmount,Discount,*AccountCode,*TaxType,TrackingName1,TrackingOption1,TrackingName2,TrackingOption2,Currency
${data.buyer_name || ''},${data.buyer_email || ''},${data.buyer_address || ''},,,,,,,,${data.invoice_number || ''},${data.invoice_date || ''},${data.due_date || ''},${data.total_amount || 0},,${data.line_items?.[0]?.description || ''},${data.line_items?.[0]?.quantity || 1},${data.line_items?.[0]?.unit_price || 0},0,200,Sales Tax,,,,,${data.currency || 'USD'}`;
    const blob = new Blob([xeroCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}_xero.csv`; a.click(); URL.revokeObjectURL(url);
    setShowDownloadMenu(null);
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
      review_required: { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
      processing: { background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' },
      failed: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }
    };
    const style = styles[status] || styles.processing;
    return <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500, textTransform: 'capitalize', ...style }}>{status ? status.replace('_', ' ') : 'Unknown'}</span>;
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

  const getConfidenceColor = (score) => {
    if (score === undefined || score === null) return '#9ca3af';
    if (score >= 0.9) return '#166534';
    if (score >= 0.75) return '#92400e';
    return '#991b1b';
  };

  // Check if mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

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

      {/* Table - scrollable on mobile */}
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
                const amount = extraction?.extracted_data?.total_amount || extraction?.extracted_data?.amount_due;
                const currency = extraction?.extracted_data?.currency || 'USD';

                return (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: doc.file_type?.includes('pdf') ? '#fee2e2' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                          {doc.file_type?.includes('pdf') ? '📄' : '🖼️'}
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
                        {doc.document_type || 'invoice'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>{getStatusBadge(doc.status)}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 500, color: '#111827', fontSize: '14px', whiteSpace: 'nowrap' }}>
                      {amount ? `${currency} ${amount.toLocaleString()}` : '-'}
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

                        {doc.status === 'review_required' && (
                          <button onClick={() => handleEdit(doc)}
                            style={{ padding: '6px 12px', background: '#f59e0b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#fff', whiteSpace: 'nowrap' }}>
                            ✏️ Edit
                          </button>
                        )}

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
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, minWidth: '160px',
                                padding: '4px 0'
                              }}>
                                {[
                                  { label: '📊 Excel (.csv)', fn: () => downloadExcel(extraction.extracted_data, doc.file_name.replace('.pdf', '')) },
                                  { label: '📄 CSV', fn: () => downloadCSV(extraction.extracted_data, doc.file_name.replace('.pdf', '')) },
                                  { label: '🔗 QuickBooks (.iif)', fn: () => downloadQuickBooks(extraction.extracted_data, doc.file_name.replace('.pdf', '')) },
                                  { label: '🔗 Xero (.csv)', fn: () => downloadXero(extraction.extracted_data, doc.file_name.replace('.pdf', '')) },
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

                        <button onClick={() => { setSelectedDoc(doc); setShowDownloadMenu(null); }}
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

      {/* ========== EDIT MODAL ========== */}
      {editingDoc && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', maxWidth: '600px', width: '100%',
            maxHeight: '90vh', overflow: 'auto', padding: '32px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Edit Extraction</h2>
              <button onClick={() => { setEditingDoc(null); setEditForm({}); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>

            {['invoice_number', 'vendor_name', 'vendor_address', 'vendor_tax_id', 'buyer_name', 'buyer_address', 'buyer_tax_id', 'invoice_date', 'due_date', 'payment_date', 'currency', 'payment_status', 'payment_method', 'payment_terms', 'category', 'notes'].map(field => (
              <div key={field} style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>{field.replace(/_/g, ' ')}</label>
                <input type="text" value={editForm[field] || ''} onChange={e => handleEditChange(field, e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {['subtotal', 'tax_amount', 'total_amount', 'amount_due', 'amount_paid', 'discount_amount', 'shipping_amount'].map(field => (
                <div key={field}>
                  <label style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>{field.replace(/_/g, ' ')}</label>
                  <input type="number" step="0.01" value={editForm[field] || ''} onChange={e => handleEditChange(field, parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>

            <h4 style={{ margin: '16px 0 8px', fontSize: '14px' }}>Line Items</h4>
            {(editForm.line_items || []).map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', marginBottom: '8px', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                <input placeholder="Description" value={item.description || ''} onChange={e => handleLineItemChange(i, 'description', e.target.value)} style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
                <input placeholder="Qty" type="number" value={item.quantity || ''} onChange={e => handleLineItemChange(i, 'quantity', e.target.value)} style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
                <input placeholder="Price" type="number" step="0.01" value={item.unit_price || ''} onChange={e => handleLineItemChange(i, 'unit_price', e.target.value)} style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
                <input placeholder="Total" type="number" step="0.01" value={item.total || ''} onChange={e => handleLineItemChange(i, 'total', e.target.value)} style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
              </div>
            ))}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={handleSaveEdit} disabled={savingEdit}
                style={{ flex: 1, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', opacity: savingEdit ? 0.6 : 1 }}>
                {savingEdit ? 'Saving...' : '💾 Save Changes'}
              </button>
              <button onClick={() => { setEditingDoc(null); setEditForm({}); }}
                style={{ padding: '12px 24px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== SIDE PANEL - FULLY POPULATED & MOBILE RESPONSIVE ========== */}
      {selectedDoc && (
        <>
          {/* Backdrop overlay */}
          <div onClick={() => setSelectedDoc(null)} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.3)', zIndex: 999
          }} />
          
          {/* Side panel */}
          <div style={{
            position: 'fixed', 
            top: 0, 
            right: 0, 
            width: isMobile ? '100%' : '420px', 
            maxWidth: '100%', 
            height: '100vh',
            background: '#fff', 
            boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', 
            zIndex: 1000,
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div style={{ minWidth: 0, flex: 1, marginRight: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827', wordBreak: 'break-word' }}>
                  {selectedDoc.file_name}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                  {formatFileSize(selectedDoc.file_size)} • {selectedDoc.page_count || 1} page(s)
                </p>
              </div>
              <button onClick={() => setSelectedDoc(null)} style={{
                background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer',
                color: '#6b7280', width: '36px', height: '36px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', borderRadius: '8px',
                flexShrink: 0
              }} onMouseEnter={e => e.target.style.background = '#f3f4f6'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                ×
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
              {/* Document preview placeholder */}
              <div style={{
                width: '100%',
                height: isMobile ? '200px' : '280px',
                background: '#f3f4f6',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                    {selectedDoc.file_type?.includes('pdf') ? '📄' : '🖼️'}
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                    {selectedDoc.file_type?.toUpperCase() || 'Document'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                    Preview not available
                  </p>
                </div>
              </div>

              {/* Status & Type */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {getStatusBadge(selectedDoc.status)}
                <span style={{
                  padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500,
                  background: '#f3f4f6', color: '#4b5563', textTransform: 'capitalize'
                }}>
                  {selectedDoc.document_type || 'invoice'}
                </span>
              </div>

              {/* Status-specific messages */}
              {selectedDoc.status === 'failed' && (
                <div style={{
                  padding: '16px', background: '#fee2e2', borderRadius: '8px',
                  border: '1px solid #fecaca', marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#991b1b', marginBottom: '4px' }}>
                    ⚠️ Extraction Failed
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#7f1d1d' }}>
                    This document could not be processed. You can retry the extraction or upload a clearer version.
                  </p>
                  <button 
                    onClick={() => { handleRetry(selectedDoc); setSelectedDoc(null); }}
                    disabled={retryingId === selectedDoc.id}
                    style={{
                      marginTop: '12px', padding: '8px 16px', background: '#991b1b', color: '#fff',
                      border: 'none', borderRadius: '6px', cursor: retryingId === selectedDoc.id ? 'not-allowed' : 'pointer',
                      fontSize: '13px', opacity: retryingId === selectedDoc.id ? 0.6 : 1
                    }}
                  >
                    {retryingId === selectedDoc.id ? 'Retrying...' : '🔄 Retry Extraction'}
                  </button>
                </div>
              )}

              {selectedDoc.status === 'processing' && (
                <div style={{
                  padding: '16px', background: '#dbeafe', borderRadius: '8px',
                  border: '1px solid #bfdbfe', marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '20px', height: '20px', border: '2px solid #bfdbfe', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#1e40af' }}>
                      Processing document...
                    </div>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#3b82f6' }}>
                    Extraction is in progress. This may take a few moments.
                  </p>
                </div>
              )}

              {/* Extracted Data - only if available */}
              {selectedDoc.extractions?.[0]?.extracted_data && Object.keys(selectedDoc.extractions[0].extracted_data).length > 0 ? (
                <div>
                  <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Extracted Data
                  </h4>

                  {/* Core Info */}
                  <div style={{ marginBottom: '20px' }}>
                    {(() => {
                      const data = selectedDoc.extractions[0].extracted_data;
                      const coreFields = [
                        ['Invoice Number', data.invoice_number],
                        ['Vendor', data.vendor_name],
                        ['Vendor Address', data.vendor_address],
                        ['Vendor Tax ID', data.vendor_tax_id],
                        ['Buyer', data.buyer_name],
                        ['Buyer Address', data.buyer_address],
                        ['Buyer Tax ID', data.buyer_tax_id],
                        ['Invoice Date', data.invoice_date],
                        ['Due Date', data.due_date],
                        ['Payment Date', data.payment_date],
                        ['Currency', data.currency],
                        ['Payment Status', data.payment_status],
                        ['Payment Method', data.payment_method],
                        ['Payment Terms', data.payment_terms],
                        ['Category', data.category],
                        ['Notes', data.notes]
                      ].filter(([_, val]) => val !== undefined && val !== null && val !== '');

                      if (coreFields.length === 0) return <p style={{ color: '#9ca3af', fontSize: '13px' }}>No core data fields found</p>;

                      return coreFields.map(([label, value]) => (
                        <div key={label} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                          padding: '8px 0', borderBottom: '1px solid #f3f4f6', gap: '12px'
                        }}>
                          <span style={{ fontSize: '13px', color: '#6b7280', flexShrink: 0 }}>{label}</span>
                          <span style={{ fontSize: '13px', color: '#111827', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>
                            {value}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Financial Summary */}
                  <div style={{ marginBottom: '20px' }}>
                    <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                      Financial Summary
                    </h5>
                    {(() => {
                      const data = selectedDoc.extractions[0].extracted_data;
                      const financialFields = [
                        ['Subtotal', data.subtotal],
                        ['Tax Amount', data.tax_amount],
                        ['Total Amount', data.total_amount],
                        ['Amount Due', data.amount_due],
                        ['Amount Paid', data.amount_paid],
                        ['Discount', data.discount_amount],
                        ['Shipping', data.shipping_amount]
                      ].filter(([_, val]) => val !== undefined && val !== null && val !== '');

                      if (financialFields.length === 0) return <p style={{ color: '#9ca3af', fontSize: '13px' }}>No financial data</p>;

                      return financialFields.map(([label, value]) => (
                        <div key={label} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                          padding: '8px 0', borderBottom: '1px solid #f3f4f6'
                        }}>
                          <span style={{ fontSize: '13px', color: '#6b7280' }}>{label}</span>
                          <span style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                            {data.currency || 'USD'} {Number(value).toLocaleString()}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Line Items */}
                  {selectedDoc.extractions[0].extracted_data.line_items?.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                        Line Items ({selectedDoc.extractions[0].extracted_data.line_items.length})
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedDoc.extractions[0].extracted_data.line_items.map((item, i) => (
                          <div key={i} style={{
                            padding: '12px', background: '#f9fafb', borderRadius: '8px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', marginBottom: '4px', wordBreak: 'break-word' }}>
                              {item.description || 'No description'}
                            </div>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6b7280', flexWrap: 'wrap' }}>
                              <span>Qty: {item.quantity || 0}</span>
                              <span>Price: {selectedDoc.extractions[0].extracted_data.currency || 'USD'} {item.unit_price || 0}</span>
                              <span style={{ color: '#111827', fontWeight: 600 }}>
                                Total: {selectedDoc.extractions[0].extracted_data.currency || 'USD'} {item.total || 0}
                              </span>
                            </div>
                            {item.sku && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>SKU: {item.sku}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence Scores */}
                                  {/* Confidence Scores */}
                  {selectedDoc.extractions[0].confidence_scores && (
                    <div style={{ marginBottom: '20px' }}>
                      <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                        Confidence Scores
                      </h5>
                      
                      {(() => {
                        const cs = selectedDoc.extractions[0].confidence_scores;
                        
                        // Handle both flat format and confidenceEngine format
                        const isEngineFormat = cs.overall !== undefined && cs.breakdown !== undefined;
                        
                        if (!isEngineFormat) {
                          // Legacy flat format: { field: 0.9, field2: 0.8 }
                          const entries = Object.entries(cs).filter(([_, v]) => typeof v === 'number' && !isNaN(v));
                          if (entries.length === 0) return <p style={{ color: '#9ca3af', fontSize: '13px' }}>No valid scores</p>;
                          
                          return entries.map(([field, score]) => (
                            <div key={field} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '6px 0'
                            }}>
                              <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                                {field.replace(/_/g, ' ')}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '60px', height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${Math.min(Math.max(score * 100, 0), 100)}%`, height: '100%',
                                    background: getConfidenceColor(score), borderRadius: '3px'
                                  }} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: getConfidenceColor(score), minWidth: '36px', textAlign: 'right' }}>
                                  {(score * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          ));
                        }

                        // confidenceEngine format
                        const overall = typeof cs.overall === 'number' ? cs.overall : parseFloat(cs.overall) || 0;
                        const status = cs.status || 'UNKNOWN';
                        const breakdown = cs.breakdown || {};
                        
                        return (
                          <>
                            {/* Overall Score - Big */}
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '12px', background: '#f9fafb', borderRadius: '8px',
                              border: '1px solid #e5e7eb', marginBottom: '12px'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>Overall Confidence</div>
                                <div style={{
                                  fontSize: '24px', fontWeight: 700,
                                  color: getConfidenceColor(overall)
                                }}>
                                  {(overall * 100).toFixed(0)}%
                                </div>
                              </div>
                              <div style={{
                                padding: '4px 12px', borderRadius: '9999px', fontSize: '12px',
                                fontWeight: 600, textTransform: 'uppercase',
                                background: overall >= 0.9 ? '#dcfce7' : overall >= 0.75 ? '#fef3c7' : '#fee2e2',
                                color: overall >= 0.9 ? '#166534' : overall >= 0.75 ? '#92400e' : '#991b1b'
                              }}>
                                {status}
                              </div>
                            </div>

                            {/* Breakdown */}
                            <div style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                Breakdown
                              </div>
                              {Object.entries(breakdown).map(([field, score]) => {
                                const numScore = typeof score === 'number' ? score : parseFloat(score) || 0;
                                return (
                                  <div key={field} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '5px 0'
                                  }}>
                                    <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                                      {field.replace(/_/g, ' ')}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ width: '50px', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{
                                          width: `${Math.min(Math.max(numScore * 100, 0), 100)}%`, height: '100%',
                                          background: getConfidenceColor(numScore), borderRadius: '2px'
                                        }} />
                                      </div>
                                      <span style={{ fontSize: '11px', fontWeight: 600, color: getConfidenceColor(numScore), minWidth: '32px', textAlign: 'right' }}>
                                        {(numScore * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Flags */}
                            {cs.flags?.low_confidence_fields?.length > 0 && (
                              <div style={{ marginTop: '12px' }}>
                                <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                  ⚠️ Low Confidence Fields
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {cs.flags.low_confidence_fields.map(field => (
                                    <span key={field} style={{
                                      padding: '2px 8px', background: '#fef3c7', borderRadius: '4px',
                                      fontSize: '11px', color: '#92400e', textTransform: 'capitalize'
                                    }}>
                                      {field.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Validation Flags */}
                  {selectedDoc.extractions[0].validation_flags?.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
                        ⚠️ Validation Issues
                      </h5>
                      {selectedDoc.extractions[0].validation_flags.map((flag, i) => (
                        <div key={i} style={{
                          padding: '10px 12px', background: '#fef3c7', borderRadius: '6px',
                          border: '1px solid #fde68a', marginBottom: '6px', fontSize: '13px', color: '#92400e'
                        }}>
                          {flag}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* No extraction data available */
                <div style={{
                  padding: '24px', background: '#f9fafb', borderRadius: '8px',
                  border: '1px dashed #d1d5db', textAlign: 'center'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
                    No extracted data available
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9ca3af' }}>
                    {selectedDoc.status === 'failed' 
                      ? 'Extraction failed — retry to get results' 
                      : selectedDoc.status === 'processing' 
                        ? 'Still processing...' 
                        : 'No data was extracted from this document'}
                  </p>
                </div>
              )}

              {/* Metadata - always shown */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Metadata
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>Document ID</span>
                  <span style={{ color: '#111827', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>{selectedDoc.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>Created</span>
                  <span style={{ color: '#111827' }}>{formatDate(selectedDoc.created_at)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>File Type</span>
                  <span style={{ color: '#111827', textTransform: 'uppercase' }}>{selectedDoc.file_type || 'Unknown'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>Pages</span>
                  <span style={{ color: '#111827' }}>{selectedDoc.page_count || 1}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>Status</span>
                  <span style={{ color: '#111827', textTransform: 'capitalize' }}>{selectedDoc.status?.replace('_', ' ') || 'Unknown'}</span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: '8px',
              flexShrink: 0,
              flexWrap: 'wrap'
            }}>
              {selectedDoc.extractions?.[0]?.extracted_data && Object.keys(selectedDoc.extractions[0].extracted_data).length > 0 ? (
                <>
                  <button onClick={() => downloadCSV(selectedDoc.extractions[0].extracted_data, selectedDoc.file_name.replace('.pdf', ''))}
                    style={{ flex: 1, minWidth: '100px', padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                    ⬇️ CSV
                  </button>
                  <button onClick={() => downloadQuickBooks(selectedDoc.extractions[0].extracted_data, selectedDoc.file_name.replace('.pdf', ''))}
                    style={{ flex: 1, minWidth: '100px', padding: '10px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                    QuickBooks
                  </button>
                </>
              ) : selectedDoc.status === 'failed' ? (
                <button onClick={() => { handleRetry(selectedDoc); setSelectedDoc(null); }}
                  disabled={retryingId === selectedDoc.id}
                  style={{ flex: 1, padding: '10px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px', cursor: retryingId === selectedDoc.id ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 500, opacity: retryingId === selectedDoc.id ? 0.6 : 1 }}>
                  {retryingId === selectedDoc.id ? 'Retrying...' : '🔄 Retry Extraction'}
                </button>
              ) : null}
              
              {selectedDoc.status === 'review_required' && (
                <button onClick={() => { setSelectedDoc(null); handleEdit(selectedDoc); }}
                  style={{ padding: '10px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                  ✏️ Edit
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
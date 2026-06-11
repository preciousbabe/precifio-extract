import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase.js';

export function DocumentList({ userId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    if (userId) {
      fetchDocuments();
    }
  }, [userId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch documents with extractions - use maybeSingle for safety
      const { data, error: docError } = await supabase
        .from('documents')
        .select(`
          *,
          extractions (
            id,
            extracted_data,
            validation_flags,
            confidence_scores,
            created_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (docError) {
        console.error('Documents query error:', docError);
        throw docError;
      }

      setDocuments(data || []);
    } catch (err) {
      console.error('Fetch documents error:', err);
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
      review_required: { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
      processing: { background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' },
      failed: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }
    };

    const style = styles[status] || styles.processing;

    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        textTransform: 'capitalize',
        ...style
      }}>
        {status ? status.replace('_', ' ') : 'Unknown'}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 12px'
        }} />
        <p style={{ color: '#6b7280' }}>Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px', background: '#fee2e2', borderRadius: '8px', color: '#991b1b' }}>
        <strong>Error loading documents:</strong> {error}
        <button 
          onClick={fetchDocuments}
          style={{ marginLeft: '12px', padding: '4px 12px', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '12px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
        <h3 style={{ margin: '0 0 8px', color: '#374151' }}>No documents yet</h3>
        <p style={{ color: '#6b7280', margin: '0 0 20px' }}>
          Upload your first document to see it here.
        </p>
        <a
          href="#upload"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            background: '#1e40af',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 500
          }}
        >
          Upload Document
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {[
          { label: 'Total Documents', value: documents.length },
          { label: 'Completed', value: documents.filter(d => d.status === 'completed').length },
          { label: 'Needs Review', value: documents.filter(d => d.status === 'review_required').length },
          { label: 'Processing', value: documents.filter(d => d.status === 'processing').length }
        ].map((stat, i) => (
          <div key={i} style={{ background: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e40af' }}>{stat.value}</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Document</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const extraction = doc.extractions?.[0];
                const confidence = extraction?.confidence_scores?.overall;
                const amount = extraction?.extracted_data?.total_amount;
                const currency = extraction?.extracted_data?.currency || 'USD';

                return (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: doc.file_type?.includes('pdf') ? '#fee2e2' : '#dbeafe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px'
                        }}>
                          {doc.file_type?.includes('pdf') ? '📄' : '🖼️'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: '#111827', fontSize: '14px' }}>{doc.file_name}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                            {formatFileSize(doc.file_size)} 
                            {doc.page_count > 1 && ` • ${doc.page_count} pages`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '2px 8px',
                        background: '#f3f4f6',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#4b5563',
                        textTransform: 'capitalize'
                      }}>
                        {doc.document_type || 'invoice'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {getStatusBadge(doc.status)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {confidence !== undefined && confidence !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            border: `3px solid ${getConfidenceColor(confidence)}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: 700,
                            color: getConfidenceColor(confidence)
                          }}>
                            {Math.round(confidence * 100)}
                          </div>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            {confidence >= 0.9 ? 'High' : confidence >= 0.75 ? 'Medium' : 'Low'}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 500, color: '#111827', fontSize: '14px' }}>
                      {amount ? `${currency} ${amount.toLocaleString()}` : '-'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6b7280' }}>
                      {formatDate(doc.created_at)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                       onClick={() => setSelectedDoc(doc)}
                        style={{
                          padding: '6px 12px',
                          background: '#fff',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#374151'
                        }}
                      >
                        View
                      </button>
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
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '420px',
          maxWidth: '100%',
          height: '100vh',
          background: '#fff',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Document Details</h3>
            <button
              onClick={() => setSelectedDoc(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6b7280',
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>

          {/* Scrollable Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>File Name</label>
              <div style={{ fontSize: '14px', fontWeight: 500, marginTop: '4px' }}>{selectedDoc.file_name}</div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
              <div style={{ marginTop: '4px' }}>{getStatusBadge(selectedDoc.status)}</div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pages / Credits</label>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>
                {selectedDoc.page_count || 1} page(s) • {selectedDoc.credits_used || 0} credit(s) used
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Uploaded</label>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>{formatDate(selectedDoc.created_at)}</div>
            </div>

            {/* Extraction Data */}
            {selectedDoc.extractions?.[0] && (
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>Extraction Results</h4>
                
                {selectedDoc.extractions[0].extracted_data && (
                  <div>
                    {Object.entries(selectedDoc.extractions[0].extracted_data)
                      .filter(([key]) => !['line_items', 'confidence_scores', '_source', '_schema_version'].includes(key))
                      .map(([key, value]) => (
                        <div key={key} style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>
                            {key.replace(/_/g, ' ')}
                          </label>
                          <div style={{ fontSize: '13px', marginTop: '2px', wordBreak: 'break-word' }}>
                            {value === null ? '-' : typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Line Items */}
                {selectedDoc.extractions[0].extracted_data?.line_items?.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <label style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Line Items</label>
                    <table style={{ width: '100%', marginTop: '8px', fontSize: '12px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ textAlign: 'left', padding: '6px 0' }}>Item</th>
                          <th style={{ textAlign: 'right', padding: '6px 0' }}>Qty</th>
                          <th style={{ textAlign: 'right', padding: '6px 0' }}>Price</th>
                          <th style={{ textAlign: 'right', padding: '6px 0' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDoc.extractions[0].extracted_data.line_items.map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '6px 0' }}>{item.description || '—'}</td>
                            <td style={{ textAlign: 'right', padding: '6px 0' }}>{item.quantity || 1}</td>
                            <td style={{ textAlign: 'right', padding: '6px 0' }}>
                              {item.unit_price ? `$${item.unit_price}` : '—'}
                            </td>
                            <td style={{ textAlign: 'right', padding: '6px 0' }}>
                              {item.total ? `$${item.total}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Validation Flags */}
                {selectedDoc.extractions[0].validation_flags?.length > 0 && (
                  <div style={{ marginTop: '16px', padding: '12px', background: '#fef3c7', borderRadius: '6px' }}>
                    <label style={{ fontSize: '11px', color: '#92400e', textTransform: 'uppercase' }}>Validation Issues</label>
                    {selectedDoc.extractions[0].validation_flags.map((flag, i) => (
                      <div key={i} style={{ fontSize: '12px', color: '#92400e', marginTop: '4px' }}>
                        • {flag.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay backdrop */}
      {selectedDoc && (
        <div
          onClick={() => setSelectedDoc(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 999
          }}
        />
      )}


    </div>
  );
}
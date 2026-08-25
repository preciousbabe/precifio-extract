// src/components/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import UserStats from "./UserStats";


export default function AdminDashboard() {
  const { user } = useAuth();
    const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Audit search state
  const [auditEmail, setAuditEmail] = useState('');
  const [auditCompany, setAuditCompany] = useState('');
  const [auditResults, setAuditResults] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);

  const isAdmin = user?.is_admin === true;

  useEffect(() => {
    if (!isAdmin) return;
    const fetchAdminData = async () => {
      try {
        const token = localStorage.getItem('precifio_token');
        const res = await fetch('/.netlify/functions/admin-stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, [isAdmin]);

  if (!isAdmin) return null;

    const handleAuditSearch = async () => {
    if (!auditEmail.trim() && !auditCompany.trim()) return;
    setAuditLoading(true);
    setAuditError(null);
    try {
      const token = localStorage.getItem('precifio_token');
      const params = new URLSearchParams();
      if (auditEmail.trim()) params.append('email', auditEmail.trim());
      if (auditCompany.trim()) params.append('company', auditCompany.trim());
      
      const res = await fetch(`/.netlify/functions/admin-user-lookup?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lookup failed');
      setAuditResults(json.results || []);
    } catch (err) {
      setAuditError(err.message);
      setAuditResults([]);
    } finally {
      setAuditLoading(false);
    }
  };


  if (loading) return <div style={{ padding: 40 }}>Loading admin data...</div>;
  if (!data) return <div style={{ padding: 40 }}>No data available</div>;

  const formatUSD = (cents) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>
            <h1 style={{ fontSize: 24, marginBottom: 24, color: '#0f172a' }}>🛡️ Precifio Admin</h1>
      <UserStats profile={null} />

      {/* User Audit Lookup */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>🔍 User Audit Lookup</h3>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Email"
            value={auditEmail}
            onChange={e => setAuditEmail(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
          />
          <input
            type="text"
            placeholder="Company Name"
            value={auditCompany}
            onChange={e => setAuditCompany(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
          />
          <button
            onClick={handleAuditSearch}
            disabled={auditLoading}
            style={{ padding: '10px 20px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            {auditLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
        {auditError && <div style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{auditError}</div>}
        
        {auditResults.length === 0 && !auditLoading && !auditError && (auditEmail || auditCompany) && (
          <div style={{ color: '#64748b', fontSize: 14 }}>No users found.</div>
        )}

        {auditResults.map((result, idx) => (
          <div key={idx} style={{ marginBottom: 24, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 15, color: '#0f172a' }}>
              {result.profile.full_name || 'Unnamed'} — {result.profile.email} — {result.profile.company_name || 'No company'}
            </h4>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              Credits: <strong>{result.profile.credits_remaining}</strong> · Created: {new Date(result.profile.created_at).toLocaleDateString()}
            </div>
            
            <details style={{ marginBottom: 12 }}>
              <summary style={{ fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                Transactions ({result.transactions.length})
              </summary>
              <table style={{ width: '100%', fontSize: 13, marginTop: 8, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '6px 0' }}>Type</th>
                    <th style={{ padding: '6px 0' }}>Amount</th>
                    <th style={{ padding: '6px 0' }}>Balance After</th>
                    <th style={{ padding: '6px 0' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {result.transactions.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '6px 0' }}>{t.type}</td>
                      <td style={{ padding: '6px 0' }}>{t.amount}</td>
                      <td style={{ padding: '6px 0' }}>{t.balance_after}</td>
                      <td style={{ padding: '6px 0', color: '#64748b' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>

            <details>
              <summary style={{ fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                Extractions ({result.extractions.length})
              </summary>
              <table style={{ width: '100%', fontSize: 13, marginTop: 8, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '6px 0' }}>Document</th>
                    <th style={{ padding: '6px 0' }}>Type</th>
                    <th style={{ padding: '6px 0' }}>Cost</th>
                    <th style={{ padding: '6px 0' }}>Status</th>
                    <th style={{ padding: '6px 0' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {result.extractions.map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '6px 0' }}>{e.file_name}</td>
                      <td style={{ padding: '6px 0' }}>{e.document_type}</td>
                      <td style={{ padding: '6px 0' }}>{e.actual_cost}</td>
                      <td style={{ padding: '6px 0' }}>{e.status}</td>
                      <td style={{ padding: '6px 0', color: '#64748b' }}>{new Date(e.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Revenue" value={formatUSD(data.totalRevenue)} color="#059669" />
        <StatCard label="Revenue This Month" value={formatUSD(data.revenueThisMonth)} color="#10b981" />
        <StatCard label="Total Users" value={data.totalUsers} color="#1e40af" />
        <StatCard label="Paying Customers" value={data.payingCustomers} color="#7c3aed" />
        <StatCard label="Total Extractions" value={data.totalExtractions} color="#0891b2" />
        <StatCard label="Success Rate" value={`${data.successRate?.toFixed(1) || 0}%`} color="#ea580c" />
        <StatCard label="Credits in Circulation" value={data.creditsInCirculation?.toFixed(0)} color="#dc2626" />
        <StatCard label="Avg. Purchase" value={formatUSD(data.avgPurchaseValue)} color="#2563eb" />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Top Document Types (by credit burn)</h3>
        <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '8px 0' }}>Type</th>
              <th style={{ padding: '8px 0' }}>Count</th>
              <th style={{ padding: '8px 0' }}>Credits Burned</th>
              <th style={{ padding: '8px 0' }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.documentTypeBreakdown?.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 0' }}>{row.type}</td>
                <td style={{ padding: '10px 0' }}>{row.count}</td>
                <td style={{ padding: '10px 0' }}>{row.credits?.toFixed(1)}</td>
                <td style={{ padding: '10px 0' }}>{formatUSD(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Recent Transactions</h3>
        <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '8px 0' }}>User</th>
              <th style={{ padding: '8px 0' }}>Package</th>
              <th style={{ padding: '8px 0' }}>Amount</th>
              <th style={{ padding: '8px 0' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.recentTransactions?.map((tx, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 0' }}>{tx.email}</td>
                <td style={{ padding: '10px 0' }}>{tx.package}</td>
                <td style={{ padding: '10px 0' }}>{formatUSD(tx.amount)}</td>
                <td style={{ padding: '10px 0', color: '#64748b' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
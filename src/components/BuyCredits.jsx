import { useState } from 'react';

const API_BASE = '/.netlify/functions';

const CREDIT_PACKAGES = [
  { id: 'starter', credits: 100, price: 1000, label: 'Starter', description: '100 Credits', popular: false },
  { id: 'growth', credits: 250, price: 2200, label: 'Growth', description: '250 Credits', popular: true },
  { id: 'business', credits: 500, price: 4000, label: 'Business', description: '500 Credits', popular: false },
  { id: 'enterprise', credits: 1000, price: 7500, label: 'Enterprise', description: '1,000 Credits', popular: false },
];

export function BuyCredits({ session, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePurchase = async (pkg) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/paystack-initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          user_id: session?.user?.id,
          email: session?.user?.email,
          amount: pkg.price, // Already in cents: $10.00 = 1000
          credit_amount: pkg.credits,
          package_id: pkg.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      window.location.href = data.authorization_url;

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        maxWidth: '520px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        padding: '32px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>Buy Credits</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280'
          }}>×</button>
        </div>

        <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>
          1 credit = 1 page processed. Choose a bundle below.
        </p>

        {error && (
          <div style={{ padding: '12px', background: '#fee2e2', borderRadius: '8px', color: '#991b1b', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {CREDIT_PACKAGES.map(pkg => (
            <div
              key={pkg.id}
              onClick={() => !loading && handlePurchase(pkg)}
              style={{
                padding: '20px',
                border: pkg.popular ? '2px solid #10b981' : '1px solid #e5e7eb',
                borderRadius: '12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                position: 'relative',
                background: pkg.popular ? '#f0fdf4' : '#fff'
              }}
            >
              {pkg.popular && (
                <span style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '16px',
                  background: '#10b981',
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600
                }}>
                  POPULAR
                </span>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a202c' }}>{pkg.label}</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    {pkg.description}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginTop: '8px' }}>
                    ${(pkg.price / 100).toFixed(2)} <span style={{ fontSize: '13px', fontWeight: 400, color: '#6b7280' }}>USD</span>
                  </div>
                </div>
                <button style={{
                  padding: '8px 20px',
                  background: pkg.popular ? '#10b981' : '#1e40af',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}>
                  {loading ? '...' : 'Buy'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '20px', textAlign: 'center' }}>
          Secured by Paystack • Instant delivery • 1 credit per page
        </p>
      </div>
    </div>
  );
}
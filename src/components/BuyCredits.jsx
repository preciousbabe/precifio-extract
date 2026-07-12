import { useState } from 'react';

const API_BASE = '/.netlify/functions';

// Volume discount packages — cheaper per page as you buy more
const CREDIT_PACKAGES = [
  { id: 'starter',    credits: 20,  price: 500,   label: 'Starter',    description: '20 pages',    pricePerPage: '$0.25/page',  popular: false },
  { id: 'growth',     credits: 50,  price: 1000,  label: 'Growth',     description: '50 pages',    pricePerPage: '$0.20/page',  popular: true  },
  { id: 'business',   credits: 120, price: 2200,  label: 'Business',   description: '120 pages',   pricePerPage: '$0.18/page',  popular: false },
  { id: 'enterprise', credits: 300, price: 5000,  label: 'Enterprise', description: '300 pages',   pricePerPage: '$0.17/page',  popular: false },
];

export function BuyCredits({ session, onClose, onSuccess, alert }) {
  const [loadingPkg, setLoadingPkg] = useState(null);
  const [error, setError] = useState(null);

  const handlePurchase = async (pkg) => {
    setLoadingPkg(pkg.id);
    setError(null);

    try {
      const token = session?.access_token || localStorage.getItem('precifio_token');

      if (!token) {
        throw new Error('You must be logged in to purchase credits');
      }

      const response = await fetch(`${API_BASE}/paystack-initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: session?.user?.id,
          email: session?.user?.email,
          amount: pkg.price,
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
      setLoadingPkg(null);
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

        {/* Contextual alert when opened from insufficient credits */}
        {alert && (
          <div style={{ 
            padding: '14px 16px', 
            background: '#fee2e2', 
            borderRadius: '10px', 
            color: '#991b1b', 
            marginBottom: '20px',
            fontSize: '14px',
            border: '1px solid #fca5a5'
          }}>
            <strong>Not enough credits.</strong><br/>
            "{alert.fileName}" needs <strong>{alert.required} credit{alert.required > 1 ? 's' : ''}</strong>. 
            You only have {alert.available}. Buy more to continue processing.
          </div>
        )}

        <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>
          1 credit = 1 page processed. No charge for failed extractions.
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
              onClick={() => !loadingPkg && handlePurchase(pkg)}
              style={{
                padding: '20px',
                border: pkg.popular ? '2px solid #10b981' : '1px solid #e5e7eb',
                borderRadius: '12px',
                cursor: loadingPkg ? 'not-allowed' : 'pointer',
                opacity: loadingPkg && loadingPkg !== pkg.id ? 0.5 : 1,
                position: 'relative',
                background: pkg.popular ? '#f0fdf4' : '#fff',
                transition: 'all 0.2s'
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
                  <div style={{ fontSize: '13px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>
                    {pkg.pricePerPage}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#1e40af', marginTop: '8px' }}>
                    ${(pkg.price / 100).toFixed(2)} <span style={{ fontSize: '13px', fontWeight: 400, color: '#6b7280' }}>USD</span>
                  </div>
                </div>
                <button 
                  disabled={loadingPkg === pkg.id}
                  style={{
                    padding: '10px 24px',
                    background: pkg.popular ? '#10b981' : '#1e40af',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px',
                    opacity: loadingPkg === pkg.id ? 0.7 : 1
                  }}
                >
                  {loadingPkg === pkg.id ? '...' : 'Buy'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '20px', textAlign: 'center' }}>
          Secured by Paystack • Instant delivery • No charge for failed extractions
        </p>
      </div>
    </div>
  );
}
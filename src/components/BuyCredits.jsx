import { useState, useEffect } from 'react';
import { usePaddle } from '../hooks/usePaddle';

const API_BASE = '/api';

export function BuyCredits({ session, onClose, onSuccess, alert }) {
  const { isReady, openCheckout } = usePaddle();
  const [packages, setPackages] = useState([]);
  const [loadingPkg, setLoadingPkg] = useState(null);
  const [error, setError] = useState(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/paddle/list-packages`)
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Server ${r.status}: ${text.slice(0, 200)}`);
        }
        return r.json();
      })
      .then((data) => {
        setPackages(data.packages || []);
        setFetching(false);
      })
      .catch((err) => {
        setError(`Failed to load packages: ${err.message}`);
        setFetching(false);
      });
  }, []);

  // ── FILTER: hide $5 mini unless user is in "low credits" alert mode ──
  const visiblePackages = alert
    ? packages
    : packages.filter(p => p.id !== 'mini');
  // ────────────────────────────────────────────────────────────────────

  const handlePurchase = async (pkg) => {
    if (!isReady) {
      setError('Payment system is still loading. Please wait a moment.');
      return;
    }

    if (!navigator.onLine) {
      setError('You appear to be offline. Please check your connection and try again.');
      return;
    }

    setLoadingPkg(pkg.id);
    setError(null);

    try {
      const token = session?.access_token || localStorage.getItem('precifio_token');
      if (!token) throw new Error('Please sign in to purchase credits');

      const response = await fetch(`${API_BASE}/paddle/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ package_id: pkg.id })
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Your session expired. Please sign in again.');
        }
        throw new Error(data.error || 'Checkout initialization failed');
      }

      // Save current credits so success screen can detect the webhook update
      const currentCredits = session?.user?.credits || 0;
      localStorage.setItem('precifio_pending_credits', currentCredits);

      openCheckout({
        items: [{ priceId: data.price_id, quantity: 1 }],
        customer: { email: data.user_email },
        customData: {
          user_id: session.user.id,
          package_id: data.package_id,
        },
      });

    } catch (err) {
      console.error('Purchase error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoadingPkg(null);
    }
  };

  const formatPrice = (cents) => `$${(cents / 100).toFixed(0)}`;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', maxWidth: '560px',
        width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '32px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#0f172a' }}>Buy AI Credits</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280'
          }}>×</button>
        </div>

        <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px', lineHeight: 1.5 }}>
          AI Credits power every document processing task inside Precifio.
          Only successful processing consumes credits.
        </p>

        {alert && (
          <div style={{
            padding: '14px 16px', background: '#fee2e2', borderRadius: '10px',
            color: '#991b1b', marginBottom: '20px', fontSize: '14px', border: '1px solid #fca5a5'
          }}>
            <strong>Not enough credits.</strong><br/>
            "{alert.fileName}" needs approximately <strong>{alert.required} credit{alert.required > 1 ? 's' : ''}</strong>.
            You have {alert.available}. Top up to continue.
          </div>
        )}

        {error && (
          <div style={{
            padding: '14px 16px', background: '#fee2e2', borderRadius: '10px',
            color: '#991b1b', marginBottom: '16px', fontSize: '14px', border: '1px solid #fca5a5',
            display: 'flex', alignItems: 'flex-start', gap: '10px'
          }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>{error}</div>
          </div>
        )}

        {!isReady && !fetching && (
          <div style={{
            padding: '14px 16px', background: '#fef3c7', borderRadius: '10px',
            color: '#92400e', marginBottom: '16px', fontSize: '14px', border: '1px solid #fcd34d',
            display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <span>⏳</span> Initializing payment system...
          </div>
        )}

        {fetching ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading packages...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {visiblePackages.map(pkg => (
              <div
                key={pkg.id}
                onClick={() => !loadingPkg && handlePurchase(pkg)}
                style={{
                  padding: pkg.id === 'mini' ? '14px 20px' : '20px',
                  border: pkg.popular ? '2px solid #10b981' : pkg.id === 'mini' ? '1px dashed #cbd5e1' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: loadingPkg ? 'not-allowed' : 'pointer',
                  opacity: loadingPkg && loadingPkg !== pkg.id ? 0.5 : 1,
                  position: 'relative',
                  background: pkg.popular ? '#f0fdf4' : pkg.id === 'mini' ? '#f8fafc' : '#fff',
                  transition: 'all 0.2s'
                }}
              >
                {pkg.popular && (
                  <span style={{
                    position: 'absolute', top: '-10px', right: '16px',
                    background: '#10b981', color: '#fff', padding: '4px 12px',
                    borderRadius: '12px', fontSize: '11px', fontWeight: 600
                  }}>MOST POPULAR</span>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: pkg.id === 'mini' ? '15px' : '17px',
                      fontWeight: 700,
                      color: pkg.id === 'mini' ? '#475569' : '#0f172a'
                    }}>
                      {pkg.label}
                    </div>
                    <div style={{ fontSize: '14px', color: '#334155', marginTop: '4px', fontWeight: 600 }}>
                      {pkg.credits} AI Credits
                    </div>
                    {pkg.id !== 'mini' && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        ${(pkg.priceCents / 100 / pkg.credits).toFixed(2)} per credit
                      </div>
                    )}
                    <div style={{
                      fontSize: pkg.id === 'mini' ? '20px' : '24px',
                      fontWeight: 700,
                      color: pkg.id === 'mini' ? '#059669' : '#1e40af',
                      marginTop: '8px'
                    }}>
                      {formatPrice(pkg.priceCents)}
                      <span style={{ fontSize: '13px', fontWeight: 400, color: '#64748b' }}> USD</span>
                    </div>
                  </div>
                  <button
                    disabled={loadingPkg === pkg.id || !isReady}
                    style={{
                      padding: pkg.id === 'mini' ? '8px 18px' : '10px 24px',
                      background: pkg.popular ? '#10b981' : pkg.id === 'mini' ? '#fff' : '#1e40af',
                      color: pkg.id === 'mini' ? '#059669' : '#fff',
                      border: pkg.id === 'mini' ? '1px solid #059669' : 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: loadingPkg === pkg.id || !isReady ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: loadingPkg === pkg.id || !isReady ? 0.7 : 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {loadingPkg === pkg.id ? '...' : pkg.id === 'mini' ? 'Top up' : 'Buy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '20px', padding: '14px', background: '#f8fafc', borderRadius: '10px' }}>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ color: '#10b981' }}>✓</span> Credits never expire
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ color: '#10b981' }}>✓</span> Only successful processing is charged
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ color: '#10b981' }}>✓</span> Instant top-up
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#10b981' }}>✓</span> Secure payment via Paddle
            </div>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '16px', textAlign: 'center' }}>
          Secured by Paddle • Instant delivery • No charge for failed extractions
        </p>
      </div>
    </div>
  );
}


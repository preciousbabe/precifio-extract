// src/components/PaymentSuccess.jsx
import { useEffect, useState } from 'react';

export function PaymentSuccess({ profile, onDone }) {
  const [status, setStatus] = useState('processing'); // processing | confirmed | delayed
  const [dots, setDots] = useState('');

  const previousCredits = Number(localStorage.getItem('precifio_pending_credits')) || 0;

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // If we already see increased credits, jump to confirmed immediately
    if (profile && profile.credits_remaining > previousCredits) {
      setStatus('confirmed');
    }

    // Otherwise give the webhook 5 seconds, then show "delayed" with reassurance
    const timer = setTimeout(() => {
      if (profile && profile.credits_remaining <= previousCredits) {
        setStatus('delayed');
      } else {
        setStatus('confirmed');
      }
    }, 5000);

    // Auto-close after total 6 seconds
    const closeTimer = setTimeout(() => {
      localStorage.removeItem('precifio_pending_credits');
      onDone?.();
    }, 6000);

    return () => {
      clearTimeout(timer);
      clearTimeout(closeTimer);
    };
  }, [profile, previousCredits, onDone]);

  const messages = {
    processing: { title: 'Payment received!', sub: 'Adding credits to your account' },
    confirmed: { title: 'Payment successful!', sub: 'Your credits are ready to use' },
    delayed: { title: 'Payment confirmed!', sub: 'Credits will appear within a minute' },
  };

  const msg = messages[status];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: status === 'delayed' ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, animation: 'fadeIn 0.4s ease-out',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes drawCheck { 0% { stroke-dashoffset: 100; } 100% { stroke-dashoffset: 0; } }
        .check-circle { animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .check-path { stroke-dasharray: 100; stroke-dashoffset: 100; animation: drawCheck 0.4s ease-out 0.3s forwards; }
      `}</style>

      <div className="check-circle" style={{
        width: 100, height: 100, borderRadius: '50%',
        background: status === 'delayed' ? '#f59e0b' : '#10b981',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: status === 'delayed' 
          ? '0 12px 40px rgba(245, 158, 11, 0.3)' 
          : '0 12px 40px rgba(16, 185, 129, 0.3)',
        marginBottom: 28,
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path className="check-path" d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: status === 'delayed' ? '#92400e' : '#065f46', marginBottom: 8, textAlign: 'center' }}>
        {msg.title}
      </h1>

      <p style={{ margin: 0, fontSize: '16px', color: status === 'delayed' ? '#b45309' : '#047857', textAlign: 'center', maxWidth: 340, lineHeight: 1.5 }}>
        {msg.sub}{dots}
      </p>

      {status === 'delayed' && (
        <p style={{ marginTop: 12, fontSize: '13px', color: '#78716c', textAlign: 'center', maxWidth: 320 }}>
          If credits don't appear within 2 minutes, please contact support.
        </p>
      )}

      <div style={{
        marginTop: 32, padding: '10px 24px', background: 'rgba(255,255,255,0.6)',
        borderRadius: 20, fontSize: '14px', color: status === 'delayed' ? '#92400e' : '#065f46', fontWeight: 500,
      }}>
        Redirecting you back{dots}
      </div>
    </div>
  );
}
// src/components/UserStats.jsx
import { useEffect, useState } from 'react';

export default function UserStats({ profile }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('precifio_token');
        const res = await fetch('/.netlify/functions/user-stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Stats error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div style={{ padding: 20, color: '#64748b' }}>Loading stats...</div>;
  if (!stats) return null;

  const cards = [
    { label: 'AI Credits Available', value: stats.creditsRemaining?.toFixed(1) || '0', accent: '#1e40af', big: true },
    { label: 'Documents Processed', value: stats.documentsProcessed || '0', accent: '#059669' },
    { label: 'AI Work Completed', value: `${stats.creditsUsed?.toFixed(1) || '0'} Credits`, accent: '#7c3aed' },
    { label: 'Estimated Time Saved', value: `${stats.timeSaved || '0'} Hours`, accent: '#ea580c' },
    { label: 'Average Processing Time', value: `${stats.avgProcessingTime || '0'}s`, accent: '#0891b2' },
    { label: 'Money Saved vs. Manual Entry', value: `≈ $${stats.moneySaved?.toLocaleString() || '0'}`, accent: '#16a34a', big: true },
  ];

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
      gap: '16px',
      marginBottom: '32px'
    }}>
      {cards.map((card, i) => (
        <div key={i} style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            {card.label}
          </div>
          <div style={{ 
            fontSize: card.big ? '28px' : '22px', 
            fontWeight: 700, 
            color: card.accent,
            letterSpacing: '-0.02em'
          }}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
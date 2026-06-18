import { useState, useEffect } from 'react';
import { supabase } from './config/supabase.js';
import { Auth } from './components/Auth.jsx';
import { UploadZone } from './components/UploadZone.jsx';
import { ExtractionResult } from './components/ExtractionResult.jsx';
import { DocumentList } from './components/DocumentList.jsx';
import { useExtraction } from './hooks/useExtraction.js';
import { useNetworkStatus } from './hooks/useNetworkStatus.js';
import { BuyCredits } from './components/BuyCredits.jsx';

const API_BASE = '/.netlify/functions';

function getRoute() {
  return window.location.hash.replace('#', '') || 'upload';
}

function App() {
  const [session, setSession] = useState(null);
  const [route, setRoute] = useState(getRoute());
  const [userCredits, setUserCredits] = useState(0);
  const { extract, loading, result, error, reset } = useExtraction();
  const [uploadedFile, setUploadedFile] = useState(null);
  const { isBad, isOnline } = useNetworkStatus();
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('precifio_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSession(parsed);
      } catch (e) {
        localStorage.removeItem('precifio_session');
      }
    }

    const handleHashChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Validate token and fetch credits when session changes
  useEffect(() => {
    if (!session?.access_token) return;

    const initSession = async () => {
      try {
        const response = await fetch(`${API_BASE}/auth-me`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        if (!response.ok) throw new Error('Invalid session');

        const data = await response.json();
        
        setSession(prev => ({
          ...prev,
          user: data.user,
          profile: data.profile
        }));

              // Set credits from profile — with fallback
        const credits = data.profile?.credits_remaining;
        console.log('Profile credits from auth-me:', credits);
        
        if (typeof credits === 'number') {
          setUserCredits(credits);
        } else {
          console.warn('No credits in profile, using default 10');
          setUserCredits(10);
        }

      } catch (err) {
        console.error('Session validation failed:', err);
        localStorage.removeItem('precifio_session');
        setSession(null);
      }
    };

    initSession();
  }, [session?.access_token]);

  const handleUpload = async (file, documentType) => {
    setUploadedFile(file);
    const result = await extract(file, documentType, session?.access_token);
    
    if (result?.creditsRemaining !== undefined) {
      setUserCredits(result.creditsRemaining);
    }
  };

  const handleSignOut = async () => {
    localStorage.removeItem('precifio_session');
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleNewUpload = () => {
    reset();
    setUploadedFile(null);
    window.location.hash = 'upload';
  };

  if (!session) {
    return <Auth />;
  }

  // ============================================
  // DOCUMENTS VIEW
  // ============================================
  if (route === 'documents') {
    return (
      <>
        {isBad && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: isOnline ? '#f59e0b' : '#ef4444',
            color: '#fff',
            padding: '10px 16px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span>{isOnline ? '⚠️' : '📡'}</span>
            <span>
              {isOnline 
                ? 'Slow connection detected. Some features may not work properly.' 
                : 'You are offline. Please check your internet connection.'}
            </span>
          </div>
        )}
        
        <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: isBad ? '72px 20px 40px' : '40px 20px', transition: 'padding 0.3s' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ margin: 0 }}>Precifio Extract</h1>
                <p style={{ color: '#6b7280', fontSize: '16px', margin: '18px 0 0 0' }}>
                  Welcome, {session.user?.user_metadata?.full_name || session.user?.email}
                </p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                  whiteSpace: 'nowrap', background: '#fef3c7', borderRadius: '20px',
                  fontSize: '13px', fontWeight: 600, color: '#92400e'
                }}>
                  <span>⚡</span>
                  <span>{userCredits} credit{userCredits !== 1 ? 's' : ''}</span>
                </div>
                <button 
                  onClick={() => setShowBuyCredits(true)}
                  style={{
                    padding: '4px 12px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  + Buy Credits
                </button>
                <a href="#upload" style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', textDecoration: 'none', color: '#374151' }}>
                  ← Back to Upload
                </a>
                <button onClick={handleSignOut} style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>
                  Sign Out
                </button>
              </div>
            </div>
            
            <DocumentList userId={session.user?.id} />
          </div>
        </div>

        {showBuyCredits && (
          <BuyCredits 
            session={session} 
            onClose={() => setShowBuyCredits(false)} 
            onSuccess={(newCredits) => {
              setUserCredits(newCredits);
              setShowBuyCredits(false);
            }}
          />
        )}
      </>
    );
  }

  // ============================================
  // UPLOAD VIEW (default)
  // ============================================
  return (
    <>
      {isBad && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: isOnline ? '#f59e0b' : '#ef4444',
          color: '#fff',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <span>{isOnline ? '⚠️' : '📡'}</span>
          <span>
            {isOnline 
              ? 'Slow connection detected. Some features may not work properly.' 
              : 'You are offline. Please check your internet connection.'}
          </span>
        </div>
      )}
      
      <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: isBad ? '72px 20px 40px' : '40px 20px', transition: 'padding 0.3s' }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ margin: 0 }}>Precifio Extract</h1>
              <p style={{ color: '#6b7280', margin: '4px 0 0 0', fontSize: '16px', wordBreak: 'break-word', maxWidth: '200px' }}>
                Welcome, {session.user?.user_metadata?.full_name || session.user?.email}
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                whiteSpace: 'nowrap', background: '#fef3c7', borderRadius: '20px',
                fontSize: '13px', fontWeight: 600, color: '#92400e'
              }}>
                <span>⚡</span>
                <span>{userCredits} credit{userCredits !== 1 ? 's' : ''}</span>
              </div>
              <button 
                onClick={() => setShowBuyCredits(true)}
                style={{
                  padding: '4px 12px',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                + Buy Credits
              </button>
              <button onClick={handleSignOut} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>
                Sign Out
              </button>
            </div>
          </div>

          {!result && <UploadZone onUpload={handleUpload} />}

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: '#6b7280', margin: 0 }}>Analyzing document with Precifio AI...</p>
            </div>
          )}

          {error && (
            <div style={{ padding: '16px', background: '#fee2e2', borderRadius: '8px', color: '#991b1b', marginBottom: '20px' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {result && (
            <div>
              <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button onClick={handleNewUpload} style={{ padding: '10px 20px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  Upload Another
                </button>
                {result.creditsUsed !== undefined && (
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    Used {result.creditsUsed} credit{result.creditsUsed !== 1 ? 's' : ''} 
                    {result.creditsRemaining !== undefined && ` • ${result.creditsRemaining} remaining`}
                  </span>
                )}
              </div>
              <ExtractionResult data={result} />
            </div>
          )}

          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <a href="#documents" style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 500 }}>
              📁 View My Documents
            </a>
          </div>
        </div>
      </div>

      {showBuyCredits && (
        <BuyCredits 
          session={session} 
          onClose={() => setShowBuyCredits(false)} 
          onSuccess={(newCredits) => {
            setUserCredits(newCredits);
            setShowBuyCredits(false);
          }}
        />
      )}
    </>
  );
}

export default App;
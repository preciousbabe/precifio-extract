import { useState, useEffect } from 'react';
import { supabase } from './config/supabase.js';
import { Auth } from './components/Auth.jsx';
import { UploadZone } from './components/UploadZone.jsx';
import { ExtractionResult } from './components/ExtractionResult.jsx';
import { DocumentList } from './components/DocumentList.jsx';
import { useExtraction } from './hooks/useExtraction.js';

const API_BASE = '/.netlify/functions';

function getRoute() {
  return window.location.hash.replace('#', '') || 'upload';
}

function App() {
  const [session, setSession] = useState(null);
  const [route, setRoute] = useState(getRoute());
  const [userCredits, setUserCredits] = useState(20);
  const { extract, loading, result, error, reset } = useExtraction();
  const [uploadedFile, setUploadedFile] = useState(null);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('precifio_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSession(parsed);
        validateSession(parsed.access_token);
      } catch (e) {
        localStorage.removeItem('precifio_session');
      }
    }

    const handleHashChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Validate token with backend
  const validateSession = async (token) => {
    try {
      const response = await fetch(`${API_BASE}/auth-me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        localStorage.removeItem('precifio_session');
        setSession(null);
        return;
      }

      const data = await response.json();
      setSession(data.session);
      if (data.profile?.credits_remaining !== undefined) {
        setUserCredits(data.profile.credits_remaining);
      }
    } catch (err) {
      console.error('Session validation failed:', err);
    }
  };

  const fetchCredits = async () => {
    if (!session?.user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits_remaining')
        .eq('id', session.user.id)
        .maybeSingle();
      
      if (error) {
        console.warn('Credit fetch error:', error);
        return;
      }
      
      setUserCredits(data?.credits_remaining || 0);
    } catch (err) {
      console.error('Failed to fetch credits:', err);
      setUserCredits(0);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchCredits();
    }
  }, [session]);

  const handleUpload = async (file, documentType) => {
    setUploadedFile(file);
    const result = await extract(file, documentType, session?.access_token);
    
    if (result?.creditsRemaining !== undefined) {
      setUserCredits(result.creditsRemaining);
    } else {
      fetchCredits();
    }
  };

  const handleSignOut = async () => {
    localStorage.removeItem('precifio_session');
    await supabase.auth.signOut(); // Clean up Supabase side too
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

  // ... rest of your App.jsx render code stays the same
  // (documents route and upload route - no changes needed there)
  
  if (route === 'documents') {
    return (
      <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '40px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ margin: 0 }}>Precifio Extract</h1>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: '18px 0 0 0' }}>
                Welcome, {session.user.email}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                whiteSpace: 'nowrap', background: '#fef3c7', borderRadius: '20px',
                fontSize: '13px', fontWeight: 600, color: '#92400e'
              }}>
                <span>⚡</span>
                <span>{userCredits} credits</span>
              </div>
              <a href="#upload" style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', textDecoration: 'none', color: '#374151' }}>
                ← Back to Upload
              </a>
              <button onClick={handleSignOut} style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>
                Sign Out
              </button>
            </div>
          </div>
          <DocumentList userId={session.user.id} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '40px 20px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0 }}>Precifio Extract</h1>
            <p style={{ color: '#6b7280', margin: '4px 0 0 0', fontSize: '12px', wordBreak: 'break-word', maxWidth: '200px' }}>
              Welcome, {session.user.email}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
              whiteSpace: 'nowrap', background: '#fef3c7', borderRadius: '20px',
              fontSize: '13px', fontWeight: 600, color: '#92400e'
            }}>
              <span>⚡</span>
              <span>{userCredits} credits</span>
            </div>
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
  );
}

export default App;
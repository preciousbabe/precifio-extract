import { useState } from 'react';

const API_BASE = '/.netlify/functions';

export function Auth() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [loginCompany, setLoginCompany] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const inputStyle = {
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db'
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password || !fullName || !companyName) {
      setMessage("Please fill all required fields");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, companyName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setMessage(data.message);
      // Optionally auto-switch to login after delay
      setTimeout(() => setIsLoginView(true), 2000);

    } catch (error) {
      setMessage(error.message);
    }

    setLoading(false);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!loginCompany || !loginPassword) {
      setMessage("Please enter company name and password");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth-signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: loginCompany, password: loginPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      // Store session in localStorage or memory
      localStorage.setItem('precifio_session', JSON.stringify(data.session));
      setMessage('Signed in successfully!');
      window.location.reload();

    } catch (error) {
      setMessage(error.message);
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '24px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Precifio Extract</h2>

      {isLoginView ? (
        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            placeholder="Company Name"
            value={loginCompany}
            onChange={(e) => setLoginCompany(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '12px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px' }}
          >
            {loading ? 'Loading...' : 'Sign In'}
          </button>
          <p onClick={() => setIsLoginView(false)} style={{ textAlign: 'center', cursor: 'pointer', color: '#1e40af' }}>
            Don't have an account? Sign Up
          </p>
        </form>
      ) : (
        <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          <input type="text" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required style={inputStyle} />
          <input type="text" placeholder="Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={inputStyle} />
          <button type="submit" disabled={loading} style={{ padding: '12px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px' }}>
            {loading ? 'Loading...' : 'Sign Up'}
          </button>
          <p onClick={() => setIsLoginView(true)} style={{ textAlign: 'center', cursor: 'pointer', color: '#1e40af' }}>
            Already have an account? Sign In
          </p>
        </form>
      )}

      {message && (
        <div style={{ marginTop: '16px', padding: '12px', borderRadius: '6px', background: message.includes('success') ? '#d1fae5' : '#fee2e2', color: message.includes('success') ? '#065f46' : '#991b1b' }}>
          {message}
        </div>
      )}
    </div>
  );
}
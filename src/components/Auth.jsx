import { useState } from 'react';

const API_BASE = '/.netlify/functions';

export function Auth({ initialMode = 'login' }) {
  const [isLoginView, setIsLoginView] = useState(initialMode !== 'signup');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [loginCompany, setLoginCompany] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState(false);

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

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error);
      }

      setMessage("🎉 Account created! Check your email and click the login button to start using Precifio with 10 free credits.");
      
      setEmail('');
      setFullName('');
      setCompanyName('');
      setPassword('');
      setJustSignedUp(true);
      
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

      // ✅ FIXED: Use precifio_token consistently
      localStorage.setItem('precifio_token', data.session.access_token);
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
          <div style={{ position: 'relative' }}>
            <input
              type={showLoginPassword ? 'text' : 'password'}
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
              style={{ ...inputStyle, width: '100%', paddingRight: '40px' }}
            />
            <button
              type="button"
              onClick={() => setShowLoginPassword(!showLoginPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#6b7280'
              }}
            >
              {showLoginPassword ? '🙈' : '👁️'}
            </button>
          </div>

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
          <div style={{ position: 'relative' }}>
            <input 
              type={showPassword ? 'text' : 'password'} 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              minLength={6} 
              style={{ ...inputStyle, width: '100%', paddingRight: '40px' }} 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#6b7280'
              }}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <button type="submit" disabled={loading} style={{ padding: '12px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px' }}>
            {loading ? 'Loading...' : 'Sign Up'}
          </button>
          {justSignedUp ? (
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', fontStyle: 'italic' }}>
              ✉️ Please check your email and click the login link to continue
            </p>
          ) : (
            <p onClick={() => setIsLoginView(true)} style={{ textAlign: 'center', cursor: 'pointer', color: '#1e40af' }}>
              Already have an account? Sign In
            </p>
          )}
        </form>
      )}

      {message && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          borderRadius: '6px', 
          background: message.includes('🎉') || message.includes('success') || message.includes('created') ? '#d1fae5' : '#fee2e2', 
          color: message.includes('🎉') || message.includes('success') || message.includes('created') ? '#065f46' : '#991b1b' 
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';

const API_BASE = '/.netlify/functions';

export function Auth({ initialMode = 'login', resetToken, featureMessage }) {
  // ── Mode replaces the boolean isLoginView ─────────────────────────
  const [mode, setMode] = useState(
    ['login', 'signup', 'forgot', 'reset'].includes(initialMode) ? initialMode : 'login'
  );

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

  // ── NEW: forgot / reset field state ────────────────────────────────
  const [forgotCompany, setForgotCompany] = useState('');
  const [newPassword, setNewPassword] = useState('');

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

      localStorage.setItem('precifio_token', data.session.access_token);
      setMessage('Signed in successfully!');
      window.location.reload();

    } catch (error) {
      setMessage(error.message);
    }

    setLoading(false);
  };

  // ── NEW: forgot handler ──────────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/auth-forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: forgotCompany })
      });
      const data = await res.json();
      setMessage(data.message || 'If an account exists, a reset email has been sent.');
    } catch (err) {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── NEW: reset handler ───────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const token = resetToken || localStorage.getItem('precifio_reset_token');
    if (!token) {
      setMessage('Reset link expired. Please request a new one.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token, newPassword })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      localStorage.removeItem('precifio_reset_token');
      setMessage('Password updated! Redirecting to login...');
      setTimeout(() => {
        setMode('login');
        setMessage('');
      }, 2000);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isSuccessMessage =
    message.includes('🎉') ||
    message.includes('success') ||
    message.includes('created') ||
    message.includes('sent') ||
    message.includes('updated');

  return (
        <div style={{ maxWidth: '400px', margin: '40px auto', padding: '24px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Precifio Extract</h2>

      {featureMessage && (
        <div style={{
          marginBottom: '20px',
          padding: '14px 16px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          color: '#1e40af',
          fontSize: '14px',
          lineHeight: 1.5
        }}>
          {featureMessage}
        </div>
      )}

      {/* ── LOGIN ── */}
      {mode === 'login' && (
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

          {/* NEW: forgot link */}
          <p
            onClick={() => setMode('forgot')}
            style={{ textAlign: 'center', cursor: 'pointer', color: '#1e40af', fontSize: '13px', margin: 0 }}
          >
            Forgot password?
          </p>

          <p onClick={() => setMode('signup')} style={{ textAlign: 'center', cursor: 'pointer', color: '#1e40af' }}>
            Don't have an account? Sign Up
          </p>
        </form>
      )}

      {/* ── SIGNUP ── */}
      {mode === 'signup' && (
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
            <p onClick={() => setMode('login')} style={{ textAlign: 'center', cursor: 'pointer', color: '#1e40af' }}>
              Already have an account? Sign In
            </p>
          )}
        </form>
      )}

      {/* ── FORGOT ── NEW ── */}
      {mode === 'forgot' && (
        <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '4px' }}>Reset Password</h3>
          <p style={{ textAlign: 'center', fontSize: '14px', color: '#64748b', margin: 0 }}>
            Enter your company name and we'll email you a reset link.
          </p>

          <input
            type="text"
            placeholder="Company Name"
            value={forgotCompany}
            onChange={(e) => setForgotCompany(e.target.value)}
            required
            autoFocus
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={loading}
            style={{ padding: '12px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px' }}
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>

          <p onClick={() => setMode('login')} style={{ textAlign: 'center', cursor: 'pointer', color: '#1e40af' }}>
            ← Back to login
          </p>
        </form>
      )}

      {/* ── RESET ── NEW ── */}
      {mode === 'reset' && (
        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '4px' }}>Create New Password</h3>

          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="New password (min 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
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

          <button
            type="submit"
            disabled={loading}
            style={{ padding: '12px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px' }}
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>

          <p onClick={() => setMode('login')} style={{ textAlign: 'center', cursor: 'pointer', color: '#1e40af' }}>
            ← Back to login
          </p>
        </form>
      )}

      {message && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          borderRadius: '6px', 
          background: isSuccessMessage ? '#d1fae5' : '#fee2e2', 
          color: isSuccessMessage ? '#065f46' : '#991b1b' 
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
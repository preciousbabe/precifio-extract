import { useState } from 'react';
import { supabase } from '../config/supabase.js';

export function Auth() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  // login-only state (company login UX)
  const [loginCompany, setLoginCompany] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const inputStyle = {
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db'
  };

  // =========================
  // SIGN UP
  // =========================
  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password || !fullName || !companyName) {
      setMessage("Please fill all required fields");
      setLoading(false);
      return;
    }

   const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: fullName,
      company_name: companyName
    }
  }
});

if (error) {
  setMessage(error.message);
} else {
  setMessage('Check your email for confirmation!');
}

setLoading(false);

  }

  // =========================
  // SIGN IN (COMPANY LOGIN)
  // =========================
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!loginCompany || !loginPassword) {
      setMessage("Please enter company name and password");
      setLoading(false);
      return;
    }

    // 1. Find email from company name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('company_name', loginCompany)
      .single();

    if (profileError || !profile) {
      setMessage("Company not found");
      setLoading(false);
      return;
    }

    // 2. Login with email + password
    const { error } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: loginPassword
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Signed in successfully!');
      window.location.reload();
    }

    setLoading(false);
  };

  return (
  <div style={{ maxWidth: '400px', margin: '40px auto', padding: '24px' }}>
    <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>
      Precifio Extract
    </h2>

    {/* ================= LOGIN VIEW ================= */}
    {isLoginView ? (
      <form
        onSubmit={handleSignIn}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
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
          style={{
            padding: '12px',
            background: '#1e40af',
            color: '#fff',
            border: 'none',
            borderRadius: '6px'
          }}
        >
          {loading ? 'Loading...' : 'Sign In'}
        </button>

        <p
          onClick={() => setIsLoginView(false)}
          style={{ textAlign: 'center', cursor: 'pointer', color: '#1e40af' }}
        >
          Don’t have an account? Sign Up
        </p>
      </form>
    ) : (
      /* ================= SIGN UP VIEW ================= */
      <form
        onSubmit={handleSignUp}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="Company Name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px',
            background: '#1e40af',
            color: '#fff',
            border: 'none',
            borderRadius: '6px'
          }}
        >
          {loading ? 'Loading...' : 'Sign Up'}
        </button>

        <p
          onClick={() => setIsLoginView(true)}
          style={{ textAlign: 'center', cursor: 'pointer', color: '#1e40af' }}
        >
          Already have an account? Sign In
        </p>
      </form>
    )}
  </div>
);
}
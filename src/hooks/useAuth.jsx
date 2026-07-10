// src/hooks/useAuth.js

import { useState, useEffect, createContext, useContext } from 'react';
import { clearGuestSession } from '../utils/guestSession';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [guestLimitReached, setGuestLimitReached] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('precifio_token');
    if (token) {
      fetchUser(token);
    } else {
      setLoading(false);
      setIsGuest(true);
    }
  }, []);

  const fetchUser = async (token) => {
    try {
      const res = await fetch('/.netlify/functions/auth-me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        setProfile(data.profile);
        setIsGuest(false);
        setGuestLimitReached(false);
        clearGuestSession();
      }
    } catch (err) {
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (companyName, password) => {
    const res = await fetch('/.netlify/functions/auth-signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, password })
    });
    const data = await res.json();
      if (data.session) {
      localStorage.setItem('precifio_token', data.session.access_token);
      await fetchUser(data.session.access_token);
      setShowAuthModal(false);
      setGuestLimitReached(false);
      clearGuestSession();
      setShowAuthModal(false);
      return true;
    }
    return false;
  };

    const signup = async (email, password, fullName, companyName) => {
    const res = await fetch('/.netlify/functions/auth-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, companyName })
    });
    const data = await res.json();
    if (data.success) {
      // DON'T auto-login. Return success so UI shows "check email" message
      return { success: true, message: data.message };
    }
    return { success: false, error: data.error };
  };


  const logout = () => {
    localStorage.removeItem('precifio_token');
    setUser(null);
    setProfile(null);
    setIsGuest(true);
  };

  const requireAuth = (action) => {
    if (isGuest) {
      setAuthModalMode(action === 'signup' ? 'signup' : 'login');
      setShowAuthModal(true);
      return false;
    }
    return true;
  };

  const handleGuestLimit = () => {
    setGuestLimitReached(true);
    setAuthModalMode('signup');
    setShowAuthModal(true);
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      isGuest,
      loading,
      guestLimitReached,
      login,
      signup,
      logout,
      showAuthModal,
      setShowAuthModal,
      authModalMode,
      setAuthModalMode,
      requireAuth,
      handleGuestLimit
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
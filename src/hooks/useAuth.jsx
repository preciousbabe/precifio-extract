// src/hooks/useAuth.js

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
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

  const fetchUser = useCallback(async (token) => {
    try {
      const res = await fetch('/.netlify/functions/auth-me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error(`Auth check failed: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.user) {
       setUser({ ...data.user, ...data.profile });
        setProfile(data.profile);
        setIsGuest(false);
        setGuestLimitReached(false);
        clearGuestSession();
        return true;
      } else {
        throw new Error('No user returned');
      }
    } catch (err) {
      console.error('Auth error:', err);
      localStorage.removeItem('precifio_token');
      setUser(null);
      setProfile(null);
      setIsGuest(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial auth check on mount
  useEffect(() => {
    const token = localStorage.getItem('precifio_token');
    if (token) {
      fetchUser(token);
    } else {
      setLoading(false);
      setIsGuest(true);
    }
  }, [fetchUser]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'precifio_token') {
        if (e.newValue) {
          fetchUser(e.newValue);
        } else {
          setUser(null);
          setProfile(null);
          setIsGuest(true);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [fetchUser]);

  const login = useCallback(async (companyName, password) => {
    const res = await fetch('/.netlify/functions/auth-signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, password })
    });
    
    const data = await res.json();
    
    if (data.session?.access_token) {
      localStorage.setItem('precifio_token', data.session.access_token);
      await fetchUser(data.session.access_token);
      setShowAuthModal(false);
      setGuestLimitReached(false);
      clearGuestSession();
      return true;
    }
    
    return false;
  }, [fetchUser]);

  const signup = useCallback(async (email, password, fullName, companyName) => {
    const res = await fetch('/.netlify/functions/auth-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, companyName })
    });
    
    const data = await res.json();
    
    if (data.success) {
      return { success: true, message: data.message };
    }
    
    return { success: false, error: data.error };
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('precifio_token');
    if (!token) return;
    
    try {
      const res = await fetch('/.netlify/functions/auth-me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.profile) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.error('Refresh profile error:', err);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('precifio_token');
    setUser(null);
    setProfile(null);
    setIsGuest(true);
  }, []);

  const requireAuth = useCallback((action) => {
    if (isGuest) {
      setAuthModalMode(action === 'signup' ? 'signup' : 'login');
      setShowAuthModal(true);
      return false;
    }
    return true;
  }, [isGuest]);

  const handleGuestLimit = useCallback(() => {
    setGuestLimitReached(true);
    setAuthModalMode('signup');
    setShowAuthModal(true);
  }, []);

  const value = {
    user,
    profile,
    setProfile,              // ← ✅ ADDED
    isGuest,
    loading,
    guestLimitReached,
    login,
    signup,
    logout,
    refreshProfile,
    showAuthModal,
    setShowAuthModal,
    authModalMode,
    setAuthModalMode,
    requireAuth,
    handleGuestLimit
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
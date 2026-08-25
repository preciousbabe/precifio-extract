// src/hooks/useAuth.js

import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { clearGuestSession } from '../utils/guestSession';


const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const tokenOnLoad = typeof window !== 'undefined' ? localStorage.getItem('precifio_token') : null;
  const [authModalMessage, setAuthModalMessage] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(!tokenOnLoad);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [guestLimitReached, setGuestLimitReached] = useState(false);

  const fetchUser = useCallback(async (token) => {
    try {
      const res = await fetch('/.netlify/functions/auth-me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // ONLY 401/403 mean the token is dead. Everything else is transient.
      if (res.status === 401 || res.status === 403) {
        throw new Error('AUTH_INVALID');
      }

      if (!res.ok) {
        setLoading(false);
        return true;
      }

      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
       
        setLoading(false);
        return true;
      }

      if (data.user) {
        setUser({ ...data.user, ...data.profile });
        setProfile(data.profile);
        setIsGuest(false);
        setGuestLimitReached(false);
        clearGuestSession();
        return true;
      }

      setLoading(false);
      return true;

    } catch (err) {
    
      if (err.message === 'AUTH_INVALID') {
        localStorage.removeItem('precifio_token');
        setUser(null);
        setProfile(null);
        setIsGuest(true);
        return false;
      }

      setLoading(false);
      return true;
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


 useEffect(() => {
  const handleShowModal = (e) => {
    setAuthModalMode(e.detail?.mode || 'login');

    if (e.detail?.link) {
      setAuthModalMessage({
        message: e.detail.message || '',
        link: e.detail.link,
        suffix: e.detail.suffix || '',
      });
    } else {
      setAuthModalMessage(e.detail?.message || '');
    }

    setShowAuthModal(true);
  };
  window.addEventListener('showAuthModal', handleShowModal);
  return () => window.removeEventListener('showAuthModal', handleShowModal);
}, []);


  // Listen for storage changes (other tabs logging out)
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

  // When network recovers, re-verify auth if we have a token but no user yet
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const handleOnline = () => {
      const token = localStorage.getItem('precifio_token');
      if (token && !userRef.current) {
        fetchUser(token);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
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
      if (!res.ok) return; 
      const data = await res.json();
      if (data.profile) {
        setProfile(data.profile);
      }
    } catch (err) {
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('precifio_token');
    setUser(null);
    setProfile(null);
    setIsGuest(true);
  }, []);

 const requireAuth = useCallback((action, message) => {
  if (isGuest) {
    setAuthModalMode(action === 'signup' ? 'signup' : 'login');
    setAuthModalMessage(message || '');
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
    setProfile,
    isGuest,
    loading,
    guestLimitReached,
    authModalMessage,
    setAuthModalMessage,
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

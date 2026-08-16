import { useState, useCallback, useEffect, useRef } from 'react';
import { AuthContext } from './auth-context';
import { loadSession, saveSession, clearSession, expiresAt } from '../auth/session';
import { setUnauthorizedHandler } from '../api/client';

export function AuthProvider({ children }) {
  // loadSession validates `exp`, so an expired token never produces a
  // signed-in-looking shell that immediately 401s.
  const [session, setSession] = useState(loadSession);
  const [expiredNotice, setExpiredNotice] = useState(false);
  const timerRef = useRef(null);

  const endSession = useCallback((wasExpiry) => {
    clearSession();
    setSession(null);
    setExpiredNotice(!!wasExpiry);
  }, []);

  const login = useCallback((token, username) => {
    const next = { token, username };
    saveSession(next);
    setSession(next);
    setExpiredNotice(false);
  }, []);

  const logout = useCallback(() => endSession(false), [endSession]);
  const clearExpiredNotice = useCallback(() => setExpiredNotice(false), []);

  // A 401 from anywhere in the app drops the session through the same path a
  // manual logout takes, so there is only one way to become signed out.
  useEffect(() => {
    setUnauthorizedHandler(() => endSession(true));
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  // Sign out the moment the token actually expires rather than waiting for the
  // next request to fail. Someone who leaves the PWA open on the rack between
  // sets shouldn't discover the session died only when they hit Finish.
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!session?.token) return;
    const exp = expiresAt(session.token);
    if (!exp) return;
    const ms = exp.getTime() - Date.now();
    // setTimeout clamps above ~24.8 days; only arm it when it fits.
    if (ms > 0 && ms < 2 ** 31 - 1) {
      timerRef.current = setTimeout(() => endSession(true), ms);
    }
    return () => clearTimeout(timerRef.current);
  }, [session, endSession]);

  // Signing out in one tab signs out the others.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'liftlog.session') setSession(loadSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = {
    token: session?.token ?? null,
    username: session?.username ?? null,
    isAuthenticated: !!session?.token,
    expiredNotice,
    clearExpiredNotice,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

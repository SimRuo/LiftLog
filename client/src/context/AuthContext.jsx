import { useState, useCallback, useEffect, useRef } from 'react';
import { AuthContext } from './auth-context';
import { loadSession, saveSession, clearSession, expiresAt, userIdFromToken } from '../auth/session';
import { setUnauthorizedHandler } from '../api/client';
import { clearCachedReads } from '../offline/store';

/**
 * An expired token is only worth something while there is no network.
 *
 * Offline it grants read-only access: the device can show what it has already
 * cached and keep queueing workouts, because there is no way to refresh a token
 * with no connection, and throwing someone out mid-session would strand both
 * them and their unsent sets. With a connection there is no excuse, so it is
 * discarded on the spot — which is the original behaviour, and what prevents a
 * signed-in-looking shell that 401s on every request.
 */
function initialSession() {
  const session = loadSession();
  if (session?.expired && navigator.onLine) {
    clearCachedReads(userIdFromToken(session.token));
    clearSession();
    return null;
  }
  return session;
}

export function AuthProvider({ children }) {
  // loadSession tags an expired token rather than deleting it; what that token
  // is still worth is decided by initialSession and by the online listener.
  const [session, setSession] = useState(initialSession);
  const [expiredNotice, setExpiredNotice] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const timerRef = useRef(null);

  // Mirrored into a ref so the listeners below can read the current session
  // without being torn down and re-registered on every session change.
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const endSession = useCallback((wasExpiry) => {
    // Wipe this user's mirrored reads on the way out so the next account on the
    // device can't be shown them. The outbox survives deliberately — it holds
    // workouts that exist nowhere else yet.
    clearCachedReads(userIdFromToken(sessionRef.current?.token));
    clearSession();
    setSession(null);
    setExpiredNotice(!!wasExpiry);
  }, []);

  const login = useCallback((token, username) => {
    const next = { token, username, expired: false };
    saveSession({ token, username });
    setSession(next);
    setExpiredNotice(false);
  }, []);

  const logout = useCallback(() => endSession(false), [endSession]);
  const clearExpiredNotice = useCallback(() => setExpiredNotice(false), []);

  // Regaining a connection is what ends a read-only grace period: the token can
  // be renewed now, so it has to be.
  useEffect(() => {
    const on = () => {
      setOnline(true);
      if (sessionRef.current?.expired) endSession(true);
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [endSession]);

  // A 401 from anywhere in the app drops the session through the same path a
  // manual logout takes, so there is only one way to become signed out.
  useEffect(() => {
    setUnauthorizedHandler(() => endSession(true));
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  // React to the token lapsing the moment it happens rather than waiting for
  // the next request to fail. Someone who leaves the PWA open on the rack
  // between sets shouldn't discover it only when they hit Finish. Online that
  // ends the session; offline it drops to the read-only grace period.
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!session?.token || session.expired) return undefined;
    const exp = expiresAt(session.token);
    if (!exp) return undefined;
    const ms = exp.getTime() - Date.now();
    // setTimeout clamps above ~24.8 days; only arm it when it fits.
    if (ms > 0 && ms < 2 ** 31 - 1) {
      timerRef.current = setTimeout(() => {
        if (navigator.onLine) endSession(true);
        else setSession((current) => current && { ...current, expired: true });
      }, ms);
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

  const readOnly = !!session?.token && !!session.expired;

  const value = {
    token: session?.token ?? null,
    username: session?.username ?? null,
    // Offline, an expired token still gets you into the shell — read-only.
    isAuthenticated: !!session?.token && (!session.expired || !online),
    readOnly,
    expiredNotice,
    clearExpiredNotice,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

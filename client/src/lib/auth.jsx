import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from './api';
import { BootLoader } from '@/components/app/brand';

const AuthContext = createContext(null);
const getInitialUser = () => {
  try {
    const raw = localStorage.getItem('tv_mock_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const signedOut = { loading: false, user: null, expiresAt: null, pendingAccess: 0, vaultUnlocked: false, elevatedUntil: null };

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => {
    const initialUser = getInitialUser();
    return {
      loading: false,
      user: initialUser,
      expiresAt: Date.now() + 60 * 60 * 1000,
      pendingAccess: 0,
      vaultUnlocked: true,
      elevatedUntil: Date.now() + 1800000
    };
  });

  const refresh = useCallback(async () => {
    try {
      const { user, expiresAt, pendingAccess, vaultUnlocked, elevatedUntil } = await api('/auth/me');
      if (user) {
        // Enforce 60 minutes session limit
        const sessionExpiry = expiresAt && (new Date(expiresAt).getTime() - Date.now() <= 3600000)
          ? new Date(expiresAt).getTime()
          : Date.now() + 60 * 60 * 1000;
        setState({ loading: false, user, expiresAt: sessionExpiry, pendingAccess, vaultUnlocked, elevatedUntil });
      }
    } catch {
      // If /auth/me fails but we have an active user in localStorage, keep them signed in!
      const localUser = getInitialUser();
      if (!localUser) {
        setState(signedOut);
      } else {
        setState((prev) => ({
          ...prev,
          user: localUser,
          expiresAt: prev.expiresAt || (Date.now() + 60 * 60 * 1000)
        }));
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const onExpired = () => {
      try { localStorage.removeItem('tv_mock_current_user'); } catch {}
      setState(signedOut);
    };
    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, [refresh]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    try { localStorage.removeItem('tv_mock_current_user'); } catch {}
    try { localStorage.removeItem('tv_mock_token'); } catch {}
    setState(signedOut);
  };

  // vault: PIN entered once this session. elevated: security check passed (time it runs out).
  const setVault = (vaultUnlocked) => setState((s) => ({ ...s, vaultUnlocked }));
  const setElevated = (elevatedUntil) => setState((s) => ({ ...s, elevatedUntil }));

  return <AuthContext.Provider value={{ ...state, refresh, logout, setVault, setElevated }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Not signed in -> /reauth, which asks only for the Authenticator code when the 12 h
// re-auth cookie is still valid, and otherwise sends the visitor to the welcome page.
export function RequireAuth({ children, roles }) {
  const { loading, user } = useAuth();
  if (loading) return <BootLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

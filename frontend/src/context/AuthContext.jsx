import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { getErrorMessage } from '../services/authService';

const ACCESS_KEY = 'lexcore_access';
const REFRESH_KEY = 'lexcore_refresh';
const USER_KEY = 'lexcore_user';

const AuthContext = createContext(undefined);

function readStoredAuth() {
  try {
    const access = localStorage.getItem(ACCESS_KEY);
    const refresh = localStorage.getItem(REFRESH_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    const user = rawUser ? JSON.parse(rawUser) : null;
    return { access, refresh, user };
  } catch {
    return { access: null, refresh: null, user: null };
  }
}

function persistAuth({ access, refresh, user }) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  else localStorage.removeItem(ACCESS_KEY);

  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  else localStorage.removeItem(REFRESH_KEY);

  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

function clearPersistedAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }) {
  const stored = readStoredAuth();
  const [user, setUser] = useState(stored.user);
  const [accessToken, setAccessToken] = useState(stored.access);
  const [refreshToken, setRefreshToken] = useState(stored.refresh);
  const [loading, setLoading] = useState(Boolean(stored.access));

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const access = localStorage.getItem(ACCESS_KEY);
      const refresh = localStorage.getItem(REFRESH_KEY);

      if (!access) {
        if (!cancelled) {
          setUser(null);
          setAccessToken(null);
          setRefreshToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        const me = await authService.getCurrentUser(access);
        if (cancelled) return;
        setAccessToken(access);
        setRefreshToken(refresh);
        setUser(me);
        persistAuth({ access, refresh, user: me });
      } catch {
        if (cancelled) return;
        clearPersistedAuth();
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const tokens = await authService.login({ email, password });
    const access = tokens.access;
    const refresh = tokens.refresh;

    try {
      const me = await authService.getCurrentUser(access);
      persistAuth({ access, refresh, user: me });
      setAccessToken(access);
      setRefreshToken(refresh);
      setUser(me);
      return me;
    } catch (err) {
      clearPersistedAuth();
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      throw err;
    }
  }, []);

  const register = useCallback(async (payload) => {
    return authService.register(payload);
  }, []);

  const logout = useCallback(async () => {
    const access = accessToken || localStorage.getItem(ACCESS_KEY);
    const refresh = refreshToken || localStorage.getItem(REFRESH_KEY);

    try {
      if (access && refresh) {
        await authService.logout({ access, refresh });
      }
    } catch {
      // Always clear local session even if blacklist call fails.
    } finally {
      clearPersistedAuth();
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    }
  }, [accessToken, refreshToken]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(user && accessToken),
      loading,
      login,
      register,
      logout,
      getErrorMessage,
    }),
    [user, accessToken, refreshToken, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

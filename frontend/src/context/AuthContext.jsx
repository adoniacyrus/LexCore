import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

const AUTH_KEY = 'lexcore_client_session';
const AuthContext = createContext(undefined);

function readSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readSession());

  const login = useCallback(({ email, name }) => {
    const session = {
      email: email.trim().toLowerCase(),
      name: name?.trim() || email.split('@')[0],
      role: 'client',
      authenticatedAt: new Date().toISOString(),
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const register = useCallback(({ fullName, email, mobile }) => {
    const session = {
      email: email.trim().toLowerCase(),
      name: fullName.trim(),
      mobile: mobile.trim(),
      role: 'client',
      authenticatedAt: new Date().toISOString(),
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [user, login, register, logout]
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

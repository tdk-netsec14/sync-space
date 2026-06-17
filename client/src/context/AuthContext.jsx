import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { fetchMe, loginUser, registerUser, storageKeys, refreshToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKeys.userKey);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem(storageKeys.tokenKey) || '');
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = Boolean(token && user);

  useEffect(() => {
    let active = true;

    async function validateToken() {
      const savedToken = localStorage.getItem(storageKeys.tokenKey);

      // If we have a token already, just validate it
      if (savedToken) {
        try {
          const response = await fetchMe();
          if (!active) return;
          setToken(savedToken);
          setUser(response.data.user);
          localStorage.setItem(storageKeys.userKey, JSON.stringify(response.data.user));
          setIsLoading(false);
          return;
        } catch (error) {
          // If token invalid, fall through to refresh attempt
          console.warn('Existing token invalid, attempting refresh');
        }
      }

      // No valid token – attempt silent refresh using httpOnly cookie (if present)
      try {
        const refreshResp = await refreshToken();
        const newToken = refreshResp.data.token || refreshResp.data.accessToken;
        if (newToken) {
          localStorage.setItem(storageKeys.tokenKey, newToken);
          setToken(newToken);
          const me = await fetchMe();
          setUser(me.data.user);
          localStorage.setItem(storageKeys.userKey, JSON.stringify(me.data.user));
          if (active) setIsLoading(false);
          return; // success, skip logout
        }
      } catch (e) {
        // Refresh failed – proceed to logout (no session)
      }

      // No token and refresh failed – clear loading and stay logged out
      if (active) setIsLoading(false);
    }

    validateToken();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback((nextToken, nextUser) => {
    localStorage.setItem(storageKeys.tokenKey, nextToken);
    localStorage.setItem(storageKeys.userKey, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const updateUser = useCallback((nextUser, nextToken = token) => {
    if (nextToken) {
      localStorage.setItem(storageKeys.tokenKey, nextToken);
      setToken(nextToken);
    }

    localStorage.setItem(storageKeys.userKey, JSON.stringify(nextUser));
    setUser(nextUser);
  }, [token]);

  const logout = useCallback(() => {
    localStorage.removeItem(storageKeys.tokenKey);
    localStorage.removeItem(storageKeys.userKey);
    localStorage.removeItem(storageKeys.workspaceKey);
    setToken('');
    setUser(null);
    window.location.href = '/';
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated,
      login,
      updateUser,
      logout,
      loginUser,
      registerUser,
      fetchMe
    }),
    [user, token, isLoading, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

export default AuthContext;

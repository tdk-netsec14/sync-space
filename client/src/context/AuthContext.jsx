import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { fetchMe, loginUser, registerUser, storageKeys } from '../services/api';

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

      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetchMe();
        if (!active) {
          return;
        }

        setToken(savedToken);
        setUser(response.data.user);
        localStorage.setItem(storageKeys.userKey, JSON.stringify(response.data.user));
      } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          logout();
        } else {
          console.warn(
            'Network connection to server failed. Retaining active session locally.',
            error
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
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

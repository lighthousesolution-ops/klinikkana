import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, ensureSeed } from '@/lib/store';
import { IS_PHP } from '@/lib/dataMode';
import { phpAuthApi } from '@/lib/apiPhp';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ensureSeed();
    // In PHP mode, prefer the cached user from a previous PHP login;
    // fall back to the local session for the mock data mode.
    const u = IS_PHP ? (phpAuthApi.currentUser() || authApi.currentUser()) : authApi.currentUser();
    setUser(u);
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    if (IS_PHP) {
      // Real PHP backend: token + user come from MySQL.
      const { user } = await phpAuthApi.login(username, password);
      setUser(user);
      return user;
    }
    const { user } = authApi.login(username, password);
    setUser(user);
    return user;
  };

  const logout = () => {
    if (IS_PHP) phpAuthApi.logout();
    authApi.logout();
    setUser(null);
  };

  const hasRole = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

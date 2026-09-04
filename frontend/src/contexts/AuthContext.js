import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, ensureSeed } from '@/lib/store';
import { IS_PHP } from '@/lib/dataMode';
import { phpAuthApi } from '@/lib/apiPhp';
import { pullAllFromServer } from '@/lib/pullFromServer';

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
    // If there is a live PHP session, pull latest data from MySQL so every
    // device sees the same picture on load. Fire-and-forget: UI is still
    // usable from cached localStorage while the fetch runs.
    if (IS_PHP && u) pullAllFromServer();
    setLoading(false);
  }, []);

  // Auto-refresh from MySQL whenever the tab comes back into focus (user
  // switched away and back, unlocked device, resumed from another app...).
  // Also refresh every 60s while the tab is active, so long sessions stay
  // fresh without needing a manual "Sync" click.
  useEffect(() => {
    if (!IS_PHP) return undefined;
    let pollId;

    const refresh = () => {
      // Skip if the user is not logged in or the tab is hidden — avoid
      // wasted requests.
      if (document.hidden) return;
      const token = localStorage.getItem('kk_token');
      if (!token) return;
      pullAllFromServer().then(() => {
        // Broadcast so pages that cache derived state can re-read.
        window.dispatchEvent(new Event('kk_settings_changed'));
      });
    };

    const onVisibility = () => { if (!document.hidden) refresh(); };
    const onFocus = () => refresh();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    pollId = setInterval(refresh, 60_000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      clearInterval(pollId);
    };
  }, []);

  const login = async (username, password) => {
    // Clear any lingering branch selection from a previous session so the new
    // user starts from their own assigned branch, not the last admin's pick.
    localStorage.removeItem('kk_current_branch');
    if (IS_PHP) {
      // Real PHP backend: token + user come from MySQL.
      const { user } = await phpAuthApi.login(username, password);
      setUser(user);
      // Right after login, hydrate localStorage from MySQL so a fresh
      // device does not fall back to seeded demo data.
      await pullAllFromServer();
      return user;
    }
    const { user } = authApi.login(username, password);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('kk_current_branch');
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

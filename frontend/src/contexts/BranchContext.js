import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { branchesApi } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';

const BranchContext = createContext(null);

/**
 * Multi-branch state.
 * - `branches`: list of all branches.
 * - `currentBranchId`: null = All Branches (admin only), else specific branch id.
 * - Non-admin users are locked to their assigned branch (if any).
 */
export function BranchProvider({ children }) {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener('kk_branch_changed', refresh);
    window.addEventListener('kk_settings_changed', refresh);
    return () => {
      window.removeEventListener('kk_branch_changed', refresh);
      window.removeEventListener('kk_settings_changed', refresh);
    };
  }, []);

  const branches = branchesApi.list();

  // Determine effective current branch based on user's role & branch assignment
  const currentBranchId = useMemo(() => {
    if (!user) return null;
    // Non-admin locked to their branch
    if (user.role !== 'admin') {
      return user.branch_id || (branches.find((b) => b.is_default)?.id ?? null);
    }
    // Admin: honor an explicit switch (localStorage), else fall back to
    // the admin's own assigned branch, else "All".
    const stored = branchesApi.getCurrent();
    if (stored !== null && stored !== undefined) return stored;
    return user.branch_id || null;
  }, [user, branches, tick]);

  const currentBranch = currentBranchId ? branches.find((b) => b.id === currentBranchId) : null;

  const canSwitch = user?.role === 'admin';

  const setBranch = (id) => {
    if (!canSwitch) return;
    branchesApi.setCurrent(id);
  };

  // Helper to filter arrays by current branch scope
  const scope = useMemo(() => {
    return (items) => {
      if (!currentBranchId) return items; // 'all'
      return items.filter((x) => !x.branch_id || x.branch_id === currentBranchId);
    };
  }, [currentBranchId]);

  return (
    <BranchContext.Provider value={{ branches, currentBranchId, currentBranch, canSwitch, setBranch, scope }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
}

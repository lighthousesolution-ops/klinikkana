import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Wrench, Package, UserCog, LogOut, Smartphone, BarChart3, Settings, Building2, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/mockData';
import { settingsApi } from '@/lib/store';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'technician', 'cashier'] },
  { to: '/repairs', label: 'Servis', icon: Wrench, roles: ['admin', 'technician', 'cashier'] },
  { to: '/customers', label: 'Pelanggan', icon: Users, roles: ['admin', 'cashier', 'technician'] },
  { to: '/spareparts', label: 'Sparepart', icon: Package, roles: ['admin', 'technician'] },
  { to: '/reports', label: 'Laporan', icon: BarChart3, roles: ['admin'] },
  { to: '/reviews', label: 'Ulasan Pelanggan', icon: Star, roles: ['admin', 'cashier'] },
  { to: '/users', label: 'Kelola User', icon: UserCog, roles: ['admin'] },
  { to: '/branches', label: 'Cabang', icon: Building2, roles: ['admin'] },
  { to: '/settings', label: 'Konfigurasi', icon: Settings, roles: ['admin'] },
];

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [s, setS] = useState(() => settingsApi.get());

  useEffect(() => {
    const refresh = () => setS(settingsApi.get());
    window.addEventListener('storage', refresh);
    window.addEventListener('kk_settings_changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('kk_settings_changed', refresh);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const items = NAV.filter((n) => n.roles.includes(user?.role));

  return (
    <aside className="h-full w-64 shrink-0 flex flex-col bg-sidebar text-sidebar-fg" data-testid="app-sidebar">
      <div className="px-6 py-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          {s.logo_url ? (
            <img src={s.logo_url} alt="Logo" className="h-10 w-10 rounded-md object-cover bg-white/10" />
          ) : (
            <div className="h-10 w-10 rounded-md bg-sidebar-active grid place-items-center">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-display font-bold text-[15px] leading-tight tracking-tight truncate">{s.shop_name || 'Klinik Kana'}</div>
            <div className="overline text-sidebar-muted mt-0.5">Servis HP</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            data-testid={`nav-${to.replace('/', '')}`}
            className={({ isActive }) => cn(
              'group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-active text-white shadow-sm'
                : 'text-sidebar-fg/80 hover:bg-sidebar-hover hover:text-white'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-sidebar-active text-white grid place-items-center font-semibold">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate" data-testid="sidebar-user-name">{user?.full_name}</div>
            <div className="overline text-sidebar-muted truncate">{ROLE_LABELS[user?.role]}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="btn-logout"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-sidebar-border hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </div>
    </aside>
  );
}

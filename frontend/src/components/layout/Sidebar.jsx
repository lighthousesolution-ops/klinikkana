import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Wrench, Package, UserCog, LogOut, Smartphone, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/mockData';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'technician', 'cashier'] },
  { to: '/repairs', label: 'Servis', icon: Wrench, roles: ['admin', 'technician', 'cashier'] },
  { to: '/customers', label: 'Pelanggan', icon: Users, roles: ['admin', 'cashier'] },
  { to: '/spareparts', label: 'Sparepart', icon: Package, roles: ['admin', 'technician'] },
  { to: '/reports', label: 'Laporan', icon: BarChart3, roles: ['admin'] },
  { to: '/users', label: 'Kelola User', icon: UserCog, roles: ['admin'] },
];

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const items = NAV.filter((n) => n.roles.includes(user?.role));

  return (
    <aside className="h-full w-64 shrink-0 border-r border-border bg-card flex flex-col" data-testid="app-sidebar">
      <div className="px-6 py-6 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display font-bold text-[15px] leading-tight tracking-tight">Klinik Kana</div>
            <div className="overline text-muted-foreground mt-0.5">Servis HP</div>
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
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-accent text-accent-foreground grid place-items-center font-semibold">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate" data-testid="sidebar-user-name">{user?.full_name}</div>
            <div className="overline text-muted-foreground truncate">{ROLE_LABELS[user?.role]}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="btn-logout"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </div>
    </aside>
  );
}

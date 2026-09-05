import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wrench, DollarSign, CheckCircle2, AlertTriangle, Plus, ArrowRight, Package, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { repairsApi, sparepartsApi, customersApi, computeTotal } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { formatIDR } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';

const STATUS_COLORS = {
  pending: '#F59E0B',
  in_progress: '#3B82F6',
  ready: '#10B981',
  picked_up: '#6B7280',
};

function Kpi({ icon: Icon, label, value, sub, tone = 'default', testid }) {
  const toneClasses = {
    default: 'text-foreground',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    primary: 'text-primary',
  };
  return (
    <div className="rounded-lg border border-border bg-card p-5 hover:-translate-y-0.5 hover:shadow-sm transition-transform" data-testid={testid}>
      <div className="flex items-start justify-between mb-4">
        <div className="overline text-muted-foreground">{label}</div>
        <div className={`h-9 w-9 rounded-md grid place-items-center bg-accent ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={`font-display text-3xl font-bold tracking-tight ${toneClasses[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1.5">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { scope, currentBranch } = useBranch();
  const navigate = useNavigate();

  const repairs = scope(repairsApi.list());
  const spareparts = scope(sparepartsApi.list());
  const customers = customersApi.list(); // Customers are global across branches

  const stats = useMemo(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth();
    const active = repairs.filter((r) => ['pending', 'in_progress', 'ready'].includes(r.status)).length;
    const completed = repairs.filter((r) => r.status === 'picked_up').length;
    const lowStock = spareparts.filter((s) => s.stock <= s.low_stock_threshold).length;
    const monthlyRevenue = repairs
      .filter((r) => r.status === 'picked_up' && r.picked_up_at)
      .filter((r) => { const d = new Date(r.picked_up_at); return d.getFullYear() === yr && d.getMonth() === mo; })
      .reduce((s, r) => s + computeTotal(r).total, 0);
    return { active, completed, lowStock, monthlyRevenue };
  }, [repairs, spareparts]);

  // Revenue for last 6 months
  const revenueData = useMemo(() => {
    const arr = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('id-ID', { month: 'short' });
      const total = repairs
        .filter((r) => r.status === 'picked_up' && r.picked_up_at)
        .filter((r) => { const p = new Date(r.picked_up_at); return p.getFullYear() === d.getFullYear() && p.getMonth() === d.getMonth(); })
        .reduce((s, r) => s + computeTotal(r).total, 0);
      arr.push({ month: label, revenue: total });
    }
    return arr;
  }, [repairs]);

  const statusData = useMemo(() => {
    const counts = { pending: 0, in_progress: 0, ready: 0, picked_up: 0 };
    repairs.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return [
      { name: 'Pending', value: counts.pending, key: 'pending' },
      { name: 'In Progress', value: counts.in_progress, key: 'in_progress' },
      { name: 'Ready', value: counts.ready, key: 'ready' },
      { name: 'Picked Up', value: counts.picked_up, key: 'picked_up' },
    ];
  }, [repairs]);

  const recentRepairs = [...repairs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
  const lowStockItems = spareparts.filter((s) => s.stock <= s.low_stock_threshold).slice(0, 5);
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  // Top 5 jasa terlaris bulan ini — aggregate dari services_json
  const topServices = useMemo(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth();
    const monthly = repairs.filter((r) => {
      const d = new Date(r.created_at);
      return d.getFullYear() === yr && d.getMonth() === mo;
    });
    const agg = {};
    monthly.forEach((r) => {
      const services = Array.isArray(r.services_json) ? r.services_json : [];
      services.forEach((s) => {
        const name = (s.name || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!agg[key]) agg[key] = { name, count: 0, revenue: 0 };
        agg[key].count += 1;
        agg[key].revenue += Number(s.price) || 0;
      });
    });
    return Object.values(agg)
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 5);
  }, [repairs]);

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="title-box font-display font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {currentBranch ? `Cabang ${currentBranch.name}` : 'Ringkasan gabungan semua cabang'}.
          </p>
        </div>
        <button
          onClick={() => navigate('/repairs/new')}
          data-testid="btn-new-repair-shortcut"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Tiket Baru
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi testid="kpi-active" icon={Wrench} label="Servis Aktif" value={stats.active} sub="Pending + In Progress + Ready" tone="primary" />
        <Kpi testid="kpi-revenue" icon={DollarSign} label="Pendapatan Bulan Ini" value={formatIDR(stats.monthlyRevenue)} sub="Total tiket picked-up" tone="success" />
        <Kpi testid="kpi-completed" icon={CheckCircle2} label="Servis Selesai" value={stats.completed} sub="Sepanjang waktu" />
        <Kpi testid="kpi-lowstock" icon={AlertTriangle} label="Sparepart Menipis" value={stats.lowStock} sub="Perlu restock segera" tone="warning" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5" data-testid="chart-revenue">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="overline text-muted-foreground">Pendapatan</div>
              <h3 className="font-display text-lg font-semibold tracking-tight">6 Bulan Terakhir</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}
                tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : v >= 1000 ? `${(v/1000).toFixed(0)}rb` : v} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => formatIDR(v)}
                cursor={{ fill: 'hsl(var(--accent))' }}
              />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-card p-5" data-testid="chart-status">
          <div className="mb-4">
            <div className="overline text-muted-foreground">Distribusi</div>
            <h3 className="font-display text-lg font-semibold tracking-tight">Status Servis</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {statusData.map((s) => <Cell key={s.key} fill={STATUS_COLORS[s.key]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {statusData.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[s.key] }} />
                <span className="text-muted-foreground">{s.name}</span>
                <span className="ml-auto font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 Jasa Terlaris Bulan Ini */}
      <div className="rounded-lg border border-border bg-card p-5" data-testid="chart-top-services">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-accent grid place-items-center text-primary"><Trophy className="h-4 w-4" /></div>
            <div>
              <div className="overline text-muted-foreground">Produk Andalan</div>
              <h3 className="font-display text-lg font-semibold tracking-tight">Top 5 Jasa Bulan Ini</h3>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {topServices.reduce((s, x) => s + x.count, 0)} order jasa
          </div>
        </div>
        {topServices.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-md" data-testid="top-services-empty">
            <Trophy className="h-6 w-6 mx-auto mb-2 opacity-40" />
            Belum ada jasa dipesan bulan ini. Katalog jasa akan mulai muncul di sini setelah teknisi buat tiket baru.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, topServices.length * 44)}>
            <BarChart data={topServices} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={180} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: 'hsl(var(--accent))' }}
                formatter={(v, name) => name === 'revenue' ? formatIDR(v) : `${v}x`}
                labelFormatter={(l) => l}
              />
              <Bar dataKey="count" name="Jumlah Order" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]}>
                {topServices.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? 'hsl(var(--primary))' : i === 1 ? '#3B82F6' : i === 2 ? '#10B981' : i === 3 ? '#F59E0B' : '#6B7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {topServices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-4 pt-4 border-t border-border">
            {topServices.map((s, i) => (
              <div key={s.name} data-testid={`top-service-${i}`} className="rounded-md border border-border p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">#{i + 1}</div>
                <div className="text-xs font-semibold truncate mt-0.5" title={s.name}>{s.name}</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-base font-display font-bold">{s.count}x</span>
                  <span className="text-[11px] text-muted-foreground font-mono">{formatIDR(s.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent + Low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card" data-testid="recent-repairs">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <div className="overline text-muted-foreground">Aktivitas</div>
              <h3 className="font-display text-lg font-semibold tracking-tight">Tiket Terbaru</h3>
            </div>
            <Link to="/repairs" className="text-sm text-primary hover:underline flex items-center gap-1" data-testid="link-all-repairs">
              Lihat semua <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentRepairs.length === 0 && <div className="p-6 text-sm text-muted-foreground">Belum ada tiket.</div>}
            {recentRepairs.map((r) => (
              <Link
                to={`/repairs/${r.id}`}
                key={r.id}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-accent transition-colors"
                data-testid={`recent-repair-${r.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{r.ticket_no}</span>
                    <span className="text-sm font-semibold truncate">{customerMap[r.customer_id]?.name || '-'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{r.device_brand} {r.device_model} — {r.complaint}</div>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card" data-testid="low-stock-list">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <div className="overline text-muted-foreground">Peringatan</div>
              <h3 className="font-display text-lg font-semibold tracking-tight">Stok Menipis</h3>
            </div>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {lowStockItems.length === 0 && <div className="p-6 text-sm text-muted-foreground">Semua stok aman.</div>}
            {lowStockItems.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{s.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{s.sku}</div>
                </div>
                <div className={`text-sm font-bold ${s.stock === 0 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
                  {s.stock} left
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

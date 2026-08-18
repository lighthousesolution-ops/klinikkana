import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { FileSpreadsheet, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { repairsApi, customersApi, sparepartsApi, branchesApi, usersApi, settingsApi, computeTotal } from '@/lib/store';
import { formatIDR, formatDate } from '@/lib/utils';
import { useBranch } from '@/contexts/BranchContext';
import { exportMonthlyExcel, exportMonthlyPDF } from '@/lib/reportExport';

export default function ReportsPage() {
  const [range, setRange] = useState(6); // months
  const { scope, currentBranch } = useBranch();
  const repairs = scope(repairsApi.list());
  const customers = customersApi.list();
  const spareparts = sparepartsApi.list();
  const branches = branchesApi.list();

  // ============ EXPORT ============
  // Month selector for export (default: current month).
  const now = new Date();
  const [exportMonth, setExportMonth] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [exporting, setExporting] = useState(false);

  const buildExportCtx = () => {
    const [y, m] = exportMonth.split('-').map(Number);
    const year = y;
    const monthIdx = m - 1;
    // Filter: repairs that finished this month, in the current branch scope.
    const monthRepairs = repairs.filter((r) => {
      if (r.status !== 'picked_up') return false;
      const d = r.picked_up_at ? new Date(r.picked_up_at) : null;
      return d && d.getFullYear() === year && d.getMonth() === monthIdx;
    });
    return {
      year, month: monthIdx,
      repairs: monthRepairs,
      customers,
      spareparts,
      branches,
      technicians: usersApi.list().filter((u) => u.role === 'technician' || u.role === 'admin'),
      shopName: settingsApi.get().shop_name,
      branchName: currentBranch?.name || 'Semua Cabang',
    };
  };

  const doExportExcel = () => {
    setExporting(true);
    try {
      const ctx = buildExportCtx();
      if (ctx.repairs.length === 0) {
        toast.warning('Tidak ada tiket selesai di bulan tersebut');
        return;
      }
      const { filename, rowCount } = exportMonthlyExcel(ctx);
      toast.success(`${filename} berhasil diunduh (${rowCount} baris)`);
    } catch (e) {
      toast.error(`Gagal ekspor Excel: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const doExportPDF = () => {
    setExporting(true);
    try {
      const ctx = buildExportCtx();
      if (ctx.repairs.length === 0) {
        toast.warning('Tidak ada tiket selesai di bulan tersebut');
        return;
      }
      const { filename, rowCount } = exportMonthlyPDF(ctx);
      toast.success(`${filename} berhasil diunduh (${rowCount} baris)`);
    } catch (e) {
      toast.error(`Gagal ekspor PDF: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Per-branch breakdown (only when viewing all branches)
  const branchBreakdown = React.useMemo(() => {
    if (currentBranch) return [];
    const allRepairs = repairsApi.list();
    return branches.map((b) => {
      const items = allRepairs.filter((r) => r.branch_id === b.id && r.status === 'picked_up');
      const revenue = items.reduce((s, r) => s + computeTotal(r).total, 0);
      return { branch: b, tickets: items.length, revenue };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [branches, currentBranch]);

  const monthly = useMemo(() => {
    const arr = [];
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      const monthRepairs = repairs.filter((r) => {
        const p = r.picked_up_at ? new Date(r.picked_up_at) : null;
        return r.status === 'picked_up' && p && p.getFullYear() === d.getFullYear() && p.getMonth() === d.getMonth();
      });
      const revenue = monthRepairs.reduce((s, r) => s + computeTotal(r).total, 0);
      const cost = monthRepairs.reduce((s, r) => {
        const parts = (r.parts_used || []).reduce((ss, p) => {
          const sp = spareparts.find((x) => x.id === p.sparepart_id);
          return ss + (sp ? sp.cost_price * p.qty : 0);
        }, 0);
        return s + parts;
      }, 0);
      arr.push({ month: label, revenue, cost, profit: revenue - cost, tickets: monthRepairs.length });
    }
    return arr;
  }, [repairs, spareparts, range]);

  const totals = monthly.reduce((a, m) => ({
    revenue: a.revenue + m.revenue,
    cost: a.cost + m.cost,
    profit: a.profit + m.profit,
    tickets: a.tickets + m.tickets,
  }), { revenue: 0, cost: 0, profit: 0, tickets: 0 });

  const topCustomers = useMemo(() => {
    const map = new Map();
    repairs.forEach((r) => {
      if (r.status !== 'picked_up') return;
      const t = computeTotal(r).total;
      map.set(r.customer_id, (map.get(r.customer_id) || 0) + t);
    });
    return [...map.entries()]
      .map(([id, total]) => ({ customer: customers.find((c) => c.id === id), total }))
      .filter((x) => x.customer)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [repairs, customers]);

  return (
    <div className="space-y-8 animate-fade-in" data-testid="reports-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="title-box font-display font-bold tracking-tight">Laporan Keuangan</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {currentBranch ? currentBranch.name : 'Gabungan semua cabang'} — {range} bulan terakhir
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-md border border-border bg-card">
          {[3, 6, 12].map((n) => (
            <button key={n} onClick={() => setRange(n)} data-testid={`range-${n}`}
              className={`px-3 h-8 rounded-sm text-sm font-medium transition-colors ${range === n ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
              {n} Bulan
            </button>
          ))}
        </div>
      </div>

      {/* ============ EXPORT LAPORAN ============ */}
      <div className="rounded-lg border border-border bg-card p-5" data-testid="export-panel">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-accent grid place-items-center text-primary shrink-0">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <div className="overline text-muted-foreground">Ekspor untuk Pajak & Akuntansi</div>
              <h3 className="font-display text-lg font-semibold tracking-tight">Unduh Laporan Bulanan</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Berisi seluruh tiket <b>selesai</b> pada bulan terpilih di cabang {currentBranch?.name || 'gabungan'}. Termasuk pelanggan, teknisi, jasa, sparepart, DP, cicilan, sisa, HPP, dan laba.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Pilih Bulan</label>
              <input
                type="month"
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
                data-testid="export-month"
                className="h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-mono"
              />
            </div>
            <button
              onClick={doExportExcel}
              disabled={exporting}
              data-testid="btn-export-excel"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
            <button
              onClick={doExportPDF}
              disabled={exporting}
              data-testid="btn-export-pdf"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-rose-600 text-white hover:bg-rose-700 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-5" data-testid="report-revenue">
          <div className="overline text-muted-foreground mb-2">Pendapatan</div>
          <div className="font-display text-2xl font-bold tracking-tight">{formatIDR(totals.revenue)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5" data-testid="report-cost">
          <div className="overline text-muted-foreground mb-2">Biaya Sparepart</div>
          <div className="font-display text-2xl font-bold tracking-tight">{formatIDR(totals.cost)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5" data-testid="report-profit">
          <div className="overline text-muted-foreground mb-2">Estimasi Laba</div>
          <div className="font-display text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{formatIDR(totals.profit)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5" data-testid="report-tickets">
          <div className="overline text-muted-foreground mb-2">Tiket Selesai</div>
          <div className="font-display text-2xl font-bold tracking-tight">{totals.tickets}</div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4">
          <div className="overline text-muted-foreground">Grafik</div>
          <h3 className="font-display text-lg font-semibold tracking-tight">Pendapatan vs Biaya</h3>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}
              tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : v >= 1000 ? `${(v/1000).toFixed(0)}rb` : v} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              formatter={(v) => formatIDR(v)}
              cursor={{ fill: 'hsl(var(--accent))' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenue" name="Pendapatan" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="cost" name="Biaya" fill="hsl(var(--status-pending))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {!currentBranch && branchBreakdown.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5" data-testid="branch-breakdown">
          <div className="mb-4">
            <div className="overline">Per Cabang</div>
            <h3 className="font-display text-lg font-semibold tracking-tight">Kontribusi Cabang</h3>
          </div>
          <div className="space-y-3">
            {branchBreakdown.map((b, i) => {
              const maxRev = branchBreakdown[0]?.revenue || 1;
              const pct = maxRev > 0 ? (b.revenue / maxRev) * 100 : 0;
              return (
                <div key={b.branch.id} data-testid={`branch-row-${b.branch.id}`}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-accent grid place-items-center font-display font-bold text-[11px]">{i + 1}</div>
                      <span className="font-semibold">{b.branch.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground uppercase">{b.branch.code}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground text-xs">{b.tickets} tiket</span>
                      <span className="font-mono font-semibold">{formatIDR(b.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-5" data-testid="top-customers">
        <div className="mb-4">
          <div className="overline">Loyalitas</div>
          <h3 className="font-display text-lg font-semibold tracking-tight">Pelanggan Teratas</h3>
        </div>
        <div className="mb-4">
          <div className="overline text-muted-foreground">Loyalitas</div>
          <h3 className="font-display text-lg font-semibold tracking-tight">Pelanggan Teratas</h3>
        </div>
        {topCustomers.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4">Belum ada data.</div>
        ) : (
          <div className="space-y-3">
            {topCustomers.map((t, i) => (
              <div key={t.customer.id} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-accent grid place-items-center font-display font-bold text-sm">{i + 1}</div>
                <div className="flex-1">
                  <div className="font-semibold">{t.customer.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{t.customer.phone}</div>
                </div>
                <div className="font-mono font-semibold">{formatIDR(t.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

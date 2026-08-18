import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { repairsApi, customersApi, usersApi } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/mockData';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';

export default function RepairsPage() {
  const { hasRole } = useAuth();
  const { scope, currentBranch } = useBranch();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tick, setTick] = useState(0);

  const repairs = scope(repairsApi.list());
  const customerMap = Object.fromEntries(customersApi.list().map((c) => [c.id, c]));
  const userMap = Object.fromEntries(usersApi.list().map((u) => [u.id, u]));

  const filtered = repairs
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
    .filter((r) => {
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        r.ticket_no.toLowerCase().includes(s) ||
        customerMap[r.customer_id]?.name.toLowerCase().includes(s) ||
        r.device_model.toLowerCase().includes(s) ||
        r.device_brand.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const del = (r) => {
    if (window.confirm(`Hapus tiket ${r.ticket_no}?`)) {
      repairsApi.delete(r.id);
      toast.success('Tiket dihapus');
      setTick((t) => t + 1);
    }
  };

  const counts = STATUS_ORDER.reduce((m, s) => ({ ...m, [s]: repairs.filter((r) => r.status === s).length }), {});

  return (
    <div className="space-y-6 animate-fade-in" data-testid="repairs-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="title-box font-display font-bold tracking-tight">Tiket Servis</h1>
          <p className="text-muted-foreground text-sm mt-2">{repairs.length} total tiket{currentBranch ? ` — ${currentBranch.name}` : ' (semua cabang)'}</p>
        </div>
        <button onClick={() => navigate('/repairs/new')} data-testid="btn-new-repair"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Tiket Baru
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[{ k: 'all', l: 'Semua', c: repairs.length }, ...STATUS_ORDER.map((s) => ({ k: s, l: STATUS_LABELS[s], c: counts[s] }))].map((t) => (
          <button
            key={t.k}
            onClick={() => setStatusFilter(t.k)}
            data-testid={`filter-${t.k}`}
            className={`px-4 h-9 rounded-md border text-sm font-medium transition-colors ${statusFilter === t.k ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}
          >
            {t.l} <span className="opacity-70 ml-1">{t.c}</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="repair-search"
              placeholder="Cari tiket, pelanggan, atau device..."
              className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left">Tiket</th>
                <th className="px-4 py-3 text-left">Pelanggan</th>
                <th className="px-4 py-3 text-left">Perangkat</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Teknisi</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Masuk</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Tidak ada tiket ditemukan.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-accent transition-colors" data-testid={`repair-row-${r.id}`}>
                  <td className="px-4 py-3">
                    <Link to={`/repairs/${r.id}`} className="font-mono text-xs text-primary hover:underline font-semibold" data-testid={`link-repair-${r.id}`}>{r.ticket_no}</Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{customerMap[r.customer_id]?.name || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.device_brand} {r.device_model}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{r.complaint}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{userMap[r.technician_id]?.full_name || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => navigate(`/repairs/${r.id}`)} title="Detail" data-testid={`btn-view-repair-${r.id}`}
                        className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      {hasRole('admin') && (
                        <button onClick={() => del(r)} title="Hapus" data-testid={`btn-delete-repair-${r.id}`}
                          className="h-8 w-8 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

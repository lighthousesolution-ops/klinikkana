import React, { useState } from 'react';
import { Plus, Search, Pencil, Trash2, X, AlertTriangle, ArrowRightLeft, History } from 'lucide-react';
import { toast } from 'sonner';
import { sparepartsApi, branchesApi, movementsApi } from '@/lib/store';
import { formatIDR, formatDateTime } from '@/lib/utils';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';

const CATEGORIES = ['Layar', 'Baterai', 'Konektor', 'Speaker', 'Fleksibel', 'Aksesoris', 'IC', 'Lainnya'];

function TransferModal({ open, onClose, initial, onSaved, currentUser }) {
  const branches = branchesApi.list();
  const [form, setForm] = useState({ to_branch_id: '', qty: 1, note: '' });

  React.useEffect(() => {
    setForm({ to_branch_id: '', qty: 1, note: '' });
  }, [open, initial]);

  if (!open || !initial) return null;

  const otherBranches = branches.filter((b) => b.id !== initial.branch_id);
  const sourceBranch = branches.find((b) => b.id === initial.branch_id);

  const submit = (e) => {
    e.preventDefault();
    try {
      sparepartsApi.transferStock({
        sparepart_id: initial.id,
        to_branch_id: form.to_branch_id,
        qty: Number(form.qty),
        note: form.note,
        user_id: currentUser?.id,
      });
      const destName = branches.find((b) => b.id === form.to_branch_id)?.name;
      toast.success(`Berhasil transfer ${form.qty} ${initial.name} ke ${destName}`);
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-semibold tracking-tight">Transfer Stok</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="rounded-md bg-accent/40 border border-border p-3">
            <div className="font-semibold text-sm">{initial.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{initial.sku}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Dari: <span className="font-semibold text-foreground">{sourceBranch?.name || '-'}</span> • Stok tersedia: <span className="font-mono font-semibold text-foreground">{initial.stock}</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Cabang Tujuan *</label>
            <select required data-testid="transfer-dest" value={form.to_branch_id} onChange={(e) => setForm({ ...form, to_branch_id: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Pilih cabang tujuan</option>
              {otherBranches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
            </select>
            {otherBranches.length === 0 && <p className="text-xs text-destructive mt-1.5">Belum ada cabang tujuan lain.</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Jumlah *</label>
            <input type="number" min={1} max={initial.stock} required data-testid="transfer-qty"
              value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Keterangan (opsional)</label>
            <input data-testid="transfer-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="e.g. Restock cabang, permintaan cabang tujuan..."
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="rounded-md bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 p-3 text-xs text-blue-900 dark:text-blue-200">
            Sistem akan otomatis: (1) mengurangi stok cabang sumber, (2) menambah stok cabang tujuan, (3) mencatat mutasi di Riwayat.
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border hover:bg-accent text-sm font-medium">Batal</button>
            <button type="submit" data-testid="transfer-submit"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold">
              <ArrowRightLeft className="h-4 w-4" /> Transfer Sekarang
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const MOVEMENT_META = {
  in:           { label: 'Masuk',       color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300', sign: '+' },
  out:          { label: 'Keluar',      color: 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300',                 sign: '-' },
  usage:        { label: 'Dipakai',     color: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',         sign: '-' },
  return:       { label: 'Dikembalikan',color: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300',             sign: '+' },
  transfer:     { label: 'Transfer',    color: 'bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300',     sign: '↔' },
};

function MovementsModal({ open, onClose, branchScopeId }) {
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  if (!open) return null;

  const branches = branchesApi.list();
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b]));
  let list = movementsApi.list();
  if (branchScopeId) {
    list = list.filter((m) => m.from_branch_id === branchScopeId || m.to_branch_id === branchScopeId);
  }
  if (typeFilter !== 'all') list = list.filter((m) => m.type === typeFilter);
  if (q) {
    const s = q.toLowerCase();
    list = list.filter((m) =>
      (m.sparepart_name || '').toLowerCase().includes(s) ||
      (m.sku || '').toLowerCase().includes(s) ||
      (m.note || '').toLowerCase().includes(s)
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-4xl h-[85vh] bg-card border border-border rounded-lg shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display text-lg font-semibold tracking-tight">Riwayat Mutasi Stok</h3>
              <div className="text-xs text-muted-foreground">{list.length} pergerakan{branchScopeId ? ` — ${branchMap[branchScopeId]?.name}` : ' semua cabang'}</div>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari sparepart, SKU, catatan..."
              className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm">
            <option value="all">Semua Jenis</option>
            <option value="transfer">Transfer</option>
            <option value="usage">Dipakai Servis</option>
            <option value="return">Dikembalikan</option>
            <option value="in">Masuk</option>
            <option value="out">Keluar</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Belum ada mutasi stok.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">Waktu</th>
                  <th className="px-4 py-3 text-left">Jenis</th>
                  <th className="px-4 py-3 text-left">Sparepart</th>
                  <th className="px-4 py-3 text-left">Arah</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-left">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((m) => {
                  const meta = MOVEMENT_META[m.type] || {};
                  return (
                    <tr key={m.id} className="hover:bg-accent" data-testid={`movement-row-${m.id}`}>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(m.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-md border ${meta.color}`}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{m.sparepart_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{m.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {m.from_branch_id && <div className="text-muted-foreground">Dari: <span className="text-foreground font-medium">{branchMap[m.from_branch_id]?.name || '-'}</span></div>}
                        {m.to_branch_id && <div className="text-muted-foreground">Ke: <span className="text-foreground font-medium">{branchMap[m.to_branch_id]?.name || '-'}</span></div>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        <span className={m.type === 'transfer' ? 'text-purple-600 dark:text-purple-300' : (['in', 'return'].includes(m.type) ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                          {meta.sign}{m.qty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{m.note || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function PartModal({ open, onClose, initial, onSaved }) {
  const [form, setForm] = useState(initial || { name: '', sku: '', category: 'Layar', stock: 0, cost_price: 0, selling_price: 0, low_stock_threshold: 3 });
  React.useEffect(() => { setForm(initial || { name: '', sku: '', category: 'Layar', stock: 0, cost_price: 0, selling_price: 0, low_stock_threshold: 3 }); }, [initial, open]);

  if (!open) return null;
  const submit = (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        stock: Number(form.stock) || 0,
        cost_price: Number(form.cost_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
      };
      if (initial?.id) sparepartsApi.update(initial.id, payload);
      else sparepartsApi.create(payload);
      toast.success(initial?.id ? 'Sparepart diperbarui' : 'Sparepart ditambahkan');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold tracking-tight">{initial?.id ? 'Edit Sparepart' : 'Sparepart Baru'}</h3>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Nama Sparepart *</label>
            <input required data-testid="part-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">SKU *</label>
            <input required data-testid="part-sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Kategori</label>
            <select data-testid="part-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Stok</label>
            <input type="number" min={0} data-testid="part-stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Batas Stok Rendah</label>
            <input type="number" min={0} data-testid="part-threshold" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Harga Beli</label>
            <input type="number" min={0} data-testid="part-cost" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Harga Jual</label>
            <input type="number" min={0} data-testid="part-price" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border hover:bg-accent transition-colors text-sm font-medium">Batal</button>
            <button type="submit" data-testid="part-save-btn" className="h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-semibold">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SparePartsPage() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState({ open: false, initial: null });
  const [transferModal, setTransferModal] = useState({ open: false, initial: null });
  const [historyModal, setHistoryModal] = useState({ open: false });
  const [showLowOnly, setShowLowOnly] = useState(false);
  const { scope, currentBranch, currentBranchId } = useBranch();
  const { user, hasRole } = useAuth();
  const branches = branchesApi.list();
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b]));

  const items = scope(sparepartsApi.list());
  const filtered = items
    .filter((s) => !showLowOnly || s.stock <= s.low_stock_threshold)
    .filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.sku.toLowerCase().includes(q.toLowerCase()));

  const del = (s) => {
    if (window.confirm(`Hapus sparepart "${s.name}"?`)) {
      sparepartsApi.delete(s.id);
      toast.success('Sparepart dihapus');
      refresh();
    }
  };

  const lowCount = items.filter((s) => s.stock <= s.low_stock_threshold).length;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="spareparts-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="title-box font-display font-bold tracking-tight">Sparepart</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {items.length} item{currentBranch ? ` di ${currentBranch.name}` : ' (semua cabang)'} • {lowCount > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{lowCount} stok menipis</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setHistoryModal({ open: true })} data-testid="btn-open-movements"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border hover:bg-accent font-semibold transition-colors">
            <History className="h-4 w-4" /> Riwayat Mutasi
          </button>
          <button onClick={() => setModal({ open: true, initial: null })} data-testid="btn-new-part"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Sparepart Baru
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="part-search"
              placeholder="Cari nama atau SKU..."
              className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <label className="flex items-center gap-2 h-10 px-3 rounded-md border border-border cursor-pointer hover:bg-accent transition-colors">
            <input type="checkbox" checked={showLowOnly} onChange={(e) => setShowLowOnly(e.target.checked)} data-testid="filter-lowstock" />
            <span className="text-sm">Tampilkan stok rendah saja</span>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Kategori</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Cabang</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Modal</th>
                <th className="px-4 py-3 text-right">Harga Jual</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Tidak ada sparepart.</td></tr>
              )}
              {filtered.map((s) => {
                const isLow = s.stock <= s.low_stock_threshold;
                return (
                  <tr key={s.id} className="hover:bg-accent transition-colors" data-testid={`part-row-${s.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{s.name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.sku}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-muted">{s.category}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs font-medium">{branchMap[s.branch_id]?.name || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className={`inline-flex items-center gap-1.5 font-mono font-semibold ${isLow ? (s.stock === 0 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400') : ''}`}>
                        {isLow && <AlertTriangle className="h-3.5 w-3.5" />}
                        {s.stock}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden lg:table-cell">{formatIDR(s.cost_price)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{formatIDR(s.selling_price)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {hasRole('admin') && s.stock > 0 && branches.length > 1 && (
                          <button onClick={() => setTransferModal({ open: true, initial: s })} title="Transfer stok" data-testid={`btn-transfer-${s.id}`}
                            className="h-8 w-8 grid place-items-center rounded-md hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-500/15 dark:hover:text-purple-300 transition-colors">
                            <ArrowRightLeft className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => setModal({ open: true, initial: s })} title="Edit" data-testid={`btn-edit-part-${s.id}`}
                          className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => del(s)} title="Hapus" data-testid={`btn-delete-part-${s.id}`}
                          className="h-8 w-8 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PartModal open={modal.open} initial={modal.initial} onClose={() => setModal({ open: false, initial: null })} onSaved={refresh} />
      <TransferModal open={transferModal.open} initial={transferModal.initial}
        onClose={() => setTransferModal({ open: false, initial: null })}
        onSaved={refresh} currentUser={user} />
      <MovementsModal open={historyModal.open} onClose={() => setHistoryModal({ open: false })} branchScopeId={currentBranchId} />
    </div>
  );
}

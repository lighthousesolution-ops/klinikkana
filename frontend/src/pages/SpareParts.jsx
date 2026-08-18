import React, { useState } from 'react';
import { Plus, Search, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { sparepartsApi } from '@/lib/store';
import { formatIDR } from '@/lib/utils';
import { useBranch } from '@/contexts/BranchContext';

const CATEGORIES = ['Layar', 'Baterai', 'Konektor', 'Speaker', 'Fleksibel', 'Aksesoris', 'IC', 'Lainnya'];

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
  const [showLowOnly, setShowLowOnly] = useState(false);
  const { scope, currentBranch } = useBranch();

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
          <div className="overline text-muted-foreground mb-1">Inventori</div>
          <h1 className="title-box font-display text-3xl font-bold tracking-tight">Sparepart</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {items.length} item{currentBranch ? ` di ${currentBranch.name}` : ' (semua cabang)'} • {lowCount > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{lowCount} stok menipis</span>}
          </p>
        </div>
        <button onClick={() => setModal({ open: true, initial: null })} data-testid="btn-new-part"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Sparepart Baru
        </button>
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
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Modal</th>
                <th className="px-4 py-3 text-right">Harga Jual</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Tidak ada sparepart.</td></tr>
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
    </div>
  );
}

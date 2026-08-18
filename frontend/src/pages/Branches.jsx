import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X, Building2, Star, StarOff } from 'lucide-react';
import { toast } from 'sonner';
import { branchesApi, customersApi, repairsApi, sparepartsApi, usersApi } from '@/lib/store';

function BranchModal({ open, onClose, initial, onSaved }) {
  const [form, setForm] = useState(initial || { name: '', code: '', address: '', phone: '' });
  React.useEffect(() => { setForm(initial || { name: '', code: '', address: '', phone: '' }); }, [initial, open]);

  if (!open) return null;
  const submit = (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, code: form.code.toUpperCase() };
      if (initial?.id) branchesApi.update(initial.id, payload);
      else branchesApi.create(payload);
      toast.success(initial?.id ? 'Cabang diperbarui' : 'Cabang ditambahkan');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold tracking-tight">{initial?.id ? 'Edit Cabang' : 'Cabang Baru'}</h3>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nama Cabang *</label>
            <input required data-testid="branch-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Kode *</label>
            <input required data-testid="branch-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="HQ, BDG, SBY, ..."
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono uppercase" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Alamat</label>
            <textarea rows={2} data-testid="branch-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Telepon</label>
            <input data-testid="branch-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border hover:bg-accent text-sm font-medium">Batal</button>
            <button type="submit" data-testid="branch-save-btn" className="h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BranchesPage() {
  const [tick, setTick] = useState(0);
  const refresh = () => { setTick((t) => t + 1); };
  const [modal, setModal] = useState({ open: false, initial: null });

  const branches = branchesApi.list();
  const customers = customersApi.list();
  const repairs = repairsApi.list();
  const parts = sparepartsApi.list();
  const users = usersApi.list();

  const stats = (id) => ({
    customers: customers.filter((c) => c.branch_id === id).length,
    repairs: repairs.filter((r) => r.branch_id === id).length,
    parts: parts.filter((s) => s.branch_id === id).length,
    users: users.filter((u) => u.branch_id === id).length,
  });

  const del = (b) => {
    try {
      if (window.confirm(`Hapus cabang "${b.name}"?`)) {
        branchesApi.delete(b.id);
        toast.success('Cabang dihapus');
        refresh();
      }
    } catch (err) { toast.error(err.message); }
  };

  const setDefault = (b) => {
    const others = branches.filter((x) => x.id !== b.id);
    others.forEach((o) => branchesApi.update(o.id, { is_default: false }));
    branchesApi.update(b.id, { is_default: true });
    toast.success(`${b.name} diset sebagai cabang default`);
    refresh();
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="branches-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="overline">Sistem</div>
          <h1 className="title-box font-display text-3xl font-bold tracking-tight">Kelola Cabang</h1>
          <p className="text-muted-foreground text-sm mt-2">{branches.length} cabang terdaftar. Data pelanggan, sparepart, dan tiket akan otomatis di-scope ke cabang.</p>
        </div>
        <button onClick={() => setModal({ open: true, initial: null })} data-testid="btn-new-branch"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Cabang Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {branches.map((b) => {
          const s = stats(b.id);
          return (
            <div key={b.id} className="rounded-lg border border-border bg-card p-5 hover:-translate-y-0.5 hover:shadow-sm transition-transform" data-testid={`branch-card-${b.id}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="h-11 w-11 rounded-md bg-accent grid place-items-center text-primary shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setDefault(b)} title={b.is_default ? 'Cabang default' : 'Jadikan default'}
                    data-testid={`btn-set-default-${b.id}`}
                    className={`h-8 w-8 grid place-items-center rounded-md transition-colors ${b.is_default ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15' : 'hover:bg-accent text-muted-foreground'}`}>
                    {b.is_default ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setModal({ open: true, initial: b })} title="Edit" data-testid={`btn-edit-branch-${b.id}`}
                    className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => del(b)} title="Hapus" data-testid={`btn-delete-branch-${b.id}`}
                    className="h-8 w-8 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="font-display text-lg font-bold tracking-tight">{b.name}</div>
                {b.is_default && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">DEFAULT</span>}
              </div>
              <div className="font-mono text-xs text-muted-foreground">{b.code}</div>
              <div className="text-xs text-muted-foreground mt-2">{b.address || '—'}</div>
              <div className="text-xs text-muted-foreground font-mono">{b.phone || '—'}</div>

              <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-border">
                <Stat label="Tiket" value={s.repairs} />
                <Stat label="Pelanggan" value={s.customers} />
                <Stat label="Sparepart" value={s.parts} />
                <Stat label="Staff" value={s.users} />
              </div>
            </div>
          );
        })}
      </div>

      <BranchModal open={modal.open} initial={modal.initial} onClose={() => setModal({ open: false, initial: null })} onSaved={refresh} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="font-display font-bold text-lg">{value}</div>
    </div>
  );
}

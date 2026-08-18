import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, MessageCircle, X, User } from 'lucide-react';
import { toast } from 'sonner';
import { customersApi, repairsApi } from '@/lib/store';
import { formatDate, waLink } from '@/lib/utils';
import { useBranch } from '@/contexts/BranchContext';

function CustomerModal({ open, onClose, initial, onSaved }) {
  const [form, setForm] = useState(initial || { name: '', phone: '', address: '', notes: '' });
  React.useEffect(() => { setForm(initial || { name: '', phone: '', address: '', notes: '' }); }, [initial, open]);

  if (!open) return null;
  const submit = (e) => {
    e.preventDefault();
    try {
      if (initial?.id) customersApi.update(initial.id, form);
      else customersApi.create(form);
      toast.success(initial?.id ? 'Pelanggan diperbarui' : 'Pelanggan ditambahkan');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold tracking-tight">{initial?.id ? 'Edit Pelanggan' : 'Pelanggan Baru'}</h3>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent" data-testid="modal-close"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nama Lengkap</label>
            <input required data-testid="customer-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Telepon / WhatsApp</label>
            <input required data-testid="customer-phone-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="081xxxxxxxxx"
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Alamat</label>
            <textarea rows={2} data-testid="customer-address-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Catatan</label>
            <input data-testid="customer-notes-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border hover:bg-accent transition-colors text-sm font-medium">Batal</button>
            <button type="submit" data-testid="customer-save-btn" className="h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-semibold">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryModal({ open, onClose, customer }) {
  if (!open || !customer) return null;
  const history = repairsApi.byCustomer(customer.id);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="overline text-muted-foreground">Riwayat Servis</div>
            <h3 className="font-display text-lg font-semibold tracking-tight">{customer.name}</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Belum ada riwayat servis.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">Tiket</th>
                  <th className="px-4 py-3 text-left">Perangkat</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((r) => (
                  <tr key={r.id} className="hover:bg-accent">
                    <td className="px-4 py-3">
                      <Link className="font-mono text-xs text-primary hover:underline" to={`/repairs/${r.id}`}>{r.ticket_no}</Link>
                    </td>
                    <td className="px-4 py-3">{r.device_brand} {r.device_model}</td>
                    <td className="px-4 py-3">{r.status}</td>
                    <td className="px-4 py-3">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState({ open: false, initial: null });
  const [historyModal, setHistoryModal] = useState({ open: false, customer: null });
  const { scope, currentBranch } = useBranch();

  const customers = scope(customersApi.list());
  const filtered = customers.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q)
  );

  const del = (c) => {
    if (window.confirm(`Hapus pelanggan "${c.name}"?`)) {
      customersApi.delete(c.id);
      toast.success('Pelanggan dihapus');
      refresh();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="customers-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="overline text-muted-foreground mb-1">Pelanggan</div>
          <h1 className="title-box font-display text-3xl font-bold tracking-tight">Manajemen Pelanggan</h1>
          <p className="text-muted-foreground text-sm mt-2">{customers.length} pelanggan{currentBranch ? ` di ${currentBranch.name}` : ' (semua cabang)'}</p>
        </div>
        <button onClick={() => setModal({ open: true, initial: null })} data-testid="btn-new-customer"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Pelanggan Baru
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="customer-search"
              placeholder="Cari nama atau nomor telepon..."
              className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Telepon</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Alamat</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Terdaftar</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Tidak ada pelanggan ditemukan.</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-accent transition-colors" data-testid={`customer-row-${c.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-accent grid place-items-center text-xs font-semibold">{c.name.charAt(0)}</div>
                      <div>
                        <button className="font-semibold hover:text-primary transition-colors text-left" onClick={() => setHistoryModal({ open: true, customer: c })} data-testid={`customer-history-${c.id}`}>
                          {c.name}
                        </button>
                        {c.notes && <div className="text-xs text-muted-foreground">{c.notes}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono">{c.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">{c.address}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <a href={waLink(c.phone, `Halo ${c.name}, dari Klinik Kana. Ada yang bisa kami bantu?`)} target="_blank" rel="noreferrer"
                        title="WhatsApp" className="h-8 w-8 grid place-items-center rounded-md hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300 transition-colors"
                        data-testid={`btn-wa-${c.id}`}>
                        <MessageCircle className="h-4 w-4" />
                      </a>
                      <button onClick={() => setModal({ open: true, initial: c })} title="Edit" data-testid={`btn-edit-customer-${c.id}`}
                        className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => del(c)} title="Hapus" data-testid={`btn-delete-customer-${c.id}`}
                        className="h-8 w-8 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CustomerModal open={modal.open} initial={modal.initial} onClose={() => setModal({ open: false, initial: null })} onSaved={refresh} />
      <HistoryModal open={historyModal.open} customer={historyModal.customer} onClose={() => setHistoryModal({ open: false, customer: null })} />
    </div>
  );
}

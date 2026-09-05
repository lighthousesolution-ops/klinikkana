import React, { useState } from 'react';
import { Wrench, Plus, Pencil, Trash2, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { serviceCategoriesApi, serviceItemsApi } from '@/lib/store';
import { formatIDR } from '@/lib/utils';

/**
 * Master data manager for Kategori & Jasa Servis (embedded in Settings page).
 * Admin only. Global (tidak per cabang).
 */
export default function ServiceCatalogSection() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [openCatModal, setOpenCatModal] = useState({ open: false, initial: null });
  const [openItemModal, setOpenItemModal] = useState({ open: false, initial: null, categoryId: null });
  const [expandedCatId, setExpandedCatId] = useState(null);

  const categories = serviceCategoriesApi.list();
  const items = serviceItemsApi.list();
  const itemsByCat = items.reduce((acc, it) => {
    (acc[it.category_id] = acc[it.category_id] || []).push(it);
    return acc;
  }, {});

  const deleteCat = (c) => {
    const count = (itemsByCat[c.id] || []).length;
    const msg = count > 0
      ? `Hapus kategori "${c.name}"? Ini juga akan menghapus ${count} jasa di dalamnya.`
      : `Hapus kategori "${c.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      serviceCategoriesApi.delete(c.id);
      toast.success('Kategori dihapus');
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const deleteItem = (it) => {
    if (!window.confirm(`Hapus jasa "${it.name}"?`)) return;
    try {
      serviceItemsApi.delete(it.id);
      toast.success('Jasa dihapus');
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6" data-testid="section-service-catalog">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-accent grid place-items-center text-primary"><Wrench className="h-4 w-4" /></div>
          <div>
            <div className="overline text-muted-foreground">Master Data</div>
            <h3 className="font-display text-lg font-semibold tracking-tight">Kategori & Jasa Servis</h3>
          </div>
        </div>
        <button onClick={() => setOpenCatModal({ open: true, initial: null })}
          data-testid="btn-new-service-category"
          className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors">
          <Plus className="h-3.5 w-3.5" /> Kategori Baru
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Katalog jasa dipakai teknisi saat buat tiket servis baru. Harga di sini adalah <strong>harga acuan</strong> — teknisi tetap bisa ubah manual per tiket.
      </p>

      {categories.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-md" data-testid="service-catalog-empty">
          Belum ada kategori. Klik "Kategori Baru" untuk mulai.
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => {
            const catItems = itemsByCat[c.id] || [];
            const isOpen = expandedCatId === c.id;
            return (
              <div key={c.id} className="border border-border rounded-md overflow-hidden" data-testid={`cat-${c.id}`}>
                <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-accent/40 transition-colors">
                  <button onClick={() => setExpandedCatId(isOpen ? null : c.id)}
                    data-testid={`cat-toggle-${c.id}`}
                    className="flex items-center gap-2 flex-1 text-left">
                    <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <span className="font-semibold text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground">({catItems.length} jasa)</span>
                  </button>
                  <button onClick={() => setOpenItemModal({ open: true, initial: null, categoryId: c.id })}
                    data-testid={`btn-add-item-${c.id}`}
                    className="h-8 px-2.5 inline-flex items-center gap-1 rounded-md text-xs font-medium border border-border hover:bg-primary hover:text-primary-foreground transition-colors">
                    <Plus className="h-3 w-3" /> Jasa
                  </button>
                  <button onClick={() => setOpenCatModal({ open: true, initial: c })}
                    data-testid={`btn-edit-cat-${c.id}`}
                    className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteCat(c)}
                    data-testid={`btn-delete-cat-${c.id}`}
                    className="h-8 w-8 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {isOpen && (
                  <div className="border-t border-border bg-muted/20">
                    {catItems.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground italic">Belum ada jasa di kategori ini.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 text-left">Nama Jasa</th>
                            <th className="px-4 py-2 text-right">Harga Acuan</th>
                            <th className="px-4 py-2 text-right">Est. Waktu</th>
                            <th className="px-4 py-2 w-24"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {catItems.map((it) => (
                            <tr key={it.id} data-testid={`item-${it.id}`} className="hover:bg-accent/40">
                              <td className="px-4 py-2">{it.name}</td>
                              <td className="px-4 py-2 text-right font-mono">{formatIDR(Number(it.default_price) || 0)}</td>
                              <td className="px-4 py-2 text-right text-muted-foreground">{it.duration_minutes ? `${it.duration_minutes} mnt` : '—'}</td>
                              <td className="px-4 py-2">
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => setOpenItemModal({ open: true, initial: it, categoryId: c.id })}
                                    data-testid={`btn-edit-item-${it.id}`}
                                    className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent transition-colors">
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => deleteItem(it)}
                                    data-testid={`btn-delete-item-${it.id}`}
                                    className="h-8 w-8 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CategoryModal {...openCatModal} onClose={() => setOpenCatModal({ open: false, initial: null })} onSaved={refresh} />
      <ItemModal {...openItemModal} onClose={() => setOpenItemModal({ open: false, initial: null, categoryId: null })} onSaved={refresh} />
    </div>
  );
}

function CategoryModal({ open, initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || { name: '', sort_order: 0 });
  React.useEffect(() => { setForm(initial || { name: '', sort_order: 0 }); }, [initial, open]);
  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    try {
      if (initial?.id) serviceCategoriesApi.update(initial.id, form);
      else serviceCategoriesApi.create(form);
      toast.success(initial?.id ? 'Kategori diperbarui' : 'Kategori ditambahkan');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold tracking-tight">{initial?.id ? 'Edit Kategori' : 'Kategori Baru'}</h3>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nama Kategori *</label>
            <input required data-testid="cat-name-input"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Urutan Tampil</label>
            <input type="number" min={0} data-testid="cat-sort-input"
              value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
            <p className="text-xs text-muted-foreground mt-1">Angka lebih kecil tampil lebih atas.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border hover:bg-accent text-sm font-medium">Batal</button>
            <button type="submit" data-testid="btn-save-cat" className="h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ItemModal({ open, initial, categoryId, onClose, onSaved }) {
  const [form, setForm] = useState(initial || { name: '', default_price: 0, duration_minutes: '', category_id: categoryId || '' });
  React.useEffect(() => {
    setForm(initial || { name: '', default_price: 0, duration_minutes: '', category_id: categoryId || '' });
  }, [initial, categoryId, open]);
  if (!open) return null;
  const categories = serviceCategoriesApi.list();

  const submit = (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        default_price: Number(form.default_price) || 0,
        duration_minutes: form.duration_minutes === '' || form.duration_minutes === null ? null : Number(form.duration_minutes),
      };
      if (initial?.id) serviceItemsApi.update(initial.id, payload);
      else serviceItemsApi.create(payload);
      toast.success(initial?.id ? 'Jasa diperbarui' : 'Jasa ditambahkan');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold tracking-tight">{initial?.id ? 'Edit Jasa' : 'Jasa Baru'}</h3>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Kategori *</label>
            <select required data-testid="item-cat-select"
              value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">— Pilih —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Nama Jasa *</label>
            <input required data-testid="item-name-input"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="mis. Ganti LCD Original"
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Harga Acuan (Rp) *</label>
            <input type="number" min={0} required data-testid="item-price-input"
              value={form.default_price} onChange={(e) => setForm({ ...form, default_price: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Est. Waktu (menit)</label>
            <input type="number" min={0} data-testid="item-duration-input"
              value={form.duration_minutes ?? ''} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
              placeholder="opsional"
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border hover:bg-accent text-sm font-medium">Batal</button>
            <button type="submit" data-testid="btn-save-item" className="h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

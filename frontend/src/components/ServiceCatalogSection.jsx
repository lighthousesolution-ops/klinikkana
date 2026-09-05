import React, { useState } from 'react';
import { Wrench, Plus, Pencil, Trash2, X, ChevronRight, Layers, Check } from 'lucide-react';
import { toast } from 'sonner';
import { serviceCategoriesApi, serviceItemsApi, servicePackagesApi } from '@/lib/store';
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

// =====================================================================
// Preset Paket Jasa — bundel jasa yang bisa dipilih sekali klik di picker.
// Ditampilkan sebagai section tambahan di halaman Konfigurasi (admin only).
// =====================================================================
export function ServicePackageSection() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [modal, setModal] = useState({ open: false, initial: null });

  const packages = servicePackagesApi.list();
  const items = serviceItemsApi.list();
  const itemById = Object.fromEntries(items.map((i) => [i.id, i]));

  const del = (p) => {
    if (!window.confirm(`Hapus paket "${p.name}"?`)) return;
    try {
      servicePackagesApi.delete(p.id);
      toast.success('Paket dihapus');
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6" data-testid="section-service-packages">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-accent grid place-items-center text-primary"><Layers className="h-4 w-4" /></div>
          <div>
            <div className="overline text-muted-foreground">Preset Bundel</div>
            <h3 className="font-display text-lg font-semibold tracking-tight">Paket Jasa</h3>
          </div>
        </div>
        <button onClick={() => setModal({ open: true, initial: null })}
          data-testid="btn-new-service-package"
          className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors">
          <Plus className="h-3.5 w-3.5" /> Paket Baru
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Bundel dari beberapa jasa (mis. Paket LCD + Baterai). Teknisi bisa pilih paket sekali klik saat buat tiket — semua jasa di dalamnya langsung masuk sebagai baris terpisah dan tetap bisa diedit harganya.
      </p>

      {packages.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-md" data-testid="service-packages-empty">
          Belum ada paket. Klik "Paket Baru" untuk bikin bundel.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {packages.map((p) => {
            const included = (p.items_json || []).map((iid) => itemById[iid]).filter(Boolean);
            const total = included.reduce((s, it) => s + (Number(it.default_price) || 0), 0);
            return (
              <div key={p.id} data-testid={`pkg-card-${p.id}`} className="rounded-md border border-border p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{p.name}</div>
                    {p.description && <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setModal({ open: true, initial: p })}
                      data-testid={`btn-edit-pkg-${p.id}`}
                      className="h-7 w-7 grid place-items-center rounded-md hover:bg-accent transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => del(p)}
                      data-testid={`btn-delete-pkg-${p.id}`}
                      className="h-7 w-7 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {included.length === 0 ? (
                    <span className="text-[11px] italic text-muted-foreground">Tidak ada jasa di paket ini</span>
                  ) : included.map((it) => (
                    <span key={it.id} className="text-[11px] px-2 py-0.5 rounded-full bg-accent border border-border">{it.name}</span>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{included.length} jasa</span>
                  <span className="font-mono font-semibold text-sm">{formatIDR(total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PackageModal {...modal} onClose={() => setModal({ open: false, initial: null })} onSaved={refresh} />
    </div>
  );
}

function PackageModal({ open, initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || { name: '', description: '', items_json: [] });
  React.useEffect(() => {
    setForm(initial ? { ...initial, items_json: Array.isArray(initial.items_json) ? initial.items_json : [] }
                    : { name: '', description: '', items_json: [] });
  }, [initial, open]);
  const categories = serviceCategoriesApi.list();
  const items = serviceItemsApi.list();
  if (!open) return null;

  const toggle = (id) => {
    setForm((f) => ({
      ...f,
      items_json: f.items_json.includes(id) ? f.items_json.filter((x) => x !== id) : [...f.items_json, id],
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Nama paket wajib');
    if (form.items_json.length === 0) return toast.error('Pilih minimal 1 jasa untuk paket');
    try {
      if (initial?.id) servicePackagesApi.update(initial.id, form);
      else servicePackagesApi.create(form);
      toast.success(initial?.id ? 'Paket diperbarui' : 'Paket ditambahkan');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold tracking-tight">{initial?.id ? 'Edit Paket' : 'Paket Baru'}</h3>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nama Paket *</label>
              <input required data-testid="pkg-name-input"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="mis. Paket LCD + Baterai"
                className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Deskripsi</label>
              <textarea rows={2} data-testid="pkg-desc-input"
                value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Cerita singkat tentang paket ini (opsional)"
                className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Jasa dalam Paket * <span className="text-xs text-muted-foreground font-normal">({form.items_json.length} terpilih)</span>
              </label>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto rounded-md border border-border p-3">
                {categories.map((c) => {
                  const catItems = items.filter((i) => i.category_id === c.id);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={c.id}>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{c.name}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {catItems.map((it) => {
                          const active = form.items_json.includes(it.id);
                          return (
                            <button type="button" key={it.id} onClick={() => toggle(it.id)}
                              data-testid={`pkg-toggle-${it.id}`}
                              className={`text-left px-2.5 py-1.5 rounded border transition-colors flex items-start gap-2 ${active ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'}`}>
                              <div className={`h-4 w-4 rounded shrink-0 mt-0.5 grid place-items-center border ${active ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                                {active && <Check className="h-3 w-3" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium truncate">{it.name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">{formatIDR(Number(it.default_price) || 0)}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border hover:bg-accent text-sm font-medium">Batal</button>
            <button type="submit" data-testid="btn-save-pkg" className="h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold">Simpan</button>
          </div>
        </form>
      </div>
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

import React, { useMemo } from 'react';
import { Plus, Trash2, Sparkles, Package } from 'lucide-react';
import { serviceCategoriesApi, serviceItemsApi } from '@/lib/store';
import { formatIDR } from '@/lib/utils';

/**
 * ServicePicker — multi-row picker for repair services (jasa).
 *
 * Props:
 *   value    : array of rows [{ id, category_id, item_id, name, price, is_custom }]
 *   onChange : (rows) => void  — parent stores the array (used both to persist
 *                                and to derive service_fee = sum of prices).
 *
 * Behaviour:
 * - Each row: Kategori dropdown → Jasa dropdown → Harga (editable) → Hapus.
 * - "Tambah Jasa Custom" appends a free-text row (no category/item).
 * - Total auto-calculated at the bottom.
 */
export function ServicePicker({ value, onChange }) {
  const rows = value || [];
  const categories = serviceCategoriesApi.list();
  const allItems = serviceItemsApi.list();

  const itemsByCat = useMemo(() => {
    const m = {};
    allItems.forEach((i) => {
      if (!m[i.category_id]) m[i.category_id] = [];
      m[i.category_id].push(i);
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return m;
  }, [allItems]);

  const total = rows.reduce((sum, r) => sum + (Number(r.price) || 0), 0);

  const addRow = () => {
    const first = categories[0];
    onChange([
      ...rows,
      { id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, category_id: first?.id || '', item_id: '', name: '', price: 0, is_custom: false },
    ]);
  };

  const addCustom = () => {
    onChange([
      ...rows,
      { id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, category_id: '', item_id: '', name: '', price: 0, is_custom: true },
    ]);
  };

  const patchRow = (rowId, patch) => {
    onChange(rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const removeRow = (rowId) => onChange(rows.filter((r) => r.id !== rowId));

  const onCategoryChange = (rowId, category_id) => {
    // Reset item + price when category changes
    patchRow(rowId, { category_id, item_id: '', name: '', price: 0 });
  };

  const onItemChange = (rowId, item_id) => {
    const item = allItems.find((i) => i.id === item_id);
    if (!item) return patchRow(rowId, { item_id: '', name: '', price: 0 });
    patchRow(rowId, { item_id: item.id, name: item.name, price: Number(item.default_price) || 0 });
  };

  return (
    <div className="space-y-3" data-testid="service-picker">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Daftar Jasa Servis</label>
        <div className="flex gap-2">
          <button type="button" onClick={addRow} data-testid="btn-add-service-row"
            className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border hover:bg-accent text-xs font-medium transition-colors">
            <Plus className="h-3.5 w-3.5" /> Tambah dari Katalog
          </button>
          <button type="button" onClick={addCustom} data-testid="btn-add-service-custom"
            className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border hover:bg-accent text-xs font-medium transition-colors">
            <Sparkles className="h-3.5 w-3.5" /> Tambah Jasa Custom
          </button>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="p-4 border border-dashed border-border rounded-md text-center text-xs text-muted-foreground" data-testid="service-picker-empty">
          <Package className="h-5 w-5 mx-auto mb-1 opacity-50" />
          Belum ada jasa. Tambahkan dari katalog atau buat jasa custom.
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left w-[30%]">Kategori</th>
                <th className="px-3 py-2 text-left w-[38%]">Jasa</th>
                <th className="px-3 py-2 text-right w-[22%]">Harga (Rp)</th>
                <th className="px-3 py-2 w-[10%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, idx) => (
                <tr key={row.id} data-testid={`service-row-${idx}`} className="hover:bg-accent/30">
                  <td className="px-3 py-2">
                    {row.is_custom ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                        <Sparkles className="h-3 w-3" /> Custom
                      </span>
                    ) : (
                      <select value={row.category_id} onChange={(e) => onCategoryChange(row.id, e.target.value)}
                        data-testid={`service-row-${idx}-category`}
                        className="w-full h-9 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                        <option value="">— Pilih —</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.is_custom ? (
                      <input value={row.name} onChange={(e) => patchRow(row.id, { name: e.target.value })}
                        placeholder="Nama jasa (mis. Cek Kerusakan)" required
                        data-testid={`service-row-${idx}-custom-name`}
                        className="w-full h-9 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    ) : (
                      <select value={row.item_id} onChange={(e) => onItemChange(row.id, e.target.value)}
                        disabled={!row.category_id}
                        data-testid={`service-row-${idx}-item`}
                        className="w-full h-9 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50">
                        <option value="">— Pilih jasa —</option>
                        {(itemsByCat[row.category_id] || []).map((i) => (
                          <option key={i.id} value={i.id}>{i.name} · {formatIDR(i.default_price)}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} value={row.price}
                      onChange={(e) => patchRow(row.id, { price: e.target.value })}
                      data-testid={`service-row-${idx}-price`}
                      className="w-full h-9 px-2 rounded border border-input bg-background text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button type="button" onClick={() => removeRow(row.id)}
                      data-testid={`service-row-${idx}-remove`}
                      className="h-8 w-8 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/40 font-semibold">
                <td colSpan={2} className="px-3 py-2 text-right text-xs uppercase tracking-wider text-muted-foreground">Total Jasa</td>
                <td className="px-3 py-2 text-right font-mono" data-testid="service-picker-total">{formatIDR(total)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Read-only summary — dipakai di RepairDetail & Invoice.
 */
export function ServiceList({ services }) {
  if (!services || services.length === 0) return null;
  const total = services.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
  return (
    <div className="rounded-md border border-border overflow-hidden" data-testid="service-list">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Jasa</th>
            <th className="px-3 py-2 text-right">Harga</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {services.map((s, idx) => (
            <tr key={s.id || idx} data-testid={`service-list-row-${idx}`}>
              <td className="px-3 py-2">
                {s.name || '—'}
                {s.is_custom && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Custom</span>}
              </td>
              <td className="px-3 py-2 text-right font-mono">{formatIDR(Number(s.price) || 0)}</td>
            </tr>
          ))}
          <tr className="bg-muted/40 font-semibold">
            <td className="px-3 py-2 text-right text-xs uppercase tracking-wider text-muted-foreground">Total Jasa</td>
            <td className="px-3 py-2 text-right font-mono">{formatIDR(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

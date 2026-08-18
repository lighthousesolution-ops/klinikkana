import React, { useState, useRef } from 'react';
import { Save, RotateCcw, Upload, Trash2, Info, Store, MessageSquare, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/lib/store';

const PLACEHOLDER_LIST = [
  { key: '{customer_name}', desc: 'Nama pelanggan' },
  { key: '{shop_name}', desc: 'Nama toko' },
  { key: '{ticket_no}', desc: 'Nomor tiket' },
  { key: '{device}', desc: 'Brand + Model' },
  { key: '{status}', desc: 'Status tiket saat ini' },
  { key: '{total}', desc: 'Total biaya (formatted Rp)' },
  { key: '{deposit}', desc: 'Uang muka' },
  { key: '{balance}', desc: 'Sisa bayar' },
  { key: '{status_message}', desc: 'Pesan spesifik status (dari template status di bawah)' },
  { key: '{status_url}', desc: 'Link cek status publik (untuk QR/WA)' },
];

export default function SettingsPage() {
  const [form, setForm] = useState(settingsApi.get());
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef(null);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true); };

  const save = () => {
    settingsApi.update(form);
    toast.success('Konfigurasi disimpan');
    setDirty(false);
    // Notify sidebar & topbar to refresh
    window.dispatchEvent(new Event('kk_settings_changed'));
  };

  const reset = () => {
    if (window.confirm('Reset semua konfigurasi ke bawaan?')) {
      const d = settingsApi.reset();
      setForm(d);
      toast.success('Konfigurasi direset');
      setDirty(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar');
    if (file.size > 1024 * 1024) return toast.error('Maks 1MB untuk performa optimal');
    const reader = new FileReader();
    reader.onload = () => {
      set('logo_url', reader.result);
      toast.success('Logo dimuat. Klik Simpan untuk apply.');
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => set('logo_url', '');

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in" data-testid="settings-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="title-box font-display font-bold tracking-tight">Konfigurasi</h1>
          <p className="text-muted-foreground text-sm mt-1">Personalisasi toko, template WhatsApp, dan nota.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border hover:bg-accent text-sm font-medium">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button onClick={save} disabled={!dirty} data-testid="btn-save-settings"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold disabled:opacity-50 transition-colors">
            <Save className="h-4 w-4" /> Simpan
          </button>
        </div>
      </div>

      {/* Shop Info */}
      <div className="rounded-lg border border-border bg-card p-6" data-testid="section-shop">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-md bg-accent grid place-items-center text-primary"><Store className="h-4 w-4" /></div>
          <div>
            <div className="overline text-muted-foreground">Identitas</div>
            <h3 className="font-display text-lg font-semibold tracking-tight">Data Toko</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Logo Toko</label>
            <div className="flex items-center gap-4 p-3 border border-border rounded-md bg-muted/30">
              <div className="h-20 w-20 rounded-md bg-white border border-border grid place-items-center overflow-hidden">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" data-testid="logo-preview" />
                ) : (
                  <span className="text-xs text-muted-foreground text-center px-2">Belum ada</span>
                )}
              </div>
              <div className="flex-1">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" data-testid="logo-file-input" />
                <div className="flex gap-2">
                  <button onClick={() => fileRef.current?.click()} data-testid="btn-upload-logo"
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors">
                    <Upload className="h-3.5 w-3.5" /> Upload Logo
                  </button>
                  {form.logo_url && (
                    <button onClick={clearLogo} data-testid="btn-clear-logo"
                      className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border hover:bg-destructive/10 hover:text-destructive text-sm font-medium transition-colors">
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">PNG/JPG, maks 1MB. Rekomendasi 200×200px transparent PNG.</p>
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nama Toko *</label>
            <input required data-testid="setting-shop-name" value={form.shop_name} onChange={(e) => set('shop_name', e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tagline</label>
            <input data-testid="setting-tagline" value={form.shop_tagline} onChange={(e) => set('shop_tagline', e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Alamat</label>
            <textarea rows={2} data-testid="setting-address" value={form.shop_address} onChange={(e) => set('shop_address', e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Telepon / WhatsApp</label>
            <input data-testid="setting-phone" value={form.shop_phone} onChange={(e) => set('shop_phone', e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
        </div>
      </div>

      {/* Invoice/Nota */}
      <div className="rounded-lg border border-border bg-card p-6" data-testid="section-invoice">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-md bg-accent grid place-items-center text-primary"><FileText className="h-4 w-4" /></div>
          <div>
            <div className="overline text-muted-foreground">Cetak</div>
            <h3 className="font-display text-lg font-semibold tracking-tight">Teks Nota / Invoice</h3>
          </div>
        </div>
        <label className="text-sm font-medium mb-1.5 block">Footer Nota (muncul di bawah invoice)</label>
        <textarea rows={4} data-testid="setting-invoice-footer" value={form.invoice_footer} onChange={(e) => set('invoice_footer', e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none font-mono text-sm" />
        <p className="text-xs text-muted-foreground mt-2">Contoh: syarat garansi, jam operasional, terima kasih, dll.</p>
      </div>

      {/* WhatsApp templates */}
      <div className="rounded-lg border border-border bg-card p-6" data-testid="section-whatsapp">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-md bg-accent grid place-items-center text-primary"><MessageSquare className="h-4 w-4" /></div>
          <div>
            <div className="overline text-muted-foreground">Komunikasi</div>
            <h3 className="font-display text-lg font-semibold tracking-tight">Template Pesan WhatsApp</h3>
          </div>
        </div>

        <div className="rounded-md bg-accent/60 border border-accent p-4 mb-4 flex gap-3">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-xs space-y-2">
            <div>Gunakan placeholder berikut di template (akan otomatis diganti):</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {PLACEHOLDER_LIST.map((p) => (
                <div key={p.key} className="flex gap-2">
                  <code className="font-mono font-semibold text-primary">{p.key}</code>
                  <span className="text-muted-foreground">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <label className="text-sm font-medium mb-1.5 block">Template Utama</label>
        <textarea rows={9} data-testid="setting-wa-template" value={form.wa_template} onChange={(e) => set('wa_template', e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none font-mono text-sm" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {[
            { k: 'wa_status_pending', l: 'Pesan status "Pending"' },
            { k: 'wa_status_in_progress', l: 'Pesan status "In Progress"' },
            { k: 'wa_status_ready', l: 'Pesan status "Ready for Pickup"' },
            { k: 'wa_status_picked_up', l: 'Pesan status "Picked Up"' },
          ].map((f) => (
            <div key={f.k}>
              <label className="text-sm font-medium mb-1.5 block">{f.l}</label>
              <textarea rows={2} data-testid={`setting-${f.k.replace(/_/g, '-')}`} value={form[f.k]} onChange={(e) => set(f.k, e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none text-sm" />
            </div>
          ))}
        </div>
      </div>

      {dirty && (
        <div className="fixed bottom-6 right-6 z-40 rounded-md border border-primary bg-card shadow-lg p-4 flex items-center gap-3 animate-slide-up">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium">Perubahan belum disimpan</span>
          <button onClick={save} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">Simpan sekarang</button>
        </div>
      )}
    </div>
  );
}

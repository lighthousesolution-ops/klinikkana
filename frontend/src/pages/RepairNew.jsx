import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { customersApi, repairsApi } from '@/lib/store';
import { useBranch } from '@/contexts/BranchContext';

const BRANDS = ['iPhone', 'Samsung', 'Xiaomi', 'Oppo', 'Vivo', 'Realme', 'Huawei', 'Asus', 'Nokia', 'Lainnya'];

export default function RepairNew() {
  const navigate = useNavigate();
  const { scope, currentBranch } = useBranch();
  const customers = scope(customersApi.list());

  const [form, setForm] = useState({
    customer_id: customers[0]?.id || '',
    device_brand: 'iPhone',
    device_model: '',
    serial_no: '',
    complaint: '',
    deposit: 0,
    service_fee: 0,
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.customer_id) return toast.error('Pilih pelanggan terlebih dahulu');
    if (!form.device_model.trim()) return toast.error('Model perangkat wajib diisi');
    if (!form.complaint.trim()) return toast.error('Keluhan wajib diisi');
    const r = repairsApi.create({
      ...form,
      deposit: Number(form.deposit) || 0,
      service_fee: Number(form.service_fee) || 0,
    });
    toast.success(`Tiket ${r.ticket_no} dibuat`);
    navigate(`/repairs/${r.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" data-testid="repair-new-page">
      <button onClick={() => navigate('/repairs')} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="btn-back">
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar
      </button>

      <div>
        <h1 className="title-box font-display font-bold tracking-tight">Buat Tiket Servis</h1>
        <p className="text-muted-foreground text-sm mt-1">Isi detail perangkat dan keluhan pelanggan.</p>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Pelanggan *</label>
            <select required data-testid="repair-customer-select" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Pilih pelanggan</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </select>
            {customers.length === 0 && <p className="text-xs text-destructive mt-1.5">Tambahkan pelanggan terlebih dahulu di halaman Pelanggan.</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Brand *</label>
            <select data-testid="repair-brand" value={form.device_brand} onChange={(e) => setForm({ ...form, device_brand: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
              {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Model *</label>
            <input required data-testid="repair-model" value={form.device_model} onChange={(e) => setForm({ ...form, device_model: e.target.value })}
              placeholder="e.g. iPhone 13 Pro"
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Serial Number / IMEI</label>
            <input data-testid="repair-serial" value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })}
              placeholder="e.g. IMEI:353xxxx"
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Keluhan *</label>
            <textarea required rows={4} data-testid="repair-complaint" value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })}
              placeholder="Ceritakan gejala yang dialami pelanggan..."
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">DP / Uang Muka</label>
            <input type="number" min={0} data-testid="repair-deposit" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Estimasi Biaya Jasa</label>
            <input type="number" min={0} data-testid="repair-service-fee" value={form.service_fee} onChange={(e) => setForm({ ...form, service_fee: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={() => navigate('/repairs')} className="h-10 px-4 rounded-md border border-border hover:bg-accent transition-colors text-sm font-medium">Batal</button>
          <button type="submit" data-testid="repair-create-submit"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-semibold">
            <Save className="h-4 w-4" /> Buat Tiket
          </button>
        </div>
      </form>
    </div>
  );
}

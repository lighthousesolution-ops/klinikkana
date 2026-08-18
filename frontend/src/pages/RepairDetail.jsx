import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Package, Plus, Trash2, User, Smartphone, ClipboardList, Save, Printer, Wallet, FileText, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { repairsApi, customersApi, sparepartsApi, usersApi, settingsApi, computeTotal } from '@/lib/store';
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/mockData';
import { formatIDR, formatDateTime, formatDate, waLink, renderTemplate } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';

export default function RepairDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const repair = repairsApi.get(id);
  const customer = repair ? customersApi.get(repair.customer_id) : null;
  const technicians = usersApi.list().filter((u) => u.role === 'technician');
  const spareparts = sparepartsApi.list();
  const spMap = Object.fromEntries(spareparts.map((s) => [s.id, s]));
  const totals = repair ? computeTotal(repair) : { parts_total: 0, total: 0, balance: 0 };

  const [editForm, setEditForm] = useState({
    service_fee: repair?.service_fee || 0,
    deposit: repair?.deposit || 0,
    technician_id: repair?.technician_id || '',
    notes: repair?.notes || '',
  });
  const [selPart, setSelPart] = useState({ sparepart_id: '', qty: 1 });
  const [payForm, setPayForm] = useState({ amount: '', method: 'Tunai', note: '' });

  const settings = settingsApi.get();

  const waMessage = useMemo(() => {
    if (!repair) return '';
    const statusKey = repair.status;
    const statusMsg = settings[`wa_status_${statusKey}`] || '';
    const statusUrl = `${window.location.origin}/status/${encodeURIComponent(repair.ticket_no)}`;
    return renderTemplate(settings.wa_template || '', {
      customer_name: customer?.name || '',
      shop_name: settings.shop_name || '',
      ticket_no: repair.ticket_no,
      device: `${repair.device_brand} ${repair.device_model}`,
      status: STATUS_LABELS[statusKey],
      total: formatIDR(totals.total),
      deposit: formatIDR(totals.deposit + totals.payments_total),
      balance: formatIDR(Math.max(0, totals.balance)),
      status_message: statusMsg,
      status_url: statusUrl,
    });
  }, [repair, customer, totals, settings]);

  if (!repair) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Tiket tidak ditemukan.</p>
        <button onClick={() => navigate('/repairs')} className="mt-4 text-primary hover:underline">Kembali</button>
      </div>
    );
  }

  const canEditTech = hasRole('admin', 'technician');
  const canEditPrice = hasRole('admin', 'cashier');

  const updateStatus = (status) => {
    const updated = repairsApi.changeStatus(id, status);
    if (!updated || updated.status !== status) {
      toast.error('Gagal mengubah status. Silakan coba lagi.');
      return;
    }
    toast.success(`Status diubah ke ${STATUS_LABELS[status]}`);
    refresh();
  };

  const saveEdit = () => {
    repairsApi.update(id, {
      service_fee: Number(editForm.service_fee) || 0,
      deposit: Number(editForm.deposit) || 0,
      technician_id: editForm.technician_id || null,
      notes: editForm.notes,
    });
    toast.success('Detail servis disimpan');
    refresh();
  };

  const addPart = () => {
    if (!selPart.sparepart_id) return toast.error('Pilih sparepart');
    try {
      repairsApi.addPart(id, selPart.sparepart_id, Number(selPart.qty) || 1);
      toast.success('Sparepart ditambahkan');
      setSelPart({ sparepart_id: '', qty: 1 });
      refresh();
    } catch (err) { toast.error(err.message); }
  };

  const removePart = (idx) => {
    if (window.confirm('Hapus sparepart ini dari tiket?')) {
      repairsApi.removePart(id, idx);
      toast.success('Sparepart dihapus, stok dikembalikan');
      refresh();
    }
  };

  const addPayment = () => {
    const amt = Number(payForm.amount);
    if (!amt || amt <= 0) return toast.error('Masukkan jumlah yang valid');
    try {
      repairsApi.addPayment(id, amt, payForm.method, payForm.note);
      toast.success(`Pembayaran ${formatIDR(amt)} dicatat`);
      setPayForm({ amount: '', method: 'Tunai', note: '' });
      refresh();
    } catch (err) { toast.error(err.message); }
  };

  const removePayment = (pid) => {
    if (window.confirm('Hapus pembayaran ini?')) {
      repairsApi.removePayment(id, pid);
      toast.success('Pembayaran dihapus');
      refresh();
    }
  };

  const publicStatusUrl = `${window.location.origin}/status/${encodeURIComponent(repair.ticket_no)}`;
  const copyStatusLink = async () => {
    try {
      await navigator.clipboard.writeText(publicStatusUrl);
      toast.success('Link cek status disalin ke clipboard');
    } catch {
      toast.error('Gagal menyalin — silakan copy manual: ' + publicStatusUrl);
    }
  };

  const nextStatusIdx = STATUS_ORDER.indexOf(repair.status);
  const nextStatus = nextStatusIdx >= 0 && nextStatusIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[nextStatusIdx + 1] : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl" data-testid="repair-detail-page">
      <button onClick={() => navigate('/repairs')} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="btn-back">
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar
      </button>

      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">{repair.ticket_no}</span>
              <StatusBadge status={repair.status} />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight mt-2">{repair.device_brand} {repair.device_model}</h1>
            <p className="text-muted-foreground text-sm mt-1">Dibuat {formatDateTime(repair.created_at)} • Update {formatDateTime(repair.updated_at)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={waLink(customer?.phone, waMessage)} target="_blank" rel="noreferrer" data-testid="btn-wa-send"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-semibold">
              <MessageCircle className="h-4 w-4" /> Kirim WhatsApp
            </a>
            <Link to={`/repairs/${id}/invoice`} data-testid="btn-open-invoice"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-semibold">
              <FileText className="h-4 w-4" /> Cetak Nota
            </Link>
            <button onClick={copyStatusLink} data-testid="btn-copy-status-link" title={publicStatusUrl}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border hover:bg-accent transition-colors text-sm font-semibold">
              <LinkIcon className="h-4 w-4" /> Salin Link Status
            </button>
          </div>
        </div>
      </div>

      {/* Status workflow */}
      <div className="rounded-lg border border-border bg-card p-5" data-testid="status-workflow">
        <div className="overline text-muted-foreground mb-3">Alur Status</div>
        <div className="flex flex-wrap gap-2 items-center">
          {STATUS_ORDER.map((s, i) => (
            <React.Fragment key={s}>
              <button
                onClick={() => updateStatus(s)}
                data-testid={`btn-status-${s}`}
                className={`px-3.5 h-9 rounded-md text-sm font-semibold border transition-colors ${
                  repair.status === s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : i <= STATUS_ORDER.indexOf(repair.status)
                    ? 'bg-accent text-accent-foreground border-transparent'
                    : 'border-border hover:bg-accent'
                }`}
              >
                {i + 1}. {STATUS_LABELS[s]}
              </button>
              {i < STATUS_ORDER.length - 1 && <span className="text-muted-foreground">→</span>}
            </React.Fragment>
          ))}
          {nextStatus && (
            <button onClick={() => updateStatus(nextStatus)} data-testid="btn-advance-status"
              className="ml-auto inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors">
              Lanjut ke {STATUS_LABELS[nextStatus]} →
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Info & Parts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer + Device */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-primary" />
                <div className="overline text-muted-foreground">Pelanggan</div>
              </div>
              <div className="text-lg font-display font-semibold tracking-tight">{customer?.name || '-'}</div>
              <div className="text-sm text-muted-foreground font-mono mt-1">{customer?.phone}</div>
              <div className="text-sm text-muted-foreground mt-2">{customer?.address}</div>
              {customer && (
                <Link to={`/customers`} className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-3">
                  Lihat riwayat →
                </Link>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="h-4 w-4 text-primary" />
                <div className="overline text-muted-foreground">Perangkat</div>
              </div>
              <div className="text-lg font-display font-semibold tracking-tight">{repair.device_brand} {repair.device_model}</div>
              <div className="text-sm text-muted-foreground font-mono mt-1">{repair.serial_no || 'Tanpa serial'}</div>
              <div className="text-sm mt-3 leading-relaxed border-t border-border pt-3">
                <div className="overline text-muted-foreground mb-1">Keluhan</div>
                {repair.complaint}
              </div>
            </div>
          </div>

          {/* Technician Notes / Edit */}
          <div className="rounded-lg border border-border bg-card p-5" data-testid="technician-section">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="h-4 w-4 text-primary" />
              <div className="overline text-muted-foreground">Detail Servis</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Teknisi</label>
                <select value={editForm.technician_id} onChange={(e) => setEditForm({ ...editForm, technician_id: e.target.value })}
                  disabled={!canEditTech} data-testid="edit-technician"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60">
                  <option value="">— Belum ditugaskan —</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Biaya Jasa</label>
                <input type="number" min={0} disabled={!canEditPrice} value={editForm.service_fee} onChange={(e) => setEditForm({ ...editForm, service_fee: e.target.value })}
                  data-testid="edit-service-fee"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono disabled:opacity-60" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">DP</label>
                <input type="number" min={0} disabled={!canEditPrice} value={editForm.deposit} onChange={(e) => setEditForm({ ...editForm, deposit: e.target.value })}
                  data-testid="edit-deposit"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono disabled:opacity-60" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">Catatan Teknisi</label>
                <textarea rows={3} disabled={!canEditTech} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  data-testid="edit-notes"
                  placeholder="Tindakan yang dilakukan, temuan, dll."
                  className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none disabled:opacity-60" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={saveEdit} data-testid="btn-save-detail"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-semibold">
                <Save className="h-4 w-4" /> Simpan
              </button>
            </div>
          </div>

          {/* Spare parts used */}
          <div className="rounded-lg border border-border bg-card p-5" data-testid="parts-section">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-4 w-4 text-primary" />
              <div className="overline text-muted-foreground">Sparepart Terpakai</div>
            </div>

            {canEditTech && (
              <div className="flex flex-col sm:flex-row gap-2 mb-4 p-3 bg-muted/40 rounded-md border border-border">
                <select value={selPart.sparepart_id} onChange={(e) => setSelPart({ ...selPart, sparepart_id: e.target.value })}
                  data-testid="add-part-select"
                  className="flex-1 h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Pilih sparepart</option>
                  {spareparts.filter((s) => s.stock > 0).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {formatIDR(s.selling_price)} (stok {s.stock})</option>
                  ))}
                </select>
                <input type="number" min={1} value={selPart.qty} onChange={(e) => setSelPart({ ...selPart, qty: e.target.value })}
                  data-testid="add-part-qty"
                  className="w-24 h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono text-center" />
                <button onClick={addPart} data-testid="btn-add-part"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors">
                  <Plus className="h-4 w-4" /> Tambah
                </button>
              </div>
            )}

            {(repair.parts_used || []).length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Belum ada sparepart digunakan.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">Sparepart</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Harga</th>
                      <th className="px-2 py-2 text-right">Subtotal</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {repair.parts_used.map((p, i) => (
                      <tr key={i}>
                        <td className="px-2 py-2 font-medium">{spMap[p.sparepart_id]?.name || 'Sparepart dihapus'}</td>
                        <td className="px-2 py-2 text-right font-mono">{p.qty}</td>
                        <td className="px-2 py-2 text-right font-mono">{formatIDR(p.price)}</td>
                        <td className="px-2 py-2 text-right font-mono font-semibold">{formatIDR(p.qty * p.price)}</td>
                        <td className="px-2 py-2 text-right">
                          {canEditTech && (
                            <button onClick={() => removePart(i)} className="h-8 w-8 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                              data-testid={`btn-remove-part-${i}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="rounded-lg border border-border bg-card p-5" data-testid="payments-section">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-4 w-4 text-primary" />
              <div className="overline text-muted-foreground">Riwayat Pembayaran</div>
            </div>

            {(hasRole('admin', 'cashier')) && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_1fr_auto] gap-2 mb-4 p-3 bg-muted/40 rounded-md border border-border">
                <input type="number" min={1} placeholder="Jumlah (Rp)" value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  data-testid="pay-amount"
                  className="h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
                <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                  data-testid="pay-method"
                  className="h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option>Tunai</option>
                  <option>Transfer</option>
                  <option>QRIS</option>
                  <option>E-Wallet</option>
                  <option>Kartu Debit</option>
                </select>
                <input type="text" placeholder="Keterangan (opsional)" value={payForm.note}
                  onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                  data-testid="pay-note"
                  className="h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <button onClick={addPayment} data-testid="btn-add-payment"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors">
                  <Plus className="h-4 w-4" /> Catat
                </button>
              </div>
            )}

            {(repair.payments || []).length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Belum ada pembayaran tercatat.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">Tanggal</th>
                      <th className="px-2 py-2 text-left">Metode</th>
                      <th className="px-2 py-2 text-left">Keterangan</th>
                      <th className="px-2 py-2 text-right">Jumlah</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {repair.payments.map((p) => (
                      <tr key={p.id} data-testid={`payment-row-${p.id}`}>
                        <td className="px-2 py-2 text-xs">{formatDate(p.paid_at)}</td>
                        <td className="px-2 py-2"><span className="text-xs px-2 py-0.5 rounded-md bg-muted">{p.method}</span></td>
                        <td className="px-2 py-2 text-muted-foreground text-xs">{p.note || '-'}</td>
                        <td className="px-2 py-2 text-right font-mono font-semibold">{formatIDR(p.amount)}</td>
                        <td className="px-2 py-2 text-right">
                          {hasRole('admin', 'cashier') && (
                            <button onClick={() => removePayment(p.id)} data-testid={`btn-remove-payment-${p.id}`}
                              className="h-8 w-8 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/40 font-semibold">
                      <td colSpan={3} className="px-2 py-2 text-right">Total dibayar</td>
                      <td className="px-2 py-2 text-right font-mono" data-testid="payments-sum">{formatIDR(totals.payments_total)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Bill */}
        <div className="rounded-lg border border-border bg-card p-6 self-start sticky top-6" data-testid="bill-summary">
          <div className="overline text-muted-foreground mb-4">Rincian Biaya</div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Biaya Jasa</span>
              <span className="font-mono">{formatIDR(repair.service_fee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Sparepart</span>
              <span className="font-mono">{formatIDR(totals.parts_total)}</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between font-semibold">
              <span>Total</span>
              <span className="font-mono text-lg font-display" data-testid="bill-total">{formatIDR(totals.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">DP / Uang Muka</span>
              <span className="font-mono">- {formatIDR(totals.deposit)}</span>
            </div>
            {totals.payments_total > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cicilan/Pelunasan</span>
                <span className="font-mono">- {formatIDR(totals.payments_total)}</span>
              </div>
            )}
            <div className="border-t border-border pt-3 flex justify-between font-bold">
              <span>Sisa Bayar</span>
              <span className={`font-mono text-xl font-display ${totals.balance <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`} data-testid="bill-balance">
                {formatIDR(Math.max(0, totals.balance))}
              </span>
            </div>
            {totals.balance <= 0 && <div className="text-xs text-center text-emerald-600 dark:text-emerald-400 pt-2">✓ Lunas</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

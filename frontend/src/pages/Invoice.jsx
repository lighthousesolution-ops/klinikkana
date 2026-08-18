import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer, Smartphone } from 'lucide-react';
import { repairsApi, customersApi, sparepartsApi, usersApi, settingsApi, computeTotal } from '@/lib/store';
import { STATUS_LABELS } from '@/lib/mockData';
import { formatIDR, formatDate, formatDateTime } from '@/lib/utils';

/*
 * Invoice printer:
 *  - Mode 'a4': portrait A4, standard.
 *  - Mode 'thermal': 58mm thermal receipt.
 */
export default function InvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState('a4');

  const repair = repairsApi.get(id);
  const customer = repair ? customersApi.get(repair.customer_id) : null;
  const spareparts = sparepartsApi.list();
  const spMap = Object.fromEntries(spareparts.map((s) => [s.id, s]));
  const users = usersApi.list();
  const technician = repair?.technician_id ? users.find((u) => u.id === repair.technician_id) : null;
  const settings = settingsApi.get();
  const totals = repair ? computeTotal(repair) : null;

  const qrValue = useMemo(() => {
    if (!repair) return '';
    return JSON.stringify({ ticket: repair.ticket_no, id: repair.id, shop: settings.shop_name });
  }, [repair, settings]);

  useEffect(() => {
    document.body.classList.toggle('print-thermal', mode === 'thermal');
    return () => document.body.classList.remove('print-thermal');
  }, [mode]);

  if (!repair) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Tiket tidak ditemukan.</p>
        <button onClick={() => navigate('/repairs')} className="mt-4 text-primary hover:underline">Kembali</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 print:bg-white print:py-0" data-testid="invoice-page">
      {/* Toolbar (screen only) */}
      <div className="no-print max-w-3xl mx-auto px-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-md p-3 shadow-sm">
          <button onClick={() => navigate(`/repairs/${id}`)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="btn-back-invoice">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-1 rounded-md border border-border bg-background">
              <button onClick={() => setMode('a4')} data-testid="mode-a4"
                className={`px-3 h-8 rounded-sm text-sm font-medium transition-colors ${mode === 'a4' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                A4
              </button>
              <button onClick={() => setMode('thermal')} data-testid="mode-thermal"
                className={`px-3 h-8 rounded-sm text-sm font-medium transition-colors ${mode === 'thermal' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                Thermal 58mm
              </button>
            </div>
            <button onClick={() => window.print()} data-testid="btn-print-now"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors">
              <Printer className="h-4 w-4" /> Cetak
            </button>
          </div>
        </div>
      </div>

      {/* Invoice */}
      {mode === 'a4' ? (
        <InvoiceA4 repair={repair} customer={customer} spMap={spMap} technician={technician} settings={settings} totals={totals} qrValue={qrValue} />
      ) : (
        <InvoiceThermal repair={repair} customer={customer} spMap={spMap} settings={settings} totals={totals} qrValue={qrValue} />
      )}
    </div>
  );
}

function InvoiceA4({ repair, customer, spMap, technician, settings, totals, qrValue }) {
  return (
    <div className="max-w-3xl mx-auto bg-white text-black shadow-md print:shadow-none border border-border print:border-0 p-10 print-page" data-testid="invoice-a4">
      {/* Header */}
      <div className="flex justify-between items-start pb-6 border-b-2 border-black">
        <div className="flex items-start gap-4">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-16 w-16 object-contain" />
          ) : (
            <div className="h-16 w-16 rounded-md bg-black text-white grid place-items-center">
              <Smartphone className="h-8 w-8" />
            </div>
          )}
          <div>
            <div className="font-display text-2xl font-bold tracking-tight">{settings.shop_name}</div>
            <div className="text-sm text-neutral-600">{settings.shop_tagline}</div>
            <div className="text-xs text-neutral-600 mt-2 whitespace-pre-line">{settings.shop_address}</div>
            <div className="text-xs text-neutral-600 font-mono">{settings.shop_phone}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="uppercase tracking-widest text-xs font-semibold text-neutral-500">Invoice / Nota Servis</div>
          <div className="font-display font-bold text-3xl mt-1">{repair.ticket_no}</div>
          <div className="mt-3">
            <QRCodeSVG value={qrValue} size={80} level="M" includeMargin={false} />
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-3 gap-6 py-6 border-b border-neutral-300 text-sm">
        <div>
          <div className="uppercase tracking-wider text-[10px] text-neutral-500 mb-1">Pelanggan</div>
          <div className="font-semibold">{customer?.name || '-'}</div>
          <div className="text-neutral-700 font-mono text-xs">{customer?.phone}</div>
          <div className="text-neutral-700 text-xs">{customer?.address}</div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-[10px] text-neutral-500 mb-1">Perangkat</div>
          <div className="font-semibold">{repair.device_brand} {repair.device_model}</div>
          <div className="text-neutral-700 font-mono text-xs">{repair.serial_no || '—'}</div>
          <div className="text-neutral-700 text-xs mt-1">Teknisi: {technician?.full_name || '—'}</div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-[10px] text-neutral-500 mb-1">Info Tiket</div>
          <div className="text-neutral-700 text-xs">Masuk: <b>{formatDate(repair.created_at)}</b></div>
          <div className="text-neutral-700 text-xs">Selesai: <b>{repair.completed_at ? formatDate(repair.completed_at) : '—'}</b></div>
          <div className="text-neutral-700 text-xs">Status: <b className="uppercase">{STATUS_LABELS[repair.status]}</b></div>
        </div>
      </div>

      {/* Complaint */}
      <div className="py-4 border-b border-neutral-300">
        <div className="uppercase tracking-wider text-[10px] text-neutral-500 mb-1">Keluhan Awal</div>
        <div className="text-sm">{repair.complaint}</div>
        {repair.notes && (
          <>
            <div className="uppercase tracking-wider text-[10px] text-neutral-500 mt-3 mb-1">Catatan Teknisi</div>
            <div className="text-sm italic text-neutral-700">{repair.notes}</div>
          </>
        )}
      </div>

      {/* Line items */}
      <table className="w-full mt-6 text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 uppercase tracking-wider text-[10px] text-neutral-500 font-semibold">Deskripsi</th>
            <th className="py-2 uppercase tracking-wider text-[10px] text-neutral-500 font-semibold text-right w-16">Qty</th>
            <th className="py-2 uppercase tracking-wider text-[10px] text-neutral-500 font-semibold text-right w-28">Harga</th>
            <th className="py-2 uppercase tracking-wider text-[10px] text-neutral-500 font-semibold text-right w-32">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-neutral-200">
            <td className="py-2.5">Jasa Servis — {repair.device_brand} {repair.device_model}</td>
            <td className="py-2.5 text-right font-mono">1</td>
            <td className="py-2.5 text-right font-mono">{formatIDR(repair.service_fee)}</td>
            <td className="py-2.5 text-right font-mono font-semibold">{formatIDR(repair.service_fee)}</td>
          </tr>
          {(repair.parts_used || []).map((p, i) => (
            <tr key={i} className="border-b border-neutral-200">
              <td className="py-2.5">{spMap[p.sparepart_id]?.name || 'Sparepart'} <span className="text-xs text-neutral-500 font-mono">({spMap[p.sparepart_id]?.sku || '-'})</span></td>
              <td className="py-2.5 text-right font-mono">{p.qty}</td>
              <td className="py-2.5 text-right font-mono">{formatIDR(p.price)}</td>
              <td className="py-2.5 text-right font-mono font-semibold">{formatIDR(p.qty * p.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mt-4">
        <div className="w-72 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-neutral-600">Subtotal</span>
            <span className="font-mono">{formatIDR(totals.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600">Uang Muka (DP)</span>
            <span className="font-mono">- {formatIDR(totals.deposit)}</span>
          </div>
          {totals.payments_total > 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-600">Cicilan/Pelunasan</span>
              <span className="font-mono">- {formatIDR(totals.payments_total)}</span>
            </div>
          )}
          <div className="border-t-2 border-black pt-2 flex justify-between font-bold text-base">
            <span>Sisa Bayar</span>
            <span className="font-mono font-display text-lg">{formatIDR(Math.max(0, totals.balance))}</span>
          </div>
          {totals.balance <= 0 && (
            <div className="text-center py-2 mt-2 border-2 border-green-700 text-green-700 font-display font-bold tracking-widest text-sm">
              ✓ LUNAS
            </div>
          )}
        </div>
      </div>

      {/* Payments list */}
      {(repair.payments || []).length > 0 && (
        <div className="mt-8">
          <div className="uppercase tracking-wider text-[10px] text-neutral-500 mb-2">Riwayat Pembayaran</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-1.5 font-semibold">Tanggal</th>
                <th className="py-1.5 font-semibold">Metode</th>
                <th className="py-1.5 font-semibold">Keterangan</th>
                <th className="py-1.5 font-semibold text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {repair.payments.map((p, i) => (
                <tr key={p.id} className="border-b border-neutral-100">
                  <td className="py-1.5">{formatDate(p.paid_at)}</td>
                  <td className="py-1.5">{p.method}</td>
                  <td className="py-1.5 text-neutral-600">{p.note || '-'}</td>
                  <td className="py-1.5 text-right font-mono">{formatIDR(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 pt-6 border-t border-neutral-300 flex justify-between items-end">
        <div className="text-xs text-neutral-600 whitespace-pre-line max-w-md">
          {settings.invoice_footer}
        </div>
        <div className="text-center">
          <div className="h-16 mb-1"></div>
          <div className="border-t border-black w-40 pt-1 text-xs">Tanda Tangan</div>
        </div>
      </div>

      <div className="text-center text-[10px] text-neutral-400 mt-6 uppercase tracking-widest">
        Dicetak {formatDateTime(new Date().toISOString())} • Powered by {settings.shop_name}
      </div>
    </div>
  );
}

function InvoiceThermal({ repair, customer, spMap, settings, totals, qrValue }) {
  return (
    <div className="mx-auto bg-white text-black shadow-md print:shadow-none border border-border print:border-0 print-page"
      style={{ width: '58mm', padding: '4mm', fontSize: '10px', fontFamily: 'IBM Plex Mono, ui-monospace, monospace', lineHeight: 1.35 }}
      data-testid="invoice-thermal">
      {/* Header */}
      <div className="text-center border-b border-dashed border-black pb-2 mb-2">
        {settings.logo_url && (
          <img src={settings.logo_url} alt="Logo" style={{ height: '30px', width: 'auto', margin: '0 auto 4px', objectFit: 'contain' }} />
        )}
        <div style={{ fontSize: '13px', fontWeight: 700 }}>{settings.shop_name}</div>
        <div style={{ fontSize: '9px' }}>{settings.shop_address}</div>
        <div style={{ fontSize: '9px' }}>{settings.shop_phone}</div>
      </div>

      <div className="text-center mb-2">
        <div style={{ fontSize: '11px', fontWeight: 700 }}>NOTA SERVIS</div>
        <div style={{ fontSize: '10px' }}>{repair.ticket_no}</div>
      </div>

      <div className="border-b border-dashed border-black pb-2 mb-2" style={{ fontSize: '9px' }}>
        <div className="flex justify-between"><span>Tgl</span><span>{formatDate(repair.created_at)}</span></div>
        <div className="flex justify-between"><span>Nama</span><span style={{ maxWidth: '60%', textAlign: 'right' }}>{customer?.name}</span></div>
        <div className="flex justify-between"><span>HP</span><span>{customer?.phone}</span></div>
        <div className="flex justify-between"><span>Device</span><span style={{ maxWidth: '60%', textAlign: 'right' }}>{repair.device_brand} {repair.device_model}</span></div>
        {repair.serial_no && <div className="flex justify-between"><span>SN</span><span style={{ maxWidth: '60%', textAlign: 'right', fontSize: '8px' }}>{repair.serial_no}</span></div>}
        <div className="flex justify-between"><span>Status</span><span style={{ fontWeight: 700 }}>{STATUS_LABELS[repair.status]}</span></div>
      </div>

      <div style={{ fontSize: '9px' }} className="mb-2">
        <div style={{ fontWeight: 700, marginBottom: '2px' }}>Keluhan:</div>
        <div>{repair.complaint}</div>
      </div>

      {/* Items */}
      <div className="border-t border-dashed border-black pt-2" style={{ fontSize: '9px' }}>
        <div className="flex justify-between" style={{ fontWeight: 700 }}>
          <span>Jasa Servis</span>
          <span>{formatIDR(repair.service_fee)}</span>
        </div>
        {(repair.parts_used || []).map((p, i) => (
          <div key={i} style={{ marginTop: '2px' }}>
            <div style={{ fontWeight: 500 }}>{spMap[p.sparepart_id]?.name || 'Sparepart'}</div>
            <div className="flex justify-between">
              <span>{p.qty} x {formatIDR(p.price)}</span>
              <span>{formatIDR(p.qty * p.price)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-dashed border-black mt-2 pt-2" style={{ fontSize: '10px' }}>
        <div className="flex justify-between"><span>Total</span><span style={{ fontWeight: 700 }}>{formatIDR(totals.total)}</span></div>
        <div className="flex justify-between"><span>DP</span><span>-{formatIDR(totals.deposit)}</span></div>
        {totals.payments_total > 0 && <div className="flex justify-between"><span>Cicilan</span><span>-{formatIDR(totals.payments_total)}</span></div>}
        <div className="flex justify-between border-t border-black mt-1 pt-1" style={{ fontWeight: 700, fontSize: '11px' }}>
          <span>Sisa</span>
          <span>{formatIDR(Math.max(0, totals.balance))}</span>
        </div>
        {totals.balance <= 0 && (
          <div className="text-center border border-black mt-2 py-1" style={{ fontWeight: 700, letterSpacing: '2px' }}>
            LUNAS
          </div>
        )}
      </div>

      {/* QR */}
      <div className="text-center mt-3 pt-2 border-t border-dashed border-black">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <QRCodeSVG value={qrValue} size={70} level="M" includeMargin={false} />
        </div>
        <div style={{ fontSize: '8px', marginTop: '3px' }}>Scan untuk cek status</div>
      </div>

      {/* Footer */}
      <div className="text-center mt-3 border-t border-dashed border-black pt-2 whitespace-pre-line" style={{ fontSize: '8px' }}>
        {settings.invoice_footer}
      </div>
      <div className="text-center" style={{ fontSize: '8px', marginTop: '4px' }}>
        {formatDateTime(new Date().toISOString())}
      </div>
    </div>
  );
}

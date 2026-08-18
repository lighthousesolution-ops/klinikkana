import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, PackageCheck, Home, Smartphone, Phone, MapPin, MessageCircle, Search, AlertCircle } from 'lucide-react';
import { repairsApi, customersApi, usersApi, settingsApi, computeTotal, ensureSeed } from '@/lib/store';
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/mockData';
import { formatIDR, formatDate, waLink } from '@/lib/utils';

const STATUS_ICONS = {
  pending: Clock,
  in_progress: Search,
  ready: PackageCheck,
  picked_up: Home,
};

const STATUS_DESCRIPTIONS = {
  pending: 'Perangkat Anda sudah kami terima dan sedang menunggu pemeriksaan.',
  in_progress: 'Teknisi sedang mengerjakan perangkat Anda saat ini.',
  ready: 'Perangkat Anda sudah selesai! Silakan datang ke toko untuk mengambil.',
  picked_up: 'Perangkat Anda sudah diambil. Terima kasih atas kepercayaan Anda!',
};

const STATUS_TONES = {
  pending:    { chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', icon: 'bg-amber-500', ring: 'ring-amber-500/40' },
  in_progress:{ chip: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',    icon: 'bg-blue-500',  ring: 'ring-blue-500/40' },
  ready:      { chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', icon: 'bg-emerald-500', ring: 'ring-emerald-500/40' },
  picked_up:  { chip: 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30',    icon: 'bg-gray-500',  ring: 'ring-gray-500/40' },
};

// Mask customer name: "Rina Marlina" -> "Rina M****a"
function maskName(name) {
  if (!name) return '-';
  const parts = name.trim().split(/\s+/);
  const masked = parts.map((p, i) => {
    if (i === 0) return p;
    if (p.length <= 2) return p[0] + '*';
    return p[0] + '*'.repeat(Math.max(2, p.length - 2)) + p.slice(-1);
  });
  return masked.join(' ');
}

// Mask phone: "081211112222" -> "0812****2222"
function maskPhone(phone) {
  if (!phone) return '-';
  const p = String(phone).replace(/\D/g, '');
  if (p.length < 8) return p;
  return p.slice(0, 4) + '****' + p.slice(-4);
}

export default function PublicStatusPage() {
  const { ticket_no } = useParams();
  ensureSeed();

  const repair = repairsApi.getByTicket(ticket_no);
  const customer = repair ? customersApi.get(repair.customer_id) : null;
  const users = usersApi.list();
  const technician = repair?.technician_id ? users.find((u) => u.id === repair.technician_id) : null;
  const settings = settingsApi.get();
  const totals = repair ? computeTotal(repair) : null;

  const timeline = useMemo(() => {
    if (!repair) return [];
    const idx = STATUS_ORDER.indexOf(repair.status);
    return STATUS_ORDER.map((s, i) => ({
      key: s,
      label: STATUS_LABELS[s],
      done: i <= idx,
      current: i === idx,
      icon: STATUS_ICONS[s],
    }));
  }, [repair]);

  if (!repair) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col">
        <PublicHeader settings={settings} />
        <div className="flex-1 grid place-items-center p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 grid place-items-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Tiket Tidak Ditemukan</h1>
            <p className="text-muted-foreground text-sm">
              Nomor tiket <span className="font-mono font-semibold">{ticket_no}</span> tidak kami temukan.
              Pastikan Anda men-scan QR code dari nota resmi.
            </p>
            <a href={waLink(settings.shop_phone, `Halo ${settings.shop_name}, saya ingin bertanya tentang tiket ${ticket_no}`)}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-sm transition-colors">
              <MessageCircle className="h-4 w-4" /> Hubungi Kami via WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  const tone = STATUS_TONES[repair.status];
  const CurrentIcon = STATUS_ICONS[repair.status];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background" data-testid="public-status-page">
      <PublicHeader settings={settings} />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Hero status card */}
        <div className={`rounded-xl border-2 bg-card p-6 shadow-sm animate-slide-up ${tone.chip.split(' ').filter(x => x.startsWith('border')).join(' ')}`} data-testid="status-hero">
          <div className="flex items-start gap-4">
            <div className={`h-16 w-16 rounded-full grid place-items-center ${tone.icon} ring-8 ${tone.ring} shrink-0`}>
              <CurrentIcon className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-muted-foreground mb-1">{repair.ticket_no}</div>
              <div className={`inline-flex text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${tone.chip}`}>
                {STATUS_LABELS[repair.status]}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-3">
                {repair.device_brand} {repair.device_model}
              </h1>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {STATUS_DESCRIPTIONS[repair.status]}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-lg border border-border bg-card p-6" data-testid="status-timeline">
          <div className="overline mb-4">Alur Servis</div>
          <div className="space-y-4">
            {timeline.map((t, i) => {
              const Icon = t.icon;
              return (
                <div key={t.key} className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full grid place-items-center shrink-0 transition-colors ${
                    t.current ? `${STATUS_TONES[t.key].icon} text-white ring-4 ${STATUS_TONES[t.key].ring}` :
                    t.done ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {t.done && !t.current ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold text-sm ${t.current ? 'text-foreground' : t.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {t.label}
                    </div>
                    {t.current && <div className="text-xs text-muted-foreground mt-0.5">Status saat ini</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Details */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4" data-testid="status-details">
          <div className="overline">Detail Perbaikan</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Row label="Pemilik" value={maskName(customer?.name)} />
            <Row label="Kontak" value={maskPhone(customer?.phone)} mono />
            <Row label="Perangkat" value={`${repair.device_brand} ${repair.device_model}`} />
            <Row label="Serial/IMEI" value={repair.serial_no || '—'} mono truncate />
            <Row label="Tanggal Masuk" value={formatDate(repair.created_at)} />
            <Row label="Estimasi Selesai" value={repair.completed_at ? formatDate(repair.completed_at) : 'Menunggu'} />
            {technician && <Row label="Teknisi" value={technician.full_name} />}
          </div>

          <div className="pt-3 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground mb-1">Keluhan</div>
            <div className="text-sm">{repair.complaint}</div>
          </div>
        </div>

        {/* Billing */}
        <div className="rounded-lg border border-border bg-card p-6" data-testid="status-billing">
          <div className="overline mb-4">Rincian Biaya</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Biaya</span><span className="font-mono font-semibold">{formatIDR(totals.total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sudah Dibayar</span><span className="font-mono">{formatIDR(totals.paid)}</span></div>
            <div className="pt-3 mt-2 border-t border-border flex justify-between items-baseline">
              <span className="font-semibold">Sisa Bayar</span>
              <span className={`font-mono font-bold text-2xl font-display ${totals.balance <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`}>
                {formatIDR(Math.max(0, totals.balance))}
              </span>
            </div>
            {totals.balance <= 0 && (
              <div className="text-center py-2 mt-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-display font-bold tracking-widest text-sm">
                ✓ LUNAS
              </div>
            )}
          </div>
        </div>

        {/* Contact card */}
        <div className="rounded-lg border border-border bg-card p-6" data-testid="status-contact">
          <div className="flex items-start gap-4">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-14 w-14 rounded-md object-contain bg-accent p-1" />
            ) : (
              <div className="h-14 w-14 rounded-md bg-primary text-primary-foreground grid place-items-center shrink-0">
                <Smartphone className="h-7 w-7" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-lg tracking-tight">{settings.shop_name}</div>
              <div className="text-xs text-muted-foreground">{settings.shop_tagline}</div>
              <div className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" /><span>{settings.shop_address}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 font-mono">
                <Phone className="h-3 w-3 shrink-0" /><span>{settings.shop_phone}</span>
              </div>
            </div>
          </div>
          <a
            href={waLink(settings.shop_phone, `Halo ${settings.shop_name}, saya ingin bertanya tentang tiket ${repair.ticket_no}`)}
            target="_blank" rel="noreferrer"
            data-testid="btn-contact-shop"
            className="mt-4 w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-semibold"
          >
            <MessageCircle className="h-4 w-4" /> Hubungi Toko via WhatsApp
          </a>
        </div>

        <div className="text-center text-xs text-muted-foreground py-4">
          <div>Halaman ini bersifat publik untuk pelanggan.</div>
          <Link to="/login" className="text-primary hover:underline" data-testid="link-staff-login">Login staf →</Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono, truncate }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className={`text-sm ${mono ? 'font-mono' : ''} ${truncate ? 'truncate' : ''}`}>{value}</div>
    </div>
  );
}

function PublicHeader({ settings }) {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        {settings.logo_url ? (
          <img src={settings.logo_url} alt="Logo" className="h-9 w-9 rounded-md object-contain" />
        ) : (
          <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <Smartphone className="h-4 w-4" />
          </div>
        )}
        <div>
          <div className="font-display font-bold text-sm tracking-tight leading-tight">{settings.shop_name}</div>
          <div className="text-[10px] text-muted-foreground">Cek Status Servis</div>
        </div>
      </div>
    </header>
  );
}

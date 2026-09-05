import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, PackageCheck, Home, Smartphone, Phone, MapPin, MessageCircle, Search, AlertCircle, RefreshCw, Star, Send } from 'lucide-react';
import { toast } from 'sonner';
import { repairsApi, customersApi, usersApi, settingsApi, computeTotal, ensureSeed } from '@/lib/store';
import { fetchPublicRepair, submitPublicRating } from '@/lib/publicSync';
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

  // Server-authoritative snapshot (works across devices).
  // Falls back to localStorage if the server is unavailable.
  const [serverData, setServerData] = useState(null);
  const [serverTried, setServerTried] = useState(false);
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const data = await fetchPublicRepair(ticket_no);
      if (mounted) {
        setServerData(data);
        setServerTried(true);
      }
    };
    load();
    // Poll every 4s so status changes propagate across devices.
    const interval = setInterval(load, 4000);
    // Cross-tab sync (same browser).
    const bump = () => setTick((t) => t + 1);
    window.addEventListener('storage', bump);
    // Also reload on focus / tab-visible for snappy UX after unlocking phone.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        load();
        bump();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('storage', bump);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
  }, [ticket_no]);

  const manualRefresh = async () => {
    setRefreshing(true);
    const data = await fetchPublicRepair(ticket_no);
    setServerData(data);
    setTick((t) => t + 1);
    setTimeout(() => setRefreshing(false), 400);
  };

  // Local fallback (for same-device admin view).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const localRepair = useMemo(() => repairsApi.getByTicket(ticket_no), [ticket_no, tick]);

  // Prefer server data; fall back to local mock. Normalise into a single shape
  // used by the rest of the page.
  const repair = useMemo(() => {
    if (serverData) {
      return {
        ...localRepair, // keep id for local rating persistence
        ticket_no: serverData.ticket_no,
        status: serverData.status,
        device_brand: serverData.device_brand,
        device_model: serverData.device_model,
        serial_no: serverData.serial_no,
        complaint: serverData.complaint,
        technician_name: serverData.technician_name,
        created_at: serverData.created_at,
        completed_at: serverData.completed_at,
        picked_up_at: serverData.picked_up_at,
        rating: serverData.rating,
        review: serverData.review,
        rated_at: serverData.rated_at,
        admin_reply: serverData.admin_reply,
        admin_reply_by_name: serverData.admin_reply_by_name,
        admin_reply_at: serverData.admin_reply_at,
        // Services list (nama + kategori, tanpa harga per baris).
        // Prefer server-provided array; fall back to local services_json for
        // same-device admin preview before the first sync completes.
        services: Array.isArray(serverData.services) && serverData.services.length > 0
          ? serverData.services
          : (Array.isArray(localRepair?.services_json) ? localRepair.services_json : []),
        __fromServer: true,
      };
    }
    // Same-device admin preview / offline fallback — reuse services_json
    // directly so the "Jasa Dikerjakan" chips work even without a server sync.
    if (localRepair) {
      return {
        ...localRepair,
        services: Array.isArray(localRepair.services_json) ? localRepair.services_json : [],
      };
    }
    return localRepair;
  }, [serverData, localRepair]);

  // Totals: use server-provided totals if available, else compute locally.
  const totals = useMemo(() => {
    if (serverData) {
      return {
        total: Number(serverData.total) || 0,
        paid: Number(serverData.paid) || 0,
        balance: Number(serverData.balance) || 0,
      };
    }
    return localRepair ? computeTotal(localRepair) : { total: 0, paid: 0, balance: 0 };
  }, [serverData, localRepair]);

  // Customer & shop: from server snapshot when present, else from local store.
  const customer = useMemo(() => {
    if (serverData) return { name: serverData.customer_name, phone: serverData.customer_phone };
    return localRepair ? customersApi.get(localRepair.customer_id) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverData, localRepair, tick]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const users = useMemo(() => usersApi.list(), [tick]);
  const technician = useMemo(() => {
    if (serverData?.technician_name) return { full_name: serverData.technician_name };
    return localRepair?.technician_id ? users.find((u) => u.id === localRepair.technician_id) : null;
  }, [serverData, localRepair, users]);

  const settings = useMemo(() => {
    if (serverData?.shop) {
      return {
        shop_name: serverData.shop.name,
        shop_tagline: serverData.shop.tagline,
        shop_address: serverData.shop.address,
        shop_phone: serverData.shop.phone,
        logo_url: serverData.shop.logo_url,
      };
    }
    return settingsApi.get();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverData, tick]);

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

  if (!repair && serverTried) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col">
        <PublicHeader settings={settings} onRefresh={manualRefresh} refreshing={refreshing} />
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

  if (!repair) {
    // Server call still pending on first render — show a light skeleton.
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
        <PublicHeader settings={settings} onRefresh={manualRefresh} refreshing={refreshing} />
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-32 rounded-xl bg-muted" />
            <div className="h-48 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const tone = STATUS_TONES[repair.status];
  const CurrentIcon = STATUS_ICONS[repair.status];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background" data-testid="public-status-page">
      <PublicHeader settings={settings} onRefresh={manualRefresh} refreshing={refreshing} />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Hero status card */}
        <div className={`rounded-xl border-2 bg-card p-6 shadow-sm animate-slide-up ${tone.chip.split(' ').filter(x => x.startsWith('border')).join(' ')}`} data-testid="status-hero">
          <div className="flex items-start gap-4">
            <div className={`h-16 w-16 rounded-full grid place-items-center ${tone.icon} ring-8 ${tone.ring} shrink-0`}>
              <CurrentIcon className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="font-mono text-xs text-muted-foreground">{repair.ticket_no}</div>
                <div className="text-[10px] text-muted-foreground/70">• update otomatis</div>
              </div>
              <div className={`inline-flex text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${tone.chip}`} data-testid="current-status-chip">
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
            {timeline.map((t) => {
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

        {/* Rating form (only when picked_up / selesai) */}
        {repair.status === 'picked_up' && (
          <RatingSection repair={repair} onSubmitted={() => setTick((t) => t + 1)} />
        )}

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

          {Array.isArray(repair.services) && repair.services.length > 0 && (
            <div className="pt-3 border-t border-border" data-testid="public-services">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Jasa yang Dikerjakan</div>
              <div className="flex flex-wrap gap-1.5">
                {repair.services.map((s, i) => (
                  <span key={i} data-testid={`public-service-${i}`}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                      s.is_custom
                        ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                        : s.from_package
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-accent border-border'
                    }`}>
                    {s.category_name && <span className="text-[10px] opacity-70">{s.category_name} ·</span>}
                    <span className="font-medium">{s.name}</span>
                    {s.from_package && <span className="text-[9px] opacity-70">({s.from_package})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Billing */}
        <div className="rounded-lg border border-border bg-card p-6" data-testid="status-billing">
          <div className="overline mb-4">Rincian Biaya</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Biaya</span><span className="font-mono font-semibold">{formatIDR(totals.total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sudah Dibayar</span><span className="font-mono">{formatIDR(totals.paid)}</span></div>
            <div className="pt-3 mt-2 border-t border-border flex justify-between items-baseline">
              <span className="font-semibold">Sisa Bayar</span>
              <span className={`font-mono font-bold text-2xl font-display ${
                totals.balance <= 0 && totals.total > 0 && (repair.status === 'ready' || repair.status === 'picked_up')
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-primary'
              }`} data-testid="public-balance">
                {formatIDR(Math.max(0, totals.balance))}
              </span>
            </div>
            {/* Show LUNAS only when there IS a bill (total>0), balance is settled, AND
                the device is either ready to pick up or already picked up.
                Prevents "LUNAS" from showing on pending/in-progress tickets that have
                no cost yet (belum ada tagihan → belum bisa disebut lunas). */}
            {totals.total > 0 &&
             totals.balance <= 0 &&
             (repair.status === 'ready' || repair.status === 'picked_up') && (
              <div className="text-center py-2 mt-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-display font-bold tracking-widest text-sm" data-testid="lunas-badge">
                ✓ LUNAS
              </div>
            )}
            {/* Info kalau belum ada tagihan */}
            {totals.total === 0 && (
              <div className="text-center py-2 mt-2 rounded-md bg-muted/60 border border-border text-muted-foreground text-xs" data-testid="no-bill-info">
                Rincian biaya akan muncul setelah perangkat diperiksa teknisi.
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

function PublicHeader({ settings, onRefresh, refreshing }) {
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
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm tracking-tight leading-tight">{settings.shop_name}</div>
          <div className="text-[10px] text-muted-foreground">Cek Status Servis</div>
        </div>
        <button
          onClick={onRefresh}
          data-testid="btn-refresh-status"
          title="Muat ulang status"
          className="h-9 w-9 grid place-items-center rounded-md border border-border hover:bg-accent transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
}

// ============ Rating & Review Section ============
function RatingSection({ repair, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already rated → show thank-you
  if (repair.rating) {
    return (
      <div
        className="rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 p-6 text-center animate-slide-up"
        data-testid="rating-thankyou"
      >
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500 text-white grid place-items-center mb-3">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="font-display text-lg font-bold tracking-tight">Terima kasih atas ulasannya!</div>
        <p className="text-sm text-muted-foreground mt-1">Masukan Anda sangat berarti bagi kami.</p>
        <div className="flex items-center justify-center gap-1 mt-4" data-testid="rating-display">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={`h-6 w-6 ${s <= repair.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
            />
          ))}
        </div>
        {repair.review && (
          <div className="mt-4 mx-auto max-w-md text-sm text-muted-foreground italic border-t border-emerald-500/20 pt-3">
            "{repair.review}"
          </div>
        )}
        {repair.admin_reply && (
          <div className="mt-4 mx-auto max-w-md text-left bg-primary/5 border-l-4 border-primary/50 rounded-r-md p-3" data-testid="admin-reply-public">
            <div className="text-xs font-semibold text-primary mb-1">💬 Balasan dari toko</div>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{repair.admin_reply}</p>
          </div>
        )}
      </div>
    );
  }

  const submit = async () => {
    if (!rating) {
      toast.error('Pilih rating bintang terlebih dahulu');
      return;
    }
    setSubmitting(true);
    try {
      // Cross-device: submit to server. Also mirror to localStorage if we have
      // the local repair id (so admin app on same browser sees it instantly).
      await submitPublicRating(repair.ticket_no, rating, review);
      if (repair.id) {
        try { repairsApi.addRating(repair.id, rating, review); } catch (_) {}
      }
      toast.success('Terima kasih! Ulasan Anda telah dikirim.');
      onSubmitted?.();
    } catch (err) {
      const code = err?.response?.data?.detail;
      if (code === 'already_rated') toast.error('Ulasan sudah pernah dikirim untuk tiket ini');
      else if (code === 'status_not_picked_up') toast.error('Rating hanya bisa diberikan setelah perangkat diambil');
      else if (code === 'not_found') toast.error('Tiket tidak ditemukan di server');
      else toast.error(err.message || 'Gagal mengirim ulasan');
    } finally {
      setSubmitting(false);
    }
  };

  const active = hover || rating;
  const RATING_LABELS = ['', 'Sangat Kurang', 'Kurang', 'Cukup', 'Baik', 'Sangat Baik'];

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-6 animate-slide-up" data-testid="rating-form">
      <div className="text-center mb-4">
        <div className="overline text-primary mb-1">Beri Ulasan</div>
        <div className="font-display text-lg font-bold tracking-tight">Bagaimana pengalaman servis Anda?</div>
        <p className="text-xs text-muted-foreground mt-1">Bantu kami memberikan pelayanan yang lebih baik.</p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            data-testid={`star-${s}`}
            onClick={() => setRating(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-md p-1"
          >
            <Star
              className={`h-9 w-9 transition-colors ${
                s <= active ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
              }`}
            />
          </button>
        ))}
      </div>
      <div className="text-center text-sm font-semibold text-primary h-5" data-testid="rating-label">
        {active > 0 ? RATING_LABELS[active] : 'Pilih bintang'}
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium mb-1.5 block">Ulasan (opsional)</label>
        <textarea
          rows={3}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          maxLength={500}
          placeholder="Ceritakan pengalaman Anda…"
          data-testid="review-textarea"
          className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none text-sm"
        />
        <div className="text-[10px] text-muted-foreground text-right mt-0.5">{review.length}/500</div>
      </div>

      <button
        onClick={submit}
        disabled={submitting || !rating}
        data-testid="btn-submit-rating"
        className="mt-3 w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="h-4 w-4" />
        {submitting ? 'Mengirim…' : 'Kirim Ulasan'}
      </button>
    </div>
  );
}

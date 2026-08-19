import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, MessageSquare, TrendingUp, Award, Search, ChevronRight, Reply, Edit3, Trash2, Send, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { repairsApi, customersApi, usersApi } from '@/lib/store';
import { fetchAllReviews, submitAdminReplyServer } from '@/lib/publicSync';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils';

const RATING_LABELS = ['', 'Sangat Kurang', 'Kurang', 'Cukup', 'Baik', 'Sangat Baik'];

export default function ReviewsPage() {
  const { currentBranchId } = useBranch();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all'); // all, 5, 4, 3, 2, 1
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [serverReviews, setServerReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const refresh = () => setTick((t) => t + 1);

  // Fetch server-side reviews (source of truth for ratings submitted from
  // customer devices that never touch the admin localStorage).
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const list = await fetchAllReviews();
      if (mounted) {
        setServerReviews(list);
        setLoading(false);
      }
    };
    load();
    // Poll so new customer ratings appear without a manual refresh.
    const interval = setInterval(load, 8000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const users = useMemo(() => usersApi.list(), [tick]);
  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  // Merge: server-side reviews (authoritative for rating/review/admin_reply)
  // overlay onto local repairs by ticket_no. If server has a review for a
  // repair the admin's localStorage doesn't know about (cross-device rating),
  // we synthesize a minimal review row from server data so nothing is lost.
  const allReviews = useMemo(() => {
    const local = repairsApi.list();
    const localByTicket = Object.fromEntries(local.map((r) => [r.ticket_no, r]));

    const merged = new Map();

    // 1) Start with server reviews (authoritative).
    serverReviews.forEach((s) => {
      const l = localByTicket[s.ticket_no];
      merged.set(s.ticket_no, {
        // Local metadata (id, branch, etc.) — with server rating overlay.
        ...(l || {}),
        id: l?.id || `srv-${s.ticket_no}`,
        ticket_no: s.ticket_no,
        branch_id: l?.branch_id || null,
        device_brand: l?.device_brand || s.device_brand,
        device_model: l?.device_model || s.device_model,
        // Rating fields from server (authoritative).
        rating: s.rating,
        review: s.review,
        rated_at: s.rated_at,
        admin_reply: s.admin_reply,
        admin_reply_at: s.admin_reply_at,
        admin_reply_by_name: s.admin_reply_by_name,
        // Customer: prefer local (has address), fall back to server snapshot.
        customer: l
          ? customersApi.get(l.customer_id)
          : { name: s.customer_name, phone: s.customer_phone },
        __fromServer: true,
      });
    });

    // 2) Include any purely-local rated repairs not yet on the server
    //    (rare, but keeps parity if server sync ever fails).
    local.filter((r) => r.rating && !merged.has(r.ticket_no)).forEach((r) => {
      merged.set(r.ticket_no, {
        ...r,
        customer: customersApi.get(r.customer_id),
      });
    });

    let items = Array.from(merged.values());
    if (currentBranchId) items = items.filter((r) => !r.branch_id || r.branch_id === currentBranchId);
    return items.sort((a, b) => new Date(b.rated_at || 0) - new Date(a.rated_at || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBranchId, serverReviews, tick]);

  const stats = useMemo(() => {
    if (allReviews.length === 0) {
      return { avg: 0, count: 0, breakdown: [0, 0, 0, 0, 0] };
    }
    const sum = allReviews.reduce((s, r) => s + r.rating, 0);
    const breakdown = [1, 2, 3, 4, 5].map((star) => allReviews.filter((r) => r.rating === star).length);
    return {
      avg: sum / allReviews.length,
      count: allReviews.length,
      breakdown,
    };
  }, [allReviews]);

  const filtered = useMemo(() => {
    let items = allReviews;
    if (filter !== 'all') items = items.filter((r) => r.rating === Number(filter));
    if (query) {
      const q = query.toLowerCase();
      items = items.filter((r) =>
        (r.ticket_no || '').toLowerCase().includes(q) ||
        (r.customer?.name || '').toLowerCase().includes(q) ||
        (r.review || '').toLowerCase().includes(q) ||
        `${r.device_brand} ${r.device_model}`.toLowerCase().includes(q)
      );
    }
    return items;
  }, [allReviews, filter, query]);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="reviews-page">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md">
          <h1 className="font-display text-xl font-bold tracking-tight">Ulasan Pelanggan</h1>
        </div>
        <button
          onClick={refresh}
          data-testid="btn-refresh-reviews"
          title="Muat ulang ulasan"
          className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border hover:bg-accent text-sm font-medium transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Muat ulang
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-6 flex items-center gap-4" data-testid="stats-avg">
          <div className="h-14 w-14 rounded-full bg-amber-500/15 grid place-items-center">
            <Star className="h-7 w-7 fill-amber-400 text-amber-400" />
          </div>
          <div className="flex-1">
            <div className="overline text-muted-foreground">Rata-rata Rating</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-display text-3xl font-bold" data-testid="avg-rating">
                {stats.avg > 0 ? stats.avg.toFixed(1) : '—'}
              </span>
              <span className="text-sm text-muted-foreground">/ 5.0</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{RATING_LABELS[Math.round(stats.avg)] || 'Belum ada ulasan'}</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 flex items-center gap-4" data-testid="stats-count">
          <div className="h-14 w-14 rounded-full bg-primary/10 grid place-items-center">
            <MessageSquare className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="overline text-muted-foreground">Total Ulasan</div>
            <div className="font-display text-3xl font-bold mt-1">{stats.count}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Pelanggan telah memberi ulasan</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 flex items-center gap-4" data-testid="stats-positive">
          <div className="h-14 w-14 rounded-full bg-emerald-500/15 grid place-items-center">
            <TrendingUp className="h-7 w-7 text-emerald-600" />
          </div>
          <div>
            <div className="overline text-muted-foreground">Ulasan Positif</div>
            <div className="font-display text-3xl font-bold mt-1">
              {stats.count > 0
                ? Math.round(((stats.breakdown[3] + stats.breakdown[4]) / stats.count) * 100)
                : 0}%
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Rating 4-5 bintang</div>
          </div>
        </div>
      </div>

      {/* Breakdown bar */}
      {stats.count > 0 && (
        <div className="rounded-lg border border-border bg-card p-6" data-testid="rating-breakdown">
          <div className="overline text-muted-foreground mb-4">Distribusi Rating</div>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.breakdown[star - 1];
              const pct = stats.count > 0 ? (count / stats.count) * 100 : 0;
              return (
                <button
                  key={star}
                  onClick={() => setFilter(filter === String(star) ? 'all' : String(star))}
                  data-testid={`filter-star-${star}`}
                  className={`w-full flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors hover:bg-accent ${
                    filter === String(star) ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-center gap-1 w-16 shrink-0">
                    <span className="text-sm font-semibold">{star}</span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-14 text-right text-sm font-mono text-muted-foreground">
                    {count}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama pelanggan, tiket, perangkat, atau isi ulasan…"
            data-testid="reviews-search"
            className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          data-testid="reviews-filter"
          className="h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
        >
          <option value="all">Semua Rating</option>
          <option value="5">5 Bintang</option>
          <option value="4">4 Bintang</option>
          <option value="3">3 Bintang</option>
          <option value="2">2 Bintang</option>
          <option value="1">1 Bintang</option>
        </select>
      </div>

      {/* Reviews list */}
      <div className="rounded-lg border border-border bg-card">
        {filtered.length === 0 ? (
          <div className="p-12 text-center" data-testid="reviews-empty">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted grid place-items-center mb-3">
              <Award className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="font-display text-lg font-semibold tracking-tight">Belum ada ulasan</div>
            <p className="text-sm text-muted-foreground mt-1">
              {allReviews.length === 0
                ? 'Ulasan akan muncul di sini setelah pelanggan memberi rating di halaman status publik.'
                : 'Tidak ada ulasan yang cocok dengan filter.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border" data-testid="reviews-list">
            {filtered.map((r) => (
              <ReviewItem
                key={r.id}
                review={r}
                canReply={user?.role === 'admin'}
                userMap={userMap}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


function ReviewItem({ review: r, canReply, userMap, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.admin_reply || '');
  const [saving, setSaving] = useState(false);

  const hasReply = Boolean(r.admin_reply);
  // Reply author: prefer local user lookup (has full user), fall back to
  // the server-mirrored display name for reviews that only exist server-side.
  const replyAuthor = r.admin_reply_by
    ? userMap[r.admin_reply_by]?.full_name
    : r.admin_reply_by_name;

  const openEditor = () => {
    setText(r.admin_reply || '');
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setText(r.admin_reply || '');
  };
  const submit = async () => {
    setSaving(true);
    try {
      const currentUser = JSON.parse(localStorage.getItem('kk_session') || 'null');
      const authorName = userMap[currentUser?.user_id]?.full_name || 'Admin';
      // Local mutation (best-effort). Failures are OK when the repair only
      // exists on the server (customer rated on a device the admin never
      // touched).
      try {
        repairsApi.replyReview(r.id, text, currentUser?.user_id || null);
      } catch (_) {
        // Server-only review — skip local write, sync directly below.
      }
      // Always mirror to the server so the customer sees the reply on the
      // public status page and other admin sessions see it in the list.
      await submitAdminReplyServer(r.ticket_no, text, authorName);
      toast.success(hasReply ? 'Balasan diperbarui' : 'Balasan dikirim ke pelanggan');
      setEditing(false);
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || 'Gagal menyimpan balasan');
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!window.confirm('Hapus balasan admin untuk ulasan ini?')) return;
    setSaving(true);
    try {
      try { repairsApi.deleteReply(r.id); } catch (_) {}
      await submitAdminReplyServer(r.ticket_no, '', '');
      toast.success('Balasan dihapus');
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || 'Gagal menghapus balasan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="p-5 hover:bg-accent/40 transition-colors" data-testid={`review-item-${r.id}`}>
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-full bg-primary/10 text-primary grid place-items-center font-display font-bold shrink-0">
          {(r.customer?.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{r.customer?.name || 'Pelanggan'}</span>
            <span className="font-mono text-xs text-muted-foreground">{r.ticket_no}</span>
            <span className="text-xs text-muted-foreground">• {formatDate(r.rated_at)}</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-4 w-4 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1">— {RATING_LABELS[r.rating]}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {r.device_brand} {r.device_model}
          </div>
          {r.review && (
            <p className="text-sm mt-2 leading-relaxed text-foreground/90">
              "{r.review}"
            </p>
          )}

          {/* Admin reply block */}
          {hasReply && !editing && (
            <div className="mt-3 ml-4 pl-4 border-l-2 border-primary/40 bg-primary/5 rounded-r-md p-3" data-testid={`admin-reply-${r.id}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center">
                  <Reply className="h-3 w-3" />
                </div>
                <span className="text-xs font-semibold text-primary">Balasan dari {replyAuthor || 'Admin'}</span>
                <span className="text-[10px] text-muted-foreground">• {formatDate(r.admin_reply_at)}</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{r.admin_reply}</p>
              {canReply && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={openEditor}
                    data-testid={`btn-edit-reply-${r.id}`}
                    className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded-md border border-border hover:bg-accent transition-colors"
                  >
                    <Edit3 className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={remove}
                    data-testid={`btn-delete-reply-${r.id}`}
                    className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded-md border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Hapus
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Reply form */}
          {canReply && editing && (
            <div className="mt-3 ml-4 pl-4 border-l-2 border-primary/40" data-testid={`reply-form-${r.id}`}>
              <textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                placeholder="Tulis balasan singkat untuk pelanggan…"
                data-testid={`reply-textarea-${r.id}`}
                className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none text-sm"
                autoFocus
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{text.length}/500</span>
                <div className="flex gap-2">
                  <button
                    onClick={cancel}
                    data-testid={`btn-cancel-reply-${r.id}`}
                    className="inline-flex items-center gap-1 h-8 px-3 text-xs rounded-md border border-border hover:bg-accent transition-colors"
                  >
                    <X className="h-3 w-3" /> Batal
                  </button>
                  <button
                    onClick={submit}
                    disabled={saving || !text.trim()}
                    data-testid={`btn-submit-reply-${r.id}`}
                    className="inline-flex items-center gap-1 h-8 px-3 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" /> {saving ? 'Menyimpan…' : hasReply ? 'Update' : 'Kirim'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reply CTA when no reply yet */}
          {canReply && !hasReply && !editing && (
            <button
              onClick={openEditor}
              data-testid={`btn-reply-${r.id}`}
              className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-semibold"
            >
              <Reply className="h-3 w-3" /> Balas Ulasan
            </button>
          )}
        </div>
        <Link
          to={`/repairs/${r.id}`}
          className="shrink-0 h-8 w-8 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Buka detail tiket"
          data-testid={`open-repair-${r.id}`}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}

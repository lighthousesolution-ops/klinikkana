import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, MessageSquare, TrendingUp, Award, Search, ChevronRight } from 'lucide-react';
import { repairsApi, customersApi } from '@/lib/store';
import { useBranch } from '@/contexts/BranchContext';
import { formatDate } from '@/lib/utils';

const RATING_LABELS = ['', 'Sangat Kurang', 'Kurang', 'Cukup', 'Baik', 'Sangat Baik'];

export default function ReviewsPage() {
  const { currentBranchId } = useBranch();
  const [filter, setFilter] = useState('all'); // all, 5, 4, 3, 2, 1
  const [query, setQuery] = useState('');

  const allReviews = useMemo(() => {
    let items = repairsApi.withReviews();
    if (currentBranchId) items = items.filter((r) => r.branch_id === currentBranchId);
    return items
      .map((r) => ({
        ...r,
        customer: customersApi.get(r.customer_id),
      }))
      .sort((a, b) => new Date(b.rated_at) - new Date(a.rated_at));
  }, [currentBranchId]);

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
      <div>
        <div className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md">
          <h1 className="font-display text-xl font-bold tracking-tight">Ulasan Pelanggan</h1>
        </div>
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
              <li key={r.id} className="p-5 hover:bg-accent/40 transition-colors" data-testid={`review-item-${r.id}`}>
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
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

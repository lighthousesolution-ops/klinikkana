import React, { useMemo, useState } from 'react';
import { User as UserIcon, KeyRound, Check, X, Eye, EyeOff, Save, ShieldCheck, Building2, Phone, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, branchesApi } from '@/lib/store';
import { IS_PHP } from '@/lib/dataMode';
import { phpAuthApi, phpUsersApi } from '@/lib/apiPhp';
import { ROLE_LABELS } from '@/lib/mockData';
import { formatDate } from '@/lib/utils';

// Mirror of the policy in Kelola User so behaviour is identical.
const PWD_RULES = [
  { key: 'len',  label: 'Panjang 6 – 20 karakter',        test: (p) => p.length >= 6 && p.length <= 20 },
  { key: 'up',   label: 'Ada huruf besar (A-Z)',           test: (p) => /[A-Z]/.test(p) },
  { key: 'low',  label: 'Ada huruf kecil (a-z)',           test: (p) => /[a-z]/.test(p) },
  { key: 'punc', label: 'Ada tanda baca (mis. ! @ # . ?)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const branches = branchesApi.list();
  const userBranch = user?.branch_id ? branches.find((b) => b.id === user.branch_id) : null;

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const checks = useMemo(() => PWD_RULES.map((r) => ({ ...r, pass: r.test(next) })), [next]);
  const allPass = checks.every((c) => c.pass);
  const matches = next.length > 0 && next === confirm;
  const canSubmit = current.length > 0 && allPass && matches && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (IS_PHP) {
        // Verify current password by attempting a fresh login (throws on wrong
        // password). This also refreshes the JWT so the subsequent PUT is
        // guaranteed to have a valid token.
        try {
          await phpAuthApi.login(user.username, current);
        } catch {
          throw new Error('Password lama tidak cocok');
        }
        if (current === next) throw new Error('Password baru harus berbeda dari lama');
        // Update via the users PUT endpoint (self-edit is allowed).
        await phpUsersApi.update(user.id, { password: next });
      } else {
        authApi.changeOwnPassword(current, next);
      }
      toast.success('Password berhasil diubah. Silakan login ulang.');
      // Force re-login for safety.
      setTimeout(() => { logout(); }, 1500);
    } catch (err) {
      toast.error(err.message || 'Gagal mengubah password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl" data-testid="profile-page">
      {/* Title */}
      <div>
        <div className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md">
          <h1 className="font-display text-xl font-bold tracking-tight">Profil Saya</h1>
        </div>
      </div>

      {/* Identity card */}
      <div className="rounded-lg border border-border bg-card p-6" data-testid="profile-identity">
        <div className="flex items-start gap-5">
          <div className="h-20 w-20 rounded-full bg-primary text-primary-foreground grid place-items-center font-display text-3xl font-bold shrink-0">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">Nama lengkap</div>
            <div className="font-display text-2xl font-bold tracking-tight" data-testid="profile-name">{user?.full_name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">@{user?.username}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold">
                <ShieldCheck className="h-3 w-3" />
                {ROLE_LABELS[user?.role]}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoTile icon={Building2} label="Cabang" value={userBranch?.name || 'Semua Cabang'} />
              <InfoTile icon={Phone} label="Telepon" value={user?.phone || '—'} mono />
              <InfoTile icon={Calendar} label="Dibuat" value={user?.created_at ? formatDate(user.created_at) : '—'} />
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 space-y-5" data-testid="change-password-form">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-accent text-primary grid place-items-center shrink-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight">Ganti Password</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Setelah password diubah, Anda akan otomatis logout dan diminta login ulang.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current password */}
          <div className="md:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Password Lama</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                data-testid="input-current-password"
                className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Masukkan password Anda saat ini"
              />
              <button
                type="button"
                onClick={() => setShowOld((s) => !s)}
                data-testid="toggle-old-visibility"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-accent"
              >
                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Password Baru</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
                maxLength={20}
                data-testid="input-new-password"
                className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Password baru"
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                data-testid="toggle-new-visibility"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-accent"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Ulangi Password Baru</label>
            <input
              type={showNew ? 'text' : 'password'}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              maxLength={20}
              data-testid="input-confirm-password"
              className={`w-full h-10 px-3 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                confirm && !matches ? 'border-destructive' : 'border-input'
              }`}
              placeholder="Ketik ulang password baru"
            />
            {confirm && !matches && (
              <div className="text-xs text-destructive mt-1" data-testid="mismatch-warning">Password baru tidak sama</div>
            )}
          </div>
        </div>

        {/* Live checklist */}
        <div className="rounded-md bg-muted/40 border border-border p-3" data-testid="password-checklist">
          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Syarat password</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4">
            {checks.map((r) => (
              <li key={r.key}
                data-testid={`profile-pwd-rule-${r.key}`}
                data-pass={r.pass ? 'true' : 'false'}
                className={`flex items-center gap-1.5 text-xs ${r.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {r.pass ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
                <span>{r.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="submit"
            disabled={!canSubmit}
            data-testid="btn-save-password"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan…' : 'Simpan Password Baru'}
          </button>
        </div>
      </form>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, mono }) {
  return (
    <div className="rounded-md border border-border bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className={`text-sm font-semibold mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

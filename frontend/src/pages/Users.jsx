import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { usersApi, branchesApi } from '@/lib/store';
import { ROLE_LABELS } from '@/lib/mockData';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// Password policy: 6-20 chars, at least one uppercase, one lowercase, one
// punctuation. Punctuation is anything that isn't a letter or digit.
const PWD_RULES = [
  { key: 'len',  label: 'Panjang 6 – 20 karakter',        test: (p) => p.length >= 6 && p.length <= 20 },
  { key: 'up',   label: 'Ada huruf besar (A-Z)',           test: (p) => /[A-Z]/.test(p) },
  { key: 'low',  label: 'Ada huruf kecil (a-z)',           test: (p) => /[a-z]/.test(p) },
  { key: 'punc', label: 'Ada tanda baca (mis. ! @ # . ?)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

function validatePassword(p) {
  const failed = PWD_RULES.filter((r) => !r.test(p || ''));
  return { ok: failed.length === 0, failed };
}

function UserModal({ open, onClose, initial, onSaved }) {
  const [form, setForm] = useState(initial || { username: '', password: '', full_name: '', role: 'technician', phone: '', branch_id: null });
  React.useEffect(() => { setForm(initial || { username: '', password: '', full_name: '', role: 'technician', phone: '', branch_id: null }); }, [initial, open]);
  const branches = branchesApi.list();

  if (!open) return null;
  const submit = (e) => {
    e.preventDefault();
    try {
      // Password policy: required for new users, optional (but validated
      // if provided) for edits.
      const pwdProvided = Boolean(form.password);
      if (!initial?.id && !pwdProvided) return toast.error('Password wajib diisi');
      if (pwdProvided) {
        const { ok, failed } = validatePassword(form.password);
        if (!ok) return toast.error(`Password belum memenuhi: ${failed.map((f) => f.label).join(', ')}`);
      }
      if (initial?.id) {
        // Only send password if the admin actually typed a new one.
        const payload = { ...form };
        if (!pwdProvided) delete payload.password;
        usersApi.update(initial.id, payload);
      } else {
        usersApi.create(form);
      }
      toast.success(initial?.id ? 'User diperbarui' : 'User ditambahkan');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  // Live checklist state (shown only when the field has focus or has content).
  const pwdChecks = PWD_RULES.map((r) => ({ ...r, pass: r.test(form.password || '') }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold tracking-tight">{initial?.id ? 'Edit User' : 'User Baru'}</h3>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Username *</label>
            <input required data-testid="user-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
              disabled={!!initial?.id}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Password {initial?.id ? '(kosongkan jika tidak diubah)' : '*'}</label>
            <input type="password" data-testid="user-password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })}
              maxLength={20}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
            {(form.password || !initial?.id) && (
              <ul className="mt-2 space-y-1" data-testid="pwd-rules">
                {pwdChecks.map((r) => (
                  <li key={r.key}
                    data-testid={`pwd-rule-${r.key}`}
                    data-pass={r.pass ? 'true' : 'false'}
                    className={`flex items-center gap-1.5 text-[11px] ${r.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {r.pass ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
                    <span>{r.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Nama Lengkap *</label>
            <input required data-testid="user-fullname" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Role *</label>
            <select data-testid="user-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="admin">Admin</option>
              <option value="technician">Teknisi</option>
              <option value="cashier">Kasir</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Telepon</label>
            <input data-testid="user-phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Cabang</label>
            <select data-testid="user-branch" value={form.branch_id || ''} onChange={(e) => setForm({ ...form, branch_id: e.target.value || null })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">— Semua Cabang (admin/owner) —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-1.5">Non-admin akan dikunci hanya melihat data cabangnya.</p>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-border hover:bg-accent transition-colors text-sm font-medium">Batal</button>
            <button type="submit" data-testid="user-save-btn" className="h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-semibold">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user: current } = useAuth();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [modal, setModal] = useState({ open: false, initial: null });

  const users = usersApi.list();
  const branches = branchesApi.list();
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b]));

  const del = (u) => {
    if (u.id === current.id) return toast.error('Tidak dapat menghapus akun sendiri');
    if (window.confirm(`Hapus user "${u.full_name}"?`)) {
      usersApi.delete(u.id);
      toast.success('User dihapus');
      refresh();
    }
  };

  const roleColor = {
    admin: 'bg-primary/10 text-primary border-primary/20',
    technician: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    cashier: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="users-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="title-box font-display font-bold tracking-tight">Kelola User</h1>
          <p className="text-muted-foreground text-sm mt-1">{users.length} user terdaftar</p>
        </div>
        <button onClick={() => setModal({ open: true, initial: null })} data-testid="btn-new-user"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> User Baru
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left">Nama</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Cabang</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Telepon</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-accent transition-colors" data-testid={`user-row-${u.id}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-accent grid place-items-center text-xs font-semibold">{u.full_name.charAt(0)}</div>
                    <div className="font-semibold">{u.full_name}</div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-md border ${roleColor[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                  {u.branch_id ? <span className="text-xs">{branchMap[u.branch_id]?.name || '—'}</span> : <span className="text-xs italic">Semua</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono hidden md:table-cell">{u.phone || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setModal({ open: true, initial: u })} data-testid={`btn-edit-user-${u.id}`}
                      className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => del(u)} data-testid={`btn-delete-user-${u.id}`}
                      className="h-8 w-8 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UserModal open={modal.open} initial={modal.initial} onClose={() => setModal({ open: false, initial: null })} onSaved={refresh} />
    </div>
  );
}

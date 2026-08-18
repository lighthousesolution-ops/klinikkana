import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Smartphone, LogIn, ShieldCheck, Wrench, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { settingsApi } from '@/lib/store';

const DEMO = [
  { role: 'admin', label: 'Admin', icon: ShieldCheck, u: 'admin', p: 'admin123' },
  { role: 'teknisi', label: 'Teknisi', icon: Wrench, u: 'teknisi', p: 'teknisi123' },
  { role: 'kasir', label: 'Kasir', icon: ShoppingBag, u: 'kasir', p: 'kasir123' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const s = settingsApi.get();

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      login(username.trim(), password);
      toast.success('Login berhasil');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const quickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-5 bg-background">
      {/* Visual side */}
      <div className="hidden lg:block lg:col-span-3 relative overflow-hidden">
        <img
          src="https://images.pexels.com/photos/6754839/pexels-photo-6754839.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
          alt="Repair"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/70 to-primary/50" />
        <div className="relative h-full flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            {s.logo_url ? (
              <img src={s.logo_url} alt="Logo" className="h-11 w-11 rounded-md object-contain bg-white/15 border border-white/20 p-1" />
            ) : (
              <div className="h-11 w-11 rounded-md bg-white/15 backdrop-blur grid place-items-center border border-white/20">
                <Smartphone className="h-6 w-6" />
              </div>
            )}
            <div>
              <div className="font-display font-bold text-xl tracking-tight">{s.shop_name}</div>
              <div className="overline text-white/70">{s.shop_tagline || 'Manajemen Servis HP'}</div>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="font-display text-4xl xl:text-5xl font-bold tracking-tight leading-[1.05]">
              Kelola bengkel HP<br />dengan presisi klinis.
            </h1>
            <p className="text-white/80 text-lg max-w-lg leading-relaxed">
              Tiket servis, sparepart, pelanggan, dan laporan keuangan — semua dalam satu dashboard yang cepat, jelas, dan siap tempur.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-4 max-w-lg">
              {[
                { k: 'Tiket', v: 'RBAC' },
                { k: 'Sparepart', v: 'Realtime' },
                { k: 'Notifikasi', v: 'WhatsApp' },
              ].map((s) => (
                <div key={s.k} className="border-l-2 border-white/30 pl-3">
                  <div className="overline text-white/60">{s.k}</div>
                  <div className="font-display font-semibold text-lg">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="lg:col-span-2 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md space-y-8 animate-slide-up">
          <div className="lg:hidden flex items-center gap-2.5">
            {s.logo_url ? (
              <img src={s.logo_url} alt="Logo" className="h-10 w-10 rounded-md object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center">
                <Smartphone className="h-5 w-5" />
              </div>
            )}
            <div>
              <div className="font-display font-bold">{s.shop_name}</div>
              <div className="overline text-muted-foreground">{s.shop_tagline}</div>
            </div>
          </div>

          <div>
            <div className="overline text-muted-foreground mb-2">Selamat datang</div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Masuk ke akun Anda</h2>
            <p className="text-muted-foreground mt-2 text-sm">Gunakan kredensial staf Anda untuk melanjutkan.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                data-testid="login-username"
                className="w-full h-11 px-3.5 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                placeholder="admin / teknisi / kasir"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
                className="w-full h-11 px-3.5 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              data-testid="login-submit"
              className="w-full h-11 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {busy ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <div className="border-t border-border pt-6">
            <div className="overline text-muted-foreground mb-3">Akun demo — klik untuk isi otomatis</div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.role}
                  onClick={() => quickFill(d.u, d.p)}
                  data-testid={`demo-${d.role}`}
                  className="flex flex-col items-start gap-2 px-3 py-3 rounded-md border border-border hover:border-primary hover:bg-accent transition-colors"
                >
                  <d.icon className="h-4 w-4 text-primary" />
                  <div className="text-left">
                    <div className="text-sm font-semibold">{d.label}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{d.u}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

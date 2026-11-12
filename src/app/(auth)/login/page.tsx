'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Truck,
  Eye,
  EyeOff,
  Shield,
  Users,
  User as UserIcon,
  Lock,
  ArrowRight,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

interface DemoCredential {
  roleLabel: string;
  subLabel: string;
  username: string;
  password: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
}

const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    roleLabel: 'Admin',
    subLabel: 'Control Tower',
    username: 'admin',
    password: 'admin123',
    icon: Shield,
    badgeBg: 'bg-blue-50 text-blue-600 border-blue-200',
    badgeText: 'text-blue-600',
  },
  {
    roleLabel: 'Driver',
    subLabel: 'Rizal Firmansyah',
    username: 'driver1',
    password: 'driver123',
    icon: Truck,
    badgeBg: 'bg-amber-50 text-amber-600 border-amber-200',
    badgeText: 'text-amber-600',
  },
  {
    roleLabel: 'Supervisor',
    subLabel: 'Monitoring Tim',
    username: 'supervisor',
    password: 'supervisor123',
    icon: Users,
    badgeBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    badgeText: 'text-emerald-600',
  },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate loading
    await new Promise(r => setTimeout(r, 600));

    const success = login(username, password);
    if (success) {
      router.push('/dashboard');
    } else {
      setError('Username atau password tidak sesuai. Silakan pilih atau gunakan kredensial akun di bawah.');
    }
    setIsLoading(false);
  };

  const handleSelectDemo = (cred: DemoCredential) => {
    setUsername(cred.username);
    setPassword(cred.password);
    setError('');
  };

  return (
    <div className="min-h-screen w-full flex bg-[#f0f4f8] text-slate-800 antialiased">
      {/* Left Panel - Corporate Branding */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] bg-gradient-to-br from-[#0a1e42] via-[#0f2b5b] to-[#163d7a] relative overflow-hidden flex-col justify-between p-12 xl:p-16 text-white">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute bottom-10 right-10 w-[28rem] h-[28rem] rounded-full bg-sky-400/10 blur-3xl" />
          <div className="absolute top-24 left-24 w-72 h-72 border border-white/[0.06] rounded-full" />
          <div className="absolute bottom-16 right-16 w-96 h-96 border border-white/[0.06] rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] border border-white/[0.04] rounded-full" />
        </div>

        {/* Top Brand Logo */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/90 shadow-lg shadow-blue-500/25 border border-white/15 flex items-center justify-center shrink-0">
            <Truck className="text-white" size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white leading-none">
              SILOG
            </h1>
            <p className="text-blue-200/90 text-sm font-medium mt-1">
              PT Semen Indonesia Logistik
            </p>
          </div>
        </div>

        {/* Center Hero Message */}
        <div className="relative z-10 my-auto py-12 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-blue-200 text-xs font-semibold uppercase tracking-wider mb-6">
            <CheckCircle2 size={14} className="text-sky-400" />
            Real-Time Fleet & Driver Management
          </div>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.15] mb-5">
            Driver Performance <br />
            <span className="text-sky-300">&amp; Control Tower</span>
          </h2>
          <p className="text-blue-100/80 text-base xl:text-lg leading-relaxed font-normal max-w-lg">
            Sistem monitoring, evaluasi OTIF, dan pengendalian kinerja driver distribusi semen secara terintegrasi dan real-time.
          </p>
        </div>

        {/* Bottom Key Metrics */}
        <div className="relative z-10 grid grid-cols-3 gap-4 max-w-lg">
          <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-4">
            <p className="text-2xl xl:text-3xl font-extrabold text-sky-300 tracking-tight">12+</p>
            <p className="text-blue-200/80 text-xs xl:text-sm font-medium mt-1">Driver Aktif</p>
          </div>
          <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-4">
            <p className="text-2xl xl:text-3xl font-extrabold text-sky-300 tracking-tight">87%</p>
            <p className="text-blue-200/80 text-xs xl:text-sm font-medium mt-1">Rata-rata OTIF</p>
          </div>
          <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-4">
            <p className="text-2xl xl:text-3xl font-extrabold text-sky-300 tracking-tight">24/7</p>
            <p className="text-blue-200/80 text-xs xl:text-sm font-medium mt-1">Monitoring</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-[440px]">
          {/* Mobile Header Brand */}
          <div className="lg:hidden flex items-center justify-center gap-3.5 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-[#0f2b5b] shadow-md flex items-center justify-center">
              <Truck className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-[#0f2b5b] leading-none">
                SILOG
              </h1>
              <p className="text-slate-500 text-xs font-medium mt-1">
                Driver Performance &amp; Control Tower
              </p>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/[0.05] border border-slate-200/80 p-7 sm:p-9">
            <div className="text-center mb-7">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Masuk ke Sistem
              </h2>
              <p className="text-slate-500 mt-1.5 text-sm">
                Masukkan username dan password akun Anda
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <UserIcon size={18} />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Masukkan username (contoh: admin / driver1)"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-[#0f2b5b] transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock size={18} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-[#0f2b5b] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-xs sm:text-sm font-medium px-4 py-3 rounded-xl border border-red-200 leading-relaxed">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0f2b5b] hover:bg-[#173b78] active:scale-[0.99] text-white py-3.5 px-4 rounded-xl font-semibold text-sm shadow-md shadow-[#0f2b5b]/15 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Demo Accounts Information & Quick Fill */}
            <div className="mt-7 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <KeyRound size={13} className="text-slate-400" />
                  <span>Kredensial Akun (Klik untuk isi otomatis)</span>
                </div>
              </div>

              <div className="space-y-2">
                {DEMO_CREDENTIALS.map(cred => {
                  const Icon = cred.icon;
                  const isSelected = username === cred.username;
                  return (
                    <button
                      key={cred.username}
                      type="button"
                      onClick={() => handleSelectDemo(cred)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/10'
                          : 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${cred.badgeBg}`}>
                          <Icon size={14} />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-800 leading-tight">
                            {cred.roleLabel}{' '}
                            <span className="font-normal text-slate-400">— {cred.subLabel}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-mono font-semibold text-slate-700">
                          {cred.username}
                        </span>
                        <span className="text-slate-300 text-xs">/</span>
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-mono text-slate-600">
                          {cred.password}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-center text-xs font-medium text-slate-400 mt-6">
            &copy; 2024 PT Semen Indonesia Logistik. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  Users, Truck, PackageCheck, Clock, Coffee, CheckCircle2, TimerOff, Target,
  AlertTriangle, ShieldAlert, Hourglass, Award, MapPin, Phone, CreditCard,
  Building2, ArrowRight, Bell, ClipboardList,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { otifDailyData, otifMonthlyData, onTimeVsLateData } from '@/lib/mock-data';
import {
  DRIVER_STATUS_COLORS,
  DRIVER_STATUS_LABELS,
  RCA_CATEGORY_LABELS,
  VERIFICATION_STATUS_COLORS,
  VERIFICATION_STATUS_LABELS,
  NOTIFICATION_PRIORITY_COLORS,
  NOTIFICATION_PRIORITY_LABELS,
} from '@/lib/types';

const COLORS = ['#0f2b5b', '#3b82f6', '#60a5fa', '#93c5fd', '#dc2626', '#f59e0b', '#10b981', '#64748b'];

function Stat({ icon, label, value, sub, tone = 'blue' }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'blue' | 'red' | 'green' | 'amber';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className="stat-card bg-white rounded-xl border border-gray-200 p-3.5 sm:p-4 flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] sm:text-xs text-gray-500 leading-tight truncate">{label}</p>
        <p className="text-lg sm:text-xl font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 min-w-0">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
      <div className="h-60 sm:h-64 w-full min-w-0">{children}</div>
    </div>
  );
}

function DriverDashboardView() {
  const { drivers, shipments, rcaEvents, notifications, rewardTransactions, punishmentTransactions } = useData();
  const { user } = useAuth();

  const driver = drivers.find(d => d.id === user?.driverId);
  const myShipments = shipments.filter(s => s.driverId === user?.driverId);
  const myRca = rcaEvents.filter(e => e.driverId === user?.driverId);
  const myNotifs = notifications
    .filter(n => n.driverId === user?.driverId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const pendingRcaAlert = myNotifs.find(
    n => n.requiresRca && !n.rcaSubmitted && !n.autoPunished
  );
  const myPointTx = [
    ...rewardTransactions.filter(t => t.driverId === user?.driverId),
    ...punishmentTransactions.filter(t => t.driverId === user?.driverId),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const fmt = (t?: string) =>
    t ? new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

  if (!driver) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500 text-sm">
        Profil driver tidak ditemukan untuk akun ini.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Urgent > 2 jam stop alert for Driver */}
      {pendingRcaAlert && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">{pendingRcaAlert.title}</p>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">{pendingRcaAlert.description}</p>
            </div>
          </div>
          <Link
            href={`/rca?notificationId=${pendingRcaAlert.id}`}
            className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shrink-0"
          >
            <ClipboardList size={16} /> Isi RCA Sekarang
          </Link>
        </div>
      )}

      {/* Header & Status */}
      <div className="bg-gradient-to-r from-[#0f2b5b] to-[#1a3d7a] rounded-2xl p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-blue-200">Portal Driver</p>
            <h1 className="text-xl sm:text-2xl font-bold mt-0.5">{driver.name}</h1>
            <p className="text-xs sm:text-sm text-blue-200 mt-1">
              ID Driver: <span className="font-semibold text-white">{driver.id}</span> · Ringkasan kinerja &amp; pengiriman pribadi Anda
            </p>
          </div>
          <div className="self-start sm:self-center">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${DRIVER_STATUS_COLORS[driver.status]}`}>
              {DRIVER_STATUS_LABELS[driver.status]}
            </span>
          </div>
        </div>

        {/* Driver Identity Info */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-4 border-t border-white/15 text-xs">
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 min-w-0">
            <Truck size={15} className="text-blue-200 shrink-0" />
            <div className="min-w-0">
              <p className="text-blue-200 text-[10px]">No. Polisi</p>
              <p className="font-semibold truncate">{driver.vehiclePlate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 min-w-0">
            <Building2 size={15} className="text-blue-200 shrink-0" />
            <div className="min-w-0">
              <p className="text-blue-200 text-[10px]">Mitra</p>
              <p className="font-semibold truncate">{driver.transporterName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 min-w-0">
            <Phone size={15} className="text-blue-200 shrink-0" />
            <div className="min-w-0">
              <p className="text-blue-200 text-[10px]">Telepon</p>
              <p className="font-semibold truncate">{driver.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 min-w-0">
            <CreditCard size={15} className="text-blue-200 shrink-0" />
            <div className="min-w-0">
              <p className="text-blue-200 text-[10px]">No. SIM</p>
              <p className="font-semibold truncate">{driver.licenseNumber}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<PackageCheck size={20} />} label="Total Pengiriman" value={driver.totalDeliveries} />
        <Stat
          icon={<Clock size={20} />}
          label="Ketepatan Waktu"
          value={`${driver.onTimePercentage}%`}
          sub={`${driver.onTimeDeliveries} On Time · ${driver.lateDeliveries} Late`}
          tone="green"
        />
        <Stat
          icon={<Award size={20} />}
          label="Skor Poin Saya"
          value={driver.finalScore}
          sub={`+${driver.totalRewardPoints} Reward · -${driver.totalPunishmentPoints} Penalti`}
          tone="blue"
        />
        <Stat
          icon={<ShieldAlert size={20} />}
          label="Pelanggaran Valid"
          value={driver.validViolations}
          tone={driver.validViolations > 2 ? 'red' : 'amber'}
        />
      </div>

      {/* My GPS Position */}
      {driver.gps && (
        <section className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <MapPin size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Posisi GPS Armada Saya</p>
              <p className="text-sm font-semibold text-gray-900">{driver.gps.locationName}</p>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">
                {driver.gps.lat.toFixed(4)}, {driver.gps.lng.toFixed(4)} · {driver.gps.speedKmh} km/jam · Berhenti {driver.gps.stoppedMinutes} menit
              </p>
            </div>
          </div>
          <a
            href={`https://www.google.com/maps?q=${driver.gps.lat},${driver.gps.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-lg text-center shrink-0"
          >
            Lihat di Peta
          </a>
        </section>
      )}

      {/* My Shipments */}
      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">Pengiriman Saya</h2>
          <span className="text-xs text-gray-500">{myShipments.length} pengiriman</span>
        </div>

        <div className="space-y-3">
          {myShipments.map(s => (
            <div key={s.id} className="border border-gray-200 rounded-xl p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">{s.suratJalanNo}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${DRIVER_STATUS_COLORS[s.driverStatus]}`}>
                    {DRIVER_STATUS_LABELS[s.driverStatus]}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.isOnTime ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {s.isOnTime ? 'On Time' : 'Late'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-gray-700">
                <MapPin size={14} className="text-blue-600 shrink-0" />
                <span className="font-medium">{s.origin}</span>
                <ArrowRight size={14} className="text-gray-400 shrink-0" />
                <span className="font-medium">{s.destination}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500 pt-1 border-t border-gray-100">
                <div>
                  <span className="block text-[10px] text-gray-400">Berangkat</span>
                  <span className="text-gray-700 font-medium">{fmt(s.departureTime)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400">Estimasi Tiba</span>
                  <span className="text-gray-700 font-medium">{fmt(s.estimatedArrival)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400">Durasi</span>
                  <span className="text-gray-700 font-medium">{s.travelDuration ?? '-'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400">Muatan</span>
                  <span className="text-gray-700 font-medium">{s.quantity} ton</span>
                </div>
              </div>
              {s.notes && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">Catatan: {s.notes}</p>}
            </div>
          ))}
          {!myShipments.length && (
            <p className="text-sm text-gray-400 text-center py-6">Belum ada data pengiriman untuk Anda.</p>
          )}
        </div>
      </section>

      {/* My Notifications & My RCA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-2">
              <Bell size={16} className="text-blue-600" />
              Notifikasi Terbaru Saya
            </h2>
            <Link href="/notifications" className="text-xs font-medium text-blue-600 hover:underline">
              Lihat semua
            </Link>
          </div>
          <div className="space-y-2.5">
            {myNotifs.slice(0, 4).map(n => (
              <div key={n.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-gray-800 text-xs sm:text-sm">{n.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${NOTIFICATION_PRIORITY_COLORS[n.priority]}`}>
                    {NOTIFICATION_PRIORITY_LABELS[n.priority]}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{n.description}</p>
                <p className="text-[11px] text-gray-400 mt-1">{fmt(n.timestamp)}</p>
              </div>
            ))}
            {!myNotifs.length && <p className="text-sm text-gray-400 py-4 text-center">Belum ada notifikasi untuk Anda.</p>}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardList size={16} className="text-amber-600" />
              Kejadian / RCA Saya
            </h2>
            <Link href="/rca" className="text-xs font-medium text-blue-600 hover:underline">
              Catat / Lihat semua
            </Link>
          </div>
          <div className="space-y-2.5">
            {myRca.slice(0, 4).map(ev => (
              <div key={ev.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-gray-800 text-xs sm:text-sm">{RCA_CATEGORY_LABELS[ev.category]}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${VERIFICATION_STATUS_COLORS[ev.verificationStatus]}`}>
                    {VERIFICATION_STATUS_LABELS[ev.verificationStatus]}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{ev.description}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {ev.eventDate} {ev.eventTime} · {ev.location}
                </p>
              </div>
            ))}
            {!myRca.length && <p className="text-sm text-gray-400 py-4 text-center">Belum ada catatan kejadian.</p>}
          </div>
        </section>
      </div>

      {/* Point History */}
      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">Riwayat Poin Saya</h2>
          <Link href="/reward" className="text-xs font-medium text-blue-600 hover:underline">
            Detail reward
          </Link>
        </div>
        <ul className="divide-y text-sm">
          {myPointTx.slice(0, 5).map(t => (
            <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-800 truncate">{t.reason}</p>
                <p className="text-[11px] text-gray-400">{fmt(t.createdAt)} · {t.createdBy}</p>
              </div>
              <span className={`font-bold text-sm shrink-0 ${t.type === 'reward' ? 'text-green-700' : 'text-red-600'}`}>
                {t.type === 'reward' ? `+${t.points}` : `-${t.points}`}
              </span>
            </li>
          ))}
          {!myPointTx.length && <li className="py-4 text-center text-gray-400 text-sm">Belum ada riwayat poin.</li>}
        </ul>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const { drivers, shipments, rcaEvents } = useData();
  const { user, hasRole } = useAuth();

  if (hasRole('driver')) {
    return <DriverDashboardView />;
  }

  const isAdmin = hasRole('admin');
  const completed = shipments.filter(s => s.status === 'completed' || s.actualArrival);
  const onTime = shipments.filter(s => s.isOnTime).length;
  const late = shipments.filter(s => !s.isOnTime).length;
  const otifCount = shipments.filter(s => s.isOTIF).length;
  const otif = shipments.length ? Math.round((otifCount / shipments.length) * 1000) / 10 : 0;
  const onTimePct = shipments.length ? Math.round((onTime / shipments.length) * 1000) / 10 : 0;

  const count = (st: string) => drivers.filter(d => d.status === st).length;
  const violations = rcaEvents.filter(e => e.verificationStatus === 'terverifikasi_pelanggaran').length;
  const pending = rcaEvents.filter(e => e.verificationStatus === 'menunggu_verifikasi' || e.verificationStatus === 'sedang_diperiksa').length;

  const rcaData = Object.entries(
    rcaEvents.reduce<Record<string, number>>((acc, e) => {
      const k = RCA_CATEGORY_LABELS[e.category];
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const violationData = Object.entries(
    rcaEvents
      .filter(e => e.verificationStatus === 'terverifikasi_pelanggaran')
      .reduce<Record<string, number>>((acc, e) => {
        const k = RCA_CATEGORY_LABELS[e.category];
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {})
  ).map(([name, value]) => ({ name, value }));

  const perfData = [...drivers]
    .sort((a, b) => b.onTimePercentage - a.onTimePercentage)
    .slice(0, 10)
    .map(d => ({ name: d.name.split(' ')[0], value: d.onTimePercentage }));

  const pieData = [
    { name: 'On Time', value: onTime },
    { name: 'Late', value: late },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Control Tower Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Selamat datang, {user?.name}. Pantau dan kelola seluruh operasional driver secara real-time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/driver-monitoring"
            className="inline-flex items-center gap-1.5 bg-[#0f2b5b] text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#1a3d7a] transition-colors"
          >
            <Truck size={15} />
            {isAdmin ? 'Pantau & Edit Driver' : 'Monitor Driver'}
          </Link>
          {isAdmin && (
            <Link
              href="/rca"
              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-xs sm:text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <AlertTriangle size={15} className="text-amber-600" />
              Verifikasi RCA ({pending})
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <Stat icon={<Users size={20} />} label="Total Driver" value={drivers.length} />
        <Stat icon={<Truck size={20} />} label="Armada Aktif" value={drivers.filter(d => d.status !== 'selesai_pengiriman').length} />
        <Stat icon={<PackageCheck size={20} />} label="Sedang Pengiriman" value={count('dalam_perjalanan')} />
        <Stat icon={<Hourglass size={20} />} label="Menunggu Bongkar" value={count('menunggu_gudang') + count('proses_bongkar_muat')} tone="amber" />
        <Stat icon={<Coffee size={20} />} label="Sedang Istirahat" value={count('istirahat')} />
        <Stat icon={<CheckCircle2 size={20} />} label="Selesai Pengiriman" value={count('selesai_pengiriman') + completed.length} tone="green" />
        <Stat icon={<Clock size={20} />} label={`On Time (${onTimePct}%)`} value={onTime} tone="green" />
        <Stat icon={<TimerOff size={20} />} label="Late" value={late} tone="red" />
        <Stat icon={<Target size={20} />} label="OTIF (In Full)" value={`${otif}%`} />
        <Stat icon={<ShieldAlert size={20} />} label="Pelanggaran Valid" value={violations} tone="red" />
        <Stat icon={<AlertTriangle size={20} />} label="Menunggu Verifikasi" value={pending} tone="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Performa OTIF Harian (%)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={otifDailyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[60, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="value" name="OTIF %" stroke="#0f2b5b" strokeWidth={2} /></LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Performa OTIF Bulanan (%)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={otifMonthlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[60, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name="OTIF %" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="On Time vs Late (Mingguan)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={onTimeVsLateData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="value" name="On Time" fill="#10b981" /><Bar dataKey="value2" name="Late" fill="#dc2626" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Komposisi On Time vs Late (Saat Ini)">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>{pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#10b981' : '#dc2626'} />)}</Pie><Tooltip /><Legend /></PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Penyebab Keterlambatan (RCA)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rcaData} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name="Jumlah" fill="#0f2b5b" radius={[0, 4, 4, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Performa Driver (% Ketepatan Waktu)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perfData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[70, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name="On Time %" fill="#60a5fa" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Pelanggaran Valid per Kategori">
          {violationData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={violationData} dataKey="value" nameKey="name" outerRadius={80} label>{violationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 h-full flex items-center justify-center">Belum ada pelanggaran terverifikasi.</p>}
        </ChartCard>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Users, Truck, PackageCheck, Clock, Coffee, CheckCircle2, TimerOff, Target, AlertTriangle, ShieldAlert, Hourglass } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { otifDailyData, otifMonthlyData, onTimeVsLateData } from '@/lib/mock-data';
import { RCA_CATEGORY_LABELS } from '@/lib/types';

const COLORS = ['#0f2b5b', '#3b82f6', '#60a5fa', '#93c5fd', '#dc2626', '#f59e0b', '#10b981', '#64748b'];

function Stat({ icon, label, value, tone = 'blue' }: { icon: React.ReactNode; label: string; value: string | number; tone?: 'blue' | 'red' | 'green' | 'amber' }) {
  const tones = { blue: 'bg-blue-50 text-blue-700', red: 'bg-red-50 text-red-600', green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700' };
  return (
    <div className="stat-card bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${tones[tone]}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { drivers, shipments, rcaEvents } = useData();
  const { user } = useAuth();

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
    rcaEvents.reduce<Record<string, number>>((acc, e) => { const k = RCA_CATEGORY_LABELS[e.category]; acc[k] = (acc[k] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const violationData = Object.entries(
    rcaEvents.filter(e => e.verificationStatus === 'terverifikasi_pelanggaran').reduce<Record<string, number>>((acc, e) => { const k = RCA_CATEGORY_LABELS[e.category]; acc[k] = (acc[k] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const perfData = [...drivers].sort((a, b) => b.onTimePercentage - a.onTimePercentage).slice(0, 10)
    .map(d => ({ name: d.name.split(' ')[0], value: d.onTimePercentage }));

  const pieData = [{ name: 'On Time', value: onTime }, { name: 'Late', value: late }];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Selamat datang, {user?.name}. Ringkasan operasional Control Tower (data simulasi).</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <Stat icon={<Users size={20} />} label="Total Driver" value={drivers.length} />
        <Stat icon={<Truck size={20} />} label="Armada Aktif" value={drivers.filter(d => d.status !== 'selesai_pengiriman').length} />
        <Stat icon={<PackageCheck size={20} />} label="Sedang Pengiriman" value={count('dalam_perjalanan')} />
        <Stat icon={<Hourglass size={20} />} label="Menunggu Bongkar Muat" value={count('menunggu_gudang') + count('proses_bongkar_muat')} tone="amber" />
        <Stat icon={<Coffee size={20} />} label="Sedang Istirahat" value={count('istirahat')} />
        <Stat icon={<CheckCircle2 size={20} />} label="Selesai Pengiriman" value={count('selesai_pengiriman') + completed.length} tone="green" />
        <Stat icon={<Clock size={20} />} label={`On Time (${onTimePct}%)`} value={onTime} tone="green" />
        <Stat icon={<TimerOff size={20} />} label="Late" value={late} tone="red" />
        <Stat icon={<Target size={20} />} label="OTIF (On Time & In Full)" value={`${otif}%`} />
        <Stat icon={<ShieldAlert size={20} />} label="Pelanggaran Valid" value={violations} tone="red" />
        <Stat icon={<AlertTriangle size={20} />} label="Menunggu Verifikasi" value={pending} tone="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Performa OTIF Harian (%)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={otifDailyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[60, 100]} /><Tooltip /><Line type="monotone" dataKey="value" name="OTIF %" stroke="#0f2b5b" strokeWidth={2} /></LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Performa OTIF Bulanan (%)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={otifMonthlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[60, 100]} /><Tooltip /><Bar dataKey="value" name="OTIF %" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="On Time vs Late (Mingguan)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={onTimeVsLateData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="value" name="On Time" fill="#10b981" /><Bar dataKey="value2" name="Late" fill="#dc2626" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Komposisi On Time vs Late (Saat Ini)">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>{pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#10b981' : '#dc2626'} />)}</Pie><Tooltip /><Legend /></PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Penyebab Keterlambatan (RCA)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rcaData} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name="Jumlah" fill="#0f2b5b" radius={[0, 4, 4, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Performa Driver (% Ketepatan Waktu)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perfData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[70, 100]} /><Tooltip /><Bar dataKey="value" name="On Time %" fill="#60a5fa" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Pelanggaran Valid per Kategori">
          {violationData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={violationData} dataKey="value" nameKey="name" outerRadius={90} label>{violationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 h-full flex items-center justify-center">Belum ada pelanggaran terverifikasi.</p>}
        </ChartCard>
      </div>
    </div>
  );
}

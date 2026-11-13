'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Printer } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { RCA_CATEGORY_LABELS, VERIFICATION_STATUS_LABELS } from '@/lib/types';

type ReportKey = 'otif' | 'driver' | 'rca' | 'pelanggaran' | 'poin' | 'perjalanan';
const REPORTS: Record<ReportKey, string> = {
  otif: 'Rekap OTIF & On Time / Late', driver: 'Rekap Performa Driver', rca: 'Rekap RCA',
  pelanggaran: 'Rekap Pelanggaran', poin: 'Rekap Reward & Punishment', perjalanan: 'Riwayat Perjalanan Driver',
};

export default function ReportsPage() {
  const { drivers, shipments, rcaEvents, rewardTransactions, punishmentTransactions } = useData();
  const { hasRole } = useAuth();
  const isDriver = hasRole('driver');
  const [type, setType] = useState<ReportKey>('otif');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [driverId, setDriverId] = useState('');
  const [mitra, setMitra] = useState('');
  const [cat, setCat] = useState('');
  const mitraList = Array.from(new Set(drivers.map(d => d.transporterName)));
  const inRange = (date: string) => (!from || date.slice(0, 10) >= from) && (!to || date.slice(0, 10) <= to);

  const { headers, rows } = useMemo(() => {
    const dOk = (id: string) => (!driverId || id === driverId) && (!mitra || drivers.find(d => d.id === id)?.transporterName === mitra);
    switch (type) {
      case 'otif': return {
        headers: ['Surat Jalan', 'Driver', 'Mitra', 'Tujuan', 'On Time', 'In Full', 'OTIF'],
        rows: shipments.filter(s => dOk(s.driverId) && inRange(s.departureTime)).map(s => [s.suratJalanNo, s.driverName, s.transporterName, s.destination, s.isOnTime ? 'Ya' : 'Tidak', s.isInFull ? 'Ya' : 'Tidak', s.isOTIF ? 'Ya' : 'Tidak']),
      };
      case 'driver': return {
        headers: ['ID', 'Nama', 'Mitra', 'Total', 'On Time', 'Late', '% On Time', 'Pelanggaran', 'Reward', 'Punishment', 'Skor'],
        rows: drivers.filter(d => dOk(d.id)).map(d => [d.id, d.name, d.transporterName, d.totalDeliveries, d.onTimeDeliveries, d.lateDeliveries, `${d.onTimePercentage}%`, d.validViolations, d.totalRewardPoints, d.totalPunishmentPoints, d.finalScore]),
      };
      case 'rca': return {
        headers: ['ID', 'Driver', 'Tanggal', 'Kategori', 'Lokasi', 'Durasi', 'Status', 'Keputusan'],
        rows: rcaEvents.filter(e => dOk(e.driverId) && inRange(e.eventDate) && (!cat || e.category === cat)).map(e => [e.id, e.driverName, e.eventDate, RCA_CATEGORY_LABELS[e.category], e.location, e.duration, VERIFICATION_STATUS_LABELS[e.verificationStatus], e.controlTowerDecision ?? '-']),
      };
      case 'pelanggaran': return {
        headers: ['ID', 'Driver', 'Tanggal', 'Kategori', 'Poin Dikurangi', 'Diverifikasi Oleh'],
        rows: rcaEvents.filter(e => e.verificationStatus === 'terverifikasi_pelanggaran' && dOk(e.driverId) && inRange(e.eventDate) && (!cat || e.category === cat)).map(e => [e.id, e.driverName, e.eventDate, RCA_CATEGORY_LABELS[e.category], e.pointsDeducted ?? 0, e.verifiedBy ?? '-']),
      };
      case 'poin': return {
        headers: ['Tanggal', 'Driver', 'Jenis', 'Poin', 'Alasan', 'Oleh'],
        rows: [...rewardTransactions, ...punishmentTransactions].filter(t => dOk(t.driverId) && inRange(t.createdAt)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(t => [t.createdAt.slice(0, 10), t.driverName, t.type === 'reward' ? 'Reward' : 'Punishment', t.type === 'reward' ? `+${t.points}` : `-${t.points}`, t.reason, t.createdBy]),
      };
      default: return {
        headers: ['Surat Jalan', 'Driver', 'Asal', 'Tujuan', 'Berangkat', 'Estimasi Tiba', 'Durasi', 'Status'],
        rows: shipments.filter(s => dOk(s.driverId) && inRange(s.departureTime)).map(s => [s.suratJalanNo, s.driverName, s.origin, s.destination, s.departureTime.replace('T', ' '), s.estimatedArrival.replace('T', ' '), s.travelDuration ?? '-', s.status]),
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, from, to, driverId, mitra, cat, drivers, shipments, rcaEvents, rewardTransactions, punishmentTransactions]);

  const total = shipments.length;
  const onTime = shipments.filter(s => s.isOnTime).length;
  const otif = shipments.filter(s => s.isOTIF).length;

  const downloadExcel = () => {
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(esc).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `silog-${type}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isDriver) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-3">
        <p className="text-gray-700 font-medium">Halaman Laporan hanya tersedia untuk Admin / Control Tower dan Supervisor.</p>
        <Link href="/dashboard" className="inline-block bg-[#0f2b5b] text-white text-sm px-4 py-2 rounded-lg">
          Kembali ke Dashboard Saya
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Laporan</h1>
        <p className="text-xs sm:text-sm text-gray-500">Unduh laporan dalam format Excel (CSV) atau PDF (Cetak → Simpan sebagai PDF).</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 print:hidden text-sm">
        <select value={type} onChange={e => setType(e.target.value as ReportKey)} className="border rounded-lg px-3 py-2 sm:col-span-2 bg-white">{Object.entries(REPORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded-lg px-3 py-2 bg-white" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border rounded-lg px-3 py-2 bg-white" />
        <select value={driverId} onChange={e => setDriverId(e.target.value)} className="border rounded-lg px-3 py-2 bg-white"><option value="">Semua Driver</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <select value={mitra} onChange={e => setMitra(e.target.value)} className="border rounded-lg px-3 py-2 bg-white"><option value="">Semua Mitra</option>{mitraList.map(m => <option key={m}>{m}</option>)}</select>
        <select value={cat} onChange={e => setCat(e.target.value)} className="border rounded-lg px-3 py-2 bg-white"><option value="">Semua Kategori</option>{Object.entries(RCA_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>

      <div className="flex gap-2 print:hidden">
        <button onClick={downloadExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"><Download size={16} />Unduh Excel</button>
        <button onClick={() => window.print()} className="bg-[#0f2b5b] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"><Printer size={16} />Unduh PDF</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold">{REPORTS[type]}</h2>
        <p className="text-xs text-gray-500 mb-3">SILOG Driver Control Tower · Total pengiriman {total} · On Time {total ? Math.round((onTime / total) * 1000) / 10 : 0}% · OTIF {total ? Math.round((otif / total) * 1000) / 10 : 0}% · {rows.length} baris</p>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600"><tr>{headers.map(h => <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="px-3 py-2">{String(c)}</td>)}</tr>)}
            {!rows.length && <tr><td colSpan={headers.length} className="text-center text-gray-400 py-6">Tidak ada data untuk filter ini.</td></tr>}</tbody>
        </table></div>
      </div>
    </div>
  );
}


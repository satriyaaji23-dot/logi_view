'use client';

import React, { useMemo, useState } from 'react';
import { Search, Eye, RefreshCw, Send, MapPin, X } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { DRIVER_STATUS_COLORS, DRIVER_STATUS_LABELS, type DriverStatus } from '@/lib/types';

export default function DriverMonitoringPage() {
  const { drivers, shipments, rcaEvents, updateDriverStatus, sendNotification } = useData();
  const { user, hasRole } = useAuth();
  const canEdit = hasRole('admin');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [mitra, setMitra] = useState('');
  const [date, setDate] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<DriverStatus>('dalam_perjalanan');
  const [notifId, setNotifId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const mitraList = Array.from(new Set(drivers.map(d => d.transporterName)));

  const rows = useMemo(() => drivers.map(d => ({ d, s: shipments.find(x => x.driverId === d.id) }))
    .filter(({ d, s }) =>
      (!q || d.name.toLowerCase().includes(q.toLowerCase())) &&
      (!status || d.status === status) &&
      (!mitra || d.transporterName === mitra) &&
      (!date || (s?.departureTime ?? '').startsWith(date))), [drivers, shipments, q, status, mitra, date]);

  const fmt = (t?: string) => t ? new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
  const detail = drivers.find(d => d.id === detailId);
  const actor = user?.name ?? 'system';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Driver Monitoring</h1>
        <p className="text-sm text-gray-500">Pantau seluruh aktivitas driver dan status pengiriman.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2"><Search size={16} className="text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama driver" className="outline-none text-sm w-full" /></div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Semua Status</option>
          {Object.entries(DRIVER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={mitra} onChange={e => setMitra(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Semua Mitra</option>
          {mitraList.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>{['ID', 'Nama Driver', 'No. Kendaraan', 'Mitra', 'No. Surat Jalan', 'Asal', 'Tujuan', 'Berangkat', 'Estimasi Tiba', 'Status', 'Durasi', 'On Time/Late', 'Aksi'].map(h => <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(({ d, s }) => (
              <tr key={d.id} className="border-t hover:bg-blue-50/40">
                <td className="px-3 py-2.5 font-medium">{d.id}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{d.name}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{d.vehiclePlate}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{d.transporterName}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{s?.suratJalanNo ?? '-'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{s?.origin ?? '-'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{s?.destination ?? '-'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{fmt(s?.departureTime)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{fmt(s?.estimatedArrival)}</td>
                <td className="px-3 py-2.5"><span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${DRIVER_STATUS_COLORS[d.status]}`}>{DRIVER_STATUS_LABELS[d.status]}</span></td>
                <td className="px-3 py-2.5 whitespace-nowrap">{s?.travelDuration ?? '-'}</td>
                <td className="px-3 py-2.5">{s ? <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.isOnTime ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.isOnTime ? 'On Time' : 'Late'}</span> : '-'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button title="Detail" onClick={() => setDetailId(d.id)} className="p-1.5 rounded hover:bg-blue-100 text-blue-700"><Eye size={16} /></button>
                    {canEdit && <button title="Update status" onClick={() => { setStatusId(d.id); setNewStatus(d.status); }} className="p-1.5 rounded hover:bg-amber-100 text-amber-700"><RefreshCw size={16} /></button>}
                    {canEdit && <button title="Kirim notifikasi" onClick={() => { setNotifId(d.id); setMsg(''); }} className="p-1.5 rounded hover:bg-green-100 text-green-700"><Send size={16} /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={13} className="text-center text-gray-400 py-8">Tidak ada data yang cocok.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><MapPin size={16} /> Peta Monitoring Armada</h3>
        <div className="h-56 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-dashed border-blue-300 flex flex-col items-center justify-center text-center p-4">
          <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-1 rounded mb-2">MODE SIMULASI</span>
          <p className="text-sm text-gray-600">GPS belum terhubung. Lokasi armada aktual akan tampil di sini setelah integrasi GPS (Tahap 3).</p>
          <p className="text-xs text-gray-400 mt-1">Tidak ada koordinat palsu yang ditampilkan sebagai lokasi sebenarnya.</p>
        </div>
      </div>

      {(detail || statusId || notifId) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setDetailId(null); setStatusId(null); setNotifId(null); }}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">{detail ? `Detail ${detail.name}` : statusId ? 'Update Status Driver' : 'Kirim Notifikasi'}</h3>
              <button onClick={() => { setDetailId(null); setStatusId(null); setNotifId(null); }}><X size={18} /></button>
            </div>
            {detail && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <p><span className="text-gray-500">Mitra:</span> {detail.transporterName}</p><p><span className="text-gray-500">Kendaraan:</span> {detail.vehiclePlate}</p>
                  <p><span className="text-gray-500">Telepon:</span> {detail.phone}</p><p><span className="text-gray-500">SIM:</span> {detail.licenseNumber}</p>
                  <p><span className="text-gray-500">Pengiriman:</span> {detail.totalDeliveries}</p><p><span className="text-gray-500">On Time:</span> {detail.onTimePercentage}%</p>
                </div>
                <h4 className="font-semibold pt-2">Riwayat Perjalanan</h4>
                <ul className="space-y-1">
                  {shipments.filter(s => s.driverId === detail.id).map(s => <li key={s.id} className="border rounded p-2">{s.suratJalanNo}: {s.origin} → {s.destination} ({s.isOnTime ? 'On Time' : 'Late'})</li>)}
                </ul>
                <h4 className="font-semibold pt-2">Riwayat Kejadian</h4>
                <ul className="space-y-1">
                  {rcaEvents.filter(e => e.driverId === detail.id).map(e => <li key={e.id} className="border rounded p-2">{e.eventDate} - {e.category.replace(/_/g, ' ')} ({e.verificationStatus.replace(/_/g, ' ')})</li>)}
                  {!rcaEvents.some(e => e.driverId === detail.id) && <li className="text-gray-400">Belum ada kejadian.</li>}
                </ul>
              </div>
            )}
            {statusId && (
              <div className="space-y-3">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as DriverStatus)} className="border rounded-lg px-3 py-2 text-sm w-full">
                  {Object.entries(DRIVER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button onClick={() => { updateDriverStatus(statusId, newStatus, actor); setStatusId(null); }} className="bg-[#0f2b5b] text-white px-4 py-2 rounded-lg text-sm w-full">Simpan</button>
              </div>
            )}
            {notifId && (
              <div className="space-y-3">
                <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={4} placeholder="Tulis pesan / permintaan klarifikasi kepada driver" className="border rounded-lg px-3 py-2 text-sm w-full" />
                <button disabled={!msg.trim()} onClick={() => { sendNotification(notifId, 'Pesan dari Control Tower', msg, 'info', actor); setNotifId(null); }} className="bg-[#0f2b5b] text-white px-4 py-2 rounded-lg text-sm w-full disabled:opacity-50">Kirim</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


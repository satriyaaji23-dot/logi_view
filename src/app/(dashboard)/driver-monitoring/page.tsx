'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Eye, RefreshCw, Send, MapPin, X, Pencil } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { mockTransporters } from '@/lib/mock-data';
import { DRIVER_STATUS_COLORS, DRIVER_STATUS_LABELS, type Driver, type DriverStatus } from '@/lib/types';

export default function DriverMonitoringPage() {
  const { drivers, shipments, rcaEvents, updateDriver, updateDriverStatus, sendNotification } = useData();
  const { user, hasRole } = useAuth();
  const isDriver = hasRole('driver');
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
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    licenseNumber: '',
    vehiclePlate: '',
    transporterName: '',
    status: 'dalam_perjalanan' as DriverStatus,
  });

  const mitraList = Array.from(new Set([
    ...mockTransporters.map(t => t.name),
    ...drivers.map(d => d.transporterName),
  ]));

  const rows = useMemo(
    () =>
      drivers
        .map(d => ({ d, s: shipments.find(x => x.driverId === d.id) }))
        .filter(({ d, s }) =>
          (!q || d.name.toLowerCase().includes(q.toLowerCase()) || d.vehiclePlate.toLowerCase().includes(q.toLowerCase())) &&
          (!status || d.status === status) &&
          (!mitra || d.transporterName === mitra) &&
          (!date || (s?.departureTime ?? '').startsWith(date))
        ),
    [drivers, shipments, q, status, mitra, date]
  );

  if (isDriver) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-3">
        <p className="text-gray-700 font-medium">Halaman ini hanya tersedia untuk Admin / Control Tower dan Supervisor.</p>
        <Link href="/dashboard" className="inline-block bg-[#0f2b5b] text-white text-sm px-4 py-2 rounded-lg">
          Kembali ke Dashboard Saya
        </Link>
      </div>
    );
  }

  const fmt = (t?: string) =>
    t ? new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
  const detail = drivers.find(d => d.id === detailId);
  const actor = user?.name ?? 'system';

  const openEditModal = (d: Driver) => {
    setEditId(d.id);
    setEditForm({
      name: d.name,
      phone: d.phone,
      licenseNumber: d.licenseNumber,
      vehiclePlate: d.vehiclePlate,
      transporterName: d.transporterName,
      status: d.status,
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    const transporter = mockTransporters.find(t => t.name === editForm.transporterName);
    updateDriver(
      editId,
      {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        licenseNumber: editForm.licenseNumber.trim(),
        vehiclePlate: editForm.vehiclePlate.trim(),
        transporterName: editForm.transporterName,
        transporterId: transporter?.id,
        status: editForm.status,
      },
      actor
    );
    setEditId(null);
  };

  const closeAllModals = () => {
    setDetailId(null);
    setStatusId(null);
    setNotifId(null);
    setEditId(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Driver Monitoring</h1>
        <p className="text-xs sm:text-sm text-gray-500">
          {canEdit
            ? 'Pantau seluruh aktivitas driver, ubah data & status driver, serta kirim notifikasi.'
            : 'Pantau seluruh aktivitas driver dan status pengiriman.'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Cari nama atau plat..."
            className="outline-none text-sm w-full"
          />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Semua Status</option>
          {Object.entries(DRIVER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={mitra} onChange={e => setMitra(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Semua Mitra</option>
          {mitraList.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {rows.map(({ d, s }) => (
          <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{d.name}</p>
                <p className="text-xs text-gray-500">{d.id} · {d.vehiclePlate} · {d.transporterName}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-[11px] font-medium shrink-0 ${DRIVER_STATUS_COLORS[d.status]}`}>
                {DRIVER_STATUS_LABELS[d.status]}
              </span>
            </div>

            {s && (
              <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800">{s.suratJalanNo}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.isOnTime ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {s.isOnTime ? 'On Time' : 'Late'}
                  </span>
                </div>
                <p>{s.origin} → {s.destination}</p>
                <p className="text-gray-400">Estimasi: {fmt(s.estimatedArrival)} · Durasi: {s.travelDuration ?? '-'}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setDetailId(d.id)}
                className="flex-1 min-w-[90px] inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                <Eye size={14} /> Detail
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={() => openEditModal(d)}
                    className="flex-1 min-w-[90px] inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  >
                    <Pencil size={14} /> Edit Data
                  </button>
                  <button
                    onClick={() => { setStatusId(d.id); setNewStatus(d.status); }}
                    className="flex-1 min-w-[90px] inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"
                  >
                    <RefreshCw size={14} /> Status
                  </button>
                  <button
                    onClick={() => { setNotifId(d.id); setMsg(''); }}
                    className="flex-1 min-w-[90px] inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100"
                  >
                    <Send size={14} /> Pesan
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            Tidak ada data yang cocok.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              {['ID', 'Nama Driver', 'No. Kendaraan', 'Mitra', 'No. Surat Jalan', 'Asal', 'Tujuan', 'Berangkat', 'Estimasi Tiba', 'Status', 'Durasi', 'On Time/Late', 'Aksi'].map(h => (
                <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
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
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${DRIVER_STATUS_COLORS[d.status]}`}>
                    {DRIVER_STATUS_LABELS[d.status]}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{s?.travelDuration ?? '-'}</td>
                <td className="px-3 py-2.5">
                  {s ? (
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.isOnTime ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {s.isOnTime ? 'On Time' : 'Late'}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button title="Detail" onClick={() => setDetailId(d.id)} className="p-1.5 rounded hover:bg-blue-100 text-blue-700">
                      <Eye size={16} />
                    </button>
                    {canEdit && (
                      <>
                        <button title="Edit data driver" onClick={() => openEditModal(d)} className="p-1.5 rounded hover:bg-indigo-100 text-indigo-700">
                          <Pencil size={16} />
                        </button>
                        <button title="Update status" onClick={() => { setStatusId(d.id); setNewStatus(d.status); }} className="p-1.5 rounded hover:bg-amber-100 text-amber-700">
                          <RefreshCw size={16} />
                        </button>
                        <button title="Kirim notifikasi" onClick={() => { setNotifId(d.id); setMsg(''); }} className="p-1.5 rounded hover:bg-green-100 text-green-700">
                          <Send size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={13} className="text-center text-gray-400 py-8">Tidak ada data yang cocok.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Map Placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><MapPin size={16} /> Peta Monitoring Armada</h3>
        <div className="h-48 sm:h-56 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-dashed border-blue-300 flex flex-col items-center justify-center text-center p-4">
          <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-1 rounded mb-2">MODE SIMULASI</span>
          <p className="text-xs sm:text-sm text-gray-600">GPS belum terhubung. Lokasi armada aktual akan tampil di sini setelah integrasi GPS (Tahap 3).</p>
          <p className="text-[11px] text-gray-400 mt-1">Tidak ada koordinat palsu yang ditampilkan sebagai lokasi sebenarnya.</p>
        </div>
      </div>

      {/* Modals */}
      {(detail || statusId || notifId || editId) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeAllModals}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">
                {detail
                  ? `Detail ${detail.name}`
                  : editId
                  ? 'Edit Data Driver'
                  : statusId
                  ? 'Update Status Driver'
                  : 'Kirim Notifikasi'}
              </h3>
              <button onClick={closeAllModals}><X size={18} /></button>
            </div>

            {detail && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <p><span className="text-gray-500">Mitra:</span> {detail.transporterName}</p>
                  <p><span className="text-gray-500">Kendaraan:</span> {detail.vehiclePlate}</p>
                  <p><span className="text-gray-500">Telepon:</span> {detail.phone}</p>
                  <p><span className="text-gray-500">SIM:</span> {detail.licenseNumber}</p>
                  <p><span className="text-gray-500">Pengiriman:</span> {detail.totalDeliveries}</p>
                  <p><span className="text-gray-500">On Time:</span> {detail.onTimePercentage}%</p>
                </div>
                <h4 className="font-semibold pt-2">Riwayat Perjalanan</h4>
                <ul className="space-y-1">
                  {shipments.filter(s => s.driverId === detail.id).map(s => (
                    <li key={s.id} className="border rounded p-2 text-xs sm:text-sm">
                      {s.suratJalanNo}: {s.origin} → {s.destination} ({s.isOnTime ? 'On Time' : 'Late'})
                    </li>
                  ))}
                </ul>
                <h4 className="font-semibold pt-2">Riwayat Kejadian</h4>
                <ul className="space-y-1">
                  {rcaEvents.filter(e => e.driverId === detail.id).map(e => (
                    <li key={e.id} className="border rounded p-2 text-xs sm:text-sm">
                      {e.eventDate} - {e.category.replace(/_/g, ' ')} ({e.verificationStatus.replace(/_/g, ' ')})
                    </li>
                  ))}
                  {!rcaEvents.some(e => e.driverId === detail.id) && <li className="text-gray-400">Belum ada kejadian.</li>}
                </ul>
              </div>
            )}

            {editId && (
              <form onSubmit={handleSaveEdit} className="space-y-3 text-sm">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Nama Driver</span>
                  <input
                    required
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="border rounded-lg px-3 py-2 w-full mt-1"
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">No. Kendaraan</span>
                    <input
                      required
                      value={editForm.vehiclePlate}
                      onChange={e => setEditForm(f => ({ ...f, vehiclePlate: e.target.value }))}
                      className="border rounded-lg px-3 py-2 w-full mt-1"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">No. Telepon</span>
                    <input
                      required
                      value={editForm.phone}
                      onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                      className="border rounded-lg px-3 py-2 w-full mt-1"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">No. SIM</span>
                    <input
                      required
                      value={editForm.licenseNumber}
                      onChange={e => setEditForm(f => ({ ...f, licenseNumber: e.target.value }))}
                      className="border rounded-lg px-3 py-2 w-full mt-1"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Mitra Transporter</span>
                    <select
                      value={editForm.transporterName}
                      onChange={e => setEditForm(f => ({ ...f, transporterName: e.target.value }))}
                      className="border rounded-lg px-3 py-2 w-full mt-1 bg-white"
                    >
                      {mitraList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Status Driver</span>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value as DriverStatus }))}
                    className="border rounded-lg px-3 py-2 w-full mt-1 bg-white"
                  >
                    {Object.entries(DRIVER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={closeAllModals} className="flex-1 border border-gray-200 px-4 py-2 rounded-lg text-gray-700">
                    Batal
                  </button>
                  <button type="submit" className="flex-1 bg-[#0f2b5b] text-white px-4 py-2 rounded-lg font-medium">
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            )}

            {statusId && (
              <div className="space-y-3">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as DriverStatus)} className="border rounded-lg px-3 py-2 text-sm w-full bg-white">
                  {Object.entries(DRIVER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button
                  onClick={() => { updateDriverStatus(statusId, newStatus, actor); setStatusId(null); }}
                  className="bg-[#0f2b5b] text-white px-4 py-2 rounded-lg text-sm w-full"
                >
                  Simpan
                </button>
              </div>
            )}

            {notifId && (
              <div className="space-y-3">
                <textarea
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  rows={4}
                  placeholder="Tulis pesan / permintaan klarifikasi kepada driver"
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                />
                <button
                  disabled={!msg.trim()}
                  onClick={() => { sendNotification(notifId, 'Pesan dari Control Tower', msg, 'info', actor); setNotifId(null); }}
                  className="bg-[#0f2b5b] text-white px-4 py-2 rounded-lg text-sm w-full disabled:opacity-50"
                >
                  Kirim
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

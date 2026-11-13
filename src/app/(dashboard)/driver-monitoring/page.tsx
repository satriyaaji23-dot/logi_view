'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search, Eye, RefreshCw, Send, X, Pencil, Video, ClockAlert, MapPin, Settings,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { mockTransporters } from '@/lib/mock-data';
import { DRIVER_STATUS_COLORS, DRIVER_STATUS_LABELS, type Driver, type DriverStatus } from '@/lib/types';
import { loadIntegrationSettings } from '@/lib/integrations';
import FleetGpsMap from '@/components/monitoring/FleetGpsMap';
import ArmadaCctvModal from '@/components/monitoring/ArmadaCctvModal';

export default function DriverMonitoringPage() {
  const {
    drivers, shipments, rcaEvents, updateDriver, updateDriverStatus,
    sendNotification, simulateLongStop, syncGpsLocations, addAudit,
  } = useData();
  const [syncingGps, setSyncingGps] = useState(false);
  const { user, hasRole } = useAuth();
  const isDriver = hasRole('driver');
  const canEdit = hasRole('admin');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [mitra, setMitra] = useState('');
  const [date, setDate] = useState('');
  const [selectedMapDriverId, setSelectedMapDriverId] = useState<string | null>('D001');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cctvId, setCctvId] = useState<string | null>(null);
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
  const [feedback, setFeedback] = useState('');

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
  const cctvDriver = drivers.find(d => d.id === cctvId) ?? null;
  const actor = user?.name ?? 'system';

  const showToast = (text: string) => {
    setFeedback(text);
    setTimeout(() => setFeedback(''), 4000);
  };

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
    showToast('Data driver berhasil diperbarui.');
  };

  const handleSimulateLongStop = (d: Driver) => {
    simulateLongStop(d.id, 135, actor);
    setSelectedMapDriverId(d.id);
    showToast(`Deteksi berhenti > 2 jam untuk ${d.name} (${d.vehiclePlate}). Notifikasi wajib isi RCA telah dikirim ke driver.`);
  };

  const handleSyncGpsApi = async () => {
    setSyncingGps(true);
    const gpsCfg = loadIntegrationSettings().gps;
    try {
      const res = await fetch('/api/integrations/gps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: gpsCfg.baseUrl,
          token: gpsCfg.token,
          authHeader: gpsCfg.authHeader,
          authPrefix: gpsCfg.authPrefix,
        }),
      });
      const json = await res.json();
      if (!json.configured) {
        showToast(json.message ?? 'Endpoint API GPS belum diisi di menu Pengaturan & API.');
      } else if (json.ok && Array.isArray(json.items)) {
        const count = syncGpsLocations(json.items, actor, gpsCfg.longStopThresholdMinutes);
        showToast(`Sinkronisasi GPS berhasil (${count} armada diperbarui).`);
      } else {
        showToast(json.message ?? 'Gagal menyinkronkan data dari API GPS.');
      }
    } catch {
      showToast('Gagal menghubungi API GPS.');
    } finally {
      setSyncingGps(false);
    }
  };

  const closeAllModals = () => {
    setDetailId(null);
    setStatusId(null);
    setNotifId(null);
    setEditId(null);
    setCctvId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Driver Monitoring &amp; GPS / CCTV</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {canEdit
              ? 'Pantau posisi GPS armada, akses CCTV kendaraan, ubah data driver, dan deteksi berhenti > 2 jam.'
              : 'Pantau seluruh aktivitas driver, posisi GPS armada, dan status pengiriman.'}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={syncingGps}
              onClick={handleSyncGpsApi}
              className="inline-flex items-center gap-1.5 bg-[#0f2b5b] hover:bg-[#1a3d7a] text-white text-xs font-medium px-3.5 py-2 rounded-lg disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncingGps ? 'animate-spin' : ''} />
              {syncingGps ? 'Sinkronisasi...' : 'Sinkronkan GPS API'}
            </button>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium px-3.5 py-2 rounded-lg"
            >
              <Settings size={14} /> Atur API CCTV &amp; GPS
            </Link>
          </div>
        )}
      </div>

      {feedback && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs sm:text-sm px-4 py-3 rounded-xl font-medium">
          {feedback}
        </div>
      )}

      {/* GPS Map Section */}
      <FleetGpsMap
        drivers={drivers}
        selectedDriverId={selectedMapDriverId}
        onSelectDriver={id => setSelectedMapDriverId(id)}
        onOpenCctv={id => setCctvId(id)}
        onOpenDetail={id => setDetailId(id)}
        canViewCctv={canEdit}
      />

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
        {rows.map(({ d, s }) => {
          const isLongStop = (d.gps?.stoppedMinutes ?? 0) > 120;
          return (
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

              {d.gps && (
                <div className={`text-xs rounded-lg p-2.5 border ${isLongStop ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50/60 border-blue-100 text-gray-700'}`}>
                  <div className="flex items-center justify-between gap-2 font-medium">
                    <span className="flex items-center gap-1 truncate"><MapPin size={12} /> {d.gps.locationName}</span>
                    <span className="shrink-0">{d.gps.speedKmh} km/j</span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Berhenti: {d.gps.stoppedMinutes} menit {isLongStop ? '(> 2 Jam · Wajib RCA)' : ''}
                  </p>
                </div>
              )}

              {s && (
                <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800">{s.suratJalanNo}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.isOnTime ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {s.isOnTime ? 'On Time' : 'Late'}
                    </span>
                  </div>
                  <p>{s.origin} → {s.destination}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => setDetailId(d.id)}
                  className="flex-1 min-w-[85px] inline-flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  <Eye size={14} /> Detail
                </button>
                {canEdit && (
                  <>
                    <button
                      onClick={() => setCctvId(d.id)}
                      className="flex-1 min-w-[85px] inline-flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
                    >
                      <Video size={14} /> CCTV
                    </button>
                    <button
                      onClick={() => openEditModal(d)}
                      className="flex-1 min-w-[85px] inline-flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      onClick={() => { setStatusId(d.id); setNewStatus(d.status); }}
                      className="flex-1 min-w-[85px] inline-flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"
                    >
                      <RefreshCw size={14} /> Status
                    </button>
                    <button
                      onClick={() => { setNotifId(d.id); setMsg(''); }}
                      className="flex-1 min-w-[85px] inline-flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100"
                    >
                      <Send size={14} /> Pesan
                    </button>
                    <button
                      onClick={() => handleSimulateLongStop(d)}
                      className="w-full inline-flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      <ClockAlert size={14} /> Simulasi Berhenti &gt; 2 Jam
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
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
              {['ID', 'Nama Driver', 'No. Kendaraan', 'Posisi GPS', 'Mitra', 'Rute', 'Status', 'Berhenti', 'On Time/Late', 'Aksi'].map(h => (
                <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, s }) => {
              const isLongStop = (d.gps?.stoppedMinutes ?? 0) > 120;
              return (
                <tr key={d.id} className="border-t hover:bg-blue-50/40">
                  <td className="px-3 py-2.5 font-medium">{d.id}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-900">{d.name}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{d.vehiclePlate}</td>
                  <td className="px-3 py-2.5 min-w-[190px]">
                    <button
                      type="button"
                      onClick={() => setSelectedMapDriverId(d.id)}
                      className="text-left hover:underline text-xs text-blue-700 font-medium flex items-center gap-1"
                    >
                      <MapPin size={12} className="shrink-0" />
                      <span className="truncate max-w-[180px]">{d.gps?.locationName ?? '-'}</span>
                    </button>
                    <span className="text-[11px] text-gray-400 block">
                      {d.gps?.speedKmh ?? 0} km/jam
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">{d.transporterName}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                    {s ? `${s.origin} → ${s.destination}` : '-'}
                    {s && <span className="block text-[11px] text-gray-400">{s.suratJalanNo}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${DRIVER_STATUS_COLORS[d.status]}`}>
                      {DRIVER_STATUS_LABELS[d.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`text-xs font-semibold ${isLongStop ? 'text-red-600' : 'text-gray-600'}`}>
                      {d.gps?.stoppedMinutes ?? 0} mnt
                    </span>
                    {isLongStop && <span className="block text-[10px] text-red-500 font-medium">&gt; 2 Jam</span>}
                  </td>
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
                          <button title="Lihat CCTV Armada" onClick={() => setCctvId(d.id)} className="p-1.5 rounded hover:bg-slate-200 text-slate-800">
                            <Video size={16} />
                          </button>
                          <button title="Edit data driver" onClick={() => openEditModal(d)} className="p-1.5 rounded hover:bg-indigo-100 text-indigo-700">
                            <Pencil size={16} />
                          </button>
                          <button title="Update status" onClick={() => { setStatusId(d.id); setNewStatus(d.status); }} className="p-1.5 rounded hover:bg-amber-100 text-amber-700">
                            <RefreshCw size={16} />
                          </button>
                          <button title="Kirim notifikasi" onClick={() => { setNotifId(d.id); setMsg(''); }} className="p-1.5 rounded hover:bg-green-100 text-green-700">
                            <Send size={16} />
                          </button>
                          <button title="Simulasi berhenti > 2 jam" onClick={() => handleSimulateLongStop(d)} className="p-1.5 rounded hover:bg-red-100 text-red-600">
                            <ClockAlert size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={10} className="text-center text-gray-400 py-8">Tidak ada data yang cocok.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* CCTV Modal */}
      <ArmadaCctvModal
        driver={cctvDriver}
        onClose={() => setCctvId(null)}
        onSendAlert={canEdit ? (id => { setCctvId(null); setNotifId(id); setMsg(''); }) : undefined}
        onCaptureSnapshot={(drv, chLabel) => {
          addAudit('CCTV_SNAPSHOT', 'drivers', drv.id, `Snapshot CCTV (${chLabel}) diambil pada ${drv.vehiclePlate}`, actor);
        }}
      />

      {/* Detail / Edit / Status / Notif Modals */}
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
                {detail.gps && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-semibold text-blue-900">Posisi GPS Terakhir</p>
                    <p>{detail.gps.locationName}</p>
                    <p className="text-gray-500 font-mono">
                      {detail.gps.lat.toFixed(4)}, {detail.gps.lng.toFixed(4)} · {detail.gps.speedKmh} km/jam · Berhenti {detail.gps.stoppedMinutes} menit
                    </p>
                  </div>
                )}
                <h4 className="font-semibold pt-2">Riwayat Perjalanan</h4>
                <ul className="space-y-1">
                  {shipments.filter(s => s.driverId === detail.id).map(s => (
                    <li key={s.id} className="border rounded p-2 text-xs sm:text-sm">
                      {s.suratJalanNo}: {s.origin} → {s.destination} ({s.isOnTime ? 'On Time' : 'Late'}) · {fmt(s.estimatedArrival)}
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
                  onClick={() => { sendNotification(notifId, 'Pesan dari Control Tower', msg, 'info', actor); setNotifId(null); showToast('Notifikasi berhasil dikirim ke driver.'); }}
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

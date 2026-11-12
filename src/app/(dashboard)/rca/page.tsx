'use client';

import React, { useState } from 'react';
import { Plus, X, Info } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import {
  RCA_CATEGORY_LABELS, EXTERNAL_RCA_CATEGORIES, VERIFICATION_STATUS_COLORS, VERIFICATION_STATUS_LABELS,
  type RCACategory, type VerificationStatus,
} from '@/lib/types';

export default function RCAPage() {
  const { rcaEvents, drivers, addRCAEvent, verifyRCAEvent } = useData();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isDriver = hasRole('driver');
  const actor = user?.name ?? 'system';

  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({
    driverId: user?.driverId ?? '', eventDate: new Date().toISOString().slice(0, 10), eventTime: '08:00',
    category: 'parkir_lama' as RCACategory, location: '', duration: '', description: '', evidence: '',
  });
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [vStatus, setVStatus] = useState<VerificationStatus>('sedang_diperiksa');
  const [decision, setDecision] = useState('');

  const selected = drivers.find(d => d.id === form.driverId);
  const events = rcaEvents.filter(e => (!isDriver || e.driverId === user?.driverId) && (!filter || e.verificationStatus === filter));
  const external = EXTERNAL_RCA_CATEGORIES.includes(form.category);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.driverId) return;
    addRCAEvent({ ...form, evidence: form.evidence ? [form.evidence] : undefined }, actor);
    setShowForm(false);
    setForm(f => ({ ...f, location: '', duration: '', description: '', evidence: '' }));
  };

  const vEvent = rcaEvents.find(e => e.id === verifyId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RCA / Pencatatan Kejadian</h1>
          <p className="text-sm text-gray-500">Catat dan verifikasi kejadian. Kendala eksternal tidak mengurangi poin driver.</p>
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Semua Status</option>
            {Object.entries(VERIFICATION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={() => setShowForm(true)} className="bg-[#0f2b5b] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"><Plus size={16} />Catat Kejadian</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>{['ID', 'Driver', 'Kendaraan', 'Waktu', 'Kategori', 'Lokasi', 'Durasi', 'Jenis', 'Status', 'Poin', 'Aksi'].map(h => <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.id} className="border-t align-top">
                <td className="px-3 py-2.5 font-medium">{ev.id}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{ev.driverName}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{ev.vehiclePlate}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{ev.eventDate} {ev.eventTime}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{RCA_CATEGORY_LABELS[ev.category]}</td>
                <td className="px-3 py-2.5">{ev.location}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{ev.duration}</td>
                <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs ${ev.isExternalCause ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{ev.isExternalCause ? 'Eksternal' : 'Perlu cek driver'}</span></td>
                <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${VERIFICATION_STATUS_COLORS[ev.verificationStatus]}`}>{VERIFICATION_STATUS_LABELS[ev.verificationStatus]}</span></td>
                <td className="px-3 py-2.5 font-semibold text-red-600">{ev.pointsDeducted ? `-${ev.pointsDeducted}` : '0'}</td>
                <td className="px-3 py-2.5">{isAdmin && <button onClick={() => { setVerifyId(ev.id); setVStatus(ev.verificationStatus); setDecision(ev.controlTowerDecision ?? ''); }} className="text-xs text-blue-700 hover:underline">Verifikasi</button>}</td>
              </tr>
            ))}
            {!events.length && <tr><td colSpan={11} className="text-center text-gray-400 py-8">Belum ada kejadian.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto space-y-3">
            <div className="flex justify-between items-center"><h3 className="font-semibold">Form Pencatatan Kejadian (RCA)</h3><button type="button" onClick={() => setShowForm(false)}><X size={18} /></button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label>Nama Driver
                <select required disabled={isDriver} value={form.driverId} onChange={e => setForm({ ...form, driverId: e.target.value })} className="border rounded-lg px-3 py-2 w-full mt-1">
                  <option value="">Pilih driver</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select></label>
              <label>ID Driver<input readOnly value={selected?.id ?? ''} className="border rounded-lg px-3 py-2 w-full mt-1 bg-gray-50" /></label>
              <label>Nomor Kendaraan<input readOnly value={selected?.vehiclePlate ?? ''} className="border rounded-lg px-3 py-2 w-full mt-1 bg-gray-50" /></label>
              <label>Kategori RCA
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as RCACategory })} className="border rounded-lg px-3 py-2 w-full mt-1">
                  {Object.entries(RCA_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
              <label>Tanggal<input type="date" required value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} className="border rounded-lg px-3 py-2 w-full mt-1" /></label>
              <label>Jam<input type="time" required value={form.eventTime} onChange={e => setForm({ ...form, eventTime: e.target.value })} className="border rounded-lg px-3 py-2 w-full mt-1" /></label>
              <label>Lokasi Kejadian<input required value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="border rounded-lg px-3 py-2 w-full mt-1" /></label>
              <label>Durasi Kejadian<input required placeholder="mis. 1 jam 30 menit" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} className="border rounded-lg px-3 py-2 w-full mt-1" /></label>
            </div>
            <label className="block text-sm">Kronologi / Alasan<textarea required rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="border rounded-lg px-3 py-2 w-full mt-1" /></label>
            <label className="block text-sm">Upload Foto / Bukti
              <input type="file" accept="image/*" onChange={e => setForm({ ...form, evidence: e.target.files?.[0]?.name ?? '' })} className="border rounded-lg px-3 py-2 w-full mt-1" /></label>
            <div className={`flex gap-2 text-xs rounded-lg p-3 ${external ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}>
              <Info size={16} className="shrink-0" />
              {external ? 'Kategori ini termasuk kendala eksternal: tidak mengurangi poin driver secara otomatis.' : 'Kategori ini perlu diverifikasi Control Tower. Poin hanya dikurangi jika terbukti sebagai pelanggaran.'}
            </div>
            <button type="submit" className="bg-[#0f2b5b] text-white px-4 py-2 rounded-lg text-sm w-full">Simpan Kejadian</button>
          </form>
        </div>
      )}

      {vEvent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setVerifyId(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-3 text-sm">
            <div className="flex justify-between items-center"><h3 className="font-semibold">Verifikasi {vEvent.id}</h3><button onClick={() => setVerifyId(null)}><X size={18} /></button></div>
            <p className="text-gray-600">{vEvent.description}</p>
            {vEvent.isExternalCause && <p className="text-xs bg-blue-50 text-blue-800 rounded p-2">Kendala eksternal: keputusan &quot;pelanggaran&quot; tidak akan mengurangi poin.</p>}
            <select value={vStatus} onChange={e => setVStatus(e.target.value as VerificationStatus)} className="border rounded-lg px-3 py-2 w-full">
              {Object.entries(VERIFICATION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <textarea value={decision} onChange={e => setDecision(e.target.value)} rows={3} placeholder="Keputusan Control Tower" className="border rounded-lg px-3 py-2 w-full" />
            <button onClick={() => { verifyRCAEvent(vEvent.id, vStatus, decision, actor); setVerifyId(null); }} className="bg-[#0f2b5b] text-white px-4 py-2 rounded-lg w-full">Simpan Keputusan</button>
          </div>
        </div>
      )}
    </div>
  );
}


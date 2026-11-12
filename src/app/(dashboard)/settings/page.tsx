'use client';

import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPage() {
  const { rules, updateRule, drivers, adjustPoints, auditLogs } = useData();
  const { user, hasRole } = useAuth();
  const actor = user?.name ?? 'system';
  const [driverId, setDriverId] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');

  if (!hasRole('admin')) return <p className="text-gray-500">Halaman ini hanya untuk Admin / Control Tower.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan Poin</h1>
        <p className="text-sm text-gray-500">Besaran poin dapat diubah Admin. Kategori eksternal tidak otomatis mengurangi poin.</p>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold mb-3">Aturan Reward &amp; Punishment</h2>
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm"><span className={`px-2 py-0.5 rounded text-xs mr-2 ${r.type === 'reward' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.type === 'reward' ? 'Reward' : 'Punishment'}</span>{r.name}</p>
                <p className="text-xs text-gray-500">{r.description}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <input type="number" min={0} value={r.points} onChange={e => updateRule(r.id, { points: Math.max(0, Number(e.target.value)) }, actor)} className="border rounded-lg px-2 py-1 w-20" />
                <label className="flex items-center gap-1"><input type="checkbox" checked={r.isActive} onChange={e => updateRule(r.id, { isActive: e.target.checked }, actor)} />Aktif</label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold mb-3">Koreksi Poin (dengan Catatan Audit)</h2>
        <form onSubmit={e => { e.preventDefault(); if (!driverId || !Number(points) || !reason.trim()) return; adjustPoints(driverId, Number(points), reason, actor); setPoints(''); setReason(''); }} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <select value={driverId} onChange={e => setDriverId(e.target.value)} className="border rounded-lg px-3 py-2"><option value="">Pilih driver</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <input type="number" value={points} onChange={e => setPoints(e.target.value)} placeholder="+10 atau -5" className="border rounded-lg px-3 py-2" />
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Alasan koreksi (wajib)" className="border rounded-lg px-3 py-2" />
          <button className="bg-[#0f2b5b] text-white rounded-lg px-4 py-2">Terapkan</button>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold mb-3">Log Audit</h2>
        <ul className="divide-y text-sm max-h-80 overflow-y-auto">
          {auditLogs.map(a => <li key={a.id} className="py-2"><b>{a.action}</b> · {a.entity} {a.entityId} — {a.details}<span className="block text-xs text-gray-400">{new Date(a.timestamp).toLocaleString('id-ID')} · {a.userName}</span></li>)}
          {!auditLogs.length && <li className="py-4 text-gray-400">Belum ada aktivitas pada sesi ini.</li>}
        </ul>
      </section>
    </div>
  );
}


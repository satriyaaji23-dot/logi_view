'use client';

import React, { useState } from 'react';
import { MapPin, Clock, MessageSquare } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { NOTIFICATION_PRIORITY_COLORS, NOTIFICATION_PRIORITY_LABELS, type NotificationHandlingStatus } from '@/lib/types';

const HANDLING: Record<NotificationHandlingStatus, string> = { belum_ditangani: 'Belum Ditangani', sedang_ditangani: 'Sedang Ditangani', selesai: 'Selesai' };

export default function NotificationsPage() {
  const { notifications, setNotificationHandling, sendNotification } = useData();
  const { user, hasRole } = useAuth();
  const isDriver = hasRole('driver');
  const [prio, setPrio] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [text, setText] = useState('');

  const list = notifications
    .filter(n => !isDriver || n.driverId === user?.driverId)
    .filter(n => !prio || n.priority === prio)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifikasi & Alert</h1>
          <p className="text-sm text-gray-500">Peringatan otomatis dan pesan Control Tower.</p>
        </div>
        <select value={prio} onChange={e => setPrio(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Semua Prioritas</option>
          {Object.entries(NOTIFICATION_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {list.map(n => (
          <div key={n.id} className={`bg-white rounded-xl border p-4 ${NOTIFICATION_PRIORITY_COLORS[n.priority].split(' ').pop()}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${NOTIFICATION_PRIORITY_COLORS[n.priority]}`}>{NOTIFICATION_PRIORITY_LABELS[n.priority]}</span>
                  <h3 className="font-semibold text-gray-900">{n.title}</h3>
                </div>
                <p className="text-sm text-gray-600">{n.description}</p>
                <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
                  <span>Driver: <b>{n.driverName}</b></span>
                  <span className="flex items-center gap-1"><Clock size={12} />{new Date(n.timestamp).toLocaleString('id-ID')}</span>
                  {n.location && <span className="flex items-center gap-1"><MapPin size={12} />{n.location}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {isDriver ? <span className="text-xs bg-gray-100 px-2 py-1 rounded">{HANDLING[n.handlingStatus]}</span> : (
                  <select value={n.handlingStatus} onChange={e => setNotificationHandling(n.id, e.target.value as NotificationHandlingStatus)} className="border rounded-lg px-2 py-1 text-xs">
                    {Object.entries(HANDLING).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                )}
                {!isDriver && <button onClick={() => { setReplyId(n.id); setText(''); }} className="text-xs flex items-center gap-1 text-blue-700 hover:underline"><MessageSquare size={14} />Minta klarifikasi</button>}
              </div>
            </div>
            {replyId === n.id && (
              <div className="mt-3 flex gap-2">
                <input value={text} onChange={e => setText(e.target.value)} placeholder="Pesan klarifikasi untuk driver" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                <button disabled={!text.trim()} onClick={() => { sendNotification(n.driverId, 'Permintaan Klarifikasi', text, 'warning', user?.name ?? 'system'); setReplyId(null); }} className="bg-[#0f2b5b] text-white px-4 rounded-lg text-sm disabled:opacity-50">Kirim</button>
              </div>
            )}
          </div>
        ))}
        {!list.length && <p className="text-center text-gray-400 py-10">Tidak ada notifikasi.</p>}
      </div>
    </div>
  );
}


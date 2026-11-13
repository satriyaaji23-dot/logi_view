'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Clock, MessageSquare, AlertTriangle, CheckCircle2, ClipboardList, Zap } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { NOTIFICATION_PRIORITY_COLORS, NOTIFICATION_PRIORITY_LABELS, type NotificationHandlingStatus } from '@/lib/types';

const HANDLING: Record<NotificationHandlingStatus, string> = {
  belum_ditangani: 'Belum Ditangani',
  sedang_ditangani: 'Sedang Ditangani',
  selesai: 'Selesai',
};

function formatRemaining(deadlineIso?: string, nowMs?: number): string {
  if (!deadlineIso || !nowMs) return '-';
  const diff = new Date(deadlineIso).getTime() - nowMs;
  if (diff <= 0) return 'Waktu habis';
  const totalSec = Math.floor(diff / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}d`;
}

export default function NotificationsPage() {
  const {
    notifications,
    setNotificationHandling,
    sendNotification,
    markNotificationRead,
    triggerAutoPunishment,
  } = useData();
  const { user, hasRole } = useAuth();
  const isDriver = hasRole('driver');
  const isAdmin = hasRole('admin');
  const [prio, setPrio] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [nowMs, setNowMs] = useState<number>(0);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const list = notifications
    .filter(n => !isDriver || n.driverId === user?.driverId)
    .filter(n => !prio || n.priority === prio)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const pendingRcaAlerts = list.filter(n => n.requiresRca && !n.rcaSubmitted && !n.autoPunished);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Notifikasi &amp; Alert</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Peringatan otomatis berhenti &gt; 2 jam, batas waktu pengisian RCA, dan pesan Control Tower.
          </p>
        </div>
        <select
          value={prio}
          onChange={e => setPrio(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Semua Prioritas</option>
          {Object.entries(NOTIFICATION_PRIORITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {isDriver && pendingRcaAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">
                Ada {pendingRcaAlerts.length} Peringatan Berhenti &gt; 2 Jam yang Wajib Diisi RCA!
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                Jika tidak segera mengisi RCA sebelum batas waktu habis, sistem akan otomatis mengurangi poin Anda.
              </p>
            </div>
          </div>
          <Link
            href={`/rca?notificationId=${pendingRcaAlerts[0].id}`}
            className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-lg shrink-0"
          >
            <ClipboardList size={16} /> Isi RCA Sekarang
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {list.map(n => {
          const isPendingRca = Boolean(n.requiresRca && !n.rcaSubmitted && !n.autoPunished);
          return (
            <div
              key={n.id}
              onClick={() => markNotificationRead(n.id)}
              className={`bg-white rounded-xl border p-4 transition-shadow ${
                !n.readAt ? 'ring-1 ring-blue-500/20' : ''
              } ${NOTIFICATION_PRIORITY_COLORS[n.priority].split(' ').pop()}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${NOTIFICATION_PRIORITY_COLORS[n.priority]}`}>
                      {NOTIFICATION_PRIORITY_LABELS[n.priority]}
                    </span>
                    {!n.readAt && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                        Baru
                      </span>
                    )}
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{n.title}</h3>
                  </div>

                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{n.description}</p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pt-1">
                    <span>Driver: <b>{n.driverName}</b></span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(n.timestamp).toLocaleString('id-ID')}
                    </span>
                    {n.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {n.location}
                      </span>
                    )}
                  </div>

                  {/* Status khusus notifikasi wajib RCA */}
                  {n.requiresRca && (
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      {isPendingRca && (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg">
                            <Clock size={13} />
                            Sisa waktu isi RCA: {formatRemaining(n.rcaDeadlineAt, nowMs)}
                          </span>
                          {isDriver && (
                            <Link
                              href={`/rca?notificationId=${n.id}`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#0f2b5b] text-white px-3 py-1.5 rounded-lg hover:bg-[#1a3d7a]"
                            >
                              <ClipboardList size={13} /> Isi RCA Sekarang
                            </Link>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                triggerAutoPunishment(n.id, `${user?.name ?? 'Admin'} (Simulasi Batas Waktu)`);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 px-2.5 py-1.5 rounded-lg"
                            >
                              <Zap size={13} /> Simulasi Lewat Batas Waktu (Auto-Punishment)
                            </button>
                          )}
                        </>
                      )}

                      {n.rcaSubmitted && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg">
                          <CheckCircle2 size={13} />
                          RCA Sudah Diisi ({n.rcaEventId}) — Menunggu / Selesai Verifikasi Admin
                        </span>
                      )}

                      {n.autoPunished && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-1 rounded-lg">
                          <AlertTriangle size={13} />
                          Terkena Auto-Punishment (Tidak Mengisi RCA)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                  {isDriver ? (
                    <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg font-medium">
                      {HANDLING[n.handlingStatus]}
                    </span>
                  ) : (
                    <select
                      value={n.handlingStatus}
                      onChange={e => setNotificationHandling(n.id, e.target.value as NotificationHandlingStatus)}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    >
                      {Object.entries(HANDLING).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  )}
                  {!isDriver && (
                    <button
                      onClick={() => {
                        setReplyId(n.id);
                        setText('');
                      }}
                      className="text-xs flex items-center gap-1 text-blue-700 hover:underline font-medium"
                    >
                      <MessageSquare size={14} /> Minta klarifikasi
                    </button>
                  )}
                </div>
              </div>

              {replyId === n.id && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Pesan klarifikasi untuk driver"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    disabled={!text.trim()}
                    onClick={() => {
                      sendNotification(n.driverId, 'Permintaan Klarifikasi', text, 'warning', user?.name ?? 'system');
                      setReplyId(null);
                    }}
                    className="bg-[#0f2b5b] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                  >
                    Kirim
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!list.length && <p className="text-center text-gray-400 py-10">Tidak ada notifikasi.</p>}
      </div>
    </div>
  );
}

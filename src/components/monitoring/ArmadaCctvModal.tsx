'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, X, Camera, MapPin, AlertTriangle, Send, Wifi, WifiOff, RefreshCw, Settings } from 'lucide-react';
import { DRIVER_STATUS_LABELS, type Driver } from '@/lib/types';
import { loadIntegrationSettings } from '@/lib/integrations';

interface ArmadaCctvModalProps {
  driver: Driver | null;
  onClose: () => void;
  onSendAlert?: (driverId: string) => void;
  onCaptureSnapshot?: (driver: Driver, channelLabel: string) => void;
}

type ChannelKey = 'cabin' | 'dashcam' | 'cargo';

const CHANNELS: { key: ChannelKey; code: string; label: string; desc: string }[] = [
  { key: 'cabin', code: 'CH-01', label: 'Kamera Kabin', desc: 'Pantau aktivitas & kewaspadaan pengemudi di kabin' },
  { key: 'dashcam', code: 'CH-02', label: 'Dashcam Depan', desc: 'Pantau kondisi jalan & lalu lintas di depan armada' },
  { key: 'cargo', code: 'CH-03', label: 'Kamera Muatan', desc: 'Pantau keamanan terpal & bak muatan semen' },
];

export default function ArmadaCctvModal({
  driver,
  onClose,
  onSendAlert,
  onCaptureSnapshot,
}: ArmadaCctvModalProps) {
  const [activeChannel, setActiveChannel] = useState<ChannelKey>('cabin');
  const [clock, setClock] = useState<string>('');
  const [snapshotNotice, setSnapshotNotice] = useState<string>('');
  const [apiState, setApiState] = useState<{
    loading: boolean;
    configured: boolean;
    hasToken: boolean;
    streamUrl?: string;
    snapshotUrl?: string;
    message?: string;
  }>({ loading: false, configured: false, hasToken: false });

  useEffect(() => {
    const updateClock = () => {
      setClock(new Date().toLocaleTimeString('id-ID', { hour12: false }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchCctvFeed = useCallback(async (targetDriver: Driver, channel: ChannelKey) => {
    const cfg = loadIntegrationSettings().cctv;
    if (!cfg.enabled) {
      setApiState({ loading: false, configured: false, hasToken: false, message: 'Integrasi CCTV dinonaktifkan di Pengaturan.' });
      return;
    }

    setApiState(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/integrations/cctv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: cfg.baseUrl,
          token: cfg.token,
          authHeader: cfg.authHeader,
          authPrefix: cfg.authPrefix,
          cameraId: targetDriver.cctv?.cameraId ?? targetDriver.vehicleId,
          vehiclePlate: targetDriver.vehiclePlate,
          driverId: targetDriver.id,
          channel,
        }),
      });
      const json = await res.json();
      setApiState({
        loading: false,
        configured: Boolean(json.configured),
        hasToken: Boolean(json.hasToken || cfg.token),
        streamUrl: json.streamUrl,
        snapshotUrl: json.snapshotUrl,
        message: json.message,
      });
    } catch {
      setApiState({
        loading: false,
        configured: false,
        hasToken: false,
        message: 'Gagal memeriksa API CCTV.',
      });
    }
  }, []);

  useEffect(() => {
    if (!driver) return;
    fetchCctvFeed(driver, activeChannel);
  }, [driver, activeChannel, fetchCctvFeed]);

  if (!driver) return null;

  const channelMeta = CHANNELS.find(c => c.key === activeChannel) ?? CHANNELS[0];
  const channelStatus =
    activeChannel === 'cabin'
      ? driver.cctv?.cabinStatus ?? 'online'
      : activeChannel === 'dashcam'
      ? driver.cctv?.dashcamStatus ?? 'online'
      : driver.cctv?.cargoStatus ?? 'online';

  const isOnline = channelStatus === 'online';
  const isMoving = (driver.gps?.speedKmh ?? 0) > 0;
  const isLongStop = (driver.gps?.stoppedMinutes ?? 0) > 120;
  const isVideoStream = Boolean(apiState.streamUrl && /\.(mp4|webm|m3u8)(\?|$)/i.test(apiState.streamUrl));

  const handleSnapshot = () => {
    onCaptureSnapshot?.(driver, channelMeta.label);
    setSnapshotNotice(`Snapshot ${channelMeta.code} (${channelMeta.label}) tersimpan pada ${clock}`);
    setTimeout(() => setSnapshotNotice(''), 3500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0f2b5b] text-white px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/30 flex items-center justify-center shrink-0">
              <Video size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm sm:text-base truncate">
                CCTV Armada · {driver.vehiclePlate}
              </h3>
              <p className="text-[11px] text-blue-200 truncate">
                {driver.name} ({driver.id}) · {driver.cctv?.cameraId ?? 'CAM-ARMADA'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fetchCctvFeed(driver, activeChannel)}
              className="p-1.5 rounded-lg hover:bg-white/10"
              title="Muat ulang stream CCTV API"
              aria-label="Muat ulang CCTV"
            >
              <RefreshCw size={16} className={apiState.loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Tutup CCTV">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* API Integration Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <div className="text-slate-600 min-w-0">
              {apiState.streamUrl || apiState.snapshotUrl ? (
                <span className="text-emerald-700 font-semibold">Terhubung ke API CCTV Live</span>
              ) : apiState.hasToken ? (
                <span>
                  <b className="text-blue-700">Token API CCTV aktif di server</b> ·{' '}
                  <span className="text-slate-500">Isi Endpoint URL CCTV agar stream live tampil otomatis.</span>
                </span>
              ) : (
                <span>Mode pratinjau simulasi · Atur Endpoint &amp; Token API CCTV di Pengaturan.</span>
              )}
            </div>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium shrink-0"
            >
              <Settings size={13} /> Atur API
            </Link>
          </div>

          {/* Channel Switcher */}
          <div className="grid grid-cols-3 gap-2">
            {CHANNELS.map(ch => {
              const st =
                ch.key === 'cabin'
                  ? driver.cctv?.cabinStatus ?? 'online'
                  : ch.key === 'dashcam'
                  ? driver.cctv?.dashcamStatus ?? 'online'
                  : driver.cctv?.cargoStatus ?? 'online';
              return (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => setActiveChannel(ch.key)}
                  className={`px-2.5 py-2 rounded-xl border text-left transition-all ${
                    activeChannel === ch.key
                      ? 'bg-blue-50 border-blue-500 text-[#0f2b5b] ring-2 ring-blue-500/15'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono font-bold">{ch.code}</span>
                    <span className={`w-2 h-2 rounded-full ${st === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  </div>
                  <p className="text-xs font-semibold truncate mt-0.5">{ch.label}</p>
                </button>
              );
            })}
          </div>

          {/* Live API Stream or Simulated CCTV Viewport */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 text-white">
            {apiState.snapshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={apiState.snapshotUrl}
                alt={`CCTV ${driver.vehiclePlate}`}
                className="w-full h-full object-cover"
              />
            ) : apiState.streamUrl && isVideoStream ? (
              <video src={apiState.streamUrl} controls autoPlay muted className="w-full h-full object-cover" />
            ) : apiState.streamUrl ? (
              <iframe
                src={apiState.streamUrl}
                title={`Stream CCTV ${driver.vehiclePlate}`}
                className="w-full h-full border-0 bg-black"
                allow="autoplay; fullscreen"
              />
            ) : isOnline ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
                  {activeChannel === 'dashcam' && (
                    <svg viewBox="0 0 400 220" className="w-full h-full opacity-75">
                      <rect width="400" height="110" fill="#1e293b" />
                      <polygon points="150,110 250,110 380,220 20,220" fill="#334155" />
                      <line x1="200" y1="115" x2="200" y2="215" stroke="#facc15" strokeWidth="4" strokeDasharray="16 12" />
                      <rect x="0" y="108" width="400" height="4" fill="#475569" />
                      <text x="200" y="75" textAnchor="middle" fill="#94a3b8" fontSize="12" fontFamily="monospace">
                        {isMoving ? 'JALUR TOL / PANTURA — KENDARAAN MELAJU' : 'ARMADA BERHENTI — AREA PARKIR / GUDANG'}
                      </text>
                    </svg>
                  )}
                  {activeChannel === 'cabin' && (
                    <svg viewBox="0 0 400 220" className="w-full h-full opacity-80">
                      <rect width="400" height="220" fill="#0f172a" />
                      <rect x="45" y="25" width="310" height="105" rx="10" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                      <circle cx="155" cy="95" r="24" fill="#475569" />
                      <path d="M115,175 C115,135 195,135 195,175 Z" fill="#475569" />
                      <circle cx="155" cy="170" r="32" fill="none" stroke="#64748b" strokeWidth="6" />
                      <text x="275" y="80" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontFamily="monospace">
                        KABIN DRIVER
                      </text>
                      <text x="275" y="100" textAnchor="middle" fill={isLongStop ? '#f87171' : '#34d399'} fontSize="10" fontFamily="monospace">
                        {isLongStop ? 'PARKIR > 2 JAM' : DRIVER_STATUS_LABELS[driver.status].toUpperCase()}
                      </text>
                    </svg>
                  )}
                  {activeChannel === 'cargo' && (
                    <svg viewBox="0 0 400 220" className="w-full h-full opacity-80">
                      <rect width="400" height="220" fill="#0f172a" />
                      <rect x="65" y="45" width="270" height="135" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                      <rect x="85" y="65" width="105" height="95" fill="#334155" stroke="#64748b" />
                      <rect x="210" y="65" width="105" height="95" fill="#334155" stroke="#64748b" />
                      <text x="200" y="118" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontFamily="monospace">
                        MUATAN SEMEN TERSEGEL · TERPAL AMAN
                      </text>
                    </svg>
                  )}
                </div>

                <div className="relative z-10 h-full flex flex-col justify-between p-3 sm:p-4 bg-gradient-to-t from-black/75 via-transparent to-black/60">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 bg-red-600/90 px-2 py-0.5 rounded text-white font-bold">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        LIVE REC
                      </span>
                      <span className="bg-black/50 px-2 py-0.5 rounded text-emerald-300 flex items-center gap-1">
                        <Wifi size={12} /> {channelMeta.code} · {channelMeta.label}
                      </span>
                    </div>
                    <span className="bg-black/50 px-2 py-0.5 rounded text-slate-200">{clock} WIB</span>
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-2 text-[11px] font-mono">
                    <div className="space-y-0.5">
                      <p className="text-sky-300 flex items-center gap-1">
                        <MapPin size={12} /> {driver.gps?.locationName ?? 'Lokasi tidak tersedia'}
                      </p>
                      <p className="text-slate-300">
                        GPS: {driver.gps ? `${driver.gps.lat.toFixed(4)}, ${driver.gps.lng.toFixed(4)}` : '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{driver.gps?.speedKmh ?? 0} km/jam</p>
                      <p className={isLongStop ? 'text-red-400 font-semibold' : 'text-slate-300'}>
                        Berhenti: {driver.gps?.stoppedMinutes ?? 0} menit
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                <WifiOff size={32} className="text-red-400" />
                <p className="text-sm font-semibold text-red-300">Sinyal {channelMeta.label} Offline</p>
                <p className="text-xs text-slate-400">Kamera tidak mengirim sinyal. Periksa koneksi unit di armada {driver.vehiclePlate}.</p>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500">{channelMeta.desc}</p>

          {apiState.configured && apiState.message && !apiState.streamUrl && !apiState.snapshotUrl && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3.5 py-2 text-xs">
              {apiState.message}
            </div>
          )}

          {isLongStop && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3.5 py-2.5 text-xs flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                Armada terdeteksi berhenti <b>{driver.gps?.stoppedMinutes} menit</b> (&gt; 2 jam). Periksa kondisi kabin &amp; jalan melalui CCTV sebelum memverifikasi RCA driver.
              </span>
            </div>
          )}

          {snapshotNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-3.5 py-2 text-xs font-medium">
              {snapshotNotice}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleSnapshot}
              disabled={!isOnline}
              className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs sm:text-sm font-medium px-4 py-2.5 rounded-xl disabled:opacity-50"
            >
              <Camera size={16} /> Ambil Snapshot
            </button>
            {onSendAlert && (
              <button
                type="button"
                onClick={() => onSendAlert(driver.id)}
                className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-1.5 bg-[#0f2b5b] hover:bg-[#1a3d7a] text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-xl"
              >
                <Send size={16} /> Kirim Teguran / Pesan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

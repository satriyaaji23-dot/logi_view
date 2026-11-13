'use client';

import React, { useState } from 'react';
import { MapPin, Navigation, Video, Eye, ExternalLink, AlertTriangle, Gauge, Clock } from 'lucide-react';
import { DRIVER_STATUS_COLORS, DRIVER_STATUS_LABELS, type Driver } from '@/lib/types';

interface FleetGpsMapProps {
  drivers: Driver[];
  selectedDriverId: string | null;
  onSelectDriver: (driverId: string) => void;
  onOpenCctv?: (driverId: string) => void;
  onOpenDetail?: (driverId: string) => void;
  canViewCctv?: boolean;
}

const CITY_ANCHORS = [
  { name: 'Semarang', lat: -6.9667, lng: 110.4167 },
  { name: 'Pati', lat: -6.7520, lng: 111.0385 },
  { name: 'Tuban', lat: -6.8976, lng: 112.0649 },
  { name: 'Lamongan', lat: -7.1150, lng: 112.4180 },
  { name: 'Gresik', lat: -7.1560, lng: 112.6550 },
  { name: 'Surabaya', lat: -7.2575, lng: 112.7521 },
  { name: 'Mojokerto', lat: -7.4722, lng: 112.4336 },
  { name: 'Madiun', lat: -7.6298, lng: 111.5239 },
  { name: 'Kediri', lat: -7.8480, lng: 112.0178 },
  { name: 'Malang', lat: -7.9666, lng: 112.6326 },
  { name: 'Blitar', lat: -8.0955, lng: 112.1609 },
  { name: 'Pasuruan', lat: -7.6453, lng: 112.9075 },
];

const BOUNDS = {
  minLat: -8.35,
  maxLat: -6.55,
  minLng: 110.15,
  maxLng: 113.35,
};

function projectToPercent(lat: number, lng: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return {
    x: Math.min(95, Math.max(5, x)),
    y: Math.min(93, Math.max(7, y)),
  };
}

export default function FleetGpsMap({
  drivers,
  selectedDriverId,
  onSelectDriver,
  onOpenCctv,
  onOpenDetail,
  canViewCctv = false,
}: FleetGpsMapProps) {
  const [mapMode, setMapMode] = useState<'fleet' | 'osm'>('fleet');
  const driversWithGps = drivers.filter(d => d.gps);
  const selected =
    driversWithGps.find(d => d.id === selectedDriverId) ?? driversWithGps[0] ?? null;

  const osmUrl = selected?.gps
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${selected.gps.lng - 0.08}%2C${selected.gps.lat - 0.05}%2C${selected.gps.lng + 0.08}%2C${selected.gps.lat + 0.05}&layer=mapnik&marker=${selected.gps.lat}%2C${selected.gps.lng}`
    : '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-2">
            <MapPin size={16} className="text-blue-600" />
            Peta GPS Armada Real-Time
          </h3>
          <p className="text-xs text-gray-500">
            Klik pin armada untuk melihat koordinat GPS, kecepatan, durasi berhenti, dan akses CCTV.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setMapMode('fleet')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              mapMode === 'fleet' ? 'bg-white text-[#0f2b5b] shadow-sm' : 'text-gray-600'
            }`}
          >
            Semua Armada ({driversWithGps.length})
          </button>
          <button
            type="button"
            onClick={() => setMapMode('osm')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              mapMode === 'osm' ? 'bg-white text-[#0f2b5b] shadow-sm' : 'text-gray-600'
            }`}
          >
            Peta Jalan (OSM)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Canvas */}
        <div className="lg:col-span-2 relative h-72 sm:h-80 rounded-xl overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-900 via-[#0f2b5b] to-slate-800">
          {mapMode === 'fleet' ? (
            <>
              {/* Subtle Radar / Coordinate Grid */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                {[20, 40, 60, 80].map(v => (
                  <React.Fragment key={v}>
                    <line x1={v} y1="0" x2={v} y2="100" stroke="#93c5fd" strokeWidth="0.2" strokeDasharray="1 1" />
                    <line x1="0" y1={v} x2="100" y2={v} stroke="#93c5fd" strokeWidth="0.2" strokeDasharray="1 1" />
                  </React.Fragment>
                ))}
                {/* Main Distribution Corridor Lines */}
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="0.5"
                  strokeDasharray="1.5 1"
                  points={CITY_ANCHORS.slice(0, 6)
                    .map(c => {
                      const p = projectToPercent(c.lat, c.lng);
                      return `${p.x},${p.y}`;
                    })
                    .join(' ')}
                />
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="0.4"
                  strokeDasharray="1.5 1"
                  points={[CITY_ANCHORS[5], CITY_ANCHORS[6], CITY_ANCHORS[8], CITY_ANCHORS[10]]
                    .map(c => {
                      const p = projectToPercent(c.lat, c.lng);
                      return `${p.x},${p.y}`;
                    })
                    .join(' ')}
                />
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="0.4"
                  strokeDasharray="1.5 1"
                  points={[CITY_ANCHORS[5], CITY_ANCHORS[11], CITY_ANCHORS[9]]
                    .map(c => {
                      const p = projectToPercent(c.lat, c.lng);
                      return `${p.x},${p.y}`;
                    })
                    .join(' ')}
                />
              </svg>

              {/* City Labels */}
              {CITY_ANCHORS.map(city => {
                const pos = projectToPercent(city.lat, city.lng);
                return (
                  <div
                    key={city.name}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-300/60 mx-auto" />
                    <span className="text-[9px] text-sky-200/70 font-medium whitespace-nowrap block text-center mt-0.5">
                      {city.name}
                    </span>
                  </div>
                );
              })}

              {/* Live Truck GPS Markers */}
              {driversWithGps.map(d => {
                if (!d.gps) return null;
                const pos = projectToPercent(d.gps.lat, d.gps.lng);
                const isSelected = selected?.id === d.id;
                const isLongStop = d.gps.stoppedMinutes > 120;
                const isMoving = d.gps.speedKmh > 0;
                const pinBg = isLongStop
                  ? 'bg-red-500 border-red-200'
                  : isMoving
                  ? 'bg-blue-500 border-blue-200'
                  : d.status === 'selesai_pengiriman'
                  ? 'bg-emerald-500 border-emerald-200'
                  : 'bg-amber-500 border-amber-200';

                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onSelectDriver(d.id)}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-transform ${
                      isSelected ? 'z-20 scale-115' : 'z-10 hover:scale-110'
                    }`}
                    title={`${d.name} (${d.vehiclePlate}) - ${d.gps.locationName}`}
                  >
                    {isLongStop && (
                      <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
                    )}
                    <div
                      className={`relative px-2 py-1 rounded-full border-2 text-white text-[10px] font-bold shadow-lg flex items-center gap-1 whitespace-nowrap ${pinBg} ${
                        isSelected ? 'ring-4 ring-white/50' : ''
                      }`}
                    >
                      <Navigation size={10} className={isMoving ? 'rotate-45' : ''} />
                      <span>{d.vehiclePlate.split(' ').slice(0, 2).join(' ')}</span>
                    </div>
                  </button>
                );
              })}

              {/* Map Legend */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 bg-slate-950/75 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[10px] text-slate-200">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Berjalan</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Berhenti / Bongkar</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Berhenti &gt; 2 Jam</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Selesai</span>
                </div>
                <span className="text-sky-300 font-mono">GPS LIVE TELEMETRY</span>
              </div>
            </>
          ) : (
            <iframe
              title={`Peta lokasi ${selected?.vehiclePlate ?? 'Armada'}`}
              src={osmUrl}
              className="w-full h-full border-0 bg-white"
              loading="lazy"
            />
          )}
        </div>

        {/* Selected Armada Telemetry Panel */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col justify-between space-y-3">
          {selected?.gps ? (
            <>
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                      Armada Terpilih
                    </span>
                    <h4 className="text-base font-bold text-gray-900">{selected.name}</h4>
                    <p className="text-xs text-gray-500">{selected.vehiclePlate} · {selected.transporterName}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${DRIVER_STATUS_COLORS[selected.status]}`}>
                    {DRIVER_STATUS_LABELS[selected.status]}
                  </span>
                </div>

                {selected.gps.stoppedMinutes > 120 && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>
                      Armada berhenti <b>{selected.gps.stoppedMinutes} menit</b> (&gt; 2 jam). Notifikasi wajib isi RCA aktif.
                    </span>
                  </div>
                )}

                <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Lokasi GPS Saat Ini</span>
                    <span className="font-semibold text-gray-800">{selected.gps.locationName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Gauge size={14} className="text-blue-600 shrink-0" />
                      <div>
                        <span className="text-[10px] text-gray-400 block">Kecepatan</span>
                        <span className="font-semibold text-gray-800">{selected.gps.speedKmh} km/jam</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className={selected.gps.stoppedMinutes > 120 ? 'text-red-600 shrink-0' : 'text-amber-600 shrink-0'} />
                      <div>
                        <span className="text-[10px] text-gray-400 block">Lama Berhenti</span>
                        <span className={`font-semibold ${selected.gps.stoppedMinutes > 120 ? 'text-red-600' : 'text-gray-800'}`}>
                          {selected.gps.stoppedMinutes} menit
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Koordinat</span>
                    <span className="font-mono text-gray-700">
                      {selected.gps.lat.toFixed(4)}, {selected.gps.lng.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  {onOpenDetail && (
                    <button
                      type="button"
                      onClick={() => onOpenDetail(selected.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                    >
                      <Eye size={14} /> Detail
                    </button>
                  )}
                  {canViewCctv && onOpenCctv && (
                    <button
                      type="button"
                      onClick={() => onOpenCctv(selected.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-[#0f2b5b] text-white hover:bg-[#1a3d7a]"
                    >
                      <Video size={14} /> Lihat CCTV
                    </button>
                  )}
                </div>
                <a
                  href={`https://www.google.com/maps?q=${selected.gps.lat},${selected.gps.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  <ExternalLink size={13} /> Buka Lokasi di Google Maps
                </a>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center my-auto">Tidak ada data GPS tersedia.</p>
          )}
        </div>
      </div>
    </div>
  );
}


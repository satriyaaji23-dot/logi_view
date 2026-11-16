'use client';

import React, { useEffect, useState } from 'react';
import { Plus, X, Info, AlertTriangle, CheckCircle2, Video, MapPin, ShieldCheck, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import {
  RCA_CATEGORY_LABELS, EXTERNAL_RCA_CATEGORIES, VERIFICATION_STATUS_COLORS, VERIFICATION_STATUS_LABELS,
  type RCACategory, type VerificationStatus, type Notification,
} from '@/lib/types';
import { uploadFotoDetailed } from '@/lib/supabaseClient';
import ArmadaCctvModal from '@/components/monitoring/ArmadaCctvModal';

function isImageUrl(val?: string): boolean {
  if (!val) return false;
  return val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.readAsDataURL(file);
  });
}

export default function RCAPage() {
  const { rcaEvents, drivers, shipments, notifications, addRCAEvent, verifyRCAEvent, addAudit } = useData();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isDriver = hasRole('driver');
  const actor = user?.name ?? 'system';

  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [linkedNotifId, setLinkedNotifId] = useState<string | undefined>(undefined);
  const [form, setForm] = useState({
    driverId: user?.driverId ?? '',
    shipmentId: '',
    eventDate: new Date().toISOString().slice(0, 10),
    eventTime: '08:00',
    category: 'parkir_lama' as RCACategory,
    location: '',
    duration: '',
    description: '',
    evidence: '',
  });
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [vStatus, setVStatus] = useState<VerificationStatus>('sedang_diperiksa');
  const [decision, setDecision] = useState('');
  const [cctvDriverId, setCctvDriverId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleEvidenceFileChange = async (file?: File) => {
    if (!file) {
      setForm(f => ({ ...f, evidence: '' }));
      setUploadFeedback(null);
      return;
    }
    setUploadingPhoto(true);
    setUploadFeedback(null);

    const res = await uploadFotoDetailed(file, 'rca');
    if (res.publicUrl) {
      setForm(f => ({ ...f, evidence: res.publicUrl ?? '' }));
      setUploadFeedback({
        ok: true,
        text: `Foto berhasil diunggah ke Supabase Storage (bucket "${res.bucket}").`,
      });
      setUploadingPhoto(false);
      return;
    }

    // Jika Supabase belum dikonfigurasi atau gagal, simpan pratinjau lokal sementara
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm(f => ({ ...f, evidence: dataUrl || file.name }));
    } catch {
      setForm(f => ({ ...f, evidence: file.name }));
    }
    setUploadFeedback({
      ok: false,
      text: res.error ?? 'Gagal mengunggah ke Supabase Storage. Pratinjau lokal sementara digunakan.',
    });
    setUploadingPhoto(false);
  };

  const openFormForAlert = (alert: Notification) => {
    const mins = alert.stoppedDurationMinutes ?? 135;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const durText = m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
    const activeLateShipment = shipments.find(
      s => s.driverId === alert.driverId && (s.ontimeStatus === 'Late' || !s.isOnTime || s.status !== 'completed')
    );
    setLinkedNotifId(alert.id);
    setForm({
      driverId: alert.driverId,
      shipmentId: activeLateShipment?.id ?? '',
      eventDate: new Date().toISOString().slice(0, 10),
      eventTime: new Date().toTimeString().slice(0, 5),
      category: 'parkir_lama',
      location: alert.location ?? '',
      duration: durText,
      description: '',
      evidence: '',
    });
    setShowForm(true);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const notifIdParam = params.get('notificationId');
    if (notifIdParam) {
      const target = notifications.find(n => n.id === notifIdParam);
      if (target && !target.rcaSubmitted && !target.autoPunished) {
        openFormForAlert(target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = drivers.find(d => d.id === form.driverId);
  const events = rcaEvents.filter(
    e => (!isDriver || e.driverId === user?.driverId) && (!filter || e.verificationStatus === filter)
  );
  const pendingAlertsForDriver = isDriver
    ? notifications.filter(
      n => n.driverId === user?.driverId && n.requiresRca && !n.rcaSubmitted && !n.autoPunished
    )
    : [];
  const external = EXTERNAL_RCA_CATEGORIES.includes(form.category);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.driverId) return;
    addRCAEvent(
      {
        ...form,
        shipmentId: form.shipmentId || undefined,
        notificationId: linkedNotifId,
        evidence: form.evidence ? [form.evidence] : undefined,
      },
      actor
    );
    setShowForm(false);
    setLinkedNotifId(undefined);
    setUploadFeedback(null);
    setForm(f => ({ ...f, shipmentId: '', location: '', duration: '', description: '', evidence: '' }));
  };

  const vEvent = rcaEvents.find(e => e.id === verifyId);
  const vDriver = vEvent ? drivers.find(d => d.id === vEvent.driverId) : undefined;
  const vShipment = vEvent
    ? shipments.find(s => s.id === vEvent.shipmentId || s.rcaEventId === vEvent.id)
    : undefined;
  const driverShipmentsForForm = shipments.filter(s => !form.driverId || s.driverId === form.driverId);
  const cctvDriver = drivers.find(d => d.id === cctvDriverId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">RCA / Pencatatan Kejadian</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {isDriver
              ? 'Isi RCA untuk kejadian berhenti > 2 jam atau kendala operasional agar tidak terkena pengurangan poin otomatis.'
              : 'Verifikasi kesesuaian RCA driver dengan GPS & CCTV armada sebelum keputusan poin.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Semua Status</option>
            {Object.entries(VERIFICATION_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setLinkedNotifId(undefined);
              setUploadFeedback(null);
              setForm(f => ({ ...f, driverId: user?.driverId ?? '' }));
              setShowForm(true);
            }}
            className="bg-[#0f2b5b] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 font-medium"
          >
            <Plus size={16} /> Catat Kejadian
          </button>
        </div>
      </div>

      {/* Banner wajib isi RCA untuk driver yang berhenti > 2 jam */}
      {isDriver && pendingAlertsForDriver.length > 0 && (
        <div className="space-y-2">
          {pendingAlertsForDriver.map(alert => (
            <div
              key={alert.id}
              className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-800">{alert.title}</p>
                  <p className="text-xs text-red-700 mt-0.5">{alert.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openFormForAlert(alert)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg shrink-0"
              >
                Isi RCA Kejadian Ini
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {events.map(ev => (
          <div key={ev.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-mono text-gray-400">{ev.id} · {ev.eventDate} {ev.eventTime}</p>
                <p className="font-semibold text-gray-900 text-sm">{RCA_CATEGORY_LABELS[ev.category]}</p>
                <p className="text-xs text-gray-600">{ev.driverName} · {ev.vehiclePlate}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${VERIFICATION_STATUS_COLORS[ev.verificationStatus]}`}>
                {VERIFICATION_STATUS_LABELS[ev.verificationStatus]}
              </span>
            </div>

            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5">{ev.description}</p>

            {ev.evidence?.[0] && (
              <div className="pt-1">
                {isImageUrl(ev.evidence[0]) ? (
                  <a href={ev.evidence[0]} target="_blank" rel="noopener noreferrer" className="inline-block">
                    <img
                      src={ev.evidence[0]}
                      alt={`Bukti ${ev.id}`}
                      className="h-24 w-36 object-cover rounded-lg border border-gray-200"
                    />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                    <ImageIcon size={12} /> {ev.evidence[0]}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>Lokasi: <b>{ev.location}</b> ({ev.duration})</span>
              <span className="font-semibold text-red-600">{ev.pointsDeducted ? `-${ev.pointsDeducted} poin` : '0 poin'}</span>
            </div>

            {isAdmin && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setVerifyId(ev.id);
                    setVStatus(ev.verificationStatus);
                    setDecision(ev.controlTowerDecision ?? '');
                  }}
                  className="flex-1 bg-[#0f2b5b] text-white text-xs font-medium py-2 rounded-lg"
                >
                  Verifikasi RCA
                </button>
                <button
                  onClick={() => setCctvDriverId(ev.driverId)}
                  className="px-3 bg-slate-800 text-white text-xs font-medium py-2 rounded-lg inline-flex items-center gap-1"
                >
                  <Video size={13} /> CCTV
                </button>
              </div>
            )}
          </div>
        ))}
        {!events.length && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            Belum ada kejadian.
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              {['ID', 'Driver', 'Kendaraan', 'Waktu', 'Kategori', 'Lokasi', 'Durasi', 'Jenis', 'Status', 'Poin', 'Aksi'].map(h => (
                <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.id} className="border-t align-top hover:bg-blue-50/30">
                <td className="px-3 py-2.5 font-medium">{ev.id}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{ev.driverName}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{ev.vehiclePlate}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{ev.eventDate} {ev.eventTime}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{RCA_CATEGORY_LABELS[ev.category]}</td>
                <td className="px-3 py-2.5">{ev.location}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{ev.duration}</td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${ev.isExternalCause ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {ev.isExternalCause ? 'Eksternal' : 'Perlu cek driver'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${VERIFICATION_STATUS_COLORS[ev.verificationStatus]}`}>
                    {VERIFICATION_STATUS_LABELS[ev.verificationStatus]}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-semibold text-red-600">{ev.pointsDeducted ? `-${ev.pointsDeducted}` : '0'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setVerifyId(ev.id);
                          setVStatus(ev.verificationStatus);
                          setDecision(ev.controlTowerDecision ?? '');
                        }}
                        className="text-xs font-medium text-blue-700 hover:underline"
                      >
                        Verifikasi
                      </button>
                      <button
                        onClick={() => setCctvDriverId(ev.driverId)}
                        className="text-xs font-medium text-slate-700 hover:underline inline-flex items-center gap-1"
                        title="Cek CCTV Armada"
                      >
                        <Video size={13} /> CCTV
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!events.length && <tr><td colSpan={11} className="text-center text-gray-400 py-8">Belum ada kejadian.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Form Pencatatan RCA */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Form Pencatatan Kejadian (RCA)</h3>
              <button type="button" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            {linkedNotifId && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg p-2.5">
                Menjawab peringatan berhenti &gt; 2 jam ({linkedNotifId}). Setelah dikirim, status peringatan akan diperbarui dan menunggu verifikasi Admin.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label>Nama Driver
                <select required disabled={isDriver} value={form.driverId} onChange={e => setForm({ ...form, driverId: e.target.value, shipmentId: '' })} className="border rounded-lg px-3 py-2 w-full mt-1 bg-white">
                  <option value="">Pilih driver</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label>Surat Jalan / Shipment Terkait
                <select value={form.shipmentId} onChange={e => setForm({ ...form, shipmentId: e.target.value })} className="border rounded-lg px-3 py-2 w-full mt-1 bg-white">
                  <option value="">Otomatis / Tidak tertaut</option>
                  {driverShipmentsForForm.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.suratJalanNo} · {s.destination} ({s.ontimeStatus ?? (s.isOnTime ? 'Ontime' : 'Late')})
                    </option>
                  ))}
                </select>
              </label>
              <label>Nomor Kendaraan<input readOnly value={selected?.vehiclePlate ?? ''} className="border rounded-lg px-3 py-2 w-full mt-1 bg-gray-50" /></label>
              <label>Kategori RCA
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as RCACategory })} className="border rounded-lg px-3 py-2 w-full mt-1 bg-white">
                  {Object.entries(RCA_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>Tanggal<input type="date" required value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} className="border rounded-lg px-3 py-2 w-full mt-1" /></label>
              <label>Jam<input type="time" required value={form.eventTime} onChange={e => setForm({ ...form, eventTime: e.target.value })} className="border rounded-lg px-3 py-2 w-full mt-1" /></label>
              <label>Lokasi Kejadian<input required value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="border rounded-lg px-3 py-2 w-full mt-1" /></label>
              <label>Durasi Kejadian<input required placeholder="mis. 2 jam 15 menit" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} className="border rounded-lg px-3 py-2 w-full mt-1" /></label>
            </div>
            <label className="block text-sm">
              Kronologi / Alasan
              <textarea
                required
                rows={3}
                placeholder="Jelaskan alasan berhenti atau kendala yang terjadi secara jelas..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="border rounded-lg px-3 py-2 w-full mt-1"
              />
            </label>
            <label className="block text-sm">
              Upload Foto / Bukti (Supabase Storage)
              <input
                type="file"
                accept="image/*"
                disabled={uploadingPhoto}
                onChange={e => handleEvidenceFileChange(e.target.files?.[0])}
                className="border rounded-lg px-3 py-2 w-full mt-1"
              />
            </label>
            {uploadingPhoto && (
              <p className="text-xs text-blue-700 flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> Mengunggah foto ke bucket Supabase...
              </p>
            )}
            {uploadFeedback && (
              <p className={`text-xs rounded-lg px-2.5 py-2 ${uploadFeedback.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                {uploadFeedback.text}
              </p>
            )}
            {isImageUrl(form.evidence) && (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                <img
                  src={form.evidence}
                  alt="Preview bukti RCA"
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200 shrink-0"
                />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-gray-800">Foto Bukti Siap Dikirim</p>
                  {form.evidence.startsWith('http') && (
                    <a
                      href={form.evidence}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 underline break-all line-clamp-2"
                    >
                      {form.evidence}
                    </a>
                  )}
                </div>
              </div>
            )}
            <div className={`flex gap-2 text-xs rounded-lg p-3 ${external ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}>
              <Info size={16} className="shrink-0" />
              {external
                ? 'Kategori ini termasuk kendala eksternal: tidak mengurangi poin driver secara otomatis.'
                : 'Kategori ini akan diverifikasi oleh Admin Control Tower menggunakan data GPS & CCTV armada.'}
            </div>
            <button
              type="submit"
              disabled={uploadingPhoto}
              className="bg-[#0f2b5b] text-white px-4 py-2.5 rounded-lg text-sm w-full font-medium disabled:opacity-50"
            >
              {uploadingPhoto ? 'Menunggu Upload Foto...' : 'Simpan & Kirim RCA'}
            </button>
          </form>
        </div>
      )}

      {/* Modal Verifikasi Admin */}
      {vEvent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setVerifyId(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-3 text-sm max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#0f2b5b]" /> Verifikasi RCA {vEvent.id}
              </h3>
              <button onClick={() => setVerifyId(null)}><X size={18} /></button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
              <p><b>Driver:</b> {vEvent.driverName} ({vEvent.vehiclePlate})</p>
              <p><b>Kategori:</b> {RCA_CATEGORY_LABELS[vEvent.category]} · <b>Durasi:</b> {vEvent.duration}</p>
              <p><b>Lokasi Laporan:</b> {vEvent.location}</p>
              {vShipment && (
                <p>
                  <b>Shipment Terkait:</b> {vShipment.suratJalanNo} ({vShipment.origin} → {vShipment.destination}) · Status:{' '}
                  <span className={`font-semibold ${vShipment.ontimeStatus === 'Late' || !vShipment.isOnTime ? 'text-red-600' : 'text-emerald-700'}`}>
                    {vShipment.ontimeStatus ?? (vShipment.isOnTime ? 'Ontime' : 'Late')}
                  </span>
                </p>
              )}
              <p className="pt-1 text-gray-700"><b>Kronologi Sopir:</b> {vEvent.description}</p>
              {vEvent.evidence?.[0] && (
                <div className="pt-2">
                  <p className="font-semibold text-gray-700 mb-1">Foto Bukti Lapangan:</p>
                  {isImageUrl(vEvent.evidence[0]) ? (
                    <a href={vEvent.evidence[0]} target="_blank" rel="noopener noreferrer" className="inline-block">
                      <img
                        src={vEvent.evidence[0]}
                        alt={`Bukti ${vEvent.id}`}
                        className="max-h-40 rounded-lg border border-gray-200 object-cover"
                      />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-1 rounded">
                      <ImageIcon size={12} /> {vEvent.evidence[0]}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5 text-xs">
              <b>Ketentuan Sanksi:</b> Sanksi diberikan apabila pengiriman bernilai <b>Late</b> dan RCA terverifikasi sebagai <b>kesalahan driver</b>. Jika kendala eksternal / bukan kesalahan driver, <b>tidak dikenakan sanksi</b>.
            </div>

            {vDriver?.gps && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-semibold text-blue-900 flex items-center gap-1">
                    <MapPin size={13} /> Posisi GPS Armada: {vDriver.gps.locationName}
                  </p>
                  <p className="text-blue-700 font-mono">
                    {vDriver.gps.lat.toFixed(4)}, {vDriver.gps.lng.toFixed(4)} · Berhenti {vDriver.gps.stoppedMinutes} menit
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCctvDriverId(vDriver.id)}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1"
                >
                  <Video size={13} /> Cek CCTV
                </button>
              </div>
            )}

            {vEvent.isExternalCause && (
              <p className="text-xs bg-blue-50 text-blue-800 rounded p-2">
                Kendala eksternal: keputusan &quot;pelanggaran&quot; tidak akan mengurangi poin.
              </p>
            )}

            {/* Quick Verdict Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setVStatus('dikecualikan');
                  setDecision('RCA sesuai kondisi lapangan (terverifikasi GPS & CCTV) — dikecualikan.');
                }}
                className="flex items-center justify-center gap-1.5 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg px-3 py-2 text-xs font-semibold"
              >
                <CheckCircle2 size={14} /> Sesuai (Bebas Poin)
              </button>
              <button
                type="button"
                onClick={() => {
                  setVStatus('terverifikasi_pelanggaran');
                  setDecision('Alasan RCA tidak sesuai hasil cek GPS/CCTV — terbukti pelanggaran.');
                }}
                className="flex items-center justify-center gap-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 rounded-lg px-3 py-2 text-xs font-semibold"
              >
                <AlertTriangle size={14} /> Tidak Sesuai (Pelanggaran)
              </button>
            </div>

            <select
              value={vStatus}
              onChange={e => setVStatus(e.target.value as VerificationStatus)}
              className="border rounded-lg px-3 py-2 w-full bg-white"
            >
              {Object.entries(VERIFICATION_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <textarea
              value={decision}
              onChange={e => setDecision(e.target.value)}
              rows={3}
              placeholder="Catatan keputusan Control Tower"
              className="border rounded-lg px-3 py-2 w-full"
            />
            <button
              onClick={() => {
                verifyRCAEvent(vEvent.id, vStatus, decision, actor);
                setVerifyId(null);
              }}
              className="bg-[#0f2b5b] text-white px-4 py-2.5 rounded-lg w-full font-medium"
            >
              Simpan Keputusan Verifikasi
            </button>
          </div>
        </div>
      )}

      {/* Modal CCTV saat verifikasi RCA */}
      <ArmadaCctvModal
        driver={cctvDriver}
        onClose={() => setCctvDriverId(null)}
        onCaptureSnapshot={(drv, chLabel) => {
          addAudit('CCTV_SNAPSHOT', 'drivers', drv.id, `Snapshot CCTV (${chLabel}) diambil saat verifikasi RCA`, actor);
        }}
      />
    </div>
  );
}

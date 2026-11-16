'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar, CheckCircle2, Clock, Gift, Info, RefreshCw, ShieldAlert,
  ChevronDown, ChevronUp, Truck, AlertOctagon, PlusCircle,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { REWARD_STATUS_LABELS, type RewardStatus } from '@/lib/types';
import {
  buildDriverPeriodSummaries,
  collectAvailablePeriods,
  evaluateShipmentsForPeriod,
  extractDateOnly,
  formatRupiah,
  formatTravelDaysLabel,
  isDateInPeriod,
  LONG_STOP_PUNISHMENT_TIERS,
  ONTIME_REWARD_TIERS,
} from '@/lib/scoring';

const STATUS_COLOR: Record<RewardStatus, string> = {
  menunggu_persetujuan: 'bg-yellow-100 text-yellow-800',
  disetujui: 'bg-blue-100 text-blue-800',
  sudah_diberikan: 'bg-green-100 text-green-800',
};

const STOP_REASON_BADGE: Record<'pending' | 'valid_external' | 'unexplained', { label: string; cls: string }> = {
  pending: { label: 'Menunggu Alasan RCA', cls: 'bg-amber-100 text-amber-800' },
  valid_external: { label: 'Alasan Jelas / Eksternal', cls: 'bg-emerald-100 text-emerald-700' },
  unexplained: { label: 'Tanpa Alasan Jelas', cls: 'bg-red-100 text-red-700' },
};

export default function RewardPage() {
  const {
    drivers,
    shipments,
    rcaEvents,
    rewardTransactions,
    punishmentTransactions,
    rules,
    driverRewards,
    longStopIncidents,
    setDriverRewardStatus,
    finalizeRewardPeriod,
    recordLongStopIncident,
  } = useData();
  const { user, hasAnyRole, hasRole } = useAuth();
  const isDriver = hasRole('driver');
  const canApprove = hasAnyRole('admin', 'supervisor');
  const actor = user?.name ?? 'system';

  const [activeTab, setActiveTab] = useState<'ontime' | 'long_stop'>('ontime');
  const [showOntimeTable, setShowOntimeTable] = useState(true);
  const [toast, setToast] = useState('');

  // State simulasi catat berhenti lama (>2 jam) oleh Admin
  const [stopShipmentId, setStopShipmentId] = useState('');
  const [stopMinutes, setStopMinutes] = useState('140');
  const [stopLocation, setStopLocation] = useState('Rest Area KM 50 Tol');

  const availablePeriods = useMemo(() => {
    const dates = [
      ...shipments.map(s => s.arrivalUnloadDate || s.actualArrival || s.sanguTransferDate || s.departureTime),
      ...rewardTransactions.map(t => t.createdAt),
      ...punishmentTransactions.map(t => t.createdAt),
    ];
    return collectAvailablePeriods(dates);
  }, [shipments, rewardTransactions, punishmentTransactions]);

  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(() => availablePeriods[0]?.key ?? '');

  const activePeriod = useMemo(
    () => availablePeriods.find(p => p.key === selectedPeriodKey) ?? availablePeriods[0],
    [availablePeriods, selectedPeriodKey]
  );

  const periodSummaries = useMemo(() => {
    if (!activePeriod) return [];
    const list = buildDriverPeriodSummaries(
      drivers,
      shipments,
      rcaEvents,
      rewardTransactions,
      punishmentTransactions,
      rules,
      activePeriod
    );
    return isDriver
      ? list.filter(s => s.driver.id === user?.driverId)
      : list.filter(s => s.totalShipments > 0 || s.totalReward > 0 || s.totalSanction > 0);
  }, [drivers, shipments, rcaEvents, rewardTransactions, punishmentTransactions, rules, activePeriod, isDriver, user?.driverId]);

  const shipmentEvaluations = useMemo(() => {
    if (!activePeriod) return [];
    const list = evaluateShipmentsForPeriod(shipments, rcaEvents, punishmentTransactions, rules, activePeriod);
    return isDriver ? list.filter(e => e.shipment.driverId === user?.driverId) : list;
  }, [shipments, rcaEvents, punishmentTransactions, rules, activePeriod, isDriver, user?.driverId]);

  const periodSettlements = useMemo(() => {
    if (!activePeriod) return [];
    return driverRewards.filter(
      r =>
        (r.periodKey === activePeriod.key || r.period === activePeriod.label) &&
        (!isDriver || r.driverId === user?.driverId)
    );
  }, [driverRewards, activePeriod, isDriver, user?.driverId]);

  const periodTransactions = useMemo(() => {
    if (!activePeriod) return [];
    return [...rewardTransactions, ...punishmentTransactions]
      .filter(t => !isDriver || t.driverId === user?.driverId)
      .filter(t => t.type === 'reward' || t.categoryType !== 'long_stop')
      .filter(t => (t.periodKey ? t.periodKey === activePeriod.key : isDateInPeriod(t.createdAt, activePeriod)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [rewardTransactions, punishmentTransactions, activePeriod, isDriver, user?.driverId]);

  const visibleLongStopIncidents = useMemo(() => {
    return longStopIncidents
      .filter(inc => !isDriver || inc.driverId === user?.driverId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [longStopIncidents, isDriver, user?.driverId]);

  const totals = useMemo(() => {
    const ontime = shipmentEvaluations.filter(e => e.ontimeStatus === 'Ontime').length;
    const late = shipmentEvaluations.filter(e => e.ontimeStatus === 'Late').length;
    const lateDriverFault = shipmentEvaluations.filter(e => e.ontimeStatus === 'Late' && e.rcaFaultStatus === 'driver').length;
    const netAmount = periodSummaries.reduce((sum, s) => sum + s.netPeriodPoints, 0);
    return { ontime, late, lateDriverFault, netAmount };
  }, [shipmentEvaluations, periodSummaries]);

  const nextStatus: Record<RewardStatus, RewardStatus | null> = {
    menunggu_persetujuan: 'disetujui',
    disetujui: 'sudah_diberikan',
    sudah_diberikan: null,
  };

  const handleFinalize = () => {
    if (!activePeriod) return;
    finalizeRewardPeriod(activePeriod.key, actor);
    setToast(`Penjumlahan akhir periode ${activePeriod.label} berhasil diperbarui.`);
    setTimeout(() => setToast(''), 4000);
  };

  const handleAddLongStop = (e: React.FormEvent) => {
    e.preventDefault();
    const sh = shipments.find(s => s.id === stopShipmentId) ?? shipments[0];
    if (!sh) return;
    const mins = Math.max(121, Number(stopMinutes) || 135);
    const created = recordLongStopIncident(sh.driverId, mins, stopLocation, actor, sh.id);
    if (created) {
      setToast(
        `Punishment berhenti lama ke-${created.stopSequenceInShipment} dicatat pada ${created.shipmentCode} (${created.driverName}): ${created.punishmentTier}.`
      );
      setTimeout(() => setToast(''), 5000);
    }
  };

  const fmtDate = (d?: string) => {
    const ymd = extractDateOnly(d);
    if (!ymd) return '-';
    const [y, m, day] = ymd.split('-');
    return `${day}/${m}/${y}`;
  };

  const fmtDateTime = (d?: string) => {
    if (!d) return '-';
    const datePart = fmtDate(d);
    const timePart = d.includes('T') ? d.slice(11, 16) : '';
    return timePart ? `${datePart} ${timePart}` : datePart;
  };

  return (
    <div className="space-y-5">
      {/* Header & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {isDriver ? 'Reward & Punishment Saya' : 'Reward & Punishment Driver'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Terdiri dari 2 sistem terpisah: <b>Reward &amp; Sanksi Ontime Delivery</b> (periode Tgl 16 – 15, cair maks. Tgl 21) dan <b>Punishment Berhenti Lama (&gt; 2 Jam)</b>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs sm:text-sm">
            <Calendar size={15} className="text-[#0f2b5b] shrink-0" />
            <select
              value={activePeriod?.key ?? ''}
              onChange={e => setSelectedPeriodKey(e.target.value)}
              className="bg-transparent font-medium text-gray-800 focus:outline-none"
            >
              {availablePeriods.map(p => (
                <option key={p.key} value={p.key}>
                  Periode: {p.label}
                </option>
              ))}
            </select>
          </div>

          {canApprove && activePeriod && activeTab === 'ontime' && (
            <button
              type="button"
              onClick={handleFinalize}
              className="inline-flex items-center gap-1.5 bg-[#0f2b5b] hover:bg-[#1a3d7a] text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-lg"
            >
              <RefreshCw size={15} /> Hitung / Rekap Akhir Periode
            </button>
          )}
        </div>
      </div>

      {/* System Switcher Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setActiveTab('ontime')}
          className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-left transition-all ${
            activeTab === 'ontime'
              ? 'bg-[#0f2b5b] text-white border-[#0f2b5b] shadow-sm'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Gift size={18} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">1. Reward &amp; Sanksi Ontime Delivery</p>
              <p className={`text-[11px] truncate ${activeTab === 'ontime' ? 'text-blue-200' : 'text-gray-500'}`}>
                Berdasarkan standar hari pengiriman (Rp 25.000 – Rp 150.000)
              </p>
            </div>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${activeTab === 'ontime' ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {shipmentEvaluations.length} trip
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('long_stop')}
          className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-left transition-all ${
            activeTab === 'long_stop'
              ? 'bg-red-700 text-white border-red-700 shadow-sm'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertOctagon size={18} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">2. Punishment Berhenti Lama (&gt; 2 Jam)</p>
              <p className={`text-[11px] truncate ${activeTab === 'long_stop' ? 'text-red-100' : 'text-gray-500'}`}>
                Sistem terpisah · Eskalasi 1x s.d. &gt;6x dalam 1 pengiriman
              </p>
            </div>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${activeTab === 'long_stop' ? 'bg-white/15 text-white' : 'bg-red-50 text-red-700'}`}>
            {visibleLongStopIncidents.length} kejadian
          </span>
        </button>
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" /> {toast}
        </div>
      )}

      {activeTab === 'ontime' ? (
        <>
          {/* Banner Periode & Tabel Tier Ontime Delivery */}
          {activePeriod && (
            <div className="bg-gradient-to-r from-[#0f2b5b] to-[#1a3d7a] text-white rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-blue-200 font-semibold">
                    Periode Penilaian (Tgl 16 – Tgl 15)
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold mt-0.5">{activePeriod.label}</h2>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Ontime (&le; standar waktu): mendapat Reward sesuai tabel hari. Late (&gt; standar waktu) &amp; RCA kesalahan driver: terkena Sanksi sesuai tabel hari.
                  </p>
                </div>
                <div className="flex flex-col sm:items-end gap-1.5">
                  <span className="inline-flex items-center gap-1.5 bg-amber-400/20 border border-amber-300/40 text-amber-100 text-xs font-semibold px-3 py-1.5 rounded-full">
                    <Clock size={14} />
                    Jadwal Pencairan: {activePeriod.payoutDeadlineLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOntimeTable(s => !s)}
                    className="inline-flex items-center gap-1 text-xs text-blue-200 hover:text-white underline"
                  >
                    <Info size={13} />
                    {showOntimeTable ? 'Sembunyikan Tabel Tarif & Ketentuan' : 'Lihat Tabel Tarif Reward & Sanksi'}
                    {showOntimeTable ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {showOntimeTable && (
                <div className="pt-3 border-t border-white/15 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  <div className="bg-white/10 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 font-semibold bg-white/10 text-white">
                      Tabel Nilai Pencapaian Ontime Delivery
                    </div>
                    <table className="w-full text-xs">
                      <thead className="text-blue-200 border-b border-white/10">
                        <tr>
                          <th className="px-3 py-1.5 text-left">No</th>
                          <th className="px-3 py-1.5 text-left">Mulai (Hari)</th>
                          <th className="px-3 py-1.5 text-left">Sampai (Hari)</th>
                          <th className="px-3 py-1.5 text-right">Ontime</th>
                          <th className="px-3 py-1.5 text-right">Late (Salah Driver)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ONTIME_REWARD_TIERS.map(t => (
                          <tr key={t.no} className="border-t border-white/10">
                            <td className="px-3 py-1.5">{t.no}</td>
                            <td className="px-3 py-1.5">{t.minLabel}</td>
                            <td className="px-3 py-1.5">{t.maxLabel}</td>
                            <td className="px-3 py-1.5 text-right text-emerald-300 font-semibold">{formatRupiah(t.rewardAmount)}</td>
                            <td className="px-3 py-1.5 text-right text-red-200 font-semibold">-{formatRupiah(t.sanctionAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ol className="space-y-1 text-blue-100 list-decimal list-inside">
                    <li>Dihitung dari tanggal transfer sangu / berangkat ke lokasi bongkar s.d. tanggal armada tiba di lokasi bongkar.</li>
                    <li>Status bernilai <b>Ontime</b> (lama &le; standar waktu) atau <b>Late</b> (lama &gt; standar waktu).</li>
                    <li>Standar waktu ditentukan berdasarkan jarak rute (mis. Surabaya–Jakarta <b>1 hari / 24 jam</b>).</li>
                    <li>Bila <b>Ontime</b>, kolom RCA dan Keterangan dikosongkan dan driver mendapat Reward sesuai tabel hari.</li>
                    <li>Bila <b>Late</b> dan <b>RCA kesalahan driver</b>, dikenakan Sanksi sesuai tabel; bila bukan kesalahan driver maka <b>Rp 0</b>.</li>
                    <li>Setiap reward dan sanksi dijumlahkan di akhir periode (<b>Tgl 16 – Tgl 15</b>) dan dicairkan maksimal <b>Tgl 21</b>.</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* KPI Periode */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-3.5 sm:p-4">
              <p className="text-xs text-gray-500">Shipment Periode Ini</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{shipmentEvaluations.length}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{totals.ontime} Ontime · {totals.late} Late</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3.5 sm:p-4">
              <p className="text-xs text-gray-500">Shipment Ontime</p>
              <p className="text-xl font-bold text-emerald-700 mt-0.5">{totals.ontime}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Mendapat reward sesuai tier hari</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3.5 sm:p-4">
              <p className="text-xs text-gray-500">Late + Kesalahan Driver</p>
              <p className="text-xl font-bold text-red-600 mt-0.5">{totals.lateDriverFault}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Dari total {totals.late} shipment Late</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3.5 sm:p-4">
              <p className="text-xs text-gray-500">Total Net Ontime Delivery</p>
              <p className={`text-xl font-bold mt-0.5 ${totals.netAmount >= 0 ? 'text-[#0f2b5b]' : 'text-red-600'}`}>
                {formatRupiah(totals.netAmount, totals.netAmount > 0)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Penjumlahan Reward − Sanksi</p>
            </div>
          </div>

          {/* Penjumlahan Akhir Periode per Driver */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Penjumlahan Reward &amp; Sanksi Akhir Periode ({activePeriod?.label})
                </h2>
                <p className="text-xs text-gray-500">
                  Net Akhir Periode = Total Reward Ontime − Total Sanksi (Late &amp; RCA Kesalahan Driver).
                </p>
              </div>
              <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                Batas Pencairan: {activePeriod?.payoutDeadlineLabel}
              </span>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2.5">
              {periodSummaries.map((s, idx) => {
                const settlement = periodSettlements.find(r => r.driverId === s.driver.id);
                const next = settlement ? nextStatus[settlement.status] : null;
                return (
                  <div key={s.driver.id} className="border border-gray-200 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">#{idx + 1} {s.driver.name}</p>
                        <p className="text-gray-500">{s.driver.transporterName} · {s.driver.vehiclePlate}</p>
                      </div>
                      {settlement && (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[settlement.status]}`}>
                          {REWARD_STATUS_LABELS[settlement.status]}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-2.5">
                      <div><span className="text-gray-500 block">Ontime / Late</span><b>{s.ontimeCount} Ontime · {s.lateCount} Late</b></div>
                      <div><span className="text-gray-500 block">Total Hari Standar</span><b>{s.standardDaysOntime} hari</b></div>
                      <div><span className="text-gray-500 block">Total Reward</span><b className="text-emerald-700">{formatRupiah(s.totalReward, s.totalReward > 0)}</b></div>
                      <div><span className="text-gray-500 block">Total Sanksi</span><b className="text-red-600">{s.totalSanction > 0 ? `-${formatRupiah(s.totalSanction)}` : 'Rp 0'}</b></div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-semibold text-gray-700">
                        Net Akhir:{' '}
                        <b className={s.netPeriodPoints >= 0 ? 'text-[#0f2b5b]' : 'text-red-600'}>
                          {formatRupiah(s.netPeriodPoints, s.netPeriodPoints > 0)}
                        </b>
                      </span>
                      {canApprove && settlement && next && (
                        <button
                          onClick={() => setDriverRewardStatus(settlement.id, next, actor)}
                          className="bg-[#0f2b5b] text-white px-3 py-1.5 rounded-lg font-medium"
                        >
                          {settlement.status === 'menunggu_persetujuan' ? 'Setujui' : 'Tandai Dicairkan'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!periodSummaries.length && (
                <p className="text-center text-gray-400 py-6 text-sm">Belum ada shipment pada periode ini.</p>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    {[
                      'Rank', 'Driver', 'Mitra', 'Ontime', 'Late (Salah Driver)',
                      'Total Reward', 'Total Sanksi', 'Net Akhir Periode',
                      'Status Pencairan', 'Aksi',
                    ].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodSummaries.map((s, i) => {
                    const settlement = periodSettlements.find(r => r.driverId === s.driver.id);
                    const next = settlement ? nextStatus[settlement.status] : null;
                    return (
                      <tr key={s.driver.id} className="border-t hover:bg-blue-50/30">
                        <td className="px-3 py-2.5 font-bold">{i + 1}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-900">{s.driver.name}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{s.driver.transporterName}</td>
                        <td className="px-3 py-2.5 text-emerald-700 font-semibold">{s.ontimeCount}</td>
                        <td className="px-3 py-2.5">
                          <span className="text-gray-800">{s.lateCount}</span>{' '}
                          <span className="text-xs text-red-600">({s.lateDriverFaultCount} salah driver)</span>
                        </td>
                        <td className="px-3 py-2.5 text-emerald-700 font-semibold whitespace-nowrap">
                          {formatRupiah(s.totalReward, s.totalReward > 0)}
                        </td>
                        <td className="px-3 py-2.5 text-red-600 font-semibold whitespace-nowrap">
                          {s.totalSanction > 0 ? `-${formatRupiah(s.totalSanction)}` : 'Rp 0'}
                        </td>
                        <td className={`px-3 py-2.5 font-bold whitespace-nowrap ${s.netPeriodPoints >= 0 ? 'text-[#0f2b5b]' : 'text-red-600'}`}>
                          {formatRupiah(s.netPeriodPoints, s.netPeriodPoints > 0)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {settlement ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[settlement.status]}`}>
                              {REWARD_STATUS_LABELS[settlement.status]}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Belum direkap</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {canApprove && settlement && next ? (
                            <button
                              onClick={() => setDriverRewardStatus(settlement.id, next, actor)}
                              className="text-xs bg-[#0f2b5b] hover:bg-[#1a3d7a] text-white px-2.5 py-1 rounded-lg font-medium"
                            >
                              {settlement.status === 'menunggu_persetujuan' ? 'Setujui' : 'Tandai Dicairkan'}
                            </button>
                          ) : settlement?.paidAt ? (
                            <span className="text-xs text-emerald-700">Cair {fmtDate(settlement.paidAt)}</span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!periodSummaries.length && (
                    <tr>
                      <td colSpan={10} className="text-center text-gray-400 py-6">
                        Belum ada shipment pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Rincian Perhitungan Per Shipment */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Truck size={17} className="text-[#0f2b5b]" />
                Rincian Perhitungan Ontime Delivery per Shipment
              </h2>
              <p className="text-xs text-gray-500">
                Menampilkan <b>Kode Shipment</b>, <b>Standar Waktu Jarak</b>, <b>Tanggal &amp; Jam Tiba</b>, serta kolom <b>RCA</b> dan <b>Keterangan</b> (hanya terisi jika <b>Late</b>; kosong bila <b>Ontime</b>).
              </p>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2.5">
              {shipmentEvaluations.map(ev => (
                <div key={ev.shipment.id} className="border border-gray-200 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold font-mono text-[#0f2b5b]">{ev.shipment.suratJalanNo}</p>
                      <p className="text-gray-700 font-medium">{ev.shipment.driverName}</p>
                      <p className="text-gray-500">{ev.shipment.origin} → {ev.shipment.destination}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ev.ontimeStatus === 'Ontime' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {ev.ontimeStatus}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 bg-gray-50 rounded-lg p-2">
                    <span>Standar Jarak: <b>{ev.standardDays} hari ({ev.standardHours} jam)</b></span>
                    <span>Aktual: <b>{formatTravelDaysLabel(ev.actualDays)}</b></span>
                    <span>Sangu/Berangkat: <b>{fmtDateTime(ev.shipment.sanguTransferDate || ev.shipment.departureTime)}</b></span>
                    <span>Tiba (Tgl &amp; Jam): <b>{fmtDateTime(ev.shipment.arrivalUnloadDate || ev.shipment.actualArrival)}</b></span>
                  </div>
                  {ev.ontimeStatus === 'Late' && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-2 space-y-1">
                      <p><b>RCA:</b> {ev.rcaDisplay}</p>
                      <p className="text-gray-700"><b>Keterangan:</b> {ev.keteranganDisplay}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-gray-500">Nilai Reward / Sanksi</span>
                    <span className={`font-bold ${ev.netPoints > 0 ? 'text-emerald-700' : ev.netPoints < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {ev.rewardPoints > 0
                        ? formatRupiah(ev.rewardPoints, true)
                        : ev.sanctionPoints > 0
                        ? `-${formatRupiah(ev.sanctionPoints)}`
                        : 'Rp 0'}
                    </span>
                  </div>
                </div>
              ))}
              {!shipmentEvaluations.length && (
                <p className="text-center text-gray-400 py-5 text-sm">Tidak ada shipment pada periode ini.</p>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    {[
                      'Kode Shipment', 'Driver', 'Rute & Standar Waktu', 'Tgl Berangkat / Sangu',
                      'Tgl & Jam Tiba', 'Aktual', 'Status', 'RCA (Jika Late)',
                      'Keterangan (Jika Late)', 'Nilai (Rp)',
                    ].map(h => (
                      <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shipmentEvaluations.map(ev => (
                    <tr key={ev.shipment.id} className="border-t hover:bg-blue-50/30 align-top">
                      <td className="px-3 py-2.5 font-mono font-semibold text-[#0f2b5b] whitespace-nowrap">
                        {ev.shipment.suratJalanNo}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{ev.shipment.driverName}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-medium text-gray-800">{ev.shipment.origin} – {ev.shipment.destination}</span>
                        <span className="block text-xs text-blue-700 font-semibold">
                          Standar: {ev.standardDays} hari ({ev.standardHours} jam)
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                        {fmtDateTime(ev.shipment.sanguTransferDate || ev.shipment.departureTime)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs font-medium text-gray-800">
                        {fmtDateTime(ev.shipment.arrivalUnloadDate || ev.shipment.actualArrival)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">{formatTravelDaysLabel(ev.actualDays)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ev.ontimeStatus === 'Ontime' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {ev.ontimeStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {ev.ontimeStatus === 'Late' ? (
                          <span className={`inline-block px-2 py-0.5 rounded font-medium ${
                            ev.rcaFaultStatus === 'driver'
                              ? 'bg-red-100 text-red-700'
                              : ev.rcaFaultStatus === 'external'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {ev.rcaDisplay}
                          </span>
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 max-w-xs">
                        {ev.ontimeStatus === 'Late' ? ev.keteranganDisplay : ''}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-bold">
                        {ev.rewardPoints > 0 ? (
                          <span className="text-emerald-700">{formatRupiah(ev.rewardPoints, true)}</span>
                        ) : ev.sanctionPoints > 0 ? (
                          <span className="text-red-600">-{formatRupiah(ev.sanctionPoints)}</span>
                        ) : (
                          <span className="text-gray-400">Rp 0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!shipmentEvaluations.length && (
                    <tr>
                      <td colSpan={10} className="text-center text-gray-400 py-6">
                        Tidak ada shipment pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Persetujuan & Riwayat Transaksi Ontime Delivery */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Gift size={16} className="text-[#0f2b5b]" />
                  Rekap Pencairan Periode (Maks. Tgl 21)
                </h2>
                {canApprove && (
                  <Link href="/settings" className="text-xs font-medium text-blue-600 hover:underline">
                    Pengaturan
                  </Link>
                )}
              </div>
              <div className="space-y-2.5">
                {periodSettlements.map(r => (
                  <div key={r.id} className="border border-gray-200 rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-semibold text-sm">{r.driverName}</p>
                        <p className="text-xs text-gray-500">
                          {r.period} · {r.payoutDeadline ? `Maks. cair ${fmtDate(r.payoutDeadline)}` : 'Maks. tgl 21'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.status]}`}>
                        {REWARD_STATUS_LABELS[r.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Ontime {r.onTimeDeliveries}/{r.totalDeliveries}
                      {r.totalReward !== undefined ? ` · Reward ${formatRupiah(r.totalReward, true)}` : ''}
                      {r.totalSanction !== undefined && r.totalSanction > 0 ? ` · Sanksi -${formatRupiah(r.totalSanction)}` : ''} ·{' '}
                      <b className="text-[#0f2b5b]">Net {formatRupiah(r.rewardPoints, r.rewardPoints > 0)}</b>
                    </p>
                    {canApprove && nextStatus[r.status] && (
                      <button
                        onClick={() => setDriverRewardStatus(r.id, nextStatus[r.status] as RewardStatus, actor)}
                        className="self-start text-xs bg-[#0f2b5b] text-white px-3 py-1.5 rounded-lg font-medium"
                      >
                        {r.status === 'menunggu_persetujuan' ? 'Setujui Pencairan' : 'Tandai Sudah Dicairkan'}
                      </button>
                    )}
                  </div>
                ))}
                {!periodSettlements.length && (
                  <p className="text-gray-400 text-sm py-4 text-center">
                    Belum ada rekap pencairan untuk periode ini.
                  </p>
                )}
              </div>
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-600" />
                Riwayat Transaksi Ontime Delivery Periode Ini
              </h2>
              <ul className="divide-y text-sm max-h-96 overflow-y-auto">
                {periodTransactions.map(t => (
                  <li key={t.id} className="py-2.5 flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-gray-800 font-medium text-xs sm:text-sm">
                        {t.driverName} — {t.reason}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {new Date(t.createdAt).toLocaleString('id-ID')} · {t.createdBy}
                      </p>
                    </div>
                    <b className={`shrink-0 whitespace-nowrap ${t.type === 'reward' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {t.type === 'reward' ? formatRupiah(t.points, true) : `-${formatRupiah(t.points)}`}
                    </b>
                  </li>
                ))}
                {!periodTransactions.length && (
                  <li className="py-6 text-center text-gray-400 text-sm">Belum ada transaksi Ontime Delivery pada periode ini.</li>
                )}
              </ul>
            </section>
          </div>
        </>
      ) : (
        /* TAB 2: SISTEM PUNISHMENT BERHENTI LAMA (> 2 JAM) — TERPISAH DARI ONTIME/LATE */
        <div className="space-y-5">
          {/* Ketentuan & Tabel Eskalasi */}
          <div className="bg-white rounded-xl border border-red-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full">
                  Sistem Punishment Terpisah (Non-Ontime/Late)
                </span>
                <h2 className="text-lg font-bold text-gray-900 mt-1">
                  Punishment Driver Berhenti Lama (&gt; 2 Jam)
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Berlaku ketika driver berhenti lama <b>&gt; 2 jam</b>, terjadi <b>&gt; 1x dalam 1 pengiriman</b> (eskalasi tegas saat <b>&gt; 3x</b>), dan <b>tidak memberikan alasan yang jelas</b>.
                </p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-900 space-y-1 max-w-sm">
                <p className="font-bold">Ketentuan Punishment Driver Berhenti Lama:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Driver berhenti lama lebih dari <b>2 jam</b>.</li>
                  <li>Driver berhenti lama <b>lebih dari 1x</b> dalam 1 pengiriman (eskalasi bertahap hingga &gt; 3x &amp; &gt; 6x).</li>
                  <li>Driver <b>tidak memberikan alasan yang jelas</b>.</li>
                </ol>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-[#2c5282] text-white text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2.5 text-left w-12">No</th>
                    <th className="px-3 py-2.5 text-left whitespace-nowrap">Total Berhenti Lama &gt; 2 Jam</th>
                    <th className="px-3 py-2.5 text-left">Punishment</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Pengurangan Poin</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Denda Tambahan</th>
                  </tr>
                </thead>
                <tbody>
                  {LONG_STOP_PUNISHMENT_TIERS.map(tier => (
                    <tr key={tier.no} className="border-t even:bg-slate-50/70">
                      <td className="px-3 py-2 font-semibold">{tier.no}</td>
                      <td className="px-3 py-2 font-bold text-[#0f2b5b]">{tier.countLabel}</td>
                      <td className="px-3 py-2 text-gray-800">{tier.punishmentLabel}</td>
                      <td className="px-3 py-2 text-right font-semibold text-red-600">
                        {tier.pointsDeducted > 0 ? `-${tier.pointsDeducted} poin` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-red-700">
                        {tier.fineAmount > 0 ? formatRupiah(tier.fineAmount) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Admin Quick Recorder untuk uji eskalasi 1x..>6x per shipment */}
          {canApprove && (
            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                <PlusCircle size={16} className="text-red-600" />
                Catat Kejadian Berhenti Lama (&gt; 2 Jam) Tanpa Alasan Jelas (Admin)
              </h3>
              <form onSubmit={handleAddLongStop} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs sm:text-sm">
                <select
                  value={stopShipmentId || shipments[0]?.id || ''}
                  onChange={e => setStopShipmentId(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 bg-white sm:col-span-2"
                >
                  {shipments.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.suratJalanNo} — {s.driverName} ({s.origin} → {s.destination})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={121}
                  value={stopMinutes}
                  onChange={e => setStopMinutes(e.target.value)}
                  placeholder="Durasi (menit > 120)"
                  className="border border-gray-200 rounded-lg px-3 py-2"
                />
                <input
                  value={stopLocation}
                  onChange={e => setStopLocation(e.target.value)}
                  placeholder="Lokasi berhenti"
                  className="border border-gray-200 rounded-lg px-3 py-2"
                />
                <button
                  type="submit"
                  className="sm:col-span-4 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg text-xs sm:text-sm"
                >
                  Catat &amp; Terapkan Eskalasi Punishment Berhenti Lama
                </button>
              </form>
            </section>
          )}

          {/* Daftar Pelanggaran Berhenti Lama per Shipment */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-gray-900">
                Riwayat Punishment Berhenti Lama (&gt; 2 Jam) per Pengiriman
              </h3>
              <p className="text-xs text-gray-500">
                Dihitung akumulatif per <b>Kode Shipment</b> untuk kejadian berhenti &gt; 2 jam tanpa alasan yang jelas.
              </p>
            </div>

            <div className="md:hidden space-y-2.5">
              {visibleLongStopIncidents.map(inc => {
                const badge = STOP_REASON_BADGE[inc.reasonStatus];
                return (
                  <div key={inc.id} className="border border-gray-200 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[#0f2b5b]">{inc.shipmentCode}</span>
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                        Ke-{inc.stopSequenceInShipment}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">{inc.driverName} · {inc.vehiclePlate}</p>
                    <p className="text-gray-500">{inc.location} · {inc.stoppedMinutes} menit · {fmtDateTime(inc.occurredAt)}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <p className="text-gray-800 bg-red-50 rounded-lg p-2">
                      <b>Punishment:</b> {inc.punishmentTier}
                    </p>
                  </div>
                );
              })}
              {!visibleLongStopIncidents.length && (
                <p className="text-center text-gray-400 py-6 text-sm">Belum ada pelanggaran berhenti lama.</p>
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    {[
                      'Kode Shipment', 'Driver', 'Waktu Kejadian', 'Lokasi', 'Durasi',
                      'Frekuensi', 'Status Alasan', 'Punishment', 'Dampak Poin / Denda',
                    ].map(h => (
                      <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleLongStopIncidents.map(inc => {
                    const badge = STOP_REASON_BADGE[inc.reasonStatus];
                    return (
                      <tr key={inc.id} className="border-t hover:bg-red-50/20">
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#0f2b5b] whitespace-nowrap">
                          {inc.shipmentCode}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-medium">{inc.driverName}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">{fmtDateTime(inc.occurredAt)}</td>
                        <td className="px-3 py-2.5 text-xs">{inc.location}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs font-medium">{inc.stoppedMinutes} menit</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            inc.stopSequenceInShipment >= 4
                              ? 'bg-red-100 text-red-700'
                              : inc.stopSequenceInShipment === 3
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {inc.stopSequenceInShipment}x
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-800">{inc.punishmentTier}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs font-bold text-red-600">
                          {inc.pointsDeducted > 0 || inc.fineAmount > 0
                            ? `${inc.pointsDeducted > 0 ? `-${inc.pointsDeducted} poin` : ''}${inc.pointsDeducted > 0 && inc.fineAmount > 0 ? ' · ' : ''}${inc.fineAmount > 0 ? formatRupiah(inc.fineAmount) : ''}`
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {!visibleLongStopIncidents.length && (
                    <tr>
                      <td colSpan={9} className="text-center text-gray-400 py-6">
                        Belum ada pelanggaran berhenti lama.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

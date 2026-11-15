'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar, CheckCircle2, Clock, Gift, Info, RefreshCw, ShieldAlert,
  ChevronDown, ChevronUp, Truck,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { REWARD_STATUS_LABELS, type RewardStatus } from '@/lib/types';
import {
  buildDriverPeriodSummaries,
  collectAvailablePeriods,
  evaluateShipmentsForPeriod,
  extractDateOnly,
  formatTravelDaysLabel,
  getRewardPerDayPoints,
  getTopRankBonusConfig,
  isDateInPeriod,
} from '@/lib/scoring';

const STATUS_COLOR: Record<RewardStatus, string> = {
  menunggu_persetujuan: 'bg-yellow-100 text-yellow-800',
  disetujui: 'bg-blue-100 text-blue-800',
  sudah_diberikan: 'bg-green-100 text-green-800',
};

const FAULT_BADGE: Record<'none' | 'driver' | 'external' | 'pending', { label: string; cls: string }> = {
  none: { label: 'Tidak perlu RCA', cls: 'bg-gray-100 text-gray-600' },
  driver: { label: 'RCA Kesalahan Driver (Kena Sanksi)', cls: 'bg-red-100 text-red-700' },
  external: { label: 'Bukan Kesalahan Driver (Bebas Sanksi)', cls: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'Menunggu Verifikasi RCA', cls: 'bg-amber-100 text-amber-800' },
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
    setDriverRewardStatus,
    finalizeRewardPeriod,
  } = useData();
  const { user, hasAnyRole, hasRole } = useAuth();
  const isDriver = hasRole('driver');
  const canApprove = hasAnyRole('admin', 'supervisor');
  const actor = user?.name ?? 'system';

  const [showRules, setShowRules] = useState(false);
  const [toast, setToast] = useState('');

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

  const pointsPerDay = useMemo(() => getRewardPerDayPoints(rules), [rules]);
  const topRankBonusCfg = useMemo(() => getTopRankBonusConfig(rules), [rules]);

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
      .filter(t => (t.periodKey ? t.periodKey === activePeriod.key : isDateInPeriod(t.createdAt, activePeriod)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [rewardTransactions, punishmentTransactions, activePeriod, isDriver, user?.driverId]);

  const totals = useMemo(() => {
    const ontime = shipmentEvaluations.filter(e => e.ontimeStatus === 'Ontime').length;
    const late = shipmentEvaluations.filter(e => e.ontimeStatus === 'Late').length;
    const lateDriverFault = shipmentEvaluations.filter(e => e.ontimeStatus === 'Late' && e.rcaFaultStatus === 'driver').length;
    const netPoints = periodSummaries.reduce((sum, s) => sum + s.netPeriodPoints, 0);
    return { ontime, late, lateDriverFault, netPoints };
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

  const fmtDate = (d?: string) => {
    const ymd = extractDateOnly(d);
    if (!ymd) return '-';
    const [y, m, day] = ymd.split('-');
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="space-y-5">
      {/* Header & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {isDriver ? 'Reward & Sanksi Ontime Delivery Saya' : 'Reward & Sanksi Ontime Delivery'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Periode cut-off tanggal 16 s.d. tanggal 15 bulan berikutnya · Pencairan maksimal tanggal 21 setiap bulan.
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

          {canApprove && activePeriod && (
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

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      {/* Info Periode & Ketentuan Ringkas */}
      {activePeriod && (
        <div className="bg-gradient-to-r from-[#0f2b5b] to-[#1a3d7a] text-white rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-blue-200 font-semibold">
                Periode Penilaian (Tgl 16 – Tgl 15)
              </span>
              <h2 className="text-lg sm:text-xl font-bold mt-0.5">{activePeriod.label}</h2>
              <p className="text-xs text-blue-100 mt-0.5">
                Tarif dasar <b className="text-white">{pointsPerDay} poin/hr</b> (skala jarak: ≤100 Km ×1 · 101–250 Km ×1.5 · 251–400 Km ×2 · &gt;400 Km ×2.5) ·{' '}
                {topRankBonusCfg.isActive && (
                  <>
                    <b className="text-amber-200">Peringkat 1–{topRankBonusCfg.maxRank}: +{topRankBonusCfg.points} bonus</b> ·{' '}
                  </>
                )}
                Sisanya tetap mendapat reward selama <b>Ontime</b> · Wajib istirahat per 2 jam / 100 Km.
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-1.5">
              <span className="inline-flex items-center gap-1.5 bg-amber-400/20 border border-amber-300/40 text-amber-100 text-xs font-semibold px-3 py-1.5 rounded-full">
                <Clock size={14} />
                Jadwal Pencairan: {activePeriod.payoutDeadlineLabel}
              </span>
              <button
                type="button"
                onClick={() => setShowRules(s => !s)}
                className="inline-flex items-center gap-1 text-xs text-blue-200 hover:text-white underline"
              >
                <Info size={13} />
                {showRules ? 'Sembunyikan Ketentuan (10 Poin)' : 'Lihat Ketentuan Konsep Reward & Sanksi'}
                {showRules ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          </div>

          {showRules && (
            <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-blue-100 pt-3 border-t border-white/15 list-decimal list-inside">
              <li>Dihitung dari tanggal transfer sangu / berangkat ke lokasi bongkar s.d. tanggal armada tiba di lokasi bongkar.</li>
              <li>Ontime Delivery bernilai <b>Ontime</b> dan <b>Late</b>.</li>
              <li>Bernilai <b>Ontime</b> jika lama perjalanan &le; standar waktu yang ditentukan perusahaan.</li>
              <li>Bernilai <b>Late</b> jika lama perjalanan &gt; standar waktu yang ditentukan perusahaan.</li>
              <li><b>Reward</b> diberikan apabila Ontime Delivery bernilai <b>Ontime</b> (disesuaikan jarak tujuan). Peringkat <b>1–{topRankBonusCfg.maxRank}</b> mendapat <b>reward tambahan +{topRankBonusCfg.points} poin</b>, sisanya tetap mendapat reward selama Ontime.</li>
              <li><b>Sanksi (Punishment)</b> diberikan apabila <b>Late</b> (disesuaikan jarak tujuan) dan <b>RCA kesalahan driver</b>, atau <b>driver nakal</b> berhenti &gt; 2 jam tanpa alasan / melanggar istirahat wajib 2 jam per 100 Km.</li>
              <li>Periode perhitungan mulai <b>tanggal 16 bulan jalan s.d. tanggal 15 bulan berikutnya</b>.</li>
              <li>Reward dihitung berdasarkan <b>lamanya standar waktu (hari)</b> di setiap shipment.</li>
              <li>Setiap reward dan sanksi dilakukan <b>penjumlahan di akhir periode</b>.</li>
              <li>Proses <b>pencairan reward</b> dilakukan maksimal <b>tanggal 21 setiap bulannya</b>.</li>
            </ol>
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
          <p className="text-[11px] text-gray-400 mt-0.5">Mendapat reward per hari standar</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3.5 sm:p-4">
          <p className="text-xs text-gray-500">Late + Kesalahan Driver</p>
          <p className="text-xl font-bold text-red-600 mt-0.5">{totals.lateDriverFault}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Dari total {totals.late} shipment Late</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3.5 sm:p-4">
          <p className="text-xs text-gray-500">Total Net Akhir Periode</p>
          <p className={`text-xl font-bold mt-0.5 ${totals.netPoints >= 0 ? 'text-[#0f2b5b]' : 'text-red-600'}`}>
            {totals.netPoints >= 0 ? `+${totals.netPoints}` : totals.netPoints} poin
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
              Total Akhir = (Hari Standar Ontime × Tarif Jarak + Bonus Peringkat 1–{topRankBonusCfg.maxRank}) − Total Sanksi (Late &amp; Driver Nakal &gt; 2 Jam).
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-bold text-gray-900 text-sm">#{s.rank ?? idx + 1} {s.driver.name}</p>
                      {s.isTop20 && s.rankBonusPoints > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                          Top 1–20 (+{s.rankBonusPoints})
                        </span>
                      ) : s.ontimeCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                          Reward Ontime Reguler
                        </span>
                      ) : null}
                    </div>
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
                  <div><span className="text-gray-500 block">Standar Hari (Ontime)</span><b>{s.standardDaysOntime} hari</b></div>
                  <div><span className="text-gray-500 block">Total Reward</span><b className="text-emerald-700">+{s.totalReward}</b></div>
                  <div><span className="text-gray-500 block">Total Sanksi</span><b className="text-red-600">-{s.totalSanction}</b></div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold text-gray-700">
                    Net Akhir Periode:{' '}
                    <b className={s.netPeriodPoints >= 0 ? 'text-[#0f2b5b]' : 'text-red-600'}>
                      {s.netPeriodPoints >= 0 ? `+${s.netPeriodPoints}` : s.netPeriodPoints} poin
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
            <p className="text-center text-gray-400 py-6 text-sm">Belum ada shipment atau transaksi pada periode ini.</p>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                {[
                  'Rank', 'Driver', 'Kategori Peringkat', 'Ontime', 'Late (Salah Driver)',
                  'Hari Standar', 'Bonus Top 1–20', 'Total Reward', 'Total Sanksi', 'Net Periode',
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
                    <td className="px-3 py-2.5 font-bold">#{s.rank ?? i + 1}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <p className="font-medium text-gray-900">{s.driver.name}</p>
                      <p className="text-[11px] text-gray-400">{s.driver.transporterName}</p>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {s.isTop20 && s.rankBonusPoints > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                          Peringkat 1–20 (+Bonus)
                        </span>
                      ) : s.ontimeCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">
                          Reguler Ontime (Reward)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700">
                          Late / Punishment
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-emerald-700 font-semibold">{s.ontimeCount}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-gray-800">{s.lateCount}</span>{' '}
                      <span className="text-xs text-red-600">({s.lateDriverFaultCount} salah driver)</span>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{s.standardDaysOntime} hr</td>
                    <td className="px-3 py-2.5 font-semibold text-amber-700">
                      {s.rankBonusPoints > 0 ? `+${s.rankBonusPoints}` : '0'}
                    </td>
                    <td className="px-3 py-2.5 text-emerald-700 font-semibold">+{s.totalReward}</td>
                    <td className="px-3 py-2.5 text-red-600 font-semibold">-{s.totalSanction}</td>
                    <td className={`px-3 py-2.5 font-bold ${s.netPeriodPoints >= 0 ? 'text-[#0f2b5b]' : 'text-red-600'}`}>
                      {s.netPeriodPoints >= 0 ? `+${s.netPeriodPoints}` : s.netPeriodPoints}
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
                  <td colSpan={12} className="text-center text-gray-400 py-6">
                    Belum ada shipment atau transaksi pada periode ini.
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
            Dihitung dari <b>Tgl Transfer Sangu / Berangkat</b> s.d. <b>Tgl Armada Tiba di Lokasi Bongkar</b> dibandingkan <b>Standar Waktu (Hari)</b>.
          </p>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2.5">
          {shipmentEvaluations.map(ev => {
            const fault = FAULT_BADGE[ev.rcaFaultStatus];
            return (
              <div key={ev.shipment.id} className="border border-gray-200 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900">{ev.shipment.suratJalanNo}</p>
                    <p className="text-gray-500">{ev.shipment.driverName} · {ev.shipment.origin} → {ev.shipment.destination}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ev.ontimeStatus === 'Ontime' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {ev.ontimeStatus}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 bg-gray-50 rounded-lg p-2">
                  <span>Sangu/Berangkat: <b>{fmtDate(ev.shipment.sanguTransferDate || ev.shipment.departureTime)}</b></span>
                  <span>Tiba Bongkar: <b>{fmtDate(ev.shipment.arrivalUnloadDate || ev.shipment.actualArrival)}</b></span>
                  <span>Jarak Tujuan: <b>{ev.distanceKm} Km</b></span>
                  <span>Tier Jarak: <b>{ev.distanceTier.label}</b></span>
                  <span>Standar / Aktual: <b>{ev.standardDays} hr / {formatTravelDaysLabel(ev.actualDays)}</b></span>
                  <span>Wajib Istirahat: <b>{ev.distanceTier.requiredRestStops}× (per 100 Km)</b></span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${fault.cls}`}>{fault.label}</span>
                  <span className={`font-bold ${ev.netPoints > 0 ? 'text-emerald-700' : ev.netPoints < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {ev.netPoints > 0 ? `+${ev.netPoints}` : ev.netPoints} poin
                  </span>
                </div>
              </div>
            );
          })}
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
                  'Surat Jalan', 'Driver', 'Rute & Jarak', 'Tgl Sangu / Berangkat',
                  'Tgl Tiba Bongkar', 'Standar / Aktual', 'Nilai',
                  'Status RCA', 'Reward / Sanksi (Skala Jarak)',
                ].map(h => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shipmentEvaluations.map(ev => {
                const fault = FAULT_BADGE[ev.rcaFaultStatus];
                return (
                  <tr key={ev.shipment.id} className="border-t hover:bg-blue-50/30">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{ev.shipment.suratJalanNo}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{ev.shipment.driverName}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                      <p>{ev.shipment.origin} → {ev.shipment.destination}</p>
                      <p className="text-[11px] text-blue-700 font-medium">
                        {ev.distanceKm} Km · {ev.distanceTier.label}
                      </p>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtDate(ev.shipment.sanguTransferDate || ev.shipment.departureTime)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtDate(ev.shipment.arrivalUnloadDate || ev.shipment.actualArrival)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <b>{ev.standardDays} hr</b> / {formatTravelDaysLabel(ev.actualDays)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        ev.ontimeStatus === 'Ontime' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {ev.ontimeStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${fault.cls}`}>
                        {fault.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-bold">
                      {ev.rewardPoints > 0 ? (
                        <span className="text-emerald-700">
                          +{ev.rewardPoints} ({ev.standardDays} hr × {ev.distanceTier.rewardPerDay}/hr)
                        </span>
                      ) : ev.sanctionPoints > 0 ? (
                        <span className="text-red-600">-{ev.sanctionPoints} (Sanksi Jarak)</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!shipmentEvaluations.length && (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-6">
                    Tidak ada shipment pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Persetujuan & Jadwal Pencairan + Riwayat Transaksi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Gift size={16} className="text-[#0f2b5b]" />
              Rekap Pencairan Periode (Maks. Tgl 21)
            </h2>
            {canApprove && (
              <Link href="/settings" className="text-xs font-medium text-blue-600 hover:underline">
                Atur Tarif Poin
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
                  {r.standardDaysTotal ? ` · ${r.standardDaysTotal} hr standar` : ''}
                  {r.totalReward !== undefined ? ` · Reward +${r.totalReward}` : ''}
                  {r.totalSanction !== undefined ? ` · Sanksi -${r.totalSanction}` : ''} ·{' '}
                  <b className="text-[#0f2b5b]">Net {r.rewardPoints >= 0 ? `+${r.rewardPoints}` : r.rewardPoints} poin</b>
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
                Belum ada rekap pencairan untuk periode ini.{canApprove ? ' Klik "Hitung / Rekap Akhir Periode" di atas.' : ''}
              </p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-600" />
            Riwayat Reward &amp; Sanksi Periode Ini
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
                <b className={`shrink-0 ${t.type === 'reward' ? 'text-emerald-700' : 'text-red-600'}`}>
                  {t.type === 'reward' ? `+${t.points}` : `-${t.points}`}
                </b>
              </li>
            ))}
            {!periodTransactions.length && (
              <li className="py-6 text-center text-gray-400 text-sm">Belum ada transaksi poin pada periode ini.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

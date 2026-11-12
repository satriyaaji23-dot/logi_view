'use client';

import React from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { REWARD_STATUS_LABELS, type RewardStatus } from '@/lib/types';

const STATUS_COLOR: Record<RewardStatus, string> = {
  menunggu_persetujuan: 'bg-yellow-100 text-yellow-800', disetujui: 'bg-blue-100 text-blue-800', sudah_diberikan: 'bg-green-100 text-green-800',
};

export default function RewardPage() {
  const { drivers, driverRewards, rewardTransactions, setDriverRewardStatus } = useData();
  const { user, hasAnyRole, hasRole } = useAuth();
  const isDriver = hasRole('driver');
  const canApprove = hasAnyRole('admin', 'supervisor');
  const actor = user?.name ?? 'system';

  const rewards = driverRewards.filter(r => !isDriver || r.driverId === user?.driverId);
  const txs = rewardTransactions.filter(t => !isDriver || t.driverId === user?.driverId);
  const eligible = [...drivers].filter(d => d.onTimePercentage >= 95 && d.validViolations <= 2)
    .filter(d => !isDriver || d.id === user?.driverId).sort((a, b) => b.finalScore - a.finalScore);

  const next: Record<RewardStatus, RewardStatus | null> = { menunggu_persetujuan: 'disetujui', disetujui: 'sudah_diberikan', sudah_diberikan: null };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reward</h1>
        <p className="text-sm text-gray-500">Driver berprestasi, persetujuan, dan riwayat pemberian reward.</p>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold mb-3">Driver Memenuhi Syarat (On Time ≥ 95% &amp; Pelanggaran ≤ 2)</h2>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600"><tr>{['Peringkat', 'Driver', 'Mitra', 'On Time', 'Total Kirim', '% On Time', 'Pelanggaran', 'Poin Reward'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>{eligible.map((d, i) => (
            <tr key={d.id} className="border-t"><td className="px-3 py-2 font-bold">{i + 1}</td><td className="px-3 py-2">{d.name}</td><td className="px-3 py-2">{d.transporterName}</td><td className="px-3 py-2">{d.onTimeDeliveries}</td><td className="px-3 py-2">{d.totalDeliveries}</td><td className="px-3 py-2">{d.onTimePercentage}%</td><td className="px-3 py-2">{d.validViolations}</td><td className="px-3 py-2 text-green-700">+{d.totalRewardPoints}</td></tr>
          ))}{!eligible.length && <tr><td colSpan={8} className="text-center text-gray-400 py-6">Belum ada driver yang memenuhi syarat.</td></tr>}</tbody>
        </table></div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold mb-3">Penghargaan Periode Ini</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rewards.map(r => (
            <div key={r.id} className="border rounded-lg p-3 flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div><p className="font-semibold">{r.achievementType}</p><p className="text-sm text-gray-600">{r.driverName} · {r.period}</p></div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[r.status]}`}>{REWARD_STATUS_LABELS[r.status]}</span>
              </div>
              <p className="text-xs text-gray-500">On Time {r.onTimeDeliveries}/{r.totalDeliveries} · Peringkat {r.rank} · <b>+{r.rewardPoints} poin</b></p>
              {canApprove && next[r.status] && (
                <button onClick={() => setDriverRewardStatus(r.id, next[r.status] as RewardStatus, actor)} className="self-start text-xs bg-[#0f2b5b] text-white px-3 py-1.5 rounded-lg">
                  {r.status === 'menunggu_persetujuan' ? 'Setujui' : 'Tandai Sudah Diberikan'}
                </button>
              )}
            </div>
          ))}
          {!rewards.length && <p className="text-gray-400 text-sm">Belum ada penghargaan.</p>}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold mb-3">Riwayat Poin Reward</h2>
        <ul className="divide-y text-sm">
          {txs.map(t => <li key={t.id} className="py-2 flex justify-between gap-3"><span>{t.driverName} — {t.reason}<span className="block text-xs text-gray-400">{new Date(t.createdAt).toLocaleString('id-ID')} · {t.createdBy}</span></span><b className="text-green-700">+{t.points}</b></li>)}
        </ul>
      </section>
    </div>
  );
}


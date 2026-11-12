'use client';

import React, { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { sortDriversByScore, scorePerDelivery } from '@/lib/scoring';

const PERIOD_FACTOR: Record<string, number> = { harian: 1 / 30, mingguan: 7 / 30, bulanan: 1 };

export default function LeaderboardPage() {
  const { drivers } = useData();
  const [period, setPeriod] = useState('bulanan');
  const [mitra, setMitra] = useState('');
  const mitraList = Array.from(new Set(drivers.map(d => d.transporterName)));

  // Catatan: data simulasi hanya menyimpan agregat; periode diskalakan proporsional sampai histori per-hari tersedia di database.
  const ranked = useMemo(() => {
    const f = PERIOD_FACTOR[period];
    const scaled = drivers.filter(d => !mitra || d.transporterName === mitra).map(d => ({
      ...d,
      totalDeliveries: Math.max(1, Math.round(d.totalDeliveries * f)),
      onTimeDeliveries: Math.round(d.onTimeDeliveries * f),
      lateDeliveries: Math.round(d.lateDeliveries * f),
      totalRewardPoints: Math.round(d.totalRewardPoints * f),
      totalPunishmentPoints: Math.round(d.totalPunishmentPoints * f),
      finalScore: Math.round(d.totalRewardPoints * f) - Math.round(d.totalPunishmentPoints * f),
    }));
    return sortDriversByScore(scaled);
  }, [drivers, period, mitra]);

  const top3 = ranked.slice(0, 3);
  const podium = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = ['h-28', 'h-36', 'h-20'];
  const medals = ['bg-gray-300', 'bg-yellow-400', 'bg-amber-600'];
  const initials = (n: string) => n.split(' ').map(x => x[0]).join('').slice(0, 2);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Driver Leaderboard</h1>
          <p className="text-sm text-gray-500">Skor Akhir = Total Reward − Total Punishment. Diperbarui otomatis setelah verifikasi.</p>
        </div>
        <div className="flex gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="harian">Harian</option><option value="mingguan">Mingguan</option><option value="bulanan">Bulanan</option>
          </select>
          <select value={mitra} onChange={e => setMitra(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Semua Mitra</option>{mitraList.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-gradient-to-b from-[#0f2b5b] to-[#1e3a6e] rounded-xl p-6">
        <div className="flex items-end justify-center gap-4">
          {podium.map(d => {
            const rank = ranked.indexOf(d) + 1;
            const idx = rank === 1 ? 1 : rank === 2 ? 0 : 2;
            return (
              <div key={d.id} className="flex flex-col items-center w-28 sm:w-36">
                {rank === 1 && <Trophy className="text-yellow-400 mb-1" size={28} />}
                <div className="w-14 h-14 rounded-full bg-blue-400/30 text-white flex items-center justify-center font-bold text-lg">{initials(d.name)}</div>
                <p className="text-white text-xs sm:text-sm font-semibold mt-1 text-center">{d.name}</p>
                <p className="text-blue-200 text-xs">{d.finalScore} poin</p>
                <div className={`${heights[idx]} ${medals[idx]} w-full rounded-t-lg mt-2 flex items-start justify-center pt-2 podium-animate`}>
                  <span className="font-bold text-gray-900">Juara {rank}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>{['Rank', 'Foto', 'Nama', 'ID', 'Mitra', 'Total', 'On Time', 'Late', '% Tepat Waktu', 'Pelanggaran', 'Reward', 'Punishment', 'Skor Akhir', 'Skor/Kirim'].map(h => <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>
            {ranked.map((d, i) => (
              <tr key={d.id} className="border-t">
                <td className="px-3 py-2.5 font-bold">{i + 1}</td>
                <td className="px-3 py-2.5"><div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-semibold">{initials(d.name)}</div></td>
                <td className="px-3 py-2.5 whitespace-nowrap">{d.name}</td>
                <td className="px-3 py-2.5">{d.id}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{d.transporterName}</td>
                <td className="px-3 py-2.5">{d.totalDeliveries}</td>
                <td className="px-3 py-2.5 text-green-700">{d.onTimeDeliveries}</td>
                <td className="px-3 py-2.5 text-red-600">{d.lateDeliveries}</td>
                <td className="px-3 py-2.5">{d.onTimePercentage}%</td>
                <td className="px-3 py-2.5">{d.validViolations}</td>
                <td className="px-3 py-2.5 text-green-700">+{d.totalRewardPoints}</td>
                <td className="px-3 py-2.5 text-red-600">-{d.totalPunishmentPoints}</td>
                <td className="px-3 py-2.5 font-bold">{d.finalScore}</td>
                <td className="px-3 py-2.5">{scorePerDelivery(d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">Skor/Kirim membantu perbandingan adil antar driver dengan volume pengiriman berbeda.</p>
    </div>
  );
}


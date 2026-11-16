// ============================================================
// SILOG Driver Control Tower - Scoring & Reward Period Logic
// ============================================================

import {
  type Driver,
  type Shipment,
  type RCAEvent,
  type RewardRule,
  type RewardTransaction,
  type PunishmentTransaction,
  type RewardPeriod,
  type OntimeDeliveryStatus,
  type LongStopActionLevel,
  EXTERNAL_RCA_CATEGORIES,
  RCA_CATEGORY_LABELS,
  type RCACategory,
} from './types';

export interface OntimeRewardTier {
  no: number;
  minLabel: string;
  maxLabel: string;
  minDaysInclusive: number;
  maxDaysInclusive: number | null;
  rewardAmount: number;
  sanctionAmount: number;
}

/**
 * Tabel Tarif Reward Pencapaian Ontime Delivery (berdasarkan Standar Waktu Pengiriman / Hari)
 */
export const ONTIME_REWARD_TIERS: OntimeRewardTier[] = [
  { no: 1, minLabel: '0', maxLabel: '1', minDaysInclusive: 0, maxDaysInclusive: 1, rewardAmount: 25000, sanctionAmount: 25000 },
  { no: 2, minLabel: '> 1', maxLabel: '2', minDaysInclusive: 2, maxDaysInclusive: 2, rewardAmount: 45000, sanctionAmount: 45000 },
  { no: 3, minLabel: '> 2', maxLabel: '3', minDaysInclusive: 3, maxDaysInclusive: 3, rewardAmount: 65000, sanctionAmount: 65000 },
  { no: 4, minLabel: '> 3', maxLabel: '4', minDaysInclusive: 4, maxDaysInclusive: 4, rewardAmount: 85000, sanctionAmount: 85000 },
  { no: 5, minLabel: '> 4', maxLabel: '5', minDaysInclusive: 5, maxDaysInclusive: 5, rewardAmount: 100000, sanctionAmount: 100000 },
  { no: 6, minLabel: '> 5', maxLabel: 'Tak Hingga', minDaysInclusive: 6, maxDaysInclusive: null, rewardAmount: 150000, sanctionAmount: 150000 },
];

export interface LongStopPunishmentTier {
  no: number;
  minCount: number;
  maxCount: number | null;
  countLabel: string;
  punishmentLabel: string;
  actionLevel: LongStopActionLevel;
  pointsDeducted: number;
  fineAmount: number;
}

/**
 * Tabel Punishment Driver Berhenti Lama (> 2 jam dalam 1 pengiriman tanpa alasan jelas)
 * Sistem terpisah dari Reward/Sanksi Ontime Delivery.
 */
export const LONG_STOP_PUNISHMENT_TIERS: LongStopPunishmentTier[] = [
  { no: 1, minCount: 1, maxCount: 1, countLabel: '1x', punishmentLabel: 'Peringatan melalui notifikasi apk/web', actionLevel: 'warning', pointsDeducted: 0, fineAmount: 0 },
  { no: 2, minCount: 2, maxCount: 2, countLabel: '2x', punishmentLabel: 'Peringatan melalui notifikasi apk/web', actionLevel: 'warning', pointsDeducted: 0, fineAmount: 0 },
  { no: 3, minCount: 3, maxCount: 3, countLabel: '3x', punishmentLabel: 'Peringatan melalui notifikasi apk/web dan akan dihubungi oleh tim control tower', actionLevel: 'call_ct', pointsDeducted: 0, fineAmount: 0 },
  { no: 4, minCount: 4, maxCount: 4, countLabel: '4x', punishmentLabel: 'Driver mendapat surat peringatan', actionLevel: 'sp', pointsDeducted: 0, fineAmount: 0 },
  { no: 5, minCount: 5, maxCount: 5, countLabel: '5x', punishmentLabel: 'Pengurangan point', actionLevel: 'point_deduction', pointsDeducted: 10, fineAmount: 0 },
  { no: 6, minCount: 6, maxCount: 6, countLabel: '6x', punishmentLabel: 'Driver dirumahkan selama 2 hari dan terkena denda/punishment', actionLevel: 'suspend_2d', pointsDeducted: 15, fineAmount: 50000 },
  { no: 7, minCount: 7, maxCount: null, countLabel: '>6x', punishmentLabel: 'Driver terkena skorsing atau dirumahkan 14 hari dan terkena denda/punishment', actionLevel: 'suspend_14d', pointsDeducted: 25, fineAmount: 100000 },
];

export function getOntimeTierByDays(standardDays: number): OntimeRewardTier {
  const days = Math.max(1, Math.round(standardDays));
  const match = ONTIME_REWARD_TIERS.find(
    t => days >= t.minDaysInclusive && (t.maxDaysInclusive === null || days <= t.maxDaysInclusive)
  );
  return match ?? ONTIME_REWARD_TIERS[ONTIME_REWARD_TIERS.length - 1];
}

export function getLongStopPunishmentByCount(stopCountInShipment: number): LongStopPunishmentTier {
  const count = Math.max(1, Math.round(stopCountInShipment));
  const match = LONG_STOP_PUNISHMENT_TIERS.find(
    t => count >= t.minCount && (t.maxCount === null || count <= t.maxCount)
  );
  return match ?? LONG_STOP_PUNISHMENT_TIERS[LONG_STOP_PUNISHMENT_TIERS.length - 1];
}

export function formatRupiah(amount: number, withSign = false): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (amount === 0) return 'Rp 0';
  if (amount < 0) return `-Rp ${formatted}`;
  return withSign ? `+Rp ${formatted}` : `Rp ${formatted}`;
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatYmd(year: number, monthIndex0: number, day: number): string {
  return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`;
}

function formatShortIdDate(year: number, monthIndex0: number, day: number): string {
  return `${day} ${MONTHS_ID[monthIndex0]} ${year}`;
}

export function extractDateOnly(value?: string): string {
  if (!value) return '';
  return value.slice(0, 10);
}

/**
 * Tentukan periode reward (Tanggal 16 bulan jalan s.d. Tanggal 15 bulan berikutnya)
 * beserta batas maksimal pencairan tanggal 21 setiap bulannya.
 */
export function getRewardPeriodForDate(dateInput: string | Date): RewardPeriod {
  let year: number;
  let month: number; // 0-11
  let day: number;

  if (typeof dateInput === 'string') {
    const ymd = extractDateOnly(dateInput);
    const [y, m, d] = ymd.split('-').map(Number);
    if (y && m && d) {
      year = y;
      month = m - 1;
      day = d;
    } else {
      const parsed = new Date(dateInput);
      year = parsed.getFullYear();
      month = parsed.getMonth();
      day = parsed.getDate();
    }
  } else {
    year = dateInput.getFullYear();
    month = dateInput.getMonth();
    day = dateInput.getDate();
  }

  let startYear = year;
  let startMonth = month;
  let endYear = year;
  let endMonth = month;

  if (day >= 16) {
    // 16 bulan ini s.d. 15 bulan berikutnya
    endMonth = month + 1;
    if (endMonth > 11) {
      endMonth = 0;
      endYear += 1;
    }
  } else {
    // 16 bulan lalu s.d. 15 bulan ini
    startMonth = month - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }

  const startDate = formatYmd(startYear, startMonth, 16);
  const endDate = formatYmd(endYear, endMonth, 15);
  const payoutDeadlineDate = formatYmd(endYear, endMonth, 21);

  return {
    key: `${startDate}_${endDate}`,
    label: `${formatShortIdDate(startYear, startMonth, 16)} – ${formatShortIdDate(endYear, endMonth, 15)}`,
    startDate,
    endDate,
    payoutDeadlineDate,
    payoutDeadlineLabel: `Maks. ${formatShortIdDate(endYear, endMonth, 21)}`,
  };
}

/**
 * Ambil daftar periode unik dari seluruh data shipment & transaksi + periode referensi saat ini.
 */
export function collectAvailablePeriods(
  dates: string[],
  referenceDate: Date | string = new Date()
): RewardPeriod[] {
  const map = new Map<string, RewardPeriod>();
  const refPeriod = getRewardPeriodForDate(referenceDate);
  map.set(refPeriod.key, refPeriod);

  for (const d of dates) {
    if (!d) continue;
    const p = getRewardPeriodForDate(d);
    if (!map.has(p.key)) {
      map.set(p.key, p);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function isDateInPeriod(dateStr: string | undefined, period: RewardPeriod): boolean {
  const ymd = extractDateOnly(dateStr);
  if (!ymd) return false;
  return ymd >= period.startDate && ymd <= period.endDate;
}

/**
 * Hitung lama perjalanan (hari) mulai dari tanggal transfer sangu / berangkat
 * sampai dengan tanggal armada tiba di lokasi bongkar.
 */
export function computeActualTravelDays(sanguOrDepartureDate?: string, arrivalUnloadDate?: string): number | undefined {
  const startYmd = extractDateOnly(sanguOrDepartureDate);
  const endYmd = extractDateOnly(arrivalUnloadDate);
  if (!startYmd || !endYmd) return undefined;

  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return undefined;

  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.max(0, Math.round((endMs - startMs) / 86400000));
}

export function formatTravelDaysLabel(days?: number): string {
  if (days === undefined || days === null) return '-';
  if (days === 0) return '< 1 hari (0 hr)';
  return `${days} hari`;
}

/**
 * Evaluasi status Ontime Delivery per shipment:
 * - Ontime jika lama perjalanan <= standar waktu (hari)
 * - Late jika lama perjalanan > standar waktu (hari)
 */
export function evaluateShipmentOntime(shipment: Shipment): {
  actualDays: number | undefined;
  ontimeStatus: OntimeDeliveryStatus;
  standardDays: number;
} {
  const standardDays = Math.max(1, shipment.standardDays || 1);
  const start = shipment.sanguTransferDate || shipment.departureTime;
  const end = shipment.arrivalUnloadDate || shipment.actualArrival;
  const computed = computeActualTravelDays(start, end);
  const actualDays = computed ?? shipment.actualDays;

  if (actualDays !== undefined) {
    return {
      actualDays,
      ontimeStatus: actualDays <= standardDays ? 'Ontime' : 'Late',
      standardDays,
    };
  }

  return {
    actualDays: undefined,
    ontimeStatus: shipment.ontimeStatus ?? (shipment.isOnTime ? 'Ontime' : 'Late'),
    standardDays,
  };
}

/**
 * Calculate final score: Total Reward Points - Total Punishment Points
 */
export function calculateFinalScore(rewardPoints: number, punishmentPoints: number): number {
  return rewardPoints - punishmentPoints;
}

/**
 * Check if an RCA category is external (not driver's fault)
 */
export function isExternalCause(category: RCACategory): boolean {
  return EXTERNAL_RCA_CATEGORIES.includes(category);
}

/**
 * Calculate On Time percentage
 */
export function calculateOnTimePercentage(onTime: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((onTime / total) * 1000) / 10;
}

/**
 * Calculate OTIF percentage
 */
export function calculateOTIF(otifCount: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((otifCount / total) * 1000) / 10;
}

/**
 * Sort drivers by final score for leaderboard.
 */
export function sortDriversByScore(drivers: Driver[]): Driver[] {
  return [...drivers].sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (b.onTimePercentage !== a.onTimePercentage) return b.onTimePercentage - a.onTimePercentage;
    return a.validViolations - b.validViolations;
  });
}

/**
 * Nilai reward pengiriman Ontime (berdasarkan tabel tier Standar Waktu Pengiriman / Hari)
 */
export function getRewardPerDayPoints(rules: RewardRule[]): number {
  const rule =
    rules.find(r => r.type === 'reward' && r.perStandardDay && r.isActive) ??
    rules.find(r => r.type === 'reward' && r.name.toLowerCase().includes('ontime') && r.isActive) ??
    rules.find(r => r.type === 'reward' && r.name === 'Pengiriman Tepat Waktu' && r.isActive);
  return rule?.points ?? 25000;
}

/**
 * Hitung nilai reward shipment (Rp): hanya diberikan bila Ontime, sesuai tabel tier standar hari.
 */
export function calculateShipmentRewardPoints(
  standardDays: number,
  ontimeStatus: OntimeDeliveryStatus,
  _pointsPerDay?: number
): number {
  if (ontimeStatus !== 'Ontime') return 0;
  return getOntimeTierByDays(standardDays).rewardAmount;
}

export function getOntimeLateSanctionAmount(standardDays: number): number {
  return getOntimeTierByDays(standardDays).sanctionAmount;
}

export function getOnTimeRewardPoints(rules: RewardRule[]): number {
  return getRewardPerDayPoints(rules);
}

/**
 * Poin/denda sanksi ketika pengiriman Late dan RCA merupakan kesalahan driver
 */
export function getPunishmentPoints(rules: RewardRule[], category?: RCACategory, standardDays?: number): number {
  if (standardDays !== undefined) {
    return getOntimeLateSanctionAmount(standardDays);
  }
  if (category) {
    const catRule = rules.find(r => r.type === 'punishment' && r.category === category && r.isActive);
    if (catRule) return catRule.points;
  }
  const lateDriverFaultRule = rules.find(
    r => r.type === 'punishment' && r.isActive && r.name.toLowerCase().includes('late')
  );
  return lateDriverFaultRule?.points ?? 25000;
}

export function formatScore(score: number): string {
  if (score > 0) return `+${score}`;
  return `${score}`;
}

export function scorePerDelivery(driver: Driver): number {
  if (driver.totalDeliveries === 0) return 0;
  return Math.round((driver.finalScore / driver.totalDeliveries) * 100) / 100;
}

export interface ShipmentRewardEvaluation {
  shipment: Shipment;
  evalDate: string;
  actualDays: number | undefined;
  standardDays: number;
  standardHours: number;
  ontimeStatus: OntimeDeliveryStatus;
  linkedRca?: RCAEvent;
  rcaFaultStatus: 'none' | 'driver' | 'external' | 'pending';
  /** Diisi HANYA jika Late; kosong ('') jika Ontime */
  rcaDisplay: string;
  /** Diisi HANYA jika Late; kosong ('') jika Ontime */
  keteranganDisplay: string;
  rewardPoints: number;
  sanctionPoints: number;
  netPoints: number;
}

export interface DriverPeriodSummary {
  driver: Driver;
  period: RewardPeriod;
  totalShipments: number;
  ontimeCount: number;
  lateCount: number;
  lateDriverFaultCount: number;
  lateExternalCount: number;
  standardDaysOntime: number;
  shipmentRewardPoints: number;
  bonusRewardPoints: number;
  totalReward: number;
  totalSanction: number;
  netPeriodPoints: number;
}

/**
 * Evaluasi rincian reward & sanksi tiap shipment sesuai Konsep Reward Ontime Delivery.
 */
export function evaluateShipmentsForPeriod(
  shipments: Shipment[],
  rcaEvents: RCAEvent[],
  punishmentTransactions: PunishmentTransaction[],
  rules: RewardRule[],
  period: RewardPeriod
): ShipmentRewardEvaluation[] {
  return shipments
    .map(sh => {
      const evalDate = sh.arrivalUnloadDate || sh.actualArrival || sh.sanguTransferDate || sh.departureTime;
      const { actualDays, ontimeStatus, standardDays } = evaluateShipmentOntime(sh);
      const standardHours = sh.standardHours ?? standardDays * 24;
      const linkedRca =
        (sh.rcaEventId ? rcaEvents.find(r => r.id === sh.rcaEventId) : undefined) ??
        rcaEvents.find(r => r.shipmentId === sh.id);

      let rcaFaultStatus: ShipmentRewardEvaluation['rcaFaultStatus'] = 'none';
      if (ontimeStatus === 'Late') {
        if (linkedRca) {
          if (linkedRca.verificationStatus === 'terverifikasi_pelanggaran' && !linkedRca.isExternalCause) {
            rcaFaultStatus = 'driver';
          } else if (
            linkedRca.verificationStatus === 'dikecualikan' ||
            linkedRca.verificationStatus === 'ditolak' ||
            linkedRca.isExternalCause
          ) {
            rcaFaultStatus = 'external';
          } else {
            rcaFaultStatus = 'pending';
          }
        } else {
          rcaFaultStatus = sh.rcaFault ?? 'pending';
        }
      }

      const rewardPoints = calculateShipmentRewardPoints(standardDays, ontimeStatus);
      let sanctionPoints = 0;
      if (ontimeStatus === 'Late' && rcaFaultStatus === 'driver') {
        const matchedTx = punishmentTransactions.find(
          t =>
            t.categoryType !== 'long_stop' &&
            ((t.shipmentId && t.shipmentId === sh.id) || (linkedRca && t.rcaEventId === linkedRca.id))
        );
        sanctionPoints = matchedTx?.points ?? getOntimeLateSanctionAmount(standardDays);
      }

      // Sesuai ketentuan revisi: RCA dan Keterangan HANYA diisi jika Late; kalau Ontime kosong!
      let rcaDisplay = '';
      let keteranganDisplay = '';
      if (ontimeStatus === 'Late') {
        rcaDisplay = linkedRca
          ? `${RCA_CATEGORY_LABELS[linkedRca.category]} (${
              rcaFaultStatus === 'driver'
                ? 'Kesalahan Driver'
                : rcaFaultStatus === 'external'
                ? 'Bukan Kesalahan Driver'
                : 'Menunggu Verifikasi'
            })`
          : rcaFaultStatus === 'driver'
          ? 'Kesalahan Driver'
          : 'Menunggu RCA';

        keteranganDisplay =
          sh.lateReasonNote ||
          linkedRca?.controlTowerDecision ||
          linkedRca?.description ||
          sh.notes ||
          (rcaFaultStatus === 'driver'
            ? 'Terlambat akibat kesalahan driver (kena sanksi)'
            : rcaFaultStatus === 'external'
            ? 'Kendala eksternal / bukan kesalahan driver (bebas sanksi)'
            : 'Menunggu verifikasi RCA oleh Admin');
      }

      return {
        shipment: sh,
        evalDate,
        actualDays,
        standardDays,
        standardHours,
        ontimeStatus,
        linkedRca,
        rcaFaultStatus,
        rcaDisplay,
        keteranganDisplay,
        rewardPoints,
        sanctionPoints,
        netPoints: rewardPoints - sanctionPoints,
      };
    })
    .filter(item => isDateInPeriod(item.evalDate, period))
    .sort((a, b) => b.evalDate.localeCompare(a.evalDate));
}

/**
 * Penjumlahan akhir periode reward dan sanksi Ontime Delivery per driver.
 * Sistem punishment berhenti lama (>2 jam) dipisahkan dari sistem Ontime/Late ini.
 */
export function buildDriverPeriodSummaries(
  drivers: Driver[],
  shipments: Shipment[],
  rcaEvents: RCAEvent[],
  rewardTransactions: RewardTransaction[],
  punishmentTransactions: PunishmentTransaction[],
  rules: RewardRule[],
  period: RewardPeriod
): DriverPeriodSummary[] {
  const evaluated = evaluateShipmentsForPeriod(shipments, rcaEvents, punishmentTransactions, rules, period);

  return drivers
    .map(driver => {
      const driverShipments = evaluated.filter(e => e.shipment.driverId === driver.id);
      const ontimeItems = driverShipments.filter(e => e.ontimeStatus === 'Ontime');
      const lateItems = driverShipments.filter(e => e.ontimeStatus === 'Late');
      const lateDriverFaultCount = lateItems.filter(e => e.rcaFaultStatus === 'driver').length;
      const lateExternalCount = lateItems.filter(e => e.rcaFaultStatus === 'external').length;

      const standardDaysOntime = ontimeItems.reduce((sum, e) => sum + e.standardDays, 0);
      const shipmentRewardPoints = ontimeItems.reduce((sum, e) => sum + e.rewardPoints, 0);

      // Bonus reward non-shipment pada periode berjalan
      const bonusRewardPoints = rewardTransactions
        .filter(
          t =>
            t.driverId === driver.id &&
            !t.shipmentId &&
            (t.periodKey ? t.periodKey === period.key : isDateInPeriod(t.createdAt, period))
        )
        .reduce((sum, t) => sum + t.points, 0);

      // Sanksi Ontime Delivery (hanya dari shipment Late + kesalahan driver, BUKAN long-stop)
      const shipmentSanctionPoints = lateItems.reduce((sum, e) => sum + e.sanctionPoints, 0);
      const accountedRcaIds = new Set(lateItems.map(e => e.linkedRca?.id).filter(Boolean));
      const accountedShipmentIds = new Set(lateItems.map(e => e.shipment.id));

      const extraOntimePunishment = punishmentTransactions
        .filter(
          t =>
            t.driverId === driver.id &&
            t.categoryType !== 'long_stop' &&
            !(t.shipmentId && accountedShipmentIds.has(t.shipmentId)) &&
            !(t.rcaEventId && accountedRcaIds.has(t.rcaEventId)) &&
            (t.periodKey ? t.periodKey === period.key : isDateInPeriod(t.createdAt, period))
        )
        .reduce((sum, t) => sum + t.points, 0);

      const totalReward = shipmentRewardPoints + bonusRewardPoints;
      const totalSanction = shipmentSanctionPoints + extraOntimePunishment;

      return {
        driver,
        period,
        totalShipments: driverShipments.length,
        ontimeCount: ontimeItems.length,
        lateCount: lateItems.length,
        lateDriverFaultCount,
        lateExternalCount,
        standardDaysOntime,
        shipmentRewardPoints,
        bonusRewardPoints,
        totalReward,
        totalSanction,
        netPeriodPoints: totalReward - totalSanction,
      };
    })
    .sort((a, b) => b.netPeriodPoints - a.netPeriodPoints || b.ontimeCount - a.ontimeCount);
}

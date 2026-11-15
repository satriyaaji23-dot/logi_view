'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import {
  type Driver, type DriverStatus, type Shipment, type RCAEvent, type RCACategory, type VerificationStatus,
  type RewardTransaction, type PunishmentTransaction, type RewardRule, type DriverReward, type RewardStatus,
  type Notification, type NotificationPriority, type AuditLog, EXTERNAL_RCA_CATEGORIES,
} from '@/lib/types';
import {
  mockDrivers, mockShipments, mockRCAEvents, mockRewardTransactions, mockPunishmentTransactions,
  mockRewardRules, mockDriverRewards, mockNotifications,
} from '@/lib/mock-data';
import {
  buildDriverPeriodSummaries,
  calculateShipmentRewardPoints,
  computeActualTravelDays,
  getPunishmentPoints,
  getRewardPeriodForDate,
  getRewardPerDayPoints,
} from '@/lib/scoring';

const LONG_STOP_THRESHOLD_MINUTES = 120; // > 2 jam
const RCA_DEADLINE_MS = 30 * 60 * 1000; // 30 menit batas waktu isi RCA

interface NewRCAInput {
  driverId: string;
  eventDate: string;
  eventTime: string;
  category: RCACategory;
  location: string;
  duration: string;
  description: string;
  evidence?: string[];
  notificationId?: string;
  shipmentId?: string;
}

interface DataContextType {
  drivers: Driver[];
  shipments: Shipment[];
  rcaEvents: RCAEvent[];
  rewardTransactions: RewardTransaction[];
  punishmentTransactions: PunishmentTransaction[];
  rules: RewardRule[];
  driverRewards: DriverReward[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  /** Tambah kejadian RCA. Kategori eksternal TIDAK mengurangi poin. Jika terkait notifikasi berhenti > 2 jam, otomatis tandai sudah diisi. */
  addRCAEvent: (input: NewRCAInput, actor: string) => RCAEvent;
  /** Verifikasi RCA oleh Admin. Sanksi diterapkan jika Late & RCA terbukti kesalahan driver. */
  verifyRCAEvent: (id: string, status: VerificationStatus, decision: string, actor: string) => void;
  /** Selesaikan shipment dengan tanggal tiba di lokasi bongkar -> hitung Ontime/Late & reward per hari standar. */
  completeShipment: (shipmentId: string, arrivalUnloadDate: string, actor: string) => void;
  /** Hitung & rekap penjumlahan akhir periode (Tgl 16 - 15) untuk pencairan maks. Tgl 21. */
  finalizeRewardPeriod: (periodStartOrKey: string, actor: string) => void;
  updateDriver: (
    driverId: string,
    patch: Partial<Pick<Driver, 'name' | 'phone' | 'licenseNumber' | 'vehiclePlate' | 'transporterId' | 'transporterName' | 'status'>>,
    actor: string
  ) => void;
  updateDriverStatus: (driverId: string, status: DriverStatus, actor: string) => void;
  sendNotification: (driverId: string, title: string, description: string, priority: NotificationPriority, actor: string) => void;
  setNotificationHandling: (id: string, handlingStatus: Notification['handlingStatus']) => void;
  markNotificationRead: (id: string) => void;
  /** Simulasi / deteksi GPS driver berhenti > 2 jam: otomatis kirim notifikasi wajib isi RCA ke driver. */
  simulateLongStop: (driverId: string, stoppedMinutes: number, actor: string, locationOverride?: string) => void;
  /** Sinkronkan posisi GPS dari API eksternal dan picu notifikasi otomatis bila berhenti > threshold. */
  syncGpsLocations: (items: Array<Record<string, unknown>>, actor: string, thresholdMinutes?: number) => number;
  /** Terapkan punishment otomatis bila driver melewati batas waktu dan belum mengisi RCA. */
  triggerAutoPunishment: (notificationId: string, actor?: string) => void;
  updateRule: (id: string, patch: Partial<RewardRule>, actor: string) => void;
  /** Koreksi poin manual oleh admin (wajib catatan audit). */
  adjustPoints: (driverId: string, points: number, reason: string, actor: string) => void;
  setDriverRewardStatus: (id: string, status: RewardStatus, actor: string) => void;
  addAudit: (action: string, entity: string, entityId: string, details: string, actor: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

let seq = 1000;
const nid = (p: string) => `${p}${++seq}`;

function recompute(d: Driver): Driver {
  const total = d.onTimeDeliveries + d.lateDeliveries;
  return {
    ...d,
    totalDeliveries: Math.max(d.totalDeliveries, total),
    onTimePercentage: d.totalDeliveries ? Math.round((d.onTimeDeliveries / d.totalDeliveries) * 1000) / 10 : 0,
    finalScore: d.totalRewardPoints - d.totalPunishmentPoints,
  };
}

function formatMinutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [drivers, setDrivers] = useState<Driver[]>(mockDrivers);
  const [shipments, setShipments] = useState<Shipment[]>(mockShipments);
  const [rcaEvents, setRcaEvents] = useState<RCAEvent[]>(mockRCAEvents);
  const [rewardTransactions, setRewardTx] = useState<RewardTransaction[]>(mockRewardTransactions);
  const [punishmentTransactions, setPunishTx] = useState<PunishmentTransaction[]>(mockPunishmentTransactions);
  const [rules, setRules] = useState<RewardRule[]>(mockRewardRules);
  const [driverRewards, setDriverRewards] = useState<DriverReward[]>(mockDriverRewards);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const initializedRef = useRef(false);
  const punishedNotifIdsRef = useRef<Set<string>>(new Set());

  const addAudit = useCallback((action: string, entity: string, entityId: string, details: string, actor: string) => {
    setAuditLogs(prev => [{
      id: nid('AL'), userId: actor, userName: actor, action, entity, entityId, details,
      timestamp: new Date().toISOString(),
    }, ...prev]);
  }, []);

  // Inisialisasi batas waktu RCA & deteksi awal armada yang berhenti > 2 jam
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const now = Date.now();
    const defaultDeadline = new Date(now + RCA_DEADLINE_MS).toISOString();

    setNotifications(prev => {
      const updated = prev.map(n =>
        n.requiresRca && !n.rcaDeadlineAt && !n.rcaSubmitted && !n.autoPunished
          ? { ...n, rcaDeadlineAt: defaultDeadline }
          : n
      );

      const generated: Notification[] = [];
      for (const drv of mockDrivers) {
        const stopped = drv.gps?.stoppedMinutes ?? 0;
        if (stopped > LONG_STOP_THRESHOLD_MINUTES) {
          const alreadyHasAlert = updated.some(
            n => n.driverId === drv.id && n.type === 'long_stop' && n.requiresRca && !n.rcaSubmitted && !n.autoPunished
          );
          if (!alreadyHasAlert) {
            generated.push({
              id: nid('N'),
              driverId: drv.id,
              driverName: drv.name,
              type: 'long_stop',
              title: 'Berhenti Lama (> 2 Jam) — Wajib Isi RCA',
              description: `GPS mendeteksi armada ${drv.vehiclePlate} berhenti ${formatMinutesLabel(stopped)} (${stopped} menit) di ${drv.gps?.locationName ?? 'lokasi terakhir'}. Driver wajib mengisi RCA sebelum batas waktu agar tidak terkena pengurangan poin otomatis.`,
              location: drv.gps?.locationName,
              priority: 'critical',
              handlingStatus: 'belum_ditangani',
              timestamp: new Date(now).toISOString(),
              requiresRca: true,
              stoppedDurationMinutes: stopped,
              rcaDeadlineAt: defaultDeadline,
              rcaSubmitted: false,
              autoPunished: false,
            });
          }
        }
      }
      return [...generated, ...updated];
    });
  }, []);

  const triggerAutoPunishment = useCallback((notificationId: string, actor = 'Sistem (Auto-Punishment)') => {
    if (punishedNotifIdsRef.current.has(notificationId)) return;

    const notif = notifications.find(n => n.id === notificationId);
    if (!notif || !notif.requiresRca || notif.rcaSubmitted || notif.autoPunished) return;

    punishedNotifIdsRef.current.add(notificationId);

    const rule =
      rules.find(r => r.type === 'punishment' && r.isActive && r.category === 'parkir_lama') ??
      rules.find(r => r.type === 'punishment' && r.isActive);
    const pts = rule?.points ?? 8;
    const nowIso = new Date().toISOString();

    setNotifications(prev => [
      {
        id: nid('N'),
        driverId: notif.driverId,
        driverName: notif.driverName,
        type: 'auto_punishment',
        title: `Pengurangan Poin Otomatis (-${pts} Poin)`,
        description: `Anda tidak mengisi laporan RCA hingga batas waktu untuk kejadian berhenti lama (${notif.stoppedDurationMinutes ?? '>120'} menit) di ${notif.location ?? '-'}. Sistem otomatis mengurangi ${pts} poin.`,
        location: notif.location,
        priority: 'critical',
        handlingStatus: 'selesai',
        timestamp: nowIso,
      },
      ...prev.map(n =>
        n.id === notificationId
          ? { ...n, autoPunished: true, handlingStatus: 'selesai' as const }
          : n
      ),
    ]);

    setPunishTx(prev => [
      {
        id: nid('PT'),
        driverId: notif.driverId,
        driverName: notif.driverName,
        type: 'punishment',
        points: pts,
        reason: `Otomatis: Tidak mengisi RCA setelah berhenti > 2 jam (${notif.id})`,
        periodKey: getRewardPeriodForDate(nowIso).key,
        ruleId: rule?.id,
        verifiedBefore: false,
        createdAt: nowIso,
        createdBy: actor,
      },
      ...prev,
    ]);

    setDrivers(prev =>
      prev.map(d =>
        d.id === notif.driverId
          ? recompute({
              ...d,
              totalPunishmentPoints: d.totalPunishmentPoints + pts,
              validViolations: d.validViolations + 1,
            })
          : d
      )
    );

    addAudit(
      'AUTO_PUNISHMENT',
      'drivers',
      notif.driverId,
      `Pengurangan otomatis -${pts} poin karena tidak mengisi RCA untuk notifikasi ${notif.id}`,
      actor
    );
  }, [notifications, rules, addAudit]);

  // Pantau batas waktu RCA setiap 5 detik; bila lewat dan driver belum mengisi RCA -> auto punishment
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      for (const n of notifications) {
        if (
          n.requiresRca &&
          !n.rcaSubmitted &&
          !n.autoPunished &&
          n.rcaDeadlineAt &&
          now >= new Date(n.rcaDeadlineAt).getTime()
        ) {
          triggerAutoPunishment(n.id, 'Sistem (Auto-Punishment)');
        }
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [notifications, triggerAutoPunishment]);

  const simulateLongStop = useCallback((
    driverId: string,
    stoppedMinutes: number,
    actor: string,
    locationOverride?: string
  ) => {
    const drv = drivers.find(d => d.id === driverId);
    if (!drv) return;
    const nowIso = new Date().toISOString();
    const loc = locationOverride?.trim() || drv.gps?.locationName || 'Rest Area Tol';

    setDrivers(prev =>
      prev.map(d =>
        d.id === driverId
          ? {
              ...d,
              gps: {
                lat: d.gps?.lat ?? -7.2575,
                lng: d.gps?.lng ?? 112.7521,
                locationName: loc,
                speedKmh: stoppedMinutes > 0 ? 0 : (d.gps?.speedKmh ?? 55),
                stoppedMinutes,
                lastUpdated: nowIso,
                heading: d.gps?.heading ?? 'Timur',
              },
            }
          : d
      )
    );

    if (stoppedMinutes > LONG_STOP_THRESHOLD_MINUTES) {
      const deadlineIso = new Date(Date.now() + RCA_DEADLINE_MS).toISOString();
      const hasActiveAlert = notifications.some(
        n => n.driverId === driverId && n.type === 'long_stop' && n.requiresRca && !n.rcaSubmitted && !n.autoPunished
      );
      if (!hasActiveAlert) {
        setNotifications(prev => [
          {
            id: nid('N'),
            driverId,
            driverName: drv.name,
            type: 'long_stop',
            title: 'Berhenti Lama (> 2 Jam) — Wajib Isi RCA',
            description: `GPS mendeteksi armada ${drv.vehiclePlate} berhenti ${formatMinutesLabel(stoppedMinutes)} (${stoppedMinutes} menit) di ${loc}. Driver wajib mengisi RCA sebelum batas waktu atau poin otomatis dikurangi.`,
            location: loc,
            priority: 'critical',
            handlingStatus: 'belum_ditangani',
            timestamp: nowIso,
            requiresRca: true,
            stoppedDurationMinutes: stoppedMinutes,
            rcaDeadlineAt: deadlineIso,
            rcaSubmitted: false,
            autoPunished: false,
          },
          ...prev,
        ]);
      }
      addAudit(
        'AUTO_NOTIFY',
        'notifications',
        driverId,
        `Deteksi GPS berhenti ${stoppedMinutes} menit (> 2 jam) di ${loc}. Notifikasi wajib isi RCA dikirim ke ${drv.name}.`,
        actor
      );
    } else {
      addAudit('GPS_UPDATE', 'drivers', driverId, `Telemetry GPS diperbarui (berhenti ${stoppedMinutes} menit)`, actor);
    }
  }, [drivers, notifications, addAudit]);

  const syncGpsLocations = useCallback((
    items: Array<Record<string, unknown>>,
    actor: string,
    thresholdMinutes = LONG_STOP_THRESHOLD_MINUTES
  ): number => {
    if (!items.length) return 0;
    const nowIso = new Date().toISOString();
    const deadlineIso = new Date(Date.now() + RCA_DEADLINE_MS).toISOString();
    let updatedCount = 0;
    const newAlerts: Notification[] = [];

    setDrivers(prev =>
      prev.map(d => {
        const match = items.find(it => {
          const idMatch = String(it.driverId ?? it.driver_id ?? '') === d.id;
          const plateMatch =
            String(it.vehiclePlate ?? it.plate ?? it.nopol ?? '').toLowerCase() === d.vehiclePlate.toLowerCase();
          return idMatch || plateMatch;
        });
        if (!match) return d;
        updatedCount += 1;
        const lat = Number(match.lat ?? match.latitude ?? d.gps?.lat ?? -7.2575);
        const lng = Number(match.lng ?? match.longitude ?? d.gps?.lng ?? 112.7521);
        const speedKmh = Number(match.speedKmh ?? match.speed ?? 0);
        const stoppedMinutes = Number(match.stoppedMinutes ?? match.stopped_minutes ?? 0);
        const locationName = String(match.locationName ?? match.location ?? match.address ?? d.gps?.locationName ?? '-');

        if (stoppedMinutes > thresholdMinutes) {
          const hasActive = notifications.some(
            n => n.driverId === d.id && n.type === 'long_stop' && n.requiresRca && !n.rcaSubmitted && !n.autoPunished
          );
          if (!hasActive) {
            newAlerts.push({
              id: nid('N'),
              driverId: d.id,
              driverName: d.name,
              type: 'long_stop',
              title: 'Berhenti Lama (> 2 Jam) — Wajib Isi RCA',
              description: `GPS API mendeteksi armada ${d.vehiclePlate} berhenti ${formatMinutesLabel(stoppedMinutes)} (${stoppedMinutes} menit) di ${locationName}. Segera isi RCA.`,
              location: locationName,
              priority: 'critical',
              handlingStatus: 'belum_ditangani',
              timestamp: nowIso,
              requiresRca: true,
              stoppedDurationMinutes: stoppedMinutes,
              rcaDeadlineAt: deadlineIso,
              rcaSubmitted: false,
              autoPunished: false,
            });
          }
        }

        return {
          ...d,
          gps: {
            lat: Number.isFinite(lat) ? lat : d.gps?.lat ?? -7.2575,
            lng: Number.isFinite(lng) ? lng : d.gps?.lng ?? 112.7521,
            locationName,
            speedKmh: Number.isFinite(speedKmh) ? speedKmh : 0,
            stoppedMinutes: Number.isFinite(stoppedMinutes) ? stoppedMinutes : 0,
            lastUpdated: nowIso,
            heading: d.gps?.heading ?? 'Timur',
          },
        };
      })
    );

    if (newAlerts.length) {
      setNotifications(prev => [...newAlerts, ...prev]);
    }
    addAudit('GPS_SYNC', 'drivers', 'fleet', `Sinkronisasi GPS API (${updatedCount} armada diperbarui)`, actor);
    return updatedCount;
  }, [notifications, addAudit]);

  const addRCAEvent = useCallback((input: NewRCAInput, actor: string): RCAEvent => {
    const driver = drivers.find(d => d.id === input.driverId);
    const matchedNotif =
      (input.notificationId ? notifications.find(n => n.id === input.notificationId) : undefined) ??
      notifications.find(
        n => n.driverId === input.driverId && n.requiresRca && !n.rcaSubmitted && !n.autoPunished
      );
    const linkedShipment = input.shipmentId
      ? shipments.find(s => s.id === input.shipmentId)
      : shipments.find(s => s.driverId === input.driverId && (s.ontimeStatus === 'Late' || !s.isOnTime));

    const ev: RCAEvent = {
      id: nid('RCA'),
      driverId: input.driverId,
      driverName: driver?.name ?? '-',
      vehiclePlate: driver?.vehiclePlate ?? '-',
      eventDate: input.eventDate,
      eventTime: input.eventTime,
      category: input.category,
      location: input.location,
      duration: input.duration,
      description: input.description,
      evidence: input.evidence,
      verificationStatus: 'menunggu_verifikasi',
      isExternalCause: EXTERNAL_RCA_CATEGORIES.includes(input.category),
      notificationId: matchedNotif?.id,
      shipmentId: linkedShipment?.id,
      createdAt: new Date().toISOString(),
    };
    setRcaEvents(prev => [ev, ...prev]);

    if (linkedShipment) {
      setShipments(prev =>
        prev.map(s =>
          s.id === linkedShipment.id
            ? { ...s, rcaEventId: ev.id, rcaFault: ev.isExternalCause ? 'external' : 'pending' }
            : s
        )
      );
    }

    if (matchedNotif) {
      setNotifications(prev =>
        prev.map(n =>
          n.id === matchedNotif.id
            ? {
                ...n,
                rcaSubmitted: true,
                rcaEventId: ev.id,
                handlingStatus: 'sedang_ditangani',
                respondedAt: new Date().toISOString(),
                readAt: n.readAt ?? new Date().toISOString(),
              }
            : n
        )
      );
    }

    addAudit(
      'CREATE',
      'rca_events',
      ev.id,
      `Kejadian ${input.category} dicatat untuk ${ev.driverName}${linkedShipment ? ` (${linkedShipment.suratJalanNo})` : ''}${matchedNotif ? ` (menjawab notifikasi ${matchedNotif.id})` : ''}`,
      actor
    );
    return ev;
  }, [drivers, notifications, shipments, addAudit]);

  const verifyRCAEvent = useCallback((id: string, status: VerificationStatus, decision: string, actor: string) => {
    const ev = rcaEvents.find(e => e.id === id);
    if (!ev) return;

    const linkedNotif = ev.notificationId ? notifications.find(n => n.id === ev.notificationId) : undefined;
    const alreadyPunishedOnNotif = linkedNotif?.autoPunished ?? false;
    const linkedShipment =
      (ev.shipmentId ? shipments.find(s => s.id === ev.shipmentId) : undefined) ??
      shipments.find(s => s.rcaEventId === ev.id);

    const isShipmentLate = linkedShipment ? (linkedShipment.ontimeStatus === 'Late' || !linkedShipment.isOnTime) : true;
    const isDriverFault = status === 'terverifikasi_pelanggaran' && !ev.isExternalCause;

    // Ketentuan #6: Sanksi diberikan apabila Ontime Delivery bernilai "Late" dan RCA merupakan kesalahan driver
    const shouldPunish =
      isDriverFault &&
      isShipmentLate &&
      !ev.pointsDeducted &&
      !alreadyPunishedOnNotif;
    const rule = rules.find(r => r.type === 'punishment' && r.isActive && r.category === ev.category);
    const pts = shouldPunish ? getPunishmentPoints(rules, ev.category) : 0;
    const nowIso = new Date().toISOString();
    const period = getRewardPeriodForDate(
      linkedShipment?.arrivalUnloadDate || linkedShipment?.actualArrival || ev.eventDate
    );

    setRcaEvents(prev =>
      prev.map(e =>
        e.id === id
          ? {
              ...e,
              verificationStatus: status,
              controlTowerDecision: decision,
              verifiedBy: actor,
              verifiedAt: nowIso,
              pointsDeducted: shouldPunish ? pts : e.pointsDeducted,
            }
          : e
      )
    );

    if (linkedShipment) {
      const nextFault =
        status === 'terverifikasi_pelanggaran' && !ev.isExternalCause
          ? 'driver'
          : status === 'dikecualikan' || status === 'ditolak' || ev.isExternalCause
          ? 'external'
          : 'pending';
      setShipments(prev =>
        prev.map(s => (s.id === linkedShipment.id ? { ...s, rcaEventId: ev.id, rcaFault: nextFault } : s))
      );
    }

    if (ev.notificationId && ['terverifikasi_pelanggaran', 'dikecualikan', 'ditolak'].includes(status)) {
      setNotifications(prev =>
        prev.map(n => (n.id === ev.notificationId ? { ...n, handlingStatus: 'selesai' } : n))
      );
    }

    if (shouldPunish && pts > 0) {
      setPunishTx(prev => [
        {
          id: nid('PT'),
          driverId: ev.driverId,
          driverName: ev.driverName,
          type: 'punishment',
          points: pts,
          reason: linkedShipment
            ? `Sanksi Late ${linkedShipment.suratJalanNo} + RCA Kesalahan Driver (${rule?.name ?? ev.category}) - ${ev.id}`
            : `${rule?.name ?? ev.category} - ${ev.id}`,
          rcaEventId: ev.id,
          shipmentId: linkedShipment?.id,
          periodKey: period.key,
          ruleId: rule?.id,
          verifiedBefore: true,
          createdAt: nowIso,
          createdBy: actor,
        },
        ...prev,
      ]);
      setDrivers(prev =>
        prev.map(d =>
          d.id === ev.driverId
            ? recompute({
                ...d,
                totalPunishmentPoints: d.totalPunishmentPoints + pts,
                validViolations: d.validViolations + 1,
              })
            : d
        )
      );
    }

    // Kirim notifikasi hasil verifikasi RCA ke driver
    if (['terverifikasi_pelanggaran', 'dikecualikan', 'ditolak'].includes(status)) {
      const verdictText =
        status === 'dikecualikan'
          ? 'RCA dinyatakan SESUAI / Bukan Kesalahan Driver (bebas sanksi, tidak ada pengurangan poin).'
          : status === 'terverifikasi_pelanggaran'
          ? isShipmentLate
            ? `Pengiriman Late & RCA dinilai kesalahan driver${pts > 0 ? ` (-${pts} poin)` : ''}.`
            : 'RCA dinilai kesalahan driver, namun pengiriman Ontime sehingga sanksi keterlambatan tidak berlaku.'
          : 'RCA ditolak / dinyatakan tidak terbukti.';
      setNotifications(prev => [
        {
          id: nid('N'),
          driverId: ev.driverId,
          driverName: ev.driverName,
          type: 'rca_verified',
          title: `Hasil Verifikasi RCA ${ev.id}`,
          description: `${verdictText}${decision ? ` Catatan Admin: ${decision}` : ''}`,
          location: ev.location,
          priority: status === 'terverifikasi_pelanggaran' ? 'warning' : 'info',
          handlingStatus: 'selesai',
          timestamp: nowIso,
        },
        ...prev,
      ]);
    }

    addAudit('VERIFY', 'rca_events', id, `Status: ${status}. Keputusan: ${decision}. Sanksi poin: ${pts}`, actor);
  }, [rcaEvents, notifications, shipments, rules, addAudit]);

  const completeShipment = useCallback((shipmentId: string, arrivalUnloadDate: string, actor: string) => {
    const sh = shipments.find(s => s.id === shipmentId);
    if (!sh) return;

    const startDate = sh.sanguTransferDate || sh.departureTime;
    const actualDays = computeActualTravelDays(startDate, arrivalUnloadDate) ?? sh.standardDays;
    const standardDays = Math.max(1, sh.standardDays || 1);
    const ontimeStatus = actualDays <= standardDays ? 'Ontime' : 'Late';
    const isOnTime = ontimeStatus === 'Ontime';
    const pointsPerDay = getRewardPerDayPoints(rules);
    const rewardPts = calculateShipmentRewardPoints(standardDays, ontimeStatus, pointsPerDay);
    const period = getRewardPeriodForDate(arrivalUnloadDate);
    const nowIso = new Date().toISOString();

    setShipments(prev =>
      prev.map(s =>
        s.id === shipmentId
          ? {
              ...s,
              arrivalUnloadDate,
              actualArrival: arrivalUnloadDate,
              actualDays,
              ontimeStatus,
              isOnTime,
              isOTIF: isOnTime && s.isInFull,
              status: 'completed',
              driverStatus: 'selesai_pengiriman',
              travelDuration: actualDays === 0 ? '< 1 hari' : `${actualDays} hari`,
              rcaFault: isOnTime ? 'none' : (s.rcaFault ?? 'pending'),
            }
          : s
      )
    );

    setDrivers(prev =>
      prev.map(d =>
        d.id === sh.driverId
          ? recompute({
              ...d,
              status: 'selesai_pengiriman',
              totalDeliveries: d.totalDeliveries + 1,
              onTimeDeliveries: d.onTimeDeliveries + (isOnTime ? 1 : 0),
              lateDeliveries: d.lateDeliveries + (isOnTime ? 0 : 1),
              totalRewardPoints: d.totalRewardPoints + rewardPts,
            })
          : d
      )
    );

    if (isOnTime && rewardPts > 0) {
      setRewardTx(prev => [
        {
          id: nid('RT'),
          driverId: sh.driverId,
          driverName: sh.driverName,
          type: 'reward',
          points: rewardPts,
          standardDays,
          periodKey: period.key,
          reason: `Ontime ${sh.suratJalanNo} (${actualDays} hr ≤ standar ${standardDays} hr × ${pointsPerDay} poin)`,
          shipmentId: sh.id,
          createdAt: arrivalUnloadDate || nowIso,
          createdBy: actor,
        },
        ...prev,
      ]);
    }

    addAudit(
      'COMPLETE_SHIPMENT',
      'shipments',
      sh.id,
      `${sh.suratJalanNo} tiba di lokasi bongkar (${actualDays} hari vs standar ${standardDays} hari -> ${ontimeStatus}, reward +${rewardPts} poin)`,
      actor
    );
  }, [shipments, rules, addAudit]);

  const updateDriverStatus = useCallback((driverId: string, status: DriverStatus, actor: string) => {
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, status } : d));

    if (status === 'selesai_pengiriman') {
      const sh = shipments.find(s => s.driverId === driverId && s.status !== 'completed');
      if (sh) {
        completeShipment(sh.id, new Date().toISOString(), actor);
        return;
      }
      const pointsPerDay = getRewardPerDayPoints(rules);
      const drv = drivers.find(d => d.id === driverId);
      const nowIso = new Date().toISOString();
      const period = getRewardPeriodForDate(nowIso);
      setDrivers(prev => prev.map(d => d.id === driverId ? recompute({
        ...d,
        totalDeliveries: d.totalDeliveries + 1,
        onTimeDeliveries: d.onTimeDeliveries + 1,
        totalRewardPoints: d.totalRewardPoints + pointsPerDay,
      }) : d));
      setRewardTx(prev => [{
        id: nid('RT'), driverId, driverName: drv?.name ?? '-', type: 'reward', points: pointsPerDay,
        standardDays: 1, periodKey: period.key, reason: 'Pengiriman selesai Ontime (1 hari standar)',
        createdAt: nowIso, createdBy: 'System',
      }, ...prev]);
    } else {
      setShipments(prev => prev.map(s => s.driverId === driverId && s.status !== 'completed' ? {
        ...s, driverStatus: status,
      } : s));
    }
    addAudit('UPDATE', 'drivers', driverId, `Status diubah menjadi ${status}`, actor);
  }, [shipments, rules, drivers, completeShipment, addAudit]);

  const finalizeRewardPeriod = useCallback((periodStartOrKey: string, actor: string) => {
    const startPart = periodStartOrKey.split('_')[0];
    const period = getRewardPeriodForDate(startPart);
    const summaries = buildDriverPeriodSummaries(
      drivers,
      shipments,
      rcaEvents,
      rewardTransactions,
      punishmentTransactions,
      rules,
      period
    ).filter(s => s.totalShipments > 0 || s.totalReward > 0 || s.totalSanction > 0);

    setDriverRewards(prev => {
      const remaining = prev.filter(r => r.periodKey !== period.key && r.period !== period.label);
      const generated: DriverReward[] = summaries.map((s, idx) => {
        const existing = prev.find(
          r => r.driverId === s.driver.id && (r.periodKey === period.key || r.period === period.label)
        );
        return {
          id: existing?.id ?? nid('DR'),
          driverId: s.driver.id,
          driverName: s.driver.name,
          achievementType: 'Reward Ontime Delivery',
          period: period.label,
          periodKey: period.key,
          payoutDeadline: period.payoutDeadlineDate,
          paidAt: existing?.paidAt,
          onTimeDeliveries: s.ontimeCount,
          lateDeliveries: s.lateCount,
          lateDriverFaultCount: s.lateDriverFaultCount,
          totalDeliveries: s.totalShipments,
          standardDaysTotal: s.standardDaysOntime,
          totalReward: s.totalReward,
          totalSanction: s.totalSanction,
          rewardPoints: s.netPeriodPoints,
          rank: idx + 1,
          status: existing?.status ?? 'menunggu_persetujuan',
          approvedBy: existing?.approvedBy,
          approvedAt: existing?.approvedAt,
        };
      });
      return [...generated, ...remaining];
    });

    addAudit(
      'SETTLE_PERIOD',
      'driver_rewards',
      period.key,
      `Penjumlahan akhir periode ${period.label} (${summaries.length} driver) — batas pencairan ${period.payoutDeadlineLabel}`,
      actor
    );
  }, [drivers, shipments, rcaEvents, rewardTransactions, punishmentTransactions, rules, addAudit]);

  const updateDriver = useCallback((
    driverId: string,
    patch: Partial<Pick<Driver, 'name' | 'phone' | 'licenseNumber' | 'vehiclePlate' | 'transporterId' | 'transporterName' | 'status'>>,
    actor: string
  ) => {
    const prevDriver = drivers.find(d => d.id === driverId);
    if (!prevDriver) return;
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, ...patch } : d));
    setShipments(prev => prev.map(s => s.driverId === driverId ? {
      ...s,
      driverName: patch.name ?? s.driverName,
      vehiclePlate: patch.vehiclePlate ?? s.vehiclePlate,
      transporterName: patch.transporterName ?? s.transporterName,
      driverStatus: s.status !== 'completed' ? (patch.status ?? s.driverStatus) : s.driverStatus,
    } : s));
    setRcaEvents(prev => prev.map(e => e.driverId === driverId ? {
      ...e,
      driverName: patch.name ?? e.driverName,
      vehiclePlate: patch.vehiclePlate ?? e.vehiclePlate,
    } : e));
    setNotifications(prev => prev.map(n => n.driverId === driverId ? {
      ...n,
      driverName: patch.name ?? n.driverName,
    } : n));
    addAudit('UPDATE', 'drivers', driverId, `Data driver diperbarui: ${Object.keys(patch).join(', ')}`, actor);
  }, [drivers, addAudit]);

  const sendNotification = useCallback((driverId: string, title: string, description: string, priority: NotificationPriority, actor: string) => {
    const drv = drivers.find(d => d.id === driverId);
    setNotifications(prev => [{
      id: nid('N'), driverId, driverName: drv?.name ?? '-', type: 'message', title, description,
      priority, handlingStatus: 'belum_ditangani', timestamp: new Date().toISOString(),
    }, ...prev]);
    addAudit('NOTIFY', 'notifications', driverId, `${title}: ${description}`, actor);
  }, [drivers, addAudit]);

  const setNotificationHandling = useCallback((id: string, handlingStatus: Notification['handlingStatus']) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, handlingStatus } : n));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n))
    );
  }, []);

  const updateRule = useCallback((id: string, patch: Partial<RewardRule>, actor: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r));
    addAudit('UPDATE', 'reward_rules', id, JSON.stringify(patch), actor);
  }, [addAudit]);

  const adjustPoints = useCallback((driverId: string, points: number, reason: string, actor: string) => {
    const drv = drivers.find(d => d.id === driverId);
    if (!drv || points === 0) return;
    const nowIso = new Date().toISOString();
    const periodKey = getRewardPeriodForDate(nowIso).key;
    if (points > 0) {
      setRewardTx(prev => [{ id: nid('RT'), driverId, driverName: drv.name, type: 'reward', points, periodKey, reason: `Koreksi admin: ${reason}`, createdAt: nowIso, createdBy: actor }, ...prev]);
      setDrivers(prev => prev.map(d => d.id === driverId ? recompute({ ...d, totalRewardPoints: d.totalRewardPoints + points }) : d));
    } else {
      const p = Math.abs(points);
      setPunishTx(prev => [{ id: nid('PT'), driverId, driverName: drv.name, type: 'punishment', points: p, periodKey, reason: `Koreksi admin: ${reason}`, verifiedBefore: true, createdAt: nowIso, createdBy: actor }, ...prev]);
      setDrivers(prev => prev.map(d => d.id === driverId ? recompute({ ...d, totalPunishmentPoints: d.totalPunishmentPoints + p }) : d));
    }
    addAudit('ADJUST_POINTS', 'drivers', driverId, `${points > 0 ? '+' : ''}${points} poin. Alasan: ${reason}`, actor);
  }, [drivers, addAudit]);

  const setDriverRewardStatus = useCallback((id: string, status: RewardStatus, actor: string) => {
    const nowIso = new Date().toISOString();
    setDriverRewards(prev =>
      prev.map(r =>
        r.id === id
          ? {
              ...r,
              status,
              approvedBy: actor,
              approvedAt: nowIso.slice(0, 10),
              paidAt: status === 'sudah_diberikan' ? nowIso.slice(0, 10) : r.paidAt,
            }
          : r
      )
    );
    addAudit('UPDATE', 'driver_rewards', id, `Status pencairan reward: ${status}`, actor);
  }, [addAudit]);

  const value = useMemo(() => ({
    drivers, shipments, rcaEvents, rewardTransactions, punishmentTransactions, rules, driverRewards,
    notifications, auditLogs, addRCAEvent, verifyRCAEvent, completeShipment, finalizeRewardPeriod,
    updateDriver, updateDriverStatus, sendNotification, setNotificationHandling, markNotificationRead,
    simulateLongStop, syncGpsLocations, triggerAutoPunishment, updateRule, adjustPoints, setDriverRewardStatus, addAudit,
  }), [
    drivers, shipments, rcaEvents, rewardTransactions, punishmentTransactions, rules, driverRewards,
    notifications, auditLogs, addRCAEvent, verifyRCAEvent, completeShipment, finalizeRewardPeriod,
    updateDriver, updateDriverStatus, sendNotification, setNotificationHandling, markNotificationRead,
    simulateLongStop, syncGpsLocations, triggerAutoPunishment, updateRule, adjustPoints, setDriverRewardStatus, addAudit,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

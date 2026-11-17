'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import {
  type Driver, type DriverStatus, type Shipment, type RCAEvent, type RCACategory, type VerificationStatus,
  type RewardTransaction, type PunishmentTransaction, type RewardRule, type DriverReward, type RewardStatus,
  type Notification, type NotificationPriority, type AuditLog, type LongStopIncident, EXTERNAL_RCA_CATEGORIES,
} from '@/lib/types';
import {
  mockDrivers, mockShipments, mockRCAEvents, mockRewardTransactions, mockPunishmentTransactions,
  mockRewardRules, mockDriverRewards, mockNotifications, mockLongStopIncidents,
} from '@/lib/mock-data';
import {
  buildDriverPeriodSummaries,
  calculateShipmentRewardPoints,
  computeActualTravelDays,
  formatRupiah,
  getLongStopPunishmentByCount,
  getOntimeLateSanctionAmount,
  getPunishmentPoints,
  getRewardPeriodForDate,
  getRewardPerDayPoints,
} from '@/lib/scoring';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { RealtimeEnvelope, SharedDataPayload } from '@/lib/realtimeStore';

const LONG_STOP_THRESHOLD_MINUTES = 120; // > 2 jam
const RCA_DEADLINE_MS = 30 * 60 * 1000; // 30 menit batas waktu isi RCA
const REALTIME_STORAGE_KEY = 'silog_shared_state_v3';
const REALTIME_CHANNEL_NAME = 'silog_realtime_v1';

export type RealtimeStatus = 'connecting' | 'connected' | 'local';

export interface RemoteNotice {
  id: string;
  actor: string;
  summary: string;
  timestamp: string;
}

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
  longStopIncidents: LongStopIncident[];
  /** Catat pelanggaran berhenti lama (> 2 jam) dalam 1 pengiriman tanpa alasan jelas (sistem terpisah 1x..>6x). */
  recordLongStopIncident: (
    driverId: string,
    stoppedMinutes: number,
    location: string,
    actor: string,
    shipmentId?: string,
    reasonNote?: string
  ) => LongStopIncident | null;
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
  /** Perbarui koordinat/kecepatan/status berhenti GPS driver secara realtime (dipicu dari Portal Driver atau Simulator). */
  updateDriverGps: (
    driverId: string,
    gpsPatch: { lat?: number; lng?: number; locationName?: string; speedKmh?: number; stoppedMinutes?: number },
    actor: string
  ) => void;
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
  /** Status dan metadata sinkronisasi realtime antar User Driver & User Admin */
  realtimeStatus: RealtimeStatus;
  realtimeTransport: string;
  lastSyncAt: string | null;
  lastSyncBy: string | null;
  lastRemoteNotice: RemoteNotice | null;
  dismissRemoteNotice: () => void;
  resetDemoData: (actor: string) => void;
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
  const [longStopIncidents, setLongStopIncidents] = useState<LongStopIncident[]>(mockLongStopIncidents);

  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');
  const [realtimeTransport, setRealtimeTransport] = useState<string>('Sinkronisasi Lokal (Multi-Tab)');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncBy, setLastSyncBy] = useState<string | null>(null);
  const [lastRemoteNotice, setLastRemoteNotice] = useState<RemoteNotice | null>(null);
  const [localMutation, setLocalMutation] = useState<{
    seq: number;
    actor: string;
    summary: string;
  } | null>(null);

  const initializedRef = useRef(false);
  const punishedNotifIdsRef = useRef<Set<string>>(new Set());
  const clientIdRef = useRef<string>('');
  const appliedVersionRef = useRef<number>(0);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  if (!clientIdRef.current) {
    clientIdRef.current = `cli_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
  }

  const dismissRemoteNotice = useCallback(() => setLastRemoteNotice(null), []);

  const schedulePublish = useCallback((actor: string, summary: string) => {
    setLocalMutation(prev => ({
      seq: (prev?.seq ?? 0) + 1,
      actor,
      summary,
    }));
  }, []);

  const applyPayload = useCallback((data: SharedDataPayload) => {
    setDrivers(data.drivers);
    setShipments(data.shipments);
    setRcaEvents(data.rcaEvents);
    setRewardTx(data.rewardTransactions);
    setPunishTx(data.punishmentTransactions);
    setRules(data.rules);
    setDriverRewards(data.driverRewards);
    setNotifications(data.notifications);
    setAuditLogs(data.auditLogs);
    if (Array.isArray(data.longStopIncidents)) {
      setLongStopIncidents(data.longStopIncidents);
    }
  }, []);

  const applyIncomingEnvelope = useCallback(
    (envelope: RealtimeEnvelope, showNotice = true) => {
      if (!envelope || !envelope.data) return;
      if (envelope.clientId === clientIdRef.current) return;
      if (envelope.version <= appliedVersionRef.current) return;

      appliedVersionRef.current = envelope.version;
      applyPayload(envelope.data);
      setLastSyncAt(envelope.updatedAt);
      setLastSyncBy(envelope.updatedBy);

      try {
        localStorage.setItem(REALTIME_STORAGE_KEY, JSON.stringify(envelope));
      } catch {
        // Abaikan bila quota penuh
      }

      if (showNotice && envelope.summary && envelope.summary !== '__silent__') {
        setLastRemoteNotice({
          id: `${envelope.version}`,
          actor: envelope.updatedBy,
          summary: envelope.summary,
          timestamp: envelope.updatedAt,
        });
      }
    },
    [applyPayload]
  );

  const addAudit = useCallback((action: string, entity: string, entityId: string, details: string, actor: string) => {
    setAuditLogs(prev => [{
      id: nid('AL'), userId: actor, userName: actor, action, entity, entityId, details,
      timestamp: new Date().toISOString(),
    }, ...prev]);
  }, []);

  // Inisialisasi state bersama (localStorage + BroadcastChannel + SSE Server + Supabase Realtime)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let hydratedFromSaved = false;
    try {
      const raw = localStorage.getItem(REALTIME_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RealtimeEnvelope;
        if (parsed?.data?.drivers?.length) {
          appliedVersionRef.current = parsed.version ?? 1;
          applyPayload(parsed.data);
          setLastSyncAt(parsed.updatedAt ?? null);
          setLastSyncBy(parsed.updatedBy ?? null);
          hydratedFromSaved = true;
        }
      }
    } catch {
      // Gunakan data default
    }

    if (!hydratedFromSaved) {
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
    }

    // 1) Cross-tab BroadcastChannel + storage event listener
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(REALTIME_CHANNEL_NAME);
      broadcastRef.current = bc;
      bc.onmessage = (ev: MessageEvent<RealtimeEnvelope>) => {
        applyIncomingEnvelope(ev.data, true);
      };
    }

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === REALTIME_STORAGE_KEY && ev.newValue) {
        try {
          const parsed = JSON.parse(ev.newValue) as RealtimeEnvelope;
          applyIncomingEnvelope(parsed, true);
        } catch {
          // Abaikan payload rusak
        }
      }
    };
    window.addEventListener('storage', onStorage);

    // 2) Live Server SSE stream (/api/realtime/stream)
    let eventSource: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      eventSource = new EventSource('/api/realtime/stream');
      eventSource.addEventListener('connected', () => {
        setRealtimeStatus('connected');
        if (!isSupabaseConfigured) {
          setRealtimeTransport('Live Server (SSE + Multi-Tab)');
        }
      });
      eventSource.addEventListener('sync', (ev: MessageEvent<string>) => {
        try {
          const envelope = JSON.parse(ev.data) as RealtimeEnvelope;
          applyIncomingEnvelope(envelope, true);
        } catch {
          // Abaikan
        }
      });
      eventSource.onerror = () => {
        setRealtimeStatus('local');
        if (!isSupabaseConfigured) {
          setRealtimeTransport('Sinkronisasi Lokal (Multi-Tab)');
        }
      };
    } else {
      setRealtimeStatus('local');
    }

    // 3) Supabase Realtime (lintas perangkat di production / Vercel)
    let supaChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    if (isSupabaseConfigured && supabase) {
      supaChannel = supabase
        .channel('silog-control-tower')
        .on('broadcast', { event: 'state_sync' }, payload => {
          const envelope = payload.payload as RealtimeEnvelope | undefined;
          if (envelope) {
            applyIncomingEnvelope(envelope, true);
          }
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('connected');
            setRealtimeTransport('Supabase Realtime + Live');
          }
        });
      supabaseChannelRef.current = supaChannel;
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      if (bc) bc.close();
      if (eventSource) eventSource.close();
      if (supaChannel && supabase) {
        supabase.removeChannel(supaChannel);
      }
    };
  }, [applyIncomingEnvelope, applyPayload]);

  // Publikasikan perubahan lokal ke seluruh channel realtime
  useEffect(() => {
    if (!localMutation) return;
    const version = Math.max(Date.now(), appliedVersionRef.current + 1);
    appliedVersionRef.current = version;
    const updatedAt = new Date().toISOString();

    const envelope: RealtimeEnvelope = {
      version,
      clientId: clientIdRef.current,
      updatedAt,
      updatedBy: localMutation.actor,
      summary: localMutation.summary,
      data: {
        drivers,
        shipments,
        rcaEvents,
        rewardTransactions,
        punishmentTransactions,
        rules,
        driverRewards,
        notifications,
        auditLogs,
        longStopIncidents,
      },
    };

    setLastSyncAt(updatedAt);
    setLastSyncBy(localMutation.actor);

    try {
      localStorage.setItem(REALTIME_STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      // Abaikan
    }

    try {
      broadcastRef.current?.postMessage(envelope);
    } catch {
      // Abaikan
    }

    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: 'broadcast',
        event: 'state_sync',
        payload: envelope,
      }).catch(() => {});
    }

    fetch('/api/realtime/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    }).catch(() => {});
  }, [
    localMutation,
    drivers,
    shipments,
    rcaEvents,
    rewardTransactions,
    punishmentTransactions,
    rules,
    driverRewards,
    notifications,
    auditLogs,
    longStopIncidents,
  ]);

  const recordLongStopIncident = useCallback((
    driverId: string,
    stoppedMinutes: number,
    location: string,
    actor: string,
    shipmentIdOverride?: string,
    reasonNote?: string
  ): LongStopIncident | null => {
    const drv = drivers.find(d => d.id === driverId);
    if (!drv) return null;

    const targetShipment =
      (shipmentIdOverride ? shipments.find(s => s.id === shipmentIdOverride) : undefined) ??
      shipments.find(s => s.driverId === driverId && s.status !== 'completed') ??
      shipments.find(s => s.driverId === driverId);

    const shipmentId = targetShipment?.id ?? `SH-${driverId}`;
    const shipmentCode = targetShipment?.suratJalanNo ?? `SH/${driverId}`;

    const existingCount = longStopIncidents.filter(
      inc => inc.shipmentId === shipmentId && inc.reasonStatus !== 'valid_external'
    ).length;
    const stopSequenceInShipment = existingCount + 1;
    const tier = getLongStopPunishmentByCount(stopSequenceInShipment);
    const nowIso = new Date().toISOString();

    const incident: LongStopIncident = {
      id: nid('LS'),
      shipmentId,
      shipmentCode,
      driverId,
      driverName: drv.name,
      vehiclePlate: drv.vehiclePlate,
      location,
      stoppedMinutes,
      occurredAt: nowIso,
      reasonStatus: 'unexplained',
      reasonNote: reasonNote || `Berhenti > 2 jam ke-${stopSequenceInShipment} pada ${shipmentCode} tanpa alasan jelas`,
      stopSequenceInShipment,
      punishmentTier: tier.punishmentLabel,
      actionLevel: tier.actionLevel,
      pointsDeducted: tier.pointsDeducted,
      fineAmount: tier.fineAmount,
    };

    setLongStopIncidents(prev => [incident, ...prev]);

    if (targetShipment) {
      setShipments(prev =>
        prev.map(s => (s.id === targetShipment.id ? { ...s, longStopCount: stopSequenceInShipment } : s))
      );
    }

    setNotifications(prev => [
      {
        id: nid('N'),
        driverId,
        driverName: drv.name,
        type: 'long_stop_escalation',
        title: `Punishment Berhenti Lama (${stopSequenceInShipment}x pada ${shipmentCode})`,
        description: `${tier.punishmentLabel}${tier.pointsDeducted > 0 ? ` (-${tier.pointsDeducted} poin)` : ''}${tier.fineAmount > 0 ? ` · Denda ${formatRupiah(tier.fineAmount)}` : ''}.`,
        location,
        priority: stopSequenceInShipment >= 3 ? 'critical' : 'warning',
        handlingStatus: stopSequenceInShipment >= 3 ? 'belum_ditangani' : 'selesai',
        timestamp: nowIso,
      },
      ...prev,
    ]);

    if (tier.pointsDeducted > 0 || tier.fineAmount > 0) {
      setPunishTx(prev => [
        {
          id: nid('PT'),
          driverId,
          driverName: drv.name,
          type: 'punishment',
          categoryType: 'long_stop',
          points: tier.pointsDeducted,
          reason: `Punishment Berhenti Lama (${stopSequenceInShipment}x) pada ${shipmentCode}: ${tier.punishmentLabel}`,
          shipmentId: targetShipment?.id,
          periodKey: getRewardPeriodForDate(nowIso).key,
          verifiedBefore: true,
          createdAt: nowIso,
          createdBy: actor,
        },
        ...prev,
      ]);
      if (tier.pointsDeducted > 0) {
        setDrivers(prev =>
          prev.map(d =>
            d.id === driverId
              ? recompute({
                  ...d,
                  totalPunishmentPoints: d.totalPunishmentPoints + tier.pointsDeducted,
                  validViolations: d.validViolations + 1,
                })
              : d
          )
        );
      }
    }

    addAudit(
      'LONG_STOP_PUNISHMENT',
      'shipments',
      shipmentId,
      `${drv.name} (${shipmentCode}) berhenti > 2 jam ke-${stopSequenceInShipment} tanpa alasan jelas -> ${tier.punishmentLabel}`,
      actor
    );
    schedulePublish(actor, `Punishment berhenti lama ke-${stopSequenceInShipment} (${drv.name})`);
    return incident;
  }, [drivers, shipments, longStopIncidents, addAudit, schedulePublish]);

  const triggerAutoPunishment = useCallback((notificationId: string, actor = 'Sistem (Auto-Punishment)') => {
    if (punishedNotifIdsRef.current.has(notificationId)) return;

    const notif = notifications.find(n => n.id === notificationId);
    if (!notif || !notif.requiresRca || notif.rcaSubmitted || notif.autoPunished) return;

    punishedNotifIdsRef.current.add(notificationId);

    const activeShipment =
      shipments.find(s => s.driverId === notif.driverId && s.status !== 'completed') ??
      shipments.find(s => s.driverId === notif.driverId);
    const shipmentId = activeShipment?.id ?? `SH-${notif.driverId}`;
    const shipmentCode = activeShipment?.suratJalanNo ?? `SH/${notif.driverId}`;

    const existingCount = longStopIncidents.filter(
      inc => inc.shipmentId === shipmentId && inc.reasonStatus !== 'valid_external' && inc.notificationId !== notificationId
    ).length;
    const stopSequenceInShipment = existingCount + 1;
    const tier = getLongStopPunishmentByCount(stopSequenceInShipment);
    const nowIso = new Date().toISOString();

    setNotifications(prev => [
      {
        id: nid('N'),
        driverId: notif.driverId,
        driverName: notif.driverName,
        type: 'auto_punishment',
        title: `Berhenti Lama Tanpa Alasan Jelas (${stopSequenceInShipment}x — ${shipmentCode})`,
        description: `Batas waktu pengisian RCA terlewati (${notif.stoppedDurationMinutes ?? '>120'} menit di ${notif.location ?? '-'}). Sanksi ke-${stopSequenceInShipment}: ${tier.punishmentLabel}.`,
        location: notif.location,
        priority: stopSequenceInShipment >= 3 ? 'critical' : 'warning',
        handlingStatus: 'selesai',
        timestamp: nowIso,
      },
      ...prev.map(n =>
        n.id === notificationId
          ? { ...n, autoPunished: true, handlingStatus: 'selesai' as const }
          : n
      ),
    ]);

    setLongStopIncidents(prev => {
      const hasMatchingPending = prev.some(i => i.notificationId === notificationId);
      if (hasMatchingPending) {
        return prev.map(i =>
          i.notificationId === notificationId
            ? {
                ...i,
                reasonStatus: 'unexplained',
                reasonNote: `Tidak mengisi RCA hingga batas waktu (${stopSequenceInShipment}x pada ${shipmentCode})`,
                stopSequenceInShipment,
                punishmentTier: tier.punishmentLabel,
                actionLevel: tier.actionLevel,
                pointsDeducted: tier.pointsDeducted,
                fineAmount: tier.fineAmount,
              }
            : i
        );
      }
      return [
        {
          id: nid('LS'),
          shipmentId,
          shipmentCode,
          driverId: notif.driverId,
          driverName: notif.driverName,
          vehiclePlate: drivers.find(d => d.id === notif.driverId)?.vehiclePlate ?? '-',
          location: notif.location ?? '-',
          stoppedMinutes: notif.stoppedDurationMinutes ?? 135,
          occurredAt: nowIso,
          reasonStatus: 'unexplained',
          reasonNote: `Tidak mengisi RCA hingga batas waktu (${stopSequenceInShipment}x pada ${shipmentCode})`,
          stopSequenceInShipment,
          punishmentTier: tier.punishmentLabel,
          actionLevel: tier.actionLevel,
          pointsDeducted: tier.pointsDeducted,
          fineAmount: tier.fineAmount,
          notificationId,
        },
        ...prev,
      ];
    });

    if (activeShipment) {
      setShipments(prev =>
        prev.map(s => (s.id === activeShipment.id ? { ...s, longStopCount: stopSequenceInShipment } : s))
      );
    }

    if (tier.pointsDeducted > 0) {
      setPunishTx(prev => [
        {
          id: nid('PT'),
          driverId: notif.driverId,
          driverName: notif.driverName,
          type: 'punishment',
          categoryType: 'long_stop',
          points: tier.pointsDeducted,
          reason: `Punishment Berhenti Lama (${stopSequenceInShipment}x) pada ${shipmentCode}: ${tier.punishmentLabel}`,
          shipmentId: activeShipment?.id,
          periodKey: getRewardPeriodForDate(nowIso).key,
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
                totalPunishmentPoints: d.totalPunishmentPoints + tier.pointsDeducted,
                validViolations: d.validViolations + 1,
              })
            : d
        )
      );
    }

    addAudit(
      'AUTO_PUNISHMENT',
      'drivers',
      notif.driverId,
      `Berhenti lama tanpa RCA (${stopSequenceInShipment}x pada ${shipmentCode}): ${tier.punishmentLabel}`,
      actor
    );
    schedulePublish(actor, `Punishment berhenti lama ${stopSequenceInShipment}x (${notif.driverName})`);
  }, [notifications, shipments, longStopIncidents, drivers, addAudit, schedulePublish]);

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
      schedulePublish(actor, `Alert berhenti > 2 jam dikirim ke ${drv.name}`);
    } else {
      addAudit('GPS_UPDATE', 'drivers', driverId, `Telemetry GPS diperbarui (berhenti ${stoppedMinutes} menit)`, actor);
      schedulePublish(actor, `Posisi GPS ${drv.name} diperbarui`);
    }
  }, [drivers, notifications, addAudit, schedulePublish]);

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
    schedulePublish(actor, `Sinkronisasi GPS API (${updatedCount} armada)`);
    return updatedCount;
  }, [notifications, addAudit, schedulePublish]);

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
    schedulePublish(actor, `${ev.driverName} mengirim RCA (${ev.id})`);
    return ev;
  }, [drivers, notifications, shipments, addAudit, schedulePublish]);

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
    const pts = shouldPunish
      ? getOntimeLateSanctionAmount(linkedShipment?.standardDays ?? 1)
      : 0;
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
        prev.map(s =>
          s.id === linkedShipment.id
            ? {
                ...s,
                rcaEventId: ev.id,
                rcaFault: nextFault,
                lateReasonNote: decision || ev.description || s.lateReasonNote,
              }
            : s
        )
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
          categoryType: 'ontime_delivery',
          points: pts,
          reason: linkedShipment
            ? `Sanksi Late ${linkedShipment.suratJalanNo} + RCA Kesalahan Driver (-${formatRupiah(pts)})`
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
    schedulePublish(actor, `Verifikasi RCA ${id} (${ev.driverName})`);
  }, [rcaEvents, notifications, shipments, rules, addAudit, schedulePublish]);

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
              lateReasonNote: isOnTime ? undefined : (s.lateReasonNote ?? 'Melebihi standar waktu pengiriman, menunggu verifikasi RCA'),
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
          reason: `Ontime ${sh.suratJalanNo} (${actualDays} hr ≤ standar ${standardDays} hr -> ${formatRupiah(rewardPts)})`,
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
      `${sh.suratJalanNo} tiba di lokasi bongkar (${actualDays} hari vs standar ${standardDays} hari -> ${ontimeStatus}, reward ${formatRupiah(rewardPts)})`,
      actor
    );
    schedulePublish(actor, `${sh.suratJalanNo} tiba di lokasi bongkar (${ontimeStatus})`);
  }, [shipments, rules, addAudit, schedulePublish]);

  const updateDriverStatus = useCallback((driverId: string, status: DriverStatus, actor: string) => {
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, status } : d));
    const drv = drivers.find(d => d.id === driverId);

    if (status === 'selesai_pengiriman') {
      const sh = shipments.find(s => s.driverId === driverId && s.status !== 'completed');
      if (sh) {
        completeShipment(sh.id, new Date().toISOString(), actor);
        return;
      }
      const pointsPerDay = getRewardPerDayPoints(rules);
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
        createdAt: nowIso, createdBy: actor,
      }, ...prev]);
    } else {
      setShipments(prev => prev.map(s => s.driverId === driverId && s.status !== 'completed' ? {
        ...s, driverStatus: status,
      } : s));
    }
    addAudit('UPDATE', 'drivers', driverId, `Status diubah menjadi ${status}`, actor);
    schedulePublish(actor, `Status ${drv?.name ?? driverId}: ${status.replace(/_/g, ' ')}`);
  }, [shipments, rules, drivers, completeShipment, addAudit, schedulePublish]);

  const updateDriverGps = useCallback((
    driverId: string,
    gpsPatch: { lat?: number; lng?: number; locationName?: string; speedKmh?: number; stoppedMinutes?: number },
    actor: string
  ) => {
    const drv = drivers.find(d => d.id === driverId);
    if (!drv) return;
    const nowIso = new Date().toISOString();
    const nextStopped = gpsPatch.stoppedMinutes ?? drv.gps?.stoppedMinutes ?? 0;
    const nextLoc = gpsPatch.locationName?.trim() || drv.gps?.locationName || 'Lokasi Armada';

    setDrivers(prev =>
      prev.map(d =>
        d.id === driverId
          ? {
              ...d,
              gps: {
                lat: gpsPatch.lat ?? d.gps?.lat ?? -7.2575,
                lng: gpsPatch.lng ?? d.gps?.lng ?? 112.7521,
                locationName: nextLoc,
                speedKmh: gpsPatch.speedKmh ?? d.gps?.speedKmh ?? 0,
                stoppedMinutes: nextStopped,
                lastUpdated: nowIso,
                heading: d.gps?.heading ?? 'Timur',
              },
            }
          : d
      )
    );

    if (nextStopped > LONG_STOP_THRESHOLD_MINUTES) {
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
            description: `GPS mendeteksi armada ${drv.vehiclePlate} berhenti ${formatMinutesLabel(nextStopped)} (${nextStopped} menit) di ${nextLoc}. Driver wajib mengisi RCA sebelum batas waktu atau poin otomatis dikurangi.`,
            location: nextLoc,
            priority: 'critical',
            handlingStatus: 'belum_ditangani',
            timestamp: nowIso,
            requiresRca: true,
            stoppedDurationMinutes: nextStopped,
            rcaDeadlineAt: deadlineIso,
            rcaSubmitted: false,
            autoPunished: false,
          },
          ...prev,
        ]);
      }
    }

    addAudit('GPS_UPDATE', 'drivers', driverId, `Lokasi GPS live diperbarui: ${nextLoc}`, actor);
    schedulePublish(actor, `Lokasi GPS ${drv.name} diperbarui (${nextLoc})`);
  }, [drivers, notifications, addAudit, schedulePublish]);

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
    schedulePublish(actor, `Rekap akhir periode ${period.label} diperbarui`);
  }, [drivers, shipments, rcaEvents, rewardTransactions, punishmentTransactions, rules, addAudit, schedulePublish]);

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
    schedulePublish(actor, `Data driver ${patch.name ?? prevDriver.name} diperbarui`);
  }, [drivers, addAudit, schedulePublish]);

  const sendNotification = useCallback((driverId: string, title: string, description: string, priority: NotificationPriority, actor: string) => {
    const drv = drivers.find(d => d.id === driverId);
    setNotifications(prev => [{
      id: nid('N'), driverId, driverName: drv?.name ?? '-', type: 'message', title, description,
      priority, handlingStatus: 'belum_ditangani', timestamp: new Date().toISOString(),
    }, ...prev]);
    addAudit('NOTIFY', 'notifications', driverId, `${title}: ${description}`, actor);
    schedulePublish(actor, `Notifikasi dikirim ke ${drv?.name ?? driverId}`);
  }, [drivers, addAudit, schedulePublish]);

  const setNotificationHandling = useCallback((id: string, handlingStatus: Notification['handlingStatus']) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, handlingStatus } : n));
    schedulePublish('Control Tower', '__silent__');
  }, [schedulePublish]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n))
    );
    schedulePublish('User', '__silent__');
  }, [schedulePublish]);

  const updateRule = useCallback((id: string, patch: Partial<RewardRule>, actor: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r));
    addAudit('UPDATE', 'reward_rules', id, JSON.stringify(patch), actor);
    schedulePublish(actor, 'Aturan reward & punishment diperbarui');
  }, [addAudit, schedulePublish]);

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
    schedulePublish(actor, `Koreksi poin ${drv.name} (${points > 0 ? '+' : ''}${points})`);
  }, [drivers, addAudit, schedulePublish]);

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
    schedulePublish(actor, `Status pencairan reward diperbarui`);
  }, [addAudit, schedulePublish]);

  const resetDemoData = useCallback((actor: string) => {
    punishedNotifIdsRef.current.clear();
    const now = Date.now();
    const defaultDeadline = new Date(now + RCA_DEADLINE_MS).toISOString();
    const freshNotifications = mockNotifications.map(n =>
      n.requiresRca && !n.rcaDeadlineAt && !n.rcaSubmitted && !n.autoPunished
        ? { ...n, rcaDeadlineAt: defaultDeadline }
        : n
    );
    applyPayload({
      drivers: mockDrivers,
      shipments: mockShipments,
      rcaEvents: mockRCAEvents,
      rewardTransactions: mockRewardTransactions,
      punishmentTransactions: mockPunishmentTransactions,
      rules: mockRewardRules,
      driverRewards: mockDriverRewards,
      notifications: freshNotifications,
      longStopIncidents: mockLongStopIncidents,
      auditLogs: [{
        id: nid('AL'),
        userId: actor,
        userName: actor,
        action: 'RESET_DEMO',
        entity: 'system',
        entityId: 'all',
        details: 'Data simulasi realtime direset ke kondisi awal',
        timestamp: new Date(now).toISOString(),
      }],
    });
    fetch('/api/realtime/sync', { method: 'DELETE' }).catch(() => {});
    schedulePublish(actor, 'Data simulasi direset ke kondisi awal');
  }, [applyPayload, schedulePublish]);

  const value = useMemo(() => ({
    drivers, shipments, rcaEvents, rewardTransactions, punishmentTransactions, rules, driverRewards,
    notifications, auditLogs, longStopIncidents, recordLongStopIncident, addRCAEvent, verifyRCAEvent, completeShipment, finalizeRewardPeriod,
    updateDriver, updateDriverStatus, updateDriverGps, sendNotification, setNotificationHandling, markNotificationRead,
    simulateLongStop, syncGpsLocations, triggerAutoPunishment, updateRule, adjustPoints, setDriverRewardStatus, addAudit,
    realtimeStatus, realtimeTransport, lastSyncAt, lastSyncBy, lastRemoteNotice, dismissRemoteNotice, resetDemoData,
  }), [
    drivers, shipments, rcaEvents, rewardTransactions, punishmentTransactions, rules, driverRewards,
    notifications, auditLogs, longStopIncidents, recordLongStopIncident, addRCAEvent, verifyRCAEvent, completeShipment, finalizeRewardPeriod,
    updateDriver, updateDriverStatus, updateDriverGps, sendNotification, setNotificationHandling, markNotificationRead,
    simulateLongStop, syncGpsLocations, triggerAutoPunishment, updateRule, adjustPoints, setDriverRewardStatus, addAudit,
    realtimeStatus, realtimeTransport, lastSyncAt, lastSyncBy, lastRemoteNotice, dismissRemoteNotice, resetDemoData,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

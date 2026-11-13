'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import {
  type Driver, type DriverStatus, type Shipment, type RCAEvent, type RCACategory, type VerificationStatus,
  type RewardTransaction, type PunishmentTransaction, type RewardRule, type DriverReward, type RewardStatus,
  type Notification, type NotificationPriority, type AuditLog, EXTERNAL_RCA_CATEGORIES,
} from '@/lib/types';
import {
  mockDrivers, mockShipments, mockRCAEvents, mockRewardTransactions, mockPunishmentTransactions,
  mockRewardRules, mockDriverRewards, mockNotifications,
} from '@/lib/mock-data';

interface NewRCAInput {
  driverId: string;
  eventDate: string;
  eventTime: string;
  category: RCACategory;
  location: string;
  duration: string;
  description: string;
  evidence?: string[];
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
  /** Tambah kejadian RCA. Kategori eksternal TIDAK mengurangi poin. */
  addRCAEvent: (input: NewRCAInput, actor: string) => RCAEvent;
  /** Verifikasi RCA. Punishment hanya diberlakukan jika status = terverifikasi_pelanggaran DAN bukan kategori eksternal. */
  verifyRCAEvent: (id: string, status: VerificationStatus, decision: string, actor: string) => void;
  updateDriver: (
    driverId: string,
    patch: Partial<Pick<Driver, 'name' | 'phone' | 'licenseNumber' | 'vehiclePlate' | 'transporterId' | 'transporterName' | 'status'>>,
    actor: string
  ) => void;
  updateDriverStatus: (driverId: string, status: DriverStatus, actor: string) => void;
  sendNotification: (driverId: string, title: string, description: string, priority: NotificationPriority, actor: string) => void;
  setNotificationHandling: (id: string, handlingStatus: Notification['handlingStatus']) => void;
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

  const addAudit = useCallback((action: string, entity: string, entityId: string, details: string, actor: string) => {
    setAuditLogs(prev => [{
      id: nid('AL'), userId: actor, userName: actor, action, entity, entityId, details,
      timestamp: new Date().toISOString(),
    }, ...prev]);
  }, []);

  const addRCAEvent = useCallback((input: NewRCAInput, actor: string): RCAEvent => {
    const driver = drivers.find(d => d.id === input.driverId);
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
      createdAt: new Date().toISOString(),
    };
    setRcaEvents(prev => [ev, ...prev]);
    addAudit('CREATE', 'rca_events', ev.id, `Kejadian ${input.category} dicatat untuk ${ev.driverName}`, actor);
    return ev;
  }, [drivers, addAudit]);

  const verifyRCAEvent = useCallback((id: string, status: VerificationStatus, decision: string, actor: string) => {
    const ev = rcaEvents.find(e => e.id === id);
    if (!ev) return;
    // Punishment hanya jika terverifikasi pelanggaran, bukan eksternal, dan belum pernah diberi poin
    const shouldPunish = status === 'terverifikasi_pelanggaran' && !ev.isExternalCause && !ev.pointsDeducted;
    const rule = rules.find(r => r.type === 'punishment' && r.isActive && r.category === ev.category);
    const pts = shouldPunish ? (rule?.points ?? 5) : 0;

    setRcaEvents(prev => prev.map(e => e.id === id ? {
      ...e, verificationStatus: status, controlTowerDecision: decision,
      verifiedBy: actor, verifiedAt: new Date().toISOString(),
      pointsDeducted: shouldPunish ? pts : e.pointsDeducted,
    } : e));

    if (shouldPunish && pts > 0) {
      setPunishTx(prev => [{
        id: nid('PT'), driverId: ev.driverId, driverName: ev.driverName, type: 'punishment', points: pts,
        reason: `${rule?.name ?? ev.category} - ${ev.id}`, rcaEventId: ev.id, ruleId: rule?.id,
        verifiedBefore: true, createdAt: new Date().toISOString(), createdBy: actor,
      }, ...prev]);
      setDrivers(prev => prev.map(d => d.id === ev.driverId ? recompute({
        ...d, totalPunishmentPoints: d.totalPunishmentPoints + pts, validViolations: d.validViolations + 1,
      }) : d));
    }
    addAudit('VERIFY', 'rca_events', id, `Status: ${status}. Keputusan: ${decision}. Poin dikurangi: ${pts}`, actor);
  }, [rcaEvents, rules, addAudit]);

  const updateDriverStatus = useCallback((driverId: string, status: DriverStatus, actor: string) => {
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, status } : d));
    setShipments(prev => prev.map(s => s.driverId === driverId && s.status !== 'completed' ? {
      ...s, driverStatus: status, status: status === 'selesai_pengiriman' ? 'completed' : s.status,
    } : s));

    // Selesai pengiriman tepat waktu -> reward otomatis sesuai aturan
    if (status === 'selesai_pengiriman') {
      const sh = shipments.find(s => s.driverId === driverId && s.status !== 'completed');
      const rule = rules.find(r => r.type === 'reward' && r.isActive && r.name === 'Pengiriman Tepat Waktu');
      const onTime = sh ? sh.isOnTime : true;
      setDrivers(prev => prev.map(d => d.id === driverId ? recompute({
        ...d, totalDeliveries: d.totalDeliveries + 1,
        onTimeDeliveries: d.onTimeDeliveries + (onTime ? 1 : 0),
        lateDeliveries: d.lateDeliveries + (onTime ? 0 : 1),
        totalRewardPoints: d.totalRewardPoints + (onTime && rule ? rule.points : 0),
      }) : d));
      if (onTime && rule) {
        const drv = drivers.find(d => d.id === driverId);
        setRewardTx(prev => [{
          id: nid('RT'), driverId, driverName: drv?.name ?? '-', type: 'reward', points: rule.points,
          reason: `Pengiriman ${sh?.suratJalanNo ?? ''} tepat waktu`, ruleId: rule.id, shipmentId: sh?.id,
          createdAt: new Date().toISOString(), createdBy: 'System',
        }, ...prev]);
      }
    }
    addAudit('UPDATE', 'drivers', driverId, `Status diubah menjadi ${status}`, actor);
  }, [shipments, rules, drivers, addAudit]);

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

  const updateRule = useCallback((id: string, patch: Partial<RewardRule>, actor: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r));
    addAudit('UPDATE', 'reward_rules', id, JSON.stringify(patch), actor);
  }, [addAudit]);

  const adjustPoints = useCallback((driverId: string, points: number, reason: string, actor: string) => {
    const drv = drivers.find(d => d.id === driverId);
    if (!drv || points === 0) return;
    if (points > 0) {
      setRewardTx(prev => [{ id: nid('RT'), driverId, driverName: drv.name, type: 'reward', points, reason: `Koreksi admin: ${reason}`, createdAt: new Date().toISOString(), createdBy: actor }, ...prev]);
      setDrivers(prev => prev.map(d => d.id === driverId ? recompute({ ...d, totalRewardPoints: d.totalRewardPoints + points }) : d));
    } else {
      const p = Math.abs(points);
      setPunishTx(prev => [{ id: nid('PT'), driverId, driverName: drv.name, type: 'punishment', points: p, reason: `Koreksi admin: ${reason}`, verifiedBefore: true, createdAt: new Date().toISOString(), createdBy: actor }, ...prev]);
      setDrivers(prev => prev.map(d => d.id === driverId ? recompute({ ...d, totalPunishmentPoints: d.totalPunishmentPoints + p }) : d));
    }
    addAudit('ADJUST_POINTS', 'drivers', driverId, `${points > 0 ? '+' : ''}${points} poin. Alasan: ${reason}`, actor);
  }, [drivers, addAudit]);

  const setDriverRewardStatus = useCallback((id: string, status: RewardStatus, actor: string) => {
    setDriverRewards(prev => prev.map(r => r.id === id ? { ...r, status, approvedBy: actor, approvedAt: new Date().toISOString() } : r));
    addAudit('UPDATE', 'driver_rewards', id, `Status reward: ${status}`, actor);
  }, [addAudit]);

  const value = useMemo(() => ({
    drivers, shipments, rcaEvents, rewardTransactions, punishmentTransactions, rules, driverRewards,
    notifications, auditLogs, addRCAEvent, verifyRCAEvent, updateDriver, updateDriverStatus, sendNotification,
    setNotificationHandling, updateRule, adjustPoints, setDriverRewardStatus, addAudit,
  }), [drivers, shipments, rcaEvents, rewardTransactions, punishmentTransactions, rules, driverRewards,
    notifications, auditLogs, addRCAEvent, verifyRCAEvent, updateDriver, updateDriverStatus, sendNotification,
    setNotificationHandling, updateRule, adjustPoints, setDriverRewardStatus, addAudit]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}


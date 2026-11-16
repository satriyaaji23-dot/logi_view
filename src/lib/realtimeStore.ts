import {
  type Driver,
  type Shipment,
  type RCAEvent,
  type RewardTransaction,
  type PunishmentTransaction,
  type RewardRule,
  type DriverReward,
  type Notification,
  type AuditLog,
  type LongStopIncident,
} from './types';

export interface SharedDataPayload {
  drivers: Driver[];
  shipments: Shipment[];
  rcaEvents: RCAEvent[];
  rewardTransactions: RewardTransaction[];
  punishmentTransactions: PunishmentTransaction[];
  rules: RewardRule[];
  driverRewards: DriverReward[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  longStopIncidents?: LongStopIncident[];
}

export interface RealtimeEnvelope {
  version: number;
  clientId: string;
  updatedAt: string;
  updatedBy: string;
  summary: string;
  data: SharedDataPayload;
}

type Listener = (envelope: RealtimeEnvelope) => void;

interface GlobalRealtimeStore {
  latest: RealtimeEnvelope | null;
  listeners: Set<Listener>;
}

const globalForRealtime = globalThis as unknown as {
  __silogRealtimeStore?: GlobalRealtimeStore;
};

function getStore(): GlobalRealtimeStore {
  if (!globalForRealtime.__silogRealtimeStore) {
    globalForRealtime.__silogRealtimeStore = {
      latest: null,
      listeners: new Set<Listener>(),
    };
  }
  return globalForRealtime.__silogRealtimeStore;
}

export function getLatestRealtimeState(): RealtimeEnvelope | null {
  return getStore().latest;
}

export function publishRealtimeState(envelope: RealtimeEnvelope): RealtimeEnvelope {
  const store = getStore();
  if (store.latest && envelope.version < store.latest.version) {
    return store.latest;
  }
  store.latest = envelope;
  for (const listener of store.listeners) {
    try {
      listener(envelope);
    } catch {
      // Abaikan listener yang sudah tertutup
    }
  }
  return store.latest;
}

export function resetServerRealtimeState(): void {
  const store = getStore();
  store.latest = null;
}

export function subscribeRealtime(listener: Listener): () => void {
  const store = getStore();
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}


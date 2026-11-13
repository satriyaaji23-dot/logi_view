export interface ServiceApiConfig {
  enabled: boolean;
  baseUrl: string;
  token: string; // Kosong berarti gunakan token dari environment variable server (.env.local / Vercel)
  authHeader: string;
  authPrefix: string;
}

export interface ApiIntegrationSettings {
  cctv: ServiceApiConfig;
  gps: ServiceApiConfig & {
    pollingIntervalSec: number;
    longStopThresholdMinutes: number;
  };
  webhook: ServiceApiConfig;
}

export interface ServerIntegrationStatus {
  cctv: {
    hasEnvToken: boolean;
    hasEnvBaseUrl: boolean;
    tokenPreview: string;
  };
  gps: {
    hasEnvToken: boolean;
    hasEnvBaseUrl: boolean;
    tokenPreview: string;
  };
  webhook: {
    hasEnvToken: boolean;
    hasEnvBaseUrl: boolean;
    tokenPreview: string;
  };
}

export const INTEGRATIONS_STORAGE_KEY = 'silog_api_integrations';

export const DEFAULT_INTEGRATIONS: ApiIntegrationSettings = {
  cctv: {
    enabled: true,
    baseUrl: '',
    token: '',
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
  },
  gps: {
    enabled: true,
    baseUrl: '',
    token: '',
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
    pollingIntervalSec: 30,
    longStopThresholdMinutes: 120,
  },
  webhook: {
    enabled: false,
    baseUrl: '',
    token: '',
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
  },
};

export function loadIntegrationSettings(): ApiIntegrationSettings {
  if (typeof window === 'undefined') return DEFAULT_INTEGRATIONS;
  try {
    const raw = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_INTEGRATIONS;
    const parsed = JSON.parse(raw) as Partial<ApiIntegrationSettings>;
    return {
      cctv: { ...DEFAULT_INTEGRATIONS.cctv, ...parsed.cctv },
      gps: { ...DEFAULT_INTEGRATIONS.gps, ...parsed.gps },
      webhook: { ...DEFAULT_INTEGRATIONS.webhook, ...parsed.webhook },
    };
  } catch {
    return DEFAULT_INTEGRATIONS;
  }
}

export function saveIntegrationSettings(settings: ApiIntegrationSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(settings));
}

export function resolveCctvEndpoint(
  template: string,
  params: { cameraId?: string; plate?: string; driverId?: string; channel?: string }
): string {
  return template
    .replace(/\{cameraId\}/gi, encodeURIComponent(params.cameraId ?? ''))
    .replace(/\{plate\}/gi, encodeURIComponent(params.plate ?? ''))
    .replace(/\{driverId\}/gi, encodeURIComponent(params.driverId ?? ''))
    .replace(/\{channel\}/gi, encodeURIComponent(params.channel ?? 'cabin'));
}


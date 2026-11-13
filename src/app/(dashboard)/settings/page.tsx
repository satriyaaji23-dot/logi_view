'use client';

import React, { useEffect, useState } from 'react';
import {
  Video, MapPin, Webhook, Eye, EyeOff, Save, CheckCircle2,
  AlertCircle, PlugZap, ShieldCheck, KeyRound,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_INTEGRATIONS,
  loadIntegrationSettings,
  saveIntegrationSettings,
  type ApiIntegrationSettings,
  type ServerIntegrationStatus,
} from '@/lib/integrations';

type ServiceKey = 'cctv' | 'gps' | 'webhook';

export default function SettingsPage() {
  const { rules, updateRule, drivers, adjustPoints, auditLogs, addAudit } = useData();
  const { user, hasRole } = useAuth();
  const actor = user?.name ?? 'system';
  const [driverId, setDriverId] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');

  // Integrasi API State
  const [apiTab, setApiTab] = useState<ServiceKey>('cctv');
  const [integrations, setIntegrations] = useState<ApiIntegrationSettings>(DEFAULT_INTEGRATIONS);
  const [serverStatus, setServerStatus] = useState<ServerIntegrationStatus | null>(null);
  const [showTokens, setShowTokens] = useState<Record<ServiceKey, boolean>>({
    cctv: false,
    gps: false,
    webhook: false,
  });
  const [savedMsg, setSavedMsg] = useState('');
  const [testResult, setTestResult] = useState<{
    service: ServiceKey;
    ok: boolean;
    message: string;
    preview?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setIntegrations(loadIntegrationSettings());
    fetch('/api/integrations/status')
      .then(r => r.json())
      .then((data: ServerIntegrationStatus) => setServerStatus(data))
      .catch(() => {});
  }, []);

  if (!hasRole('admin')) {
    return <p className="text-gray-500">Halaman ini hanya untuk Admin / Control Tower.</p>;
  }

  const updateService = (
    key: ServiceKey,
    patch: Partial<ApiIntegrationSettings['cctv'] & { pollingIntervalSec?: number; longStopThresholdMinutes?: number }>
  ) => {
    setIntegrations(prev => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const handleSaveIntegrations = (e: React.FormEvent) => {
    e.preventDefault();
    saveIntegrationSettings(integrations);
    addAudit(
      'UPDATE_API',
      'integrations',
      apiTab,
      `Konfigurasi API ${apiTab.toUpperCase()} disimpan`,
      actor
    );
    setSavedMsg(`Konfigurasi API ${apiTab.toUpperCase()} berhasil disimpan.`);
    setTimeout(() => setSavedMsg(''), 3500);
  };

  const handleTestConnection = async (service: ServiceKey) => {
    setTesting(true);
    setTestResult(null);
    const cfg = integrations[service];
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service,
          endpointUrl: cfg.baseUrl,
          token: cfg.token,
          authHeader: cfg.authHeader,
          authPrefix: cfg.authPrefix,
        }),
      });
      const json = await res.json();
      setTestResult({
        service,
        ok: Boolean(json.ok),
        message: json.message ?? 'Selesai memeriksa koneksi.',
        preview: json.preview,
      });
    } catch {
      setTestResult({
        service,
        ok: false,
        message: 'Gagal menjalankan pengujian ke endpoint API.',
      });
    } finally {
      setTesting(false);
    }
  };

  const activeCfg = integrations[apiTab];
  const activeEnv = serverStatus?.[apiTab];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pengaturan &amp; Integrasi API</h1>
        <p className="text-xs sm:text-sm text-gray-500">
          Kelola API CCTV Armada, API GPS, Webhook eksternal, serta aturan poin reward &amp; punishment.
        </p>
      </div>

      {/* Integrasi API (CCTV, GPS & Eksternal) */}
      <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <KeyRound size={18} className="text-[#0f2b5b]" />
              Integrasi API (CCTV, GPS &amp; Lainnya)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Token rahasia disimpan aman di server (<code className="bg-gray-100 px-1 rounded">.env.local</code> / Vercel Environment Variables) atau dapat diisi sementara di bawah.
            </p>
          </div>
          {serverStatus?.cctv.hasEnvToken && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full">
              <ShieldCheck size={14} />
              Token CCTV Server Aktif ({serverStatus.cctv.tokenPreview})
            </span>
          )}
        </div>

        {/* Service Tabs */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'cctv' as ServiceKey, label: 'API CCTV', icon: Video },
            { key: 'gps' as ServiceKey, label: 'API GPS', icon: MapPin },
            { key: 'webhook' as ServiceKey, label: 'API Lain / Webhook', icon: Webhook },
          ].map(t => {
            const Icon = t.icon;
            const envReady = serverStatus?.[t.key]?.hasEnvToken || Boolean(integrations[t.key].token);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setApiTab(t.key);
                  setTestResult(null);
                }}
                className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                  apiTab === t.key
                    ? 'bg-[#0f2b5b] text-white border-[#0f2b5b]'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{t.label}</span>
                {envReady && (
                  <span className={`w-2 h-2 rounded-full shrink-0 ${apiTab === t.key ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Service Form */}
        <form onSubmit={handleSaveIntegrations} className="space-y-4 border border-gray-200 rounded-xl p-4 bg-gray-50/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={activeCfg.enabled}
                onChange={e => updateService(apiTab, { enabled: e.target.checked })}
              />
              Aktifkan Integrasi {apiTab.toUpperCase()}
            </label>
            {activeEnv && (
              <span className="text-xs text-gray-500">
                Status Env Server:{' '}
                {activeEnv.hasEnvToken ? (
                  <b className="text-emerald-700">Token Terpasang ({activeEnv.tokenPreview})</b>
                ) : (
                  <span className="text-amber-700">Belum ada di .env</span>
                )}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-gray-600">
                Endpoint / Base URL {apiTab === 'cctv' ? '(mendukung {cameraId}, {plate}, {driverId}, {channel})' : ''}
              </span>
              <input
                type="url"
                value={activeCfg.baseUrl}
                onChange={e => updateService(apiTab, { baseUrl: e.target.value })}
                placeholder={
                  apiTab === 'cctv'
                    ? 'https://domain-cctv-anda.com/api/streams/{cameraId}'
                    : apiTab === 'gps'
                    ? 'https://domain-gps-anda.com/api/vehicles/positions'
                    : 'https://domain-webhook-anda.com/api/notify'
                }
                className="border border-gray-200 bg-white rounded-lg px-3 py-2 w-full mt-1"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-gray-600">
                API Key / Bearer Token {activeEnv?.hasEnvToken ? '(kosongkan untuk memakai token server .env.local)' : ''}
              </span>
              <div className="relative mt-1">
                <input
                  type={showTokens[apiTab] ? 'text' : 'password'}
                  value={activeCfg.token}
                  onChange={e => updateService(apiTab, { token: e.target.value })}
                  placeholder={
                    activeEnv?.hasEnvToken
                      ? `Menggunakan token server (${activeEnv.tokenPreview}) — isi jika ingin override`
                      : 'Tempel API token / Bearer token di sini'
                  }
                  className="border border-gray-200 bg-white rounded-lg px-3 py-2 pr-10 w-full font-mono text-xs sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowTokens(s => ({ ...s, [apiTab]: !s[apiTab] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Tampilkan atau sembunyikan token"
                >
                  {showTokens[apiTab] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-600">Nama Header Autentikasi</span>
              <input
                value={activeCfg.authHeader}
                onChange={e => updateService(apiTab, { authHeader: e.target.value })}
                placeholder="Authorization"
                className="border border-gray-200 bg-white rounded-lg px-3 py-2 w-full mt-1"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-600">Prefix Token (mis. Bearer / Token / kosong)</span>
              <input
                value={activeCfg.authPrefix}
                onChange={e => updateService(apiTab, { authPrefix: e.target.value })}
                placeholder="Bearer"
                className="border border-gray-200 bg-white rounded-lg px-3 py-2 w-full mt-1"
              />
            </label>

            {apiTab === 'gps' && (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Interval Polling GPS (detik)</span>
                  <input
                    type="number"
                    min={5}
                    value={integrations.gps.pollingIntervalSec}
                    onChange={e => updateService('gps', { pollingIntervalSec: Math.max(5, Number(e.target.value)) })}
                    className="border border-gray-200 bg-white rounded-lg px-3 py-2 w-full mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Batas Berhenti Lama / Wajib RCA (menit)</span>
                  <input
                    type="number"
                    min={30}
                    value={integrations.gps.longStopThresholdMinutes}
                    onChange={e => updateService('gps', { longStopThresholdMinutes: Math.max(30, Number(e.target.value)) })}
                    className="border border-gray-200 bg-white rounded-lg px-3 py-2 w-full mt-1"
                  />
                </label>
              </>
            )}
          </div>

          {savedMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
              <CheckCircle2 size={15} /> {savedMsg}
            </div>
          )}

          {testResult && testResult.service === apiTab && (
            <div
              className={`border text-xs px-3 py-2.5 rounded-lg space-y-1 ${
                testResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <p className="font-semibold flex items-center gap-1.5">
                {testResult.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                {testResult.message}
              </p>
              {testResult.preview && (
                <pre className="bg-white/70 border border-black/5 rounded p-2 text-[11px] overflow-x-auto font-mono">
                  {testResult.preview}
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 bg-[#0f2b5b] hover:bg-[#1a3d7a] text-white text-xs sm:text-sm font-medium px-4 py-2 rounded-lg"
            >
              <Save size={15} /> Simpan Konfigurasi
            </button>
            <button
              type="button"
              disabled={testing}
              onClick={() => handleTestConnection(apiTab)}
              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs sm:text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              <PlugZap size={15} /> {testing ? 'Menguji...' : 'Uji Koneksi API'}
            </button>
          </div>
        </form>

        <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 space-y-1">
          <p className="font-semibold">Panduan Environment Variable (Lokal `.env.local` &amp; Vercel):</p>
          <p className="font-mono text-[11px] text-blue-800">
            CCTV_API_BASE_URL, CCTV_API_TOKEN, GPS_API_BASE_URL, GPS_API_TOKEN, WEBHOOK_API_URL, WEBHOOK_API_TOKEN
          </p>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold mb-3">Aturan Reward &amp; Punishment</h2>
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs mr-2 ${r.type === 'reward' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {r.type === 'reward' ? 'Reward' : 'Punishment'}
                  </span>
                  {r.name}
                </p>
                <p className="text-xs text-gray-500">{r.description}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <input
                  type="number"
                  min={0}
                  value={r.points}
                  onChange={e => updateRule(r.id, { points: Math.max(0, Number(e.target.value)) }, actor)}
                  className="border rounded-lg px-2 py-1 w-20"
                />
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={r.isActive}
                    onChange={e => updateRule(r.id, { isActive: e.target.checked }, actor)}
                  />
                  Aktif
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold mb-3">Koreksi Poin (dengan Catatan Audit)</h2>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!driverId || !Number(points) || !reason.trim()) return;
            adjustPoints(driverId, Number(points), reason, actor);
            setPoints('');
            setReason('');
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm"
        >
          <select value={driverId} onChange={e => setDriverId(e.target.value)} className="border rounded-lg px-3 py-2 bg-white">
            <option value="">Pilih driver</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input type="number" value={points} onChange={e => setPoints(e.target.value)} placeholder="+10 atau -5" className="border rounded-lg px-3 py-2" />
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Alasan koreksi (wajib)" className="border rounded-lg px-3 py-2" />
          <button className="bg-[#0f2b5b] text-white rounded-lg px-4 py-2">Terapkan</button>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold mb-3">Log Audit</h2>
        <ul className="divide-y text-sm max-h-80 overflow-y-auto">
          {auditLogs.map(a => (
            <li key={a.id} className="py-2">
              <b>{a.action}</b> · {a.entity} {a.entityId} — {a.details}
              <span className="block text-xs text-gray-400">
                {new Date(a.timestamp).toLocaleString('id-ID')} · {a.userName}
              </span>
            </li>
          ))}
          {!auditLogs.length && <li className="py-4 text-gray-400">Belum ada aktivitas pada sesi ini.</li>}
        </ul>
      </section>
    </div>
  );
}

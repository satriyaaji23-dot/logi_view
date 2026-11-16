import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadIntegrationSettings } from './integrations';

export const DEFAULT_SUPABASE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'foto-website';

const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const envSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True jika env Supabase tersedia. Jika false, dapat menggunakan konfigurasi di Pengaturan Admin atau data simulasi. */
export const isSupabaseConfigured = Boolean(envSupabaseUrl && envSupabaseAnonKey);

/** Client Supabase default dari .env (null jika belum dikonfigurasi, agar build tetap aman). */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(envSupabaseUrl, envSupabaseAnonKey)
  : null;

let cachedKey = '';
let cachedClient: SupabaseClient | null = supabase;

export function getActiveSupabaseConfig(): {
  projectUrl: string;
  anonKey: string;
  bucketName: string;
  configured: boolean;
  source: 'env' | 'settings' | 'none';
} {
  const settings = loadIntegrationSettings().supabase;
  const settingsUrl = settings.projectUrl?.trim() ?? '';
  const settingsKey = settings.anonKey?.trim() ?? '';
  const bucketName = settings.bucketName?.trim() || DEFAULT_SUPABASE_BUCKET;

  if (settings.enabled && settingsUrl && settingsKey) {
    return {
      projectUrl: settingsUrl,
      anonKey: settingsKey,
      bucketName,
      configured: true,
      source: 'settings',
    };
  }

  if (envSupabaseUrl && envSupabaseAnonKey) {
    return {
      projectUrl: envSupabaseUrl,
      anonKey: envSupabaseAnonKey,
      bucketName,
      configured: true,
      source: 'env',
    };
  }

  return {
    projectUrl: '',
    anonKey: '',
    bucketName,
    configured: false,
    source: 'none',
  };
}

/** Ambil SupabaseClient aktif (dari pengaturan Admin atau .env.local). */
export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getActiveSupabaseConfig();
  if (!cfg.configured) return null;

  const sig = `${cfg.projectUrl}|${cfg.anonKey}`;
  if (cachedClient && cachedKey === sig) {
    return cachedClient;
  }
  cachedKey = sig;
  cachedClient = createClient(cfg.projectUrl, cfg.anonKey);
  return cachedClient;
}

export interface UploadFotoResult {
  publicUrl: string | null;
  path?: string;
  bucket: string;
  error?: string;
  notConfigured?: boolean;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Unggah foto ke Supabase Storage (bucket default 'foto-website') dan kembalikan detail + publicUrl.
 */
export async function uploadFotoDetailed(file: File, folder = ''): Promise<UploadFotoResult> {
  const cfg = getActiveSupabaseConfig();
  const client = getSupabaseClient();

  if (!client || !cfg.configured) {
    return {
      publicUrl: null,
      bucket: cfg.bucketName,
      notConfigured: true,
      error: 'Supabase belum dikonfigurasi. Isi Project URL dan Anon Public Key di .env.local atau Pengaturan & API → Supabase Storage.',
    };
  }

  const safeName = sanitizeFilename(file.name || 'foto.jpg');
  const uniqueName = `${Date.now()}-${safeName}`;
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const filePath = cleanFolder ? `${cleanFolder}/${uniqueName}` : uniqueName;

  const { error } = await client.storage.from(cfg.bucketName).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    return {
      publicUrl: null,
      bucket: cfg.bucketName,
      error: `Gagal mengunggah foto ke bucket "${cfg.bucketName}": ${error.message}`,
    };
  }

  const { data: urlData } = client.storage.from(cfg.bucketName).getPublicUrl(filePath);
  return {
    publicUrl: urlData.publicUrl,
    path: filePath,
    bucket: cfg.bucketName,
  };
}

/**
 * Fungsi ringkas uploadFoto(file) -> mengembalikan URL publik foto untuk langsung dipakai di tag <img>.
 */
export async function uploadFoto(file: File, folder = ''): Promise<string | null> {
  const result = await uploadFotoDetailed(file, folder);
  if (result.error) {
    console.error('Gagal mengunggah foto:', result.error);
  }
  return result.publicUrl;
}

export async function testSupabaseStorage(
  overrideUrl?: string,
  overrideAnonKey?: string,
  overrideBucket?: string
): Promise<{ ok: boolean; message: string; preview?: string }> {
  const active = getActiveSupabaseConfig();
  const projectUrl = overrideUrl?.trim() || active.projectUrl;
  const anonKey = overrideAnonKey?.trim() || active.anonKey;
  const bucketName = overrideBucket?.trim() || active.bucketName || DEFAULT_SUPABASE_BUCKET;

  if (!projectUrl || !anonKey) {
    return {
      ok: false,
      message: 'Project URL dan Anon Public Key Supabase belum diisi.',
    };
  }

  try {
    const client = createClient(projectUrl, anonKey);
    const { data, error } = await client.storage.from(bucketName).list('', { limit: 5 });
    if (error) {
      return {
        ok: false,
        message: `Gagal mengakses bucket "${bucketName}": ${error.message}`,
        preview: 'Pastikan bucket sudah dibuat di Supabase Storage (Public) dan RLS/Policy Storage mengizinkan akses.',
      };
    }
    return {
      ok: true,
      message: `Koneksi Supabase Storage ke bucket "${bucketName}" berhasil! (${data?.length ?? 0} file ditemukan di root)`,
      preview: JSON.stringify(
        (data ?? []).map(f => ({ name: f.name, created_at: f.created_at })),
        null,
        2
      ),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Gagal menghubungi server Supabase.',
    };
  }
}

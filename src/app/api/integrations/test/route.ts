import { NextRequest, NextResponse } from 'next/server';

function isValidExternalHttpUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      service: 'cctv' | 'gps' | 'webhook';
      endpointUrl?: string;
      token?: string;
      authHeader?: string;
      authPrefix?: string;
    };

    const envUrl =
      body.service === 'cctv'
        ? process.env.CCTV_API_BASE_URL
        : body.service === 'gps'
        ? process.env.GPS_API_BASE_URL
        : process.env.WEBHOOK_API_URL;

    const envToken =
      body.service === 'cctv'
        ? process.env.CCTV_API_TOKEN
        : body.service === 'gps'
        ? process.env.GPS_API_TOKEN
        : process.env.WEBHOOK_API_TOKEN;

    const url = (body.endpointUrl || envUrl || '').trim();
    const token = (body.token || envToken || '').trim();
    const authHeader = (body.authHeader || 'Authorization').trim();
    const authPrefix = (body.authPrefix ?? 'Bearer').trim();

    if (!url) {
      return NextResponse.json({
        ok: false,
        configured: false,
        hasToken: Boolean(token),
        message: token
          ? `Token ${body.service.toUpperCase()} terdeteksi, tetapi URL Endpoint masih kosong. Isi Endpoint URL terlebih dahulu untuk menguji koneksi.`
          : `URL Endpoint dan Token ${body.service.toUpperCase()} belum diisi.`,
      });
    }

    if (!isValidExternalHttpUrl(url)) {
      return NextResponse.json({
        ok: false,
        configured: true,
        message: 'URL harus diawali http:// atau https://',
      });
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) {
      headers[authHeader] = authPrefix ? `${authPrefix} ${token}` : token;
    }

    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - started;
      const preview = (await res.text()).slice(0, 240);

      return NextResponse.json({
        ok: res.ok,
        configured: true,
        status: res.status,
        latencyMs,
        message: res.ok
          ? `Koneksi berhasil (HTTP ${res.status}, ${latencyMs} ms).`
          : `Server merespons HTTP ${res.status} (${latencyMs} ms).`,
        preview,
      });
    } catch (err) {
      clearTimeout(timeout);
      return NextResponse.json({
        ok: false,
        configured: true,
        message: err instanceof Error ? `Koneksi gagal: ${err.message}` : 'Koneksi gagal.',
      });
    }
  } catch {
    return NextResponse.json({ ok: false, message: 'Permintaan tidak valid.' }, { status: 400 });
  }
}


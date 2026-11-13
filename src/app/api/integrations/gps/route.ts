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
      endpointUrl?: string;
      token?: string;
      authHeader?: string;
      authPrefix?: string;
    };

    const baseUrl = (body.endpointUrl || process.env.GPS_API_BASE_URL || '').trim();
    const apiToken = (body.token || process.env.GPS_API_TOKEN || '').trim();
    const authHeader = (body.authHeader || process.env.GPS_API_AUTH_HEADER || 'Authorization').trim();
    const authPrefix = (body.authPrefix ?? process.env.GPS_API_AUTH_PREFIX ?? 'Bearer').trim();

    if (!baseUrl) {
      return NextResponse.json({
        configured: false,
        hasToken: Boolean(apiToken),
        message: 'Endpoint URL API GPS belum diatur. Isi di Pengaturan API atau GPS_API_BASE_URL.',
      });
    }

    if (!isValidExternalHttpUrl(baseUrl)) {
      return NextResponse.json(
        { configured: true, ok: false, message: 'Format URL API GPS tidak valid (harus http:// atau https://).' },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiToken) {
      headers[authHeader] = authPrefix ? `${authPrefix} ${apiToken}` : apiToken;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const upstream = await fetch(baseUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);

      const contentType = upstream.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const json = await upstream.json();
        const items = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
        return NextResponse.json({
          configured: true,
          ok: upstream.ok,
          status: upstream.status,
          items,
          raw: json,
        });
      }

      return NextResponse.json({
        configured: true,
        ok: upstream.ok,
        status: upstream.status,
        message: 'Respons API GPS bukan JSON.',
      });
    } catch (err) {
      clearTimeout(timeout);
      return NextResponse.json({
        configured: true,
        ok: false,
        message: err instanceof Error ? `Gagal menghubungi server GPS: ${err.message}` : 'Gagal menghubungi server GPS.',
      });
    }
  } catch {
    return NextResponse.json({ configured: false, ok: false, message: 'Permintaan tidak valid.' }, { status: 400 });
  }
}


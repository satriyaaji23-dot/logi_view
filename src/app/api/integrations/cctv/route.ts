import { NextRequest, NextResponse } from 'next/server';
import { resolveCctvEndpoint } from '@/lib/integrations';

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
      cameraId?: string;
      vehiclePlate?: string;
      driverId?: string;
      channel?: string;
    };

    const baseTemplate = (body.endpointUrl || process.env.CCTV_API_BASE_URL || '').trim();
    const apiToken = (body.token || process.env.CCTV_API_TOKEN || '').trim();
    const authHeader = (body.authHeader || process.env.CCTV_API_AUTH_HEADER || 'Authorization').trim();
    const authPrefix = (body.authPrefix ?? process.env.CCTV_API_AUTH_PREFIX ?? 'Bearer').trim();

    if (!baseTemplate) {
      return NextResponse.json({
        configured: false,
        hasToken: Boolean(apiToken),
        message: 'Endpoint URL API CCTV belum diatur. Isi URL pada Pengaturan API atau CCTV_API_BASE_URL di environment server.',
      });
    }

    const resolvedUrl = resolveCctvEndpoint(baseTemplate, {
      cameraId: body.cameraId,
      plate: body.vehiclePlate,
      driverId: body.driverId,
      channel: body.channel,
    });

    if (!isValidExternalHttpUrl(resolvedUrl)) {
      return NextResponse.json(
        { configured: true, ok: false, message: 'Format URL API CCTV tidak valid (harus http:// atau https://).' },
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
      const upstream = await fetch(resolvedUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);

      const contentType = upstream.headers.get('content-type') ?? '';
      if (contentType.startsWith('image/')) {
        const buffer = await upstream.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return NextResponse.json({
          configured: true,
          ok: upstream.ok,
          status: upstream.status,
          snapshotUrl: `data:${contentType};base64,${base64}`,
        });
      }

      if (contentType.includes('application/json')) {
        const json = await upstream.json();
        const payload = json?.data ?? json;
        const streamUrl =
          payload?.streamUrl ??
          payload?.stream_url ??
          payload?.hlsUrl ??
          payload?.hls_url ??
          payload?.url ??
          undefined;
        const snapshotUrl =
          payload?.snapshotUrl ??
          payload?.snapshot_url ??
          payload?.imageUrl ??
          payload?.image_url ??
          undefined;

        return NextResponse.json({
          configured: true,
          ok: upstream.ok,
          status: upstream.status,
          streamUrl,
          snapshotUrl,
          data: json,
        });
      }

      const text = await upstream.text();
      return NextResponse.json({
        configured: true,
        ok: upstream.ok,
        status: upstream.status,
        streamUrl: resolvedUrl,
        message: upstream.ok ? 'Endpoint merespons non-JSON, gunakan URL stream langsung.' : text.slice(0, 200),
      });
    } catch (err) {
      clearTimeout(timeout);
      return NextResponse.json({
        configured: true,
        ok: false,
        message: err instanceof Error ? `Gagal menghubungi server CCTV: ${err.message}` : 'Gagal menghubungi server CCTV.',
      });
    }
  } catch {
    return NextResponse.json({ configured: false, ok: false, message: 'Permintaan tidak valid.' }, { status: 400 });
  }
}


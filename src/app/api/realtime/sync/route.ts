import { NextResponse } from 'next/server';
import {
  getLatestRealtimeState,
  publishRealtimeState,
  resetServerRealtimeState,
  type RealtimeEnvelope,
} from '@/lib/realtimeStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  const latest = getLatestRealtimeState();
  return NextResponse.json({
    ok: true,
    hasState: Boolean(latest),
    envelope: latest,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<RealtimeEnvelope>;
    if (!body || typeof body.version !== 'number' || !body.data || !body.clientId) {
      return NextResponse.json(
        { ok: false, message: 'Payload sinkronisasi realtime tidak valid.' },
        { status: 400 }
      );
    }

    const envelope: RealtimeEnvelope = {
      version: body.version,
      clientId: body.clientId,
      updatedAt: body.updatedAt ?? new Date().toISOString(),
      updatedBy: body.updatedBy ?? 'System',
      summary: body.summary ?? 'Pembaruan data',
      data: body.data,
    };

    const saved = publishRealtimeState(envelope);
    return NextResponse.json({
      ok: true,
      version: saved.version,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Gagal menyinkronkan data.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  resetServerRealtimeState();
  return NextResponse.json({ ok: true });
}


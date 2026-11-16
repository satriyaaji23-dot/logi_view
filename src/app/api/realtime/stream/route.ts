import { getLatestRealtimeState, subscribeRealtime } from '@/lib/realtimeStore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (eventName: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream sudah ditutup
        }
      };

      const current = getLatestRealtimeState();
      sendEvent('connected', {
        ok: true,
        hasState: Boolean(current),
        version: current?.version ?? 0,
      });

      if (current) {
        sendEvent('sync', current);
      }

      unsubscribe = subscribeRealtime(envelope => {
        sendEvent('sync', envelope);
      });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          // Abaikan jika stream tertutup
        }
      }, 20000);

      req.signal.addEventListener('abort', () => {
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {
          // Sudah tertutup
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}


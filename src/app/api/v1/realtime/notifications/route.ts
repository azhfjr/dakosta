import { getRequestId, jsonError } from "@/lib/api";
import {
  drainOutbox,
  getNotificationsSince,
  resolveReplayStart,
} from "@/lib/notifications";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CONNECTION_LIFETIME_MS = 55_000;
const POLL_INTERVAL_MS = 2_500;
const HEARTBEAT_INTERVAL_MS = 15_000;

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  let user;
  try {
    user = await getApiUser();
  } catch (error) {
    return jsonError(error, requestId);
  }

  const since = resolveReplayStart(new URL(request.url).searchParams.get("since"));
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const onRequestAbort = () => abort.abort();
  request.signal.addEventListener("abort", onRequestAbort, { once: true });

  await drainOutbox({ recipientId: user.id }).catch((error) => {
    console.error(`[notifications] drain SSE gagal ${requestId}`, error);
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (chunk: string) => {
        if (!open) return;
        controller.enqueue(encoder.encode(chunk));
      };

      const sent = new Set<string>();
      let cursor = since;
      let lastBeat = Date.now();
      const deadline = Date.now() + CONNECTION_LIFETIME_MS;

      try {
        send("retry: 3000\n\n");
        send(`: stream ${requestId}\n\n`);

        while (!abort.signal.aborted && Date.now() < deadline) {
          const items = await getNotificationsSince(user.id, cursor).catch((error) => {
            console.error(`[notifications] poll SSE gagal ${requestId}`, error);
            return [];
          });

          for (const item of items) {
            if (sent.has(item.id)) continue;
            sent.add(item.id);
            send(`id: ${item.id}\nevent: notification\ndata: ${JSON.stringify(item)}\n\n`);
          }

          if (items.length > 0) {
            cursor = new Date(items[items.length - 1]!.createdAt);
          }

          if (Date.now() - lastBeat >= HEARTBEAT_INTERVAL_MS) {
            send(`: ping ${Date.now()}\n\n`);
            lastBeat = Date.now();
          }

          await delay(POLL_INTERVAL_MS, abort.signal);
        }

        send("event: stream_end\ndata: {}\n\n");
      } catch (error) {
        if (!abort.signal.aborted) {
          console.error(`[notifications] stream SSE berhenti ${requestId}`, error);
        }
      } finally {
        open = false;
        request.signal.removeEventListener("abort", onRequestAbort);
        try {
          controller.close();
        } catch {
          // Stream sudah dibatalkan oleh klien.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

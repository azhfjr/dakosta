"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

const FALLBACK_POLL_MS = 20_000;
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

type StreamPayload = {
  id: string;
  title: string;
  body: string;
  href: string | null;
};

async function fetchUnreadCount(): Promise<number | null> {
  try {
    const response = await fetch("/api/v1/notifications/unread-count", {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { data?: { unreadCount?: number } };
    return typeof json.data?.unreadCount === "number"
      ? json.data.unreadCount
      : null;
  } catch {
    return null;
  }
}

export function NotificationStream() {
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let attempts = 0;
    const seen = new Set<string>();

    const refresh = () => {
      if (disposed) return;
      router.refresh();
    };

    const onNotification = (event: MessageEvent<string>) => {
      let payload: StreamPayload | null = null;
      try {
        payload = JSON.parse(event.data) as StreamPayload;
      } catch {
        return;
      }
      if (!payload || typeof payload.id !== "string" || seen.has(payload.id))
        return;
      if (seen.size > 300) seen.clear();
      seen.add(payload.id);

      const href =
        payload.href && payload.href.startsWith("/") ? payload.href : null;

      toast(payload.title || "Notifikasi baru", {
        description: payload.body || undefined,
        action: href
          ? { label: "Buka", onClick: () => router.push(href) }
          : undefined,
      });
      refresh();
    };

    const connect = () => {
      if (disposed || document.visibilityState !== "visible") return;
      source?.close();
      const since = encodeURIComponent(new Date().toISOString());
      const current = new EventSource(
        `/api/v1/realtime/notifications?since=${since}`,
      );
      source = current;

      current.addEventListener("notification", onNotification as EventListener);
      current.addEventListener("open", () => {
        attempts = 0;
      });
      current.addEventListener("error", () => {
        if (disposed || source !== current) return;
        current.close();
        source = null;
        const delay = Math.min(
          RECONNECT_MAX_MS,
          RECONNECT_BASE_MS * 2 ** attempts,
        );
        attempts += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      });
    };

    connect();

    let baseline: number | null = null;
    void fetchUnreadCount().then((value) => {
      if (value !== null) baseline = value;
    });

    const interval = window.setInterval(async () => {
      if (disposed || document.visibilityState !== "visible") return;
      const count = await fetchUnreadCount();
      if (count === null) return;
      const previous = baseline;
      baseline = count;
      if (previous !== null && count > previous) {
        if (!source || source.readyState !== EventSource.OPEN) {
          toast.info("Notifikasi baru", {
            description: "Kotak masuk Anda memiliki pembaruan.",
          });
        }
        refresh();
      }
    }, FALLBACK_POLL_MS);

    const onFocus = () => {
      if (!source || source.readyState !== EventSource.OPEN) refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
        if (!source) {
          attempts = 0;
          connect();
        }
      } else if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      source?.removeEventListener(
        "notification",
        onNotification as EventListener,
      );
      source?.close();
    };
  }, [router]);

  return null;
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 20_000;

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
    return typeof json.data?.unreadCount === "number" ? json.data.unreadCount : null;
  } catch {
    return null;
  }
}

export function NotificationStream() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    const seen = new Set<string>();
    const since = encodeURIComponent(new Date().toISOString());
    const source = new EventSource(`/api/v1/realtime/notifications?since=${since}`);

    const refresh = () => {
      if (disposed) return;
      router.refresh();
      void queryClient.invalidateQueries();
    };

    const onNotification = (event: MessageEvent<string>) => {
      let payload: StreamPayload | null = null;
      try {
        payload = JSON.parse(event.data) as StreamPayload;
      } catch {
        return;
      }
      if (!payload || typeof payload.id !== "string" || seen.has(payload.id)) return;
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

    source.addEventListener("notification", onNotification as EventListener);

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
        if (source.readyState !== EventSource.OPEN) {
          toast.info("Notifikasi baru", {
            description: "Kotak masuk Anda memiliki pembaruan.",
          });
        }
        refresh();
      }
    }, POLL_INTERVAL_MS);

    const onFocus = () => {
      if (source.readyState !== EventSource.OPEN) refresh();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      source.removeEventListener("notification", onNotification as EventListener);
      source.close();
    };
  }, [router, queryClient]);

  return null;
}

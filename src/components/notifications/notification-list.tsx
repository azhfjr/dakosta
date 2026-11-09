"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Archive,
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export type NotificationView = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const EVENT_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  CONTENT_SUBMITTED: {
    icon: ClipboardCheck,
    className:
      "border-brand-blue-500/30 bg-brand-blue-100/40 text-brand-blue-600",
  },
  CONTENT_APPROVED: {
    icon: CheckCircle2,
    className:
      "border-status-approved/30 bg-status-approved/10 text-status-approved",
  },
  CONTENT_REJECTED: {
    icon: XCircle,
    className:
      "border-status-rejected/30 bg-status-rejected/10 text-status-rejected",
  },
  CONTENT_REVISION_REQUESTED: {
    icon: RotateCcw,
    className:
      "border-status-revision/30 bg-status-revision/10 text-status-revision",
  },
  CONTENT_REVOKED: {
    icon: Archive,
    className: "border-border bg-surface-muted text-ink-muted",
  },
};

const FALLBACK_STYLE = {
  icon: Bell,
  className: "border-border bg-surface-muted text-ink-muted",
};

const timestampFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : timestampFormatter.format(date);
}

async function sendUpdate(body: unknown): Promise<void> {
  const response = await fetch("/api/v1/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("notifikasi gagal diperbarui");
}

export function NotificationList({ items }: { items: NotificationView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const unread = items.filter((item) => !item.readAt).length;

  async function markAll() {
    if (busy || unread === 0) return;
    setBusy(true);
    try {
      await sendUpdate({ action: "read_all" });
      toast.success("Semua notifikasi ditandai dibaca.");
      router.refresh();
    } catch {
      toast.error("Tidak dapat menandai notifikasi. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  function markOne(id: string) {
    void sendUpdate({ action: "read", ids: [id] })
      .then(() => router.refresh())
      .catch(() => undefined);
  }

  if (items.length === 0) {
    return (
      <section
        aria-label="Daftar notifikasi"
        className="rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center"
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-surface-muted text-ink-muted">
          <Bell className="size-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-base font-semibold text-foreground">
          Belum ada notifikasi
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink-muted">
          Pemberitahuan pengiriman dan keputusan validasi akan muncul di sini.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Daftar notifikasi"
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {unread > 0
            ? `${unread} notifikasi belum dibaca`
            : "Semua notifikasi sudah dibaca"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={markAll}
          disabled={busy || unread === 0}
        >
          <CheckCheck className="size-4" aria-hidden />
          Tandai semua dibaca
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {items.map((item) => {
          const isUnread = !item.readAt;
          const style = EVENT_STYLE[item.eventType] ?? FALLBACK_STYLE;
          const Icon = style.icon;

          return (
            <li
              key={item.id}
              className={isUnread ? "bg-brand-teal-100/30" : undefined}
            >
              <div className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
                <span
                  className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border sm:size-10 ${style.className}`}
                >
                  <Icon className="size-4" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className="text-sm leading-snug font-semibold text-foreground sm:text-[15px]">
                      {item.title}
                    </p>
                    <time
                      dateTime={item.createdAt}
                      className="shrink-0 text-xs whitespace-nowrap text-ink-muted"
                    >
                      {formatTimestamp(item.createdAt)}
                    </time>
                  </div>

                  <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-muted">
                    {item.body}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {item.href && item.href.startsWith("/") ? (
                      <Link
                        href={item.href}
                        onClick={() => {
                          if (isUnread) markOne(item.id);
                        }}
                        className="inline-flex min-h-9 items-center rounded-md text-sm font-medium text-brand-teal-700 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus/40"
                      >
                        Buka detail
                      </Link>
                    ) : null}
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={() => markOne(item.id)}
                        className="inline-flex min-h-9 items-center rounded-md text-sm text-ink-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus/40"
                      >
                        Tandai dibaca
                      </button>
                    ) : (
                      <span className="text-xs text-ink-muted">
                        Sudah dibaca
                      </span>
                    )}
                  </div>
                </div>

                {isUnread ? (
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-teal-500">
                    <span className="sr-only">Belum dibaca</span>
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { cachedRead, invalidateReadCacheEntry } from "@/lib/read-cache";

export type NotificationItem = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  href: string | null;
  objectType: string | null;
  objectId: string | null;
  readAt: string | null;
  createdAt: string;
};

const MAX_LIST_LIMIT = 50;
const SSE_BATCH_LIMIT = 25;
const SSE_LOOKBACK_MS = 5 * 60 * 1000;

function clampLimit(value: number | undefined, fallback: number): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 1), MAX_LIST_LIMIT);
}

function serialize(row: {
  id: string;
  eventType: string;
  title: string;
  body: string;
  href: string | null;
  objectType: string | null;
  objectId: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  return {
    id: row.id,
    eventType: row.eventType,
    title: row.title,
    body: row.body,
    href: row.href,
    objectType: row.objectType,
    objectId: row.objectId,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listNotifications(
  recipientId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<NotificationItem[]> {
  const limit = clampLimit(options.limit, 20);

  const rows = await getDb()
    .select()
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.recipientId, recipientId),
        options.unreadOnly ? isNull(schema.notifications.readAt) : undefined,
      ),
    )
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit);

  return rows.map(serialize);
}

function unreadCountKey(recipientId: string): string {
  return JSON.stringify(["unread-notifications", recipientId]);
}

export async function getUnreadNotificationCount(
  recipientId: string,
): Promise<number> {
  return cachedRead(
    unreadCountKey(recipientId),
    async () => {
      const [row] = await getDb()
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.recipientId, recipientId),
            isNull(schema.notifications.readAt),
          ),
        );

      return Number(row?.total ?? 0);
    },
    { ttlMs: 5_000 },
  );
}

export async function markNotificationsRead(
  recipientId: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;

  const updated = await getDb()
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.recipientId, recipientId),
        inArray(schema.notifications.id, ids),
        isNull(schema.notifications.readAt),
      ),
    )
    .returning({ id: schema.notifications.id });

  invalidateReadCacheEntry(unreadCountKey(recipientId));
  return updated.length;
}

export async function markAllNotificationsRead(
  recipientId: string,
): Promise<number> {
  const updated = await getDb()
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.recipientId, recipientId),
        isNull(schema.notifications.readAt),
      ),
    )
    .returning({ id: schema.notifications.id });

  invalidateReadCacheEntry(unreadCountKey(recipientId));
  return updated.length;
}

export function resolveReplayStart(input: string | null): Date {
  const now = Date.now();
  const earliest = now - SSE_LOOKBACK_MS;
  if (!input) return new Date(now);
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return new Date(now);
  return new Date(Math.min(Math.max(parsed.getTime(), earliest), now));
}

export async function getNotificationsSince(
  recipientId: string,
  since: Date,
): Promise<NotificationItem[]> {
  const rows = await getDb()
    .select()
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.recipientId, recipientId),
        gte(schema.notifications.createdAt, since),
      ),
    )
    .orderBy(asc(schema.notifications.createdAt), asc(schema.notifications.id))
    .limit(SSE_BATCH_LIMIT);

  return rows.map(serialize);
}

// Baris outbox dianggap terkirim begitu notifikasi terkait tersimpan dan
// terbaca relay; relai SSE membaca tabel notifications, bukan outbox.
export async function drainOutbox(
  options: {
    recipientId?: string;
    limit?: number;
  } = {},
): Promise<number> {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 100), 1), 500);

  const result = await getDb().execute(sql`
    update outbox_events
       set processed_at = now(),
           attempts = attempts + 1,
           last_error = null
     where id in (
       select id
         from outbox_events
        where processed_at is null
          and (next_retry_at is null or next_retry_at <= now())
          ${options.recipientId ? sql`and recipient_id = ${options.recipientId}` : sql``}
        order by created_at
        limit ${limit}
     )
    returning id
  `);

  return (result.rows as unknown as Array<{ id: string }>).length;
}

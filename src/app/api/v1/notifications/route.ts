import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import {
  drainOutbox,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from "@/lib/notifications";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) => value === "true" || value === "1"),
});

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("read"),
    ids: z.array(z.string().uuid()).min(1).max(100),
  }),
  z.object({ action: z.literal("read_all") }),
]);

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await getApiUser();
    const params = new URL(request.url).searchParams;
    const query = listQuerySchema.parse({
      limit: params.get("limit") ?? undefined,
      unreadOnly: params.get("unreadOnly") ?? undefined,
    });

    const [items, unreadCount] = await Promise.all([
      listNotifications(user.id, { limit: query.limit, unreadOnly: query.unreadOnly }),
      getUnreadNotificationCount(user.id),
    ]);

    await drainOutbox({ recipientId: user.id }).catch((error) => {
      console.error(`[notifications] drain gagal ${requestId}`, error);
    });

    return jsonOk(
      { items, unreadCount },
      { requestId, meta: { count: items.length, unreadCount } },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function PATCH(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await getApiUser();
    const input = updateSchema.parse(await readJson(request));

    const updated =
      input.action === "read_all"
        ? await markAllNotificationsRead(user.id)
        : await markNotificationsRead(user.id, input.ids);

    const unreadCount = await getUnreadNotificationCount(user.id);

    return jsonOk({ updated, unreadCount }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

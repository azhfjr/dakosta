import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await getApiUser();
    const unreadCount = await getUnreadNotificationCount(user.id);
    return jsonOk({ unreadCount }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

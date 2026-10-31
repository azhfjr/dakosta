import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { drainOutbox } from "@/lib/notifications";
import { getApiUserWithRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const admin = await getApiUserWithRole("ADMIN");
    const processed = await drainOutbox({ limit: 200 });

    await recordAudit({
      actorId: admin.id,
      actorRole: admin.role,
      action: "OUTBOX_DRAINED",
      recordType: "OUTBOX",
      recordId: null,
      after: { processed },
      requestId,
    });

    return jsonOk({ processed }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

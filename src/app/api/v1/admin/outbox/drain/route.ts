import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertNotDemoActor } from "@/lib/authz/demo-guard";
import { assertSameOrigin, requireStepUp } from "@/lib/authz/guards";
import { drainOutbox } from "@/lib/notifications";
import { guardRateLimit } from "@/lib/rate-limit";
import { getApiUserWithRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const admin = await getApiUserWithRole("ADMIN");
    assertNotDemoActor(admin);
    await requireStepUp();
    await guardRateLimit(request, "mutation", "outbox-drain");

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

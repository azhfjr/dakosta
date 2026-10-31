import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertSameOrigin, requireMasterApi } from "@/lib/authz/guards";
import { updateRegion, updateRegionInputSchema } from "@/lib/hierarchy-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    const { id } = await context.params;
    const body = updateRegionInputSchema.parse(await readJson(request));
    await updateRegion(id, body);

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "REGION_UPDATED",
      recordType: "REGION",
      recordId: id,
      after: { code: body.code.toUpperCase(), name: body.name, status: body.status },
      regionId: id,
      requestId,
      source: "API",
    });

    return jsonOk({ id }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

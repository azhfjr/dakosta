import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertSameOrigin, requireMasterApi } from "@/lib/authz/guards";
import {
  updateOrganization,
  updateOrganizationInputSchema,
} from "@/lib/hierarchy-admin";

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
    const body = updateOrganizationInputSchema.parse(await readJson(request));
    await updateOrganization(id, body);

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "ORGANIZATION_UPDATED",
      recordType: "ORGANIZATION",
      recordId: id,
      after: {
        name: body.name,
        organizationType: body.organizationType,
        faskesClass: body.faskesClass ?? null,
        faskesCode: body.faskesCode ?? null,
        status: body.status,
      },
      branchId: body.branchOfficeId,
      organizationId: id,
      requestId,
      source: "API",
    });

    return jsonOk({ id }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

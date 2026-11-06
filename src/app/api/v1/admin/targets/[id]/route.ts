import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertNotDemoActor } from "@/lib/authz/demo-guard";
import {
  assertSameOrigin,
  requireMasterApi,
  requireStepUp,
} from "@/lib/authz/guards";
import { errors } from "@/lib/errors";
import { deleteTarget, findTarget, updateTarget } from "@/lib/targets";
import { parseUuidParam } from "@/lib/validation/params";
import { targetUpdateSchema } from "@/lib/validation/target";

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
    assertNotDemoActor(master);
    await requireStepUp();
    const { id } = await context.params;
    const targetId = parseUuidParam(id, "ID target");

    const before = await findTarget(targetId);
    if (!before) throw errors.notFound("Target tidak ditemukan.");

    const body = targetUpdateSchema.parse(await readJson(request));
    await updateTarget(
      targetId,
      {
        ...(body.stakeholderId !== undefined
          ? { stakeholderId: body.stakeholderId ?? null }
          : {}),
        ...(body.subTheme !== undefined
          ? { subTheme: body.subTheme ?? null }
          : {}),
        ...(body.targetCount !== undefined
          ? { targetCount: body.targetCount }
          : {}),
        ...(body.reportingUnit !== undefined
          ? { reportingUnit: body.reportingUnit }
          : {}),
      },
      master.userId,
    );

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "TARGET_UPDATED",
      recordType: "KPI_TARGET",
      recordId: targetId,
      before: {
        stakeholderId: before.stakeholderId,
        subTheme: before.subTheme,
        targetCount: before.targetCount,
        reportingUnit: before.reportingUnit,
      },
      after: body as Record<string, unknown>,
      requestId,
      source: "APP",
    });

    return jsonOk({ id: targetId }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    assertNotDemoActor(master);
    await requireStepUp();
    const { id } = await context.params;
    const targetId = parseUuidParam(id, "ID target");

    const before = await findTarget(targetId);
    if (!before) throw errors.notFound("Target tidak ditemukan.");

    await deleteTarget(targetId, master.userId);

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "TARGET_DELETED",
      recordType: "KPI_TARGET",
      recordId: targetId,
      before: {
        stakeholderId: before.stakeholderId,
        subTheme: before.subTheme,
        targetCount: before.targetCount,
        periodStart: before.periodStart,
        periodEnd: before.periodEnd,
      },
      requestId,
      source: "APP",
    });

    return jsonOk({ id: targetId }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

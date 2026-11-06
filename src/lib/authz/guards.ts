import "server-only";

import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit";
import { AppError, errors } from "@/lib/errors";

import { getAuthContext, hasCapability } from "./context";
import { hasRecentStepUp } from "./step-up";
import type { AppRole, AuthContext, Capability } from "./types";

export { assertSameOrigin } from "./same-origin";

type PageOptions = {
  allowPasswordChangePending?: boolean;
  allowPendingLocation?: boolean;
};

export function needsLocationActivation(
  ctx: Pick<AuthContext, "role" | "locationStatus" | "locationGraceDeadline">,
): boolean {
  if (ctx.role === "MASTER_ADMIN") return false;
  if (ctx.locationStatus === "VERIFIED" || ctx.locationStatus === "EXEMPT") {
    return false;
  }
  if (ctx.locationStatus === "GRACE") {
    return Boolean(
      ctx.locationGraceDeadline &&
      ctx.locationGraceDeadline.getTime() <= Date.now(),
    );
  }
  return true;
}

export async function requireAuth(
  options: PageOptions = {},
): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/masuk");
  if (ctx.mustChangePassword && !options.allowPasswordChangePending) {
    redirect("/ganti-password");
  }
  if (!options.allowPendingLocation && needsLocationActivation(ctx)) {
    redirect("/aktivasi-lokasi");
  }
  return ctx;
}

export async function requireRole(...roles: AppRole[]): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!roles.includes(ctx.role)) {
    await recordAudit({
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: "ACCESS_DENIED",
      recordType: "ROUTE",
      recordId: ctx.homePath,
      after: { reason: "role_mismatch", allowed: roles },
      branchId: ctx.scope.kind === "BRANCH" ? ctx.scope.branchId : null,
      regionId:
        ctx.scope.kind === "REGION" || ctx.scope.kind === "BRANCH"
          ? ctx.scope.regionId
          : null,
    });
    redirect("/akses-ditolak");
  }
  return ctx;
}

export async function requireCapability(
  capability: Capability,
): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!hasCapability(ctx, capability)) {
    await recordAudit({
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: "ACCESS_DENIED",
      recordType: "ROUTE",
      recordId: ctx.homePath,
      after: { reason: "capability_missing", capability },
    });
    redirect("/akses-ditolak");
  }
  return ctx;
}

export async function requireMaster(): Promise<AuthContext> {
  return requireRole("MASTER_ADMIN");
}

export async function getApiAuth(
  options: PageOptions = {},
): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw errors.unauthorized();
  if (ctx.mustChangePassword && !options.allowPasswordChangePending) {
    throw new AppError(
      "PASSWORD_CHANGE_REQUIRED",
      "Ubah kata sandi terlebih dahulu sebelum melanjutkan.",
      403,
    );
  }
  if (!options.allowPendingLocation && needsLocationActivation(ctx)) {
    throw new AppError(
      "LOCATION_ACTIVATION_REQUIRED",
      "Aktifkan lokasi perangkat terlebih dahulu sebelum melanjutkan.",
      403,
    );
  }
  return ctx;
}

export async function requireApiCapability(
  capability: Capability,
): Promise<AuthContext> {
  const ctx = await getApiAuth();
  if (!hasCapability(ctx, capability)) {
    await recordAudit({
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: "ACCESS_DENIED",
      recordType: "API",
      recordId: capability,
      after: { reason: "capability_missing", capability },
    });
    throw errors.forbidden();
  }
  return ctx;
}

export async function requireApiRole(
  ...roles: AppRole[]
): Promise<AuthContext> {
  const ctx = await getApiAuth();
  if (!roles.includes(ctx.role)) {
    await recordAudit({
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: "ACCESS_DENIED",
      recordType: "API",
      recordId: roles.join(","),
      after: { reason: "role_mismatch" },
    });
    throw errors.forbidden();
  }
  return ctx;
}

export async function requireMasterApi(): Promise<AuthContext> {
  return requireApiRole("MASTER_ADMIN");
}

export async function requireStepUp(): Promise<AuthContext> {
  const ctx = await getApiAuth();
  if (!(await hasRecentStepUp(ctx.userId))) {
    throw new AppError(
      "STEP_UP_REQUIRED",
      "Konfirmasi kata sandi diperlukan untuk tindakan sensitif ini.",
      403,
      { reason: "recent_login_required" },
    );
  }
  return ctx;
}

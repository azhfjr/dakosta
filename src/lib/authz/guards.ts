import "server-only";

import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit";
import { AppError, errors } from "@/lib/errors";

import { getAuthContext, hasCapability } from "./context";
import { hasRecentStepUp } from "./step-up";
import type { AppRole, AuthContext, Capability } from "./types";

type PageOptions = { allowPasswordChangePending?: boolean };

export async function requireAuth(options: PageOptions = {}): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/masuk");
  if (ctx.mustChangePassword && !options.allowPasswordChangePending) {
    redirect("/ganti-password");
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

export async function requireApiRole(...roles: AppRole[]): Promise<AuthContext> {
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

/**
 * CSRF defence for cookie-authenticated mutations. Browsers send Origin on
 * cross-site writes; a mismatch is rejected. Non-browser clients without an
 * Origin header still rely on SameSite cookies and bearer-free session rules.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) throw errors.forbidden("Permintaan lintas asal ditolak.");
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      throw errors.forbidden("Permintaan lintas asal ditolak.");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw errors.forbidden("Asal permintaan tidak valid.");
  }
}

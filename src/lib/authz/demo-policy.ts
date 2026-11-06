import { errors } from "@/lib/errors";

export const DEMO_MUTATION_MESSAGE =
  "Akun demo tidak dapat menjalankan tindakan ini.";

/**
 * Generic containment for demo actors on master-only mutations that are not
 * covered by the account or hierarchy guards.
 */
export function assertNotDemoActor(ctx: { isDemo: boolean }): void {
  if (ctx.isDemo) throw errors.forbidden(DEMO_MUTATION_MESSAGE);
}

/**
 * Review endpoints are shared by Master and branch reviewers. Blocking every
 * demo actor there would break the branch demo workflow, so containment only
 * applies to demo Master actors.
 */
export function assertNotDemoMaster(ctx: {
  isDemo: boolean;
  role: string;
}): void {
  if (ctx.isDemo && ctx.role === "MASTER_ADMIN") {
    throw errors.forbidden(DEMO_MUTATION_MESSAGE);
  }
}

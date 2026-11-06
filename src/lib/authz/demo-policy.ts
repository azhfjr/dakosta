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

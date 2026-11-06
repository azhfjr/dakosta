import "server-only";

import { errors } from "@/lib/errors";

import { getApiAuth } from "./guards";

export { assertNotDemoActor, DEMO_MUTATION_MESSAGE } from "./demo-policy";

export {
  PROTECTED_ACCOUNT_EMAILS,
  isProtectedAccountEmail,
} from "./protected-accounts";

/**
 * Demo accounts are seeded into the live database for showcase purposes. They
 * must never be able to mutate the real Master account, provision accounts, or
 * reshape the hierarchy, even though their role is MASTER_ADMIN.
 */
const ACCOUNT_MESSAGE =
  "Akun demo tidak dapat mengubah akun atau mengimpor pengguna.";
const HIERARCHY_MESSAGE =
  "Akun demo tidak dapat mengubah wilayah, cabang, atau organisasi.";

export async function assertDemoCannotManageAccounts(): Promise<void> {
  const ctx = await getApiAuth();
  if (ctx.isDemo) throw errors.forbidden(ACCOUNT_MESSAGE);
}

export async function assertDemoCannotManageHierarchy(): Promise<void> {
  const ctx = await getApiAuth();
  if (ctx.isDemo) throw errors.forbidden(HIERARCHY_MESSAGE);
}

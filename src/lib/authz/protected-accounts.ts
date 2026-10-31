/**
 * Accounts that demo tooling must never delete or modify. Kept free of
 * `server-only` so operational scripts can import the same list.
 */
export const PROTECTED_ACCOUNT_EMAILS = ["admin@dakosta.local"] as const;

export function isProtectedAccountEmail(email: string): boolean {
  return (PROTECTED_ACCOUNT_EMAILS as readonly string[]).includes(
    email.trim().toLowerCase(),
  );
}

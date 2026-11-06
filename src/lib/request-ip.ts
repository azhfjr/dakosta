function lastHop(value: string | null): string | null {
  if (!value) return null;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) ?? null;
}

/**
 * Vercel terminates the connection and writes x-real-ip / x-vercel-forwarded-for
 * itself. Fall back to the right-most XFF hop so a client cannot spoof the key
 * by prepending an address.
 */
export function getClientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return (
    lastHop(request.headers.get("x-vercel-forwarded-for")) ??
    lastHop(request.headers.get("x-forwarded-for")) ??
    "unknown"
  );
}

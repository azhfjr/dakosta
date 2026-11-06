import { errors } from "@/lib/errors";

/**
 * CSRF defence for cookie-authenticated mutations. Browsers send Origin (or at
 * least Referer) on writes; a request carrying neither cannot prove it came
 * from a browser session and is rejected.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!origin && !referer) {
    throw errors.forbidden("Permintaan tanpa asal ditolak.");
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) throw errors.forbidden("Permintaan lintas asal ditolak.");

  let sourceHost: string;
  try {
    sourceHost = new URL(origin ?? referer!).host;
  } catch {
    throw errors.forbidden("Asal permintaan tidak valid.");
  }
  if (sourceHost !== host) {
    throw errors.forbidden("Permintaan lintas asal ditolak.");
  }
}

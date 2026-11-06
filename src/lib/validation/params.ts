import { errors } from "@/lib/errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Route parameters must fail as a 400, never reach the database as a cast error. */
export function parseUuidParam(value: string, label = "ID"): string {
  if (!isUuid(value)) {
    throw errors.validation(`${label} tidak valid.`);
  }
  return value;
}

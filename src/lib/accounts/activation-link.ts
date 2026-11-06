import { createHash, randomBytes } from "node:crypto";

export const INVITATION_TTL_HOURS = 48;

const INVITATION_TTL_MS = INVITATION_TTL_HOURS * 60 * 60 * 1000;

export function buildActivationUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/aktivasi-akun?token=${encodeURIComponent(token)}`;
}

export function createInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

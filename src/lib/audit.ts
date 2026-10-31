import "server-only";

import { getDb, schema } from "@/db";
import type { AppRole } from "@/lib/session";

export async function recordAudit(entry: {
  actorId: string | null;
  actorRole: AppRole | "SYSTEM";
  action: string;
  recordType: string;
  recordId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string | null;
}): Promise<void> {
  try {
    await getDb()
      .insert(schema.auditLogs)
      .values({
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        recordType: entry.recordType,
        recordId: entry.recordId ?? null,
        before: entry.before ?? null,
        after: entry.after ?? null,
        requestId: entry.requestId ?? null,
      });
  } catch (error) {
    console.error("[audit] gagal menulis jejak audit", error);
  }
}

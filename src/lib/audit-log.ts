import "server-only";

import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";

import { getDb, schema } from "@/db";

export type AuditLogRow = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string;
  action: string;
  recordType: string;
  recordId: string | null;
  requestId: string | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
};

export type AuditLogPage = {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  actions: string[];
};

export async function listAuditLogs(options: {
  page?: number;
  pageSize?: number;
  action?: string;
} = {}): Promise<AuditLogPage> {
  const db = getDb();
  const pageSize = Math.min(Math.max(options.pageSize ?? 40, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const conditions: SQL[] = [];
  if (options.action) {
    conditions.push(eq(schema.auditLogs.action, options.action));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRows, actionRows, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(schema.auditLogs)
      .where(where),
    db
      .selectDistinct({ action: schema.auditLogs.action })
      .from(schema.auditLogs)
      .orderBy(asc(schema.auditLogs.action)),
    db
      .select({
        id: schema.auditLogs.id,
        actorId: schema.auditLogs.actorId,
        actorName: schema.user.name,
        actorRole: schema.auditLogs.actorRole,
        action: schema.auditLogs.action,
        recordType: schema.auditLogs.recordType,
        recordId: schema.auditLogs.recordId,
        requestId: schema.auditLogs.requestId,
        after: schema.auditLogs.after,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.user, eq(schema.user.id, schema.auditLogs.actorId))
      .where(where)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    pageSize,
    actions: actionRows.map((row) => row.action),
  };
}

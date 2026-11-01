import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return Response.json(
      { status: "ok", db: "not_configured" },
      { status: 503 },
    );
  }

  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", db: "ok" });
  } catch {
    return Response.json(
      { status: "degraded", db: "unavailable" },
      { status: 503 },
    );
  }
}

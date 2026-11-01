import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
};

export async function consumeRateLimit(options: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSeconds } = options;

  const runQuery = () =>
    getDb().execute(sql`
      insert into demo_rate_limits (key, window_start, count)
      values (
        ${key},
        to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}),
        1
      )
      on conflict (key) do update set
        count = case
          when demo_rate_limits.window_start = excluded.window_start
          then demo_rate_limits.count + 1
          else 1
        end,
        window_start = excluded.window_start
      returning count
    `);

  let result;
  try {
    result = await runQuery();
  } catch (error) {
    // A dropped pooled connection must not fail sign-in; retry once.
    if (!isTransientConnectionError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 150));
    result = await runQuery();
  }

  const rows = result.rows as unknown as Array<{ count: number }>;
  const count = Number(rows[0]?.count ?? 1);

  return {
    allowed: count <= limit,
    count,
    limit,
    retryAfterSeconds: windowSeconds,
  };
}

function isTransientConnectionError(error: unknown): boolean {
  const cause = (error as { cause?: unknown } | null)?.cause;
  const text = `${error instanceof Error ? error.message : String(error)} ${
    cause instanceof Error ? cause.message : String(cause ?? "")
  }`;
  return /connection terminated|econnreset|fetch failed|timeout|502|503|504/i.test(
    text,
  );
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function getRateLimitHeaders(
  result: RateLimitResult,
): Promise<Record<string, string>> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(Math.max(0, result.limit - result.count)),
    "RateLimit-Reset": String(result.retryAfterSeconds),
    ...(result.allowed
      ? {}
      : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}

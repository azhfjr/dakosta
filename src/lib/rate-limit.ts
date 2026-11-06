import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { AppError } from "@/lib/errors";
import { getClientIp } from "@/lib/request-ip";

export { getClientIp } from "@/lib/request-ip";

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

export const RATE_LIMIT_PRESETS = {
  auth: { limit: 30, envKey: "RATE_LIMIT_AUTH_PER_MINUTE" },
  mutation: { limit: 120, envKey: "RATE_LIMIT_MUTATION_PER_MINUTE" },
  activation: { limit: 10, envKey: "RATE_LIMIT_ACTIVATION_PER_MINUTE" },
  demoLogin: { limit: 20, envKey: "RATE_LIMIT_DEMO_LOGIN_PER_MINUTE" },
} as const;

export type RateLimitPreset = keyof typeof RATE_LIMIT_PRESETS;

function limitFor(preset: RateLimitPreset): number {
  const { limit, envKey } = RATE_LIMIT_PRESETS[preset];
  const override = Number(process.env[envKey]);
  return Number.isFinite(override) && override >= 0
    ? Math.floor(override)
    : limit;
}

/**
 * Throws a 429 when the caller exceeds its bucket. `scope` separates buckets
 * (auth, submissions, etc.) while the key is always IP-bound.
 */
export async function guardRateLimit(
  request: Request,
  preset: RateLimitPreset,
  scope: string,
): Promise<void> {
  const limit = limitFor(preset);
  if (limit === 0) return;
  const result = await consumeRateLimit({
    key: `${scope}:${getClientIp(request)}`,
    limit,
    windowSeconds: 60,
  });
  if (!result.allowed) {
    throw new AppError(
      "RATE_LIMITED",
      "Terlalu banyak permintaan. Coba lagi.",
      429,
      { retryAfterSeconds: result.retryAfterSeconds },
    );
  }
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

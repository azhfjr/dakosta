import { config } from "dotenv";

export type DbTarget = "local" | "staging" | "production";

export function resolveDbTarget(): DbTarget {
  const arg = process.argv.find((value) => value.startsWith("--target="));
  const fromArg = arg?.split("=")[1];
  const raw = (fromArg ?? process.env.DB_TARGET ?? "local").toLowerCase();
  if (raw === "staging" || raw === "production") return raw;
  return "local";
}

/**
 * Loads environment values for script execution. Staging uses a dedicated,
 * gitignored file so operational scripts never touch production by accident.
 * Values are never printed.
 */
export function loadScriptEnv(target: DbTarget = resolveDbTarget()): DbTarget {
  if (target === "staging") {
    config({ path: ".env.staging.local", override: true, quiet: true });
  } else if (target === "production") {
    // The pulled production file must win over the developer's .env.local.
    config({ path: ".env.local", override: true, quiet: true });
    config({ path: ".env.production.local", override: true, quiet: true });
    config({ override: true, quiet: true });
  } else {
    config({ path: ".env.local", override: true, quiet: true });
    config({ override: true, quiet: true });
  }
  return target;
}

export function requireDatabaseUrlForScript(): string {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL belum dikonfigurasi untuk target ini.");
  }
  return url;
}

export function describeTarget(target: DbTarget): string {
  const appEnv = process.env.APP_ENV ?? "(derived)";
  return `target=${target} app_env=${appEnv}`;
}

/**
 * Demo seed/reset must never reach a deployed database by accident. The local
 * target loads `.env.local`, which on developer machines can point at the
 * production Neon branch, so it needs an explicit opt-in.
 */
export function assertDestructiveTargetAllowed(
  target: DbTarget,
  action: string,
): void {
  const runtimeEnv = process.env.APP_ENV ?? process.env.VERCEL_ENV;
  if (target === "production" || runtimeEnv === "production") {
    throw new Error(
      `${action} dilarang di production. Tidak ada perubahan yang dilakukan.`,
    );
  }
  if (target === "local" && !process.env.APP_ENV) {
    if (process.env.ALLOW_LOCAL_DEMO_SEED !== "yes") {
      throw new Error(
        `${action} ditolak: target local tidak menyatakan APP_ENV dan .env.local dapat menunjuk basis data terdeploy. ` +
          "Gunakan --target=staging, atau set ALLOW_LOCAL_DEMO_SEED=yes bila basis data lokal memang aman.",
      );
    }
  }
}

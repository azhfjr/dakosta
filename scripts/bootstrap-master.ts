import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";

import * as schema from "../src/db/schema";
import {
  describeTarget,
  loadScriptEnv,
  requireDatabaseUrlForScript,
} from "./_env";

const target = process.argv
  .find((value) => value.startsWith("--target="))
  ?.split("=")[1];
if (target !== "production") {
  throw new Error(
    "Bootstrap Master hanya boleh dijalankan dengan --target=production. Tidak ada perubahan yang dilakukan.",
  );
}

loadScriptEnv("production");

if (process.env.BOOTSTRAP_CONFIRM !== "bootstrap-master") {
  throw new Error(
    "Bootstrap Master memerlukan BOOTSTRAP_CONFIRM=bootstrap-master. Tidak ada perubahan yang dilakukan.",
  );
}

function requireEmail(): string {
  const email = process.env.BOOTSTRAP_MASTER_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(
      "BOOTSTRAP_MASTER_EMAIL belum diisi dengan format email yang valid.",
    );
  }
  return email;
}

function resolvePassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.BOOTSTRAP_MASTER_PASSWORD;
  if (fromEnv) {
    if (fromEnv.length < 12) {
      throw new Error("BOOTSTRAP_MASTER_PASSWORD minimal 12 karakter.");
    }
    return { password: fromEnv, generated: false };
  }
  return {
    password: `${randomBytes(15).toString("base64url")}Aa1!`,
    generated: true,
  };
}

async function main(): Promise<void> {
  const email = requireEmail();
  const name =
    process.env.BOOTSTRAP_MASTER_NAME?.trim() || "Master Admin DAKOSTA";
  const { password, generated } = resolvePassword();

  const pool = new Pool({
    connectionString: requireDatabaseUrlForScript(),
    max: 1,
  });
  const db = drizzle(pool, { schema });

  try {
    const [existingMaster] = await db
      .select({ total: sql<number>`count(*)` })
      .from(schema.userMemberships)
      .innerJoin(
        schema.userProfiles,
        eq(schema.userProfiles.userId, schema.userMemberships.userId),
      )
      .where(
        and(
          eq(schema.userMemberships.role, "MASTER_ADMIN"),
          isNull(schema.userMemberships.revokedAt),
          eq(schema.userProfiles.status, "ACTIVE"),
        ),
      );

    if (Number(existingMaster?.total ?? 0) > 0) {
      throw new Error(
        "Sudah ada Master Admin aktif. Bootstrap dibatalkan; gunakan alur akun di aplikasi.",
      );
    }

    const [existingEmail] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);

    if (existingEmail) {
      throw new Error(
        "Email tersebut sudah terdaftar. Bootstrap dibatalkan; gunakan alur reset kata sandi.",
      );
    }

    const passwordHash = await hashPassword(password);
    const userId = randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(schema.user).values({
        id: userId,
        name,
        email,
        emailVerified: true,
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(schema.account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(schema.userProfiles).values({
        userId,
        mustChangePassword: true,
        isDemo: false,
        active: true,
        status: "ACTIVE",
        locationStatus: "EXEMPT",
        displayTitle: "Master Admin DAKOSTA",
      });

      await tx.insert(schema.userRoleMemberships).values({
        userId,
        role: "ADMIN",
      });

      await tx.insert(schema.userMemberships).values({
        userId,
        role: "MASTER_ADMIN",
      });

      await tx.insert(schema.auditLogs).values({
        actorId: null,
        actorRole: "SYSTEM",
        action: "BOOTSTRAP_MASTER",
        recordType: "AUTH",
        recordId: userId,
        after: { role: "MASTER_ADMIN", source: "bootstrap_script" },
        source: "SCRIPT",
      });
    });

    const directory = join(process.cwd(), ".secrets");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = join(directory, `bootstrap-master-${stamp}.txt`);
    await writeFile(
      file,
      [
        "DAKOSTA bootstrap Master Admin",
        `dibuat: ${new Date().toISOString()}`,
        `email: ${email}`,
        `kata_sandi_sementara: ${password}`,
        "",
        "Wajib ganti kata sandi saat masuk pertama. Hapus berkas ini setelah kredensial diserahkan.",
      ].join("\n"),
      { encoding: "utf8", mode: 0o600 },
    );

    console.log(
      `Bootstrap Master Admin selesai (${describeTarget("production")}).`,
    );
    console.log(`Kredensial awal disimpan di: ${file}`);
    console.log(
      generated
        ? "Kata sandi dibuat otomatis. Nilai tidak dicetak; buka berkas untuk menyerahkannya."
        : "Kata sandi diambil dari environment. Nilai tidak dicetak.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

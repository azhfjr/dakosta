import { loadScriptEnv } from "./_env";

const target = loadScriptEnv();

import { Pool } from "@neondatabase/serverless";

function arg(name: string, fallback?: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match ? match.split("=").slice(1).join("=") : fallback;
}

type Candidate = {
  status: string;
  total: string;
};

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const confirm = arg("confirm");
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");

  if (apply && confirm !== "demo-only") {
    throw new Error(
      "Tambahkan --apply --confirm=demo-only untuk menandai konten buatan akun demo.",
    );
  }

  const pool = new Pool({ connectionString, max: 2 });

  try {
    const before = await pool.query<Candidate>(`
      select s.status, count(*)::text as total
        from content_submissions s
        join "user" u on u.id = s.created_by
        join user_profiles p on p.user_id = u.id
       where p.is_demo = true
         and s.is_demo = false
       group by s.status
       order by s.status
    `);

    const pending = before.rows.reduce(
      (sum, row) => sum + Number(row.total),
      0,
    );

    console.log(`Target lingkungan: ${target}`);
    console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
    console.log(`Konten buatan akun demo dengan is_demo=false: ${pending}`);
    for (const row of before.rows) {
      console.log(`  - ${row.status}: ${row.total}`);
    }

    if (pending === 0) {
      console.log("Tidak ada baris yang perlu diubah.");
      return;
    }
    if (!apply) {
      console.log("Tidak ada perubahan. Jalankan ulang dengan --apply.");
      return;
    }

    const updated = await pool.query<{ id: string }>(`
      update content_submissions s
         set is_demo = true,
             updated_at = now()
        from user_profiles p
       where p.user_id = s.created_by
         and p.is_demo = true
         and s.is_demo = false
      returning s.id
    `);

    const after = await pool.query<{ total: string }>(`
      select count(*)::text as total
        from content_submissions s
        join user_profiles p on p.user_id = s.created_by
       where p.is_demo = true
         and s.is_demo = false
    `);

    console.log(`Baris ditandai is_demo=true: ${updated.rowCount ?? 0}`);
    console.log(`Sisa baris belum ditandai: ${after.rows[0]?.total ?? "0"}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

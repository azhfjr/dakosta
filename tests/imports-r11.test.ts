import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "../src/db/schema";
import {
  ACCOUNT_IMPORT_HEADERS,
  IMPORT_MAX_ROWS,
  exampleAccountCsv,
  importResultsCsv,
  parseConflictPolicy,
  parseCsv,
  previewImport,
  templateCsv,
} from "@/lib/imports/accounts";

const MIGRATIONS = [
  "0000_goofy_dagger.sql",
  "0001_fluffy_serpent_society.sql",
  "0002_v4_revoke_action.sql",
  "0003_content_taxonomy_and_review.sql",
  "0004_v1_1_foundations.sql",
  "0005_v1_1_perf_indexes.sql",
  "0006_v1_2_imports_sync.sql",
];

const MASTER_ID = "imports-r11-master";
const REGION_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const ORG_ID = "33333333-3333-4333-8333-333333333333";
const EXISTING_USER_ID = "existing-stakeholder-user";

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

function csv(rows: Record<string, string>[]): string {
  const lines = [
    ACCOUNT_IMPORT_HEADERS.join(","),
    ...rows.map((row) =>
      ACCOUNT_IMPORT_HEADERS.map((header) => row[header] ?? "").join(","),
    ),
  ];
  return lines.join("\n");
}

function baseRow(overrides: Record<string, string> = {}) {
  return {
    nama: "Budi Santoso",
    email: "budi@instansi.go.id",
    peran: "stakeholder",
    wilayah: "",
    cabang: "",
    organisasi: "FKTP-BDG-001",
    jabatan: "Humas",
    ...overrides,
  };
}

beforeAll(async () => {
  client = new PGlite();
  for (const file of MIGRATIONS) {
    await client.exec(
      readFileSync(join(process.cwd(), "drizzle", file), "utf8"),
    );
  }

  await client.query(
    `insert into "user" (id, name, email, email_verified, role, created_at, updated_at)
     values ($1, 'Master Impor', 'master.import@example.test', true, 'admin', now(), now()),
            ($2, 'Sudah Ada', 'sudah.ada@instansi.go.id', true, 'user', now(), now())`,
    [MASTER_ID, EXISTING_USER_ID],
  );

  await client.query(
    `insert into regional_offices (id, code, name, status)
     values ($1::uuid, 'REG-JABAR', 'Jawa Barat', 'ACTIVE')`,
    [REGION_ID],
  );
  await client.query(
    `insert into branch_offices (id, regional_office_id, code, name, status)
     values ($1::uuid, $2::uuid, 'CBG-BDG-KOTA', 'Bandung Kota', 'ACTIVE')`,
    [BRANCH_ID, REGION_ID],
  );
  await client.query(
    `insert into stakeholders
       (id, name, category, organization_type, faskes_class, faskes_code,
        faskes_code_normalized, service_area, latitude, longitude, status,
        joined_at, branch_office_id)
     values ($1::uuid, 'Klinik Uji FKTP', 'FASKES', 'FASKES', 'FKTP',
        'FKTP-BDG-001', 'fktp-bdg-001', 'Bandung', -6.9, 107.6, 'ACTIVE',
        '2026-01-01', $2::uuid)`,
    [ORG_ID, BRANCH_ID],
  );

  db = drizzle(client, { schema });
});

afterAll(async () => {
  await client.close();
});

describe("CSV parsing", () => {
  it("detects semicolon delimiters and strips the UTF-8 BOM", () => {
    const parsed = parseCsv(
      "\uFEFFnama;email;peran\nBudi;budi@instansi.go.id;stakeholder\n",
    );
    expect(parsed.headers).toEqual(["nama", "email", "peran"]);
    expect(parsed.rows).toEqual([
      ["Budi", "budi@instansi.go.id", "stakeholder"],
    ]);
  });

  it("ignores blank lines and keeps quoted separators intact", () => {
    const parsed = parseCsv(
      'nama,email\n"Budi, S.Kom",budi@instansi.go.id\n\n',
    );
    expect(parsed.rows).toEqual([["Budi, S.Kom", "budi@instansi.go.id"]]);
  });

  it("rejects an empty file", () => {
    expect(() => parseCsv("\uFEFF\n")).toThrow(/kosong/i);
  });
});

describe("templates", () => {
  it("separates the header-only template from the example file", () => {
    const template = templateCsv()
      .replace(/^\uFEFF/, "")
      .split("\r\n")
      .filter(Boolean);
    const example = exampleAccountCsv()
      .replace(/^\uFEFF/, "")
      .split("\r\n")
      .filter(Boolean);
    expect(template).toEqual([ACCOUNT_IMPORT_HEADERS.join(",")]);
    expect(example.length).toBeGreaterThan(1);
    expect(example[0]).toBe(ACCOUNT_IMPORT_HEADERS.join(","));
  });

  it("never offers a password column", () => {
    const headers = ACCOUNT_IMPORT_HEADERS.map((header) =>
      header.toLowerCase(),
    );
    expect(headers.some((header) => header.includes("sandi"))).toBe(false);
    expect(headers.some((header) => header.includes("password"))).toBe(false);
  });
});

describe("conflict policy", () => {
  it("defaults to skip for unknown values", () => {
    expect(parseConflictPolicy(undefined)).toBe("skip");
    expect(parseConflictPolicy("hapus")).toBe("skip");
    expect(parseConflictPolicy("upsert")).toBe("upsert");
  });
});

describe("account import preview", () => {
  it("accepts rows resolved by code and name", async () => {
    const preview = await previewImport({
      filename: "akun.csv",
      content: csv([
        baseRow(),
        baseRow({
          nama: "Sari Wilayah",
          email: "sari@instansi.go.id",
          peran: "wilayah",
          wilayah: "REG-JABAR",
          organisasi: "",
        }),
        baseRow({
          nama: "Andi Cabang",
          email: "andi@instansi.go.id",
          peran: "cabang",
          cabang: "CBG-BDG-KOTA",
          organisasi: "",
        }),
      ]),
      actorId: MASTER_ID,
      db: db as never,
    });

    expect(preview.validCount).toBe(3);
    expect(preview.errorCount).toBe(0);
    expect(preview.rows[1]?.normalized?.regionalOfficeId).toBe(REGION_ID);
    expect(preview.rows[2]?.normalized?.branchOfficeId).toBe(BRANCH_ID);
    expect(preview.rows[0]?.normalized?.organizationId).toBe(ORG_ID);
  });

  it("rejects master rows, unknown scopes, and in-file duplicates", async () => {
    const preview = await previewImport({
      filename: "akun.csv",
      content: csv([
        baseRow({ email: "master2@instansi.go.id", peran: "master" }),
        baseRow({
          email: "x1@instansi.go.id",
          peran: "wilayah",
          wilayah: "REG-TIDAK-ADA",
          organisasi: "",
        }),
        baseRow({ email: "x2@instansi.go.id", peran: "cabang" }),
        baseRow({ email: "x3@instansi.go.id", organisasi: "TIDAK-ADA" }),
        baseRow({ email: "budi@instansi.go.id" }),
        baseRow({ email: "BUDI@instansi.go.id" }),
      ]),
      actorId: MASTER_ID,
      db: db as never,
    });

    expect(preview.rows[0]?.errors?.join(" ")).toMatch(/Master Admin/);
    expect(preview.rows[1]?.errors?.join(" ")).toMatch(/tidak ditemukan/);
    expect(preview.rows[2]?.errors?.join(" ")).toMatch(/Kode cabang/);
    expect(preview.rows[3]?.errors?.join(" ")).toMatch(/tidak ditemukan/);
    expect(preview.rows[5]?.errors?.join(" ")).toMatch(/duplikat/);
    expect(preview.errorCount).toBe(5);
  });

  it("marks existing emails as skipped under the default policy", async () => {
    const preview = await previewImport({
      filename: "akun.csv",
      content: csv([baseRow({ email: "sudah.ada@instansi.go.id" })]),
      actorId: MASTER_ID,
      db: db as never,
    });
    expect(preview.policy).toBe("skip");
    expect(preview.rows[0]?.status).toBe("SKIPPED");
    expect(preview.rows[0]?.userId).toBe(EXISTING_USER_ID);
    expect(preview.stats.skipped).toBe(1);
  });

  it("marks existing emails as conflicts under the upsert policy", async () => {
    const preview = await previewImport({
      filename: "akun.csv",
      content: csv([baseRow({ email: "sudah.ada@instansi.go.id" })]),
      actorId: MASTER_ID,
      policy: "upsert",
      db: db as never,
    });
    expect(preview.conflictCount).toBe(1);
    expect(preview.rows[0]?.status).toBe("CONFLICT");
    expect(preview.rows[0]?.userId).toBe(EXISTING_USER_ID);
  });

  it("rejects files with the wrong headers", async () => {
    await expect(
      previewImport({
        filename: "salah.csv",
        content: "email,nama\nbudi@instansi.go.id,Budi",
        actorId: MASTER_ID,
        db: db as never,
      }),
    ).rejects.toThrow(/Kolom wajib/);
  });

  it("caps the number of rows", async () => {
    const rows = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, index) =>
      baseRow({ email: `bulk-${index}@instansi.go.id` }),
    );
    await expect(
      previewImport({
        filename: "besar.csv",
        content: csv(rows),
        actorId: MASTER_ID,
        db: db as never,
      }),
    ).rejects.toThrow(/Maksimal/);
  });

  it("caps the file size", async () => {
    await expect(
      previewImport({
        filename: "besar.csv",
        content: `${ACCOUNT_IMPORT_HEADERS.join(",")}\n${"a".repeat(1_000_001)}`,
        actorId: MASTER_ID,
        db: db as never,
      }),
    ).rejects.toThrow(/1 MB/);
  });
});

describe("error report", () => {
  it("neutralizes spreadsheet formula injection", () => {
    const output = importResultsCsv([
      {
        rowNumber: 1,
        status: "INVALID",
        normalized: { name: '=HYPERLINK("http://evil")', email: "a@b.c" },
        errors: ["@SUM(1+1)"],
        userId: null,
      },
    ]);
    expect(output).toContain("'=HYPERLINK");
    expect(output).toContain("'@SUM");
  });
});

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "../src/db/schema";
import {
  CONTENT_IMPORT_HEADERS,
  CONTENT_IMPORT_OPTIONAL_HEADERS,
  CONTENT_IMPORT_REQUIRED,
  contentExampleCsv,
  contentTemplateCsv,
  previewContentImport,
} from "@/lib/imports/content";

const MIGRATIONS = [
  "0000_goofy_dagger.sql",
  "0001_fluffy_serpent_society.sql",
  "0002_v4_revoke_action.sql",
  "0003_content_taxonomy_and_review.sql",
];

const FKTP_ID = "11111111-1111-4111-8111-111111111111";
const PEMDA_ID = "22222222-2222-4222-8222-222222222222";
const INACTIVE_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "content-import-test";
const LOCATION_ID = "44444444-4444-4444-8444-444444444444";
const EXISTING_ID = "55555555-5555-4555-8555-555555555555";

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

function csv(rows: string[][]): string {
  return [CONTENT_IMPORT_HEADERS as readonly string[], ...rows]
    .map((row) =>
      row
        .map((cell) =>
          /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell,
        )
        .join(","),
    )
    .join("\n");
}

const NARRATIVE =
  "Narasi konten yang cukup panjang untuk lolos validasi minimal empat puluh karakter.";

function validRow(overrides: Partial<Record<string, string>> = {}): string[] {
  const row: Record<string, string> = {
    organisasi: "FKTP-BDG-001",
    judul: "Edukasi Mobile JKN",
    tautan: "https://www.instagram.com/p/valid-1",
    platform: "instagram",
    jenis_konten: "video",
    tema_utama: "non-edufast",
    sub_tema: "mobile jkn",
    narasi: NARRATIVE,
    tanggal_konten: "2026-10-05",
    tanggal_terbit: "2026-10-06",
    lintang: "",
    bujur: "",
    lokasi: "",
  };
  Object.assign(row, overrides);
  return CONTENT_IMPORT_HEADERS.map((header) => row[header] ?? "");
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
     values ($1, 'Import Master', 'import@example.test', true, 'admin', now(), now())`,
    [USER_ID],
  );

  await client.query(
    `insert into stakeholders
       (id, name, category, organization_type, faskes_class, faskes_code,
        faskes_code_normalized, service_area, latitude, longitude, status, joined_at)
     values
       ($1::uuid, 'Klinik Uji FKTP', 'FASKES', 'FASKES', 'FKTP', 'FKTP-BDG-001',
        'fktp-bdg-001', 'Bandung', -6.9, 107.6, 'ACTIVE', '2026-01-01'),
       ($2::uuid, 'Pemda Uji', 'FASKES', 'PEMDA', null, null, null,
        'Bandung', -6.91, 107.61, 'ACTIVE', '2026-01-01'),
       ($3::uuid, 'Klinik Nonaktif', 'FASKES', 'FASKES', 'FKTP', 'FKTP-OFF',
        'fktp-off', 'Bandung', -6.92, 107.62, 'INACTIVE', '2026-01-01')`,
    [FKTP_ID, PEMDA_ID, INACTIVE_ID],
  );

  await client.query(
    `insert into locations (id, latitude, longitude, label, source, verified_status, precision)
     values ($1::uuid, -6.9, 107.6, 'Lokasi lama', 'manual_pin', 'MANUAL_UNVERIFIED', 'approximate')`,
    [LOCATION_ID],
  );

  await client.query(
    `insert into content_submissions
       (id, reference_code, stakeholder_id, created_by, submitted_by, title, narrative,
        published_url, normalized_url, normalized_url_hash, platform, date_created,
        location_id, status, idempotency_key, submitted_at)
     values
       ($1::uuid, 'DAK-2026-KONTENLAMA', $2::uuid, $3, $3, 'Konten lama', $4,
        'https://www.instagram.com/p/lama-1', 'instagram.com/p/lama-1', $5,
        'INSTAGRAM', '2026-10-01', $6::uuid, 'APPROVED', 'existing-import-key', now())`,
    [
      EXISTING_ID,
      FKTP_ID,
      USER_ID,
      NARRATIVE,
      createHash("sha256").update("instagram.com/p/lama-1").digest("hex"),
      LOCATION_ID,
    ],
  );

  db = drizzle(client, { schema });
});

afterAll(async () => {
  await client.close();
});

describe("content import template", () => {
  it("exports every supported column in a stable order", () => {
    const template = contentTemplateCsv();
    const header = template.replace(/^\uFEFF/, "").split("\r\n")[0];
    expect(header).toBe(
      [...CONTENT_IMPORT_HEADERS, ...CONTENT_IMPORT_OPTIONAL_HEADERS].join(","),
    );
    for (const required of CONTENT_IMPORT_REQUIRED) {
      expect(CONTENT_IMPORT_HEADERS).toContain(required);
    }
  });

  it("keeps the template header-only and puts samples in the example file", () => {
    const template = contentTemplateCsv()
      .replace(/^\uFEFF/, "")
      .split("\r\n")
      .filter(Boolean);
    const example = contentExampleCsv()
      .replace(/^\uFEFF/, "")
      .split("\r\n")
      .filter(Boolean);
    expect(template).toHaveLength(1);
    expect(example.length).toBeGreaterThan(1);
    expect(example[0]).toBe(
      [...CONTENT_IMPORT_HEADERS, ...CONTENT_IMPORT_OPTIONAL_HEADERS].join(","),
    );
  });
});

describe("content import preview", () => {
  it("accepts valid rows resolved by code and by organization name", async () => {
    const content = csv([
      validRow(),
      validRow({
        organisasi: "Pemda Uji",
        tautan: "https://example.go.id/konten-2",
        platform: "website",
        jenis_konten: "infografis",
        sub_tema: "Informasi",
      }),
    ]);
    const preview = await previewContentImport({
      filename: "konten.csv",
      content,
      db: db as never,
    });

    expect(preview.rowCount).toBe(2);
    expect(preview.errorCount).toBe(0);
    expect(preview.validCount).toBe(2);
    expect(preview.rows[0]?.organizationName).toBe("Klinik Uji FKTP");
    expect(preview.rows[1]?.organizationName).toBe("Pemda Uji");
    expect(preview.rows[1]?.subTheme).toBe("INFORMASI");
    expect(preview.rows[1]?.contentType).toBe("INFOGRAFIS");
  });

  it("reports invalid organizations, platform, taxonomy, narrative, and dates", async () => {
    const content = csv([
      validRow({ organisasi: "Tidak Ada" }),
      validRow({
        organisasi: "Klinik Nonaktif",
        tautan: "https://www.instagram.com/p/inactive-1",
      }),
      validRow({
        platform: "myspace",
        tautan: "https://www.instagram.com/p/bad-platform",
      }),
      validRow({
        sub_tema: "tema ngawur",
        tautan: "https://www.instagram.com/p/bad-theme",
      }),
      validRow({
        narasi: "pendek",
        tautan: "https://www.instagram.com/p/short",
      }),
      validRow({
        tanggal_konten: "2999-01-01",
        tautan: "https://www.instagram.com/p/future",
      }),
      validRow({
        tautan: "http://insecure.example/path",
      }),
    ]);

    const preview = await previewContentImport({
      filename: "konten.csv",
      content,
      db: db as never,
    });

    expect(preview.validCount).toBe(0);
    expect(preview.errorCount).toBe(7);
    expect(preview.rows[0]?.errors.join(" ")).toMatch(
      /Organisasi tidak ditemukan/,
    );
    expect(preview.rows[1]?.errors.join(" ")).toMatch(/tidak aktif/);
    expect(preview.rows[2]?.errors.join(" ")).toMatch(/Platform/);
    expect(preview.rows[3]?.errors.join(" ")).toMatch(/Sub-tema/);
    expect(preview.rows[4]?.errors.join(" ")).toMatch(/minimal 40 karakter/);
    expect(preview.rows[5]?.errors.join(" ")).toMatch(/masa depan/);
    expect(preview.rows[6]?.errors.join(" ")).toMatch(/https/);
  });

  it("rejects duplicate links inside the file and against existing content", async () => {
    const content = csv([
      validRow({ tautan: "https://www.instagram.com/p/sama-1" }),
      validRow({
        tautan: "https://www.instagram.com/p/sama-1?utm_source=feed",
      }),
      validRow({ tautan: "https://www.instagram.com/p/lama-1" }),
    ]);

    const preview = await previewContentImport({
      filename: "konten.csv",
      content,
      db: db as never,
    });

    expect(preview.rows[0]?.status).toBe("VALID");
    expect(preview.rows[1]?.errors.join(" ")).toMatch(
      /Tautan sama dengan baris 1/,
    );
    expect(preview.rows[2]?.errors.join(" ")).toMatch(/sudah terdaftar/);
    expect(preview.validCount).toBe(1);
    expect(preview.errorCount).toBe(2);
  });

  it("produces a stable digest for the same file content", async () => {
    const content = csv([validRow()]);
    const first = await previewContentImport({
      filename: "a.csv",
      content,
      db: db as never,
    });
    const second = await previewContentImport({
      filename: "b.csv",
      content,
      db: db as never,
    });
    expect(first.digest).toBe(second.digest);
    expect(first.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects files that are missing required columns", async () => {
    await expect(
      previewContentImport({
        filename: "rusak.csv",
        content: "organisasi,judul\nKlinik Uji FKTP,Contoh",
        db: db as never,
      }),
    ).rejects.toThrow(/Kolom wajib/);
  });

  it("only lets Master Admin import approved rows, with an approval date", async () => {
    const headers = [
      ...CONTENT_IMPORT_HEADERS,
      ...CONTENT_IMPORT_OPTIONAL_HEADERS,
    ];
    const approvedRow = (extra: Record<string, string>) => {
      const base: Record<string, string> = {
        ...Object.fromEntries(
          CONTENT_IMPORT_HEADERS.map((header, index) => [
            header,
            validRow()[index] ?? "",
          ]),
        ),
        status: "disetujui",
        tanggal_persetujuan: "2026-10-07",
        ...extra,
      };
      return headers.map((header) => base[header] ?? "");
    };
    const render = (rows: string[][]) =>
      [headers, ...rows]
        .map((row) =>
          row
            .map((cell) =>
              /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell,
            )
            .join(","),
        )
        .join("\n");

    const asBranch = await previewContentImport({
      filename: "konten.csv",
      content: render([
        approvedRow({ tautan: "https://www.instagram.com/p/approve-1" }),
      ]),
      actorRole: "BRANCH_ADMIN",
      db: db as never,
    });
    expect(asBranch.rows[0]?.errors.join(" ")).toMatch(/Hanya Master Admin/);
    expect(asBranch.approvedCount).toBe(0);

    const asMaster = await previewContentImport({
      filename: "konten.csv",
      content: render([
        approvedRow({ tautan: "https://www.instagram.com/p/approve-2" }),
        approvedRow({
          tautan: "https://www.instagram.com/p/approve-3",
          tanggal_persetujuan: "",
        }),
      ]),
      actorRole: "MASTER_ADMIN",
      db: db as never,
    });
    expect(asMaster.rows[0]?.status).toBe("VALID");
    expect(asMaster.rows[0]?.approvedAt).toBe("2026-10-07");
    expect(asMaster.approvedCount).toBe(1);
    expect(asMaster.rows[1]?.errors.join(" ")).toMatch(
      /Tanggal persetujuan wajib/,
    );
  });
});

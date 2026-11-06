# Review Operasional, Data, dan Performa — F2.5

- Tanggal: 2026-11-06
- Metode: review statis repo + bukti historis + probe TTFB ringan
- Lingkungan: repo `fix/all-features-hardening` @ `01c237b`; produksi read-only

## 1. Migrasi database

- 6 migrasi: `drizzle/0000` … `0005`; semuanya additive atau penggantian constraint.
- `drizzle/0003_content_taxonomy_and_review.sql` menghapus dua constraint lama dan
  `NOT NULL` pada `content_submissions.theme_id`, lalu menambahkan constraint baru
  yang lebih ketat (`submission_id,version,action` unik dan CHECK action). Tidak
  ada `DROP TABLE`, `DROP COLUMN`, atau `TRUNCATE` pada seluruh migrasi.
- `drizzle/0005_v1_1_perf_indexes.sql` menambah indeks komposit
  `content_submissions_stakeholder_status_approved_idx`.
- Tidak ada mekanisme down-migration; rollback data mengandalkan backup logis.
- Status: **PASS (review statis)**; eksekusi migrasi tidak dijalankan pada audit ini.

## 2. Indeks dan query

- 71 deklarasi `index`/`uniqueIndex` pada `src/db/schema/*.ts`.
- Bukti `EXPLAIN` historis tersedia untuk dashboard, kinerja, peta, dan SLA
  (`docs/audit/evidence/E-explain-*-2026-11-01*.json`).
- Status: **PASS (bukti historis)**; tidak ada pengukuran baru.

## 3. Koneksi dan pooling

- `src/db/index.ts:70-99`: `Pool` Neon serverless singleton di `globalThis`,
  `max` default 3 (dibatasi 50 lewat `DB_POOL_MAX`), `idleTimeoutMillis` 10 dtk,
  `connectionTimeoutMillis` 30 dtk, `query_timeout` 15 dtk.
- Retry hanya untuk statement baca (`withConnectionRetry`), penulisan tidak diulang
  untuk mencegah efek ganda.
- Status: **PASS**.

## 4. Backup dan retensi

- `scripts/backup-db.ts:48-82`: `select *` dari **seluruh** tabel `public`
  (kecuali `__drizzle_migrations`) ditulis sebagai NDJSON **plaintext** ke
  `backups/<stamp>-<target>/`. Ini mencakup tabel auth (`user`, `account`,
  `session`) sehingga berisi hash kata sandi, token sesi, dan email.
- Tidak ada enkripsi, rotasi, atau retensi otomatis; direktori hanya di-gitignore.
- Tidak ada job retensi untuk `audit_logs`, `notifications`, atau `outbox_events`;
  pembersihan hanya manual (`scripts/purge-demo-only.ts`).
- Status: **FAIL** — lihat FND-006 (backup plaintext) dan FND-019 (retensi).

## 5. Observability dan alerting

- Tidak ada SDK Sentry/OpenTelemetry/Datadog di `package.json`.
- Error hanya dicatat lewat `console.error` (mis. `src/lib/api.ts:101`,
  `src/db/index.ts:89-94`, `src/app/api/v1/realtime/notifications/route.ts:52,75,106`).
- `/api/health` memeriksa konektivitas DB; tidak ada SLO, alert, atau dashboard
  operasional di repo.
- Status: **FAIL** — lihat FND-008.

## 6. CI/CD dan supply chain

- Tidak ada `.github/workflows` atau pipeline setara; seluruh gate dijalankan manual
  (`npm run verify`).
- Tidak ada SAST, SCA berkala, secret scan, atau SBOM di pipeline.
- Audit ini menjalankan sendiri: ESLint, `tsc`, Prettier, Vitest 120/120,
  `npm audit --omit=dev` (0 kerentanan), `npm audit` penuh (25 advisories, seluruhnya
  devDependency; 1 critical pada `better-auth@1.4.22` di dalam `@better-auth/cli`),
  SBOM CycloneDX, dan secret scan (0 temuan).
- Status: **FAIL** — lihat FND-008.

## 7. Secret dan konfigurasi

- `.gitignore` mencakup `.env*`, `.secrets`, `/backups`, `/.vercel`.
- Secret scan atas seluruh file terlacak: 0 temuan (private key, GitHub token,
  OpenAI key, AWS key, JWT-like, password hardcoded).
- `.env.example` tersedia; nilai produksi tidak pernah dibaca ke output audit.
- Status: **PASS**.

## 8. Rollback dan release

- Rollback kode terdokumentasi di `docs/v4-handoff.md` §6 (`vercel rollback` /
  promosi deployment sebelumnya) dan pernah dieksekusi pada insiden `08P01`
  (bukti di dokumen yang sama).
- Rollback data bergantung pada backup logis (§4) yang belum terenkripsi.
- Status: **PASS (prosedur)** / **FAIL (perlindungan data)**.

## 9. SSE dan outbox

- `src/app/api/v1/realtime/notifications/route.ts:13-15`: koneksi 55 dtk,
  polling DB setiap 2.500 ms, heartbeat 15 dtk.
- `drainOutbox({ recipientId })` dipanggil sekali per koneksi (baris 51); tidak ada
  rate limit atau kuota koneksi pada route ini.
- Fallback klien: polling 20 dtk saat SSE tidak terbuka
  (`src/components/notifications/notification-stream.tsx:7`).
- Dampak: setiap klien terautentikasi menghasilkan ±22 query per koneksi;
  konkurensi tinggi dapat membebani Neon. Status: **SUSPECTED** (FND-017).

## 10. Rate limit

- `src/lib/rate-limit.ts`: `consumeRateLimit` memakai tabel `demo_rate_limits`
  (persisten lintas instance), upsert + retry untuk error koneksi transien.
- `getClientIp` memakai hop pertama `x-forwarded-for`.
- Better Auth memakai limiter in-memory: `src/lib/auth.ts:63-69`
  (60/60 dtk global, sign-in 8/60 dtk, change-password 6/60 dtk).
- 18 route mutasi tidak memanggil `consumeRateLimit` (inventaris
  `E-inventory-2026-11-06T02-30-10Z.json`), termasuk endpoint publik/demo dan
  beberapa admin-only. Status: **SUSPECTED** (FND-004).

## 11. Performa

- Bukti historis 100k dataset lokal (`docs/audit/evidence/E-perf-100k-2026-11-01T18-08-44.log`):
  seluruh anggaran terpenuhi; TTFB p95 348–995 ms, LCP p95 540–1.668 ms,
  CLS ≤ 0,099, JS ≤ 356 KB.
- Probe TTFB produksi (`E-ttfb-2026-11-06T02-37-45-447Z.json`, 3 permintaan
  serial per rute, jeda 1 dtk, bukan load test):

  | Rute                 | Peran          | Status | TTFB median | TTFB min–max | Byte    |
  | -------------------- | -------------- | ------ | ----------- | ------------ | ------- |
  | `/`                  | anonim         | 200    | 59 ms       | 55–65 ms     | 51.955  |
  | `/masuk`             | anonim         | 200    | 302 ms      | 279–313 ms   | 27.191  |
  | `/admin`             | MASTER_ADMIN   | 200    | 347 ms      | 336–416 ms   | ±230 KB |
  | `/wilayah/dashboard` | REGIONAL_ADMIN | 200    | 402 ms      | 402–407 ms   | ±169 KB |
  | `/client`            | STAKEHOLDER    | 200    | 365 ms      | 343–592 ms   | 142.504 |

  Semua rute merespons di bawah 1 dtk TTFB pada 3 sampel (maks 592 ms pada
  `/client`). Angka ini **bukan** bukti kapasitas: tidak ada konkurensi, cache,
  atau pengukuran p95.

- Load test G6: **NOT TESTED** pada audit ini. Bukti lama
  (`E-load-soak-2026-11-01T15-23-52-009Z.json`) dijalankan pada jaringan rusak
  (78.111 error, 0 5xx) dan tidak boleh dipakai sebagai bukti kapasitas.

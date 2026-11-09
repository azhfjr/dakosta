# D21 — Dashboard v3.6: empat status, peta bertingkat, analitik per peran, dan hardening UX

**Tanggal:** 2026-11-09
**Branch:** `fix/all-features-hardening`
**Baseline produksi:** v3.5 `a937c55`, deployment `dpl_5dnHcwACpnC6ZcTp7FftALfbikhY` (rollback target v3.6)
**Status:** Phase 0–8 selesai (semua gate hijau); Phase 9–10 menunggu rilis

Dokumen ini adalah buku bukti berjalan. Setiap angka menyebut artefak dan waktunya.
Nilai rahasia (URL database, secret, cookie) tidak pernah dicetak; hanya nama variabel.

## 1. Baseline (Phase 0)

| Item                          | Nilai                                                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                        | `fix/all-features-hardening`                                                                                                                                                           |
| HEAD saat mulai               | `6d11614` (release record v3.5)                                                                                                                                                        |
| Produksi                      | alias `dakosta-dakosta.vercel.app`, deployment v3.5 `dpl_5dnHcwACpnC6ZcTp7FftALfbikhY`                                                                                                 |
| Rollback target               | v3.5 (sebelum migrasi); v3.5 + CHECK dilonggarkan (sesudah migrasi)                                                                                                                    |
| Env vars produksi (nama saja) | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MAP_STYLE_URL`, `DEMO_MODE`, `DEMO_SEED_PASSWORD`, `CRON_SECRET` |
| Env staging (nama saja)       | `APP_ENV`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DEMO_MODE`, `DEMO_SEED_PASSWORD`                                                                                                  |
| Target seed/load              | `--target=staging` (`APP_ENV=staging`) — tidak pernah produksi                                                                                                                         |

### Census status produksi sebelum migrasi (read-only)

`npx tsx scripts/status-census.ts --target=production`, 2026-11-09.

| Status            | archived |    Baris | approved_at terisi |
| ----------------- | -------- | -------: | -----------------: |
| APPROVED          | false    |     1381 |               1381 |
| ARCHIVED          | true     |      635 |                635 |
| DRAFT             | false    |       20 |                  0 |
| IN_REVIEW         | false    |       19 |                  0 |
| REJECTED          | false    |      125 |                  0 |
| RESUBMITTED       | false    |       19 |                  0 |
| REVISION_REQUIRED | false    |       21 |                  0 |
| REVOKED           | false    |      160 |                160 |
| SUBMITTED         | false    |       20 |                  0 |
| **Total**         |          | **2400** |                    |
| Baris legacy      |          |      958 |                    |
| Disetujui aktif   |          |     1381 |                    |

Pemetaan yang diharapkan setelah migrasi 0007:

- `SUBMITTED` = 20 + 19 (RESUBMITTED) + 19 (IN_REVIEW) = **58**
- `REVISION_REQUIRED` = 21 + 125 (REJECTED) + 160 (REVOKED) = **306**
- `APPROVED` aktif = **1381**; `APPROVED` + `archived=true` = **635**
- `DRAFT` = **20**; total tetap **2400**; tidak ada nilai legacy.

### Migrasi staging (dry rehearsal)

1. Census staging sebelum: APPROVED 39 aktif + ARCHIVED 1, DRAFT 19, IN_REVIEW 2,
   REJECTED 11, REVISION_REQUIRED 2, REVOKED 1, SUBMITTED 48 (123 baris, 15 legacy).
2. `npm run db:migrate:staging` → "Migrasi selesai."
3. `npx tsx scripts/status-census.ts --target=staging --strict` →
   APPROVED 39 aktif + 1 arsip, DRAFT 19, REVISION_REQUIRED 14, SUBMITTED 50,
   total 123, **legacy 0**, disetujui aktif tetap 39. Guard `--strict` lulus.

## 2. Phase 1 — kontrak empat status

- `src/lib/content-status.ts`: `CONTENT_STATUSES` (4), label Indonesia, tone,
  `PENDING_STATUSES = ["SUBMITTED"]`, tabel transisi, `normalizeStatus`, peta label legacy.
- `src/db/schema/core.ts`: CHECK `content_submissions_status_check` menjadi 4 nilai.
- `drizzle/0007_fantastic_prowler.sql`: memetakan data lebih dulu, lalu mengganti CHECK,
  lalu blok `DO` yang gagal bila masih ada nilai legacy. Lossy; nilai persis hanya dari backup.
- Workflow: `assertSubmissionEditable` menerima DRAFT dan REVISION_REQUIRED (termasuk baris
  legacy yang dinormalisasi); kirim ulang selalu `SUBMITTED` dan menaikkan versi;
  `startReview`/`IN_REVIEW` dihapus; `REJECT` dan `REVOKE` menulis `REVISION_REQUIRED`,
  mencabut `approved_at`, dan tetap dapat direvisi/dikirim ulang.
- SLA: ringkasan `draft`, `pending`, `revision`, `approved`; rate = approved / (approved + revision).
- Seed/demo/fixtures/backtest/explain/E2E diselaraskan ke 4 status; volume demo tetap 2.400.

Gate Phase 1 (2026-11-09):

| Gate                           | Hasil                       |
| ------------------------------ | --------------------------- |
| `npm run typecheck`            | PASS                        |
| `npm run lint`                 | PASS                        |
| `npm test`                     | 42 berkas, **287/287 PASS** |
| Migrasi staging + census ketat | PASS, legacy 0              |

Sisa referensi nama legacy yang disengaja: peta normalisasi/label di `content-status.ts`,
nama event notifikasi historis (`CONTENT_REJECTED`, `CONTENT_REVOKED`), label audit historis,
status domain EDUFAST (`ARCHIVED`), kode error API `REQUEST_REJECTED`, dan
`ACCOUNT_SESSIONS_REVOKED` (sesi akun). Semuanya bukan status konten yang dapat ditulis.

## 3. Rollback

- **Sebelum migrasi:** promosikan v3.5 `dpl_5dnHcwACpnC6ZcTp7FftALfbikhY`; tanpa perubahan DB.
- **Sesudah migrasi, rollback aplikasi:** longgarkan `content_submissions_status_check`
  agar memuat `RESUBMITTED` dan `IN_REVIEW` (SQL terkonfirmasi eksplisit), lalu promosikan v3.5.
- **Rollback data penuh:** pulihkan backup pra-migrasi (destruktif; perlu konfirmasi eksplisit).
- Jangan pernah menjalankan v3.5 terhadap CHECK 4 nilai yang ketat.

## 4. Phase 2–7 — implementasi

### 4.1 Dashboard v3.6

- Kontrak (`src/lib/dashboard/types.ts`): `categoryShares`, `DashboardMonthlySeries`,
  `DashboardContentTypeSlice`, `DashboardTypeTrend`, `DashboardThemeTrend`,
  `DashboardMapAggregate`, tier peta pada `DashboardMap`.
- `src/lib/dashboard/series.ts`: 12 bulan terakhir zona Asia/Jakarta + zero-fill,
  `largestRemainderShares` (selalu 100,0%), irisan jenis konten, tren per jenis/tema.
- `src/lib/dashboard/map-tiers.ts`: ambang zoom per varian, radius `sqrt(total/maxTotal)`,
  centroid berbobot konten, feature collection per tier.
- `src/lib/analytics/dashboard-overview.ts`: total/porsi kategori, seri 12 bulan,
  jenis konten, tren jenis/tema, agregat wilayah/cabang (termasuk institusi tanpa koordinat),
  `maxTotal`, dan bendera truncation 5.000 titik — semua lewat scope + cache permintaan.
- UI: `scorecards.tsx` (4 kartu kategori + porsi kecil `data-stat-share`), `monthly-trend-chart.tsx`,
  `content-type-panel.tsx`, `theme-panel.tsx`, `dashboard-map.tsx` (tier region→branch→institution,
  bubble proporsional konten, popup agregat, hint tier `data-map-tier`).
- Varian: stakeholder tanpa "Institusi dengan Konten" dan tanpa peta; urutan seksi
  `ringkasan → jenis-konten → tren-bulanan → tren-jenis-konten → tren-tema → tema-konten`.
- Anchor baru (`tren-bulanan`, `jenis-konten`, `tren-jenis-konten`, `tren-tema`) plus
  pemetaan anchor lama agar URL `?view=` lama tidak mendarat di anchor mati.
- PDF/infografis dasbor memakai kontrak baru (porsi kategori, mini tren 12 bulan, irisan jenis/tema).
  Infografis PNG tidak dapat memuat tautan yang dapat diklik (didokumentasikan di release notes).

### 4.2 Navigasi, filter, tabel, detail

- `Input Konten` muncul tepat setelah Dashboard untuk stakeholder, tone hijau, desktop + sheet seluler.
- Sidebar global 15rem (240px); notifikasi memakai `PageContainer width="wide"` pada 4 peran.
- Detail Konten: tanpa filter jenis organisasi; filter utama menyatu dalam satu grid label;
  status hanya 4 nilai kanonik + ALL; periode dihapus dari UI (rentang tanggal tetap).
- Tabel: header sortable (`aria-sort`, URL state, reset halaman), kolom Keputusan dilebur ke
  Status (badge + "oleh X · tanggal"), `min-w` 68rem, tanggal `tabular` tanpa wrap, sticky header.
- Kinerja: filter numerik min/max dihapus dari tipe, parser, SQL, UI, dan ekspor; status target dipertahankan.
- Detail page semua peran: header/breadcrumb, grid metadata, URL panjang `break-all`, riwayat review,
  panel keputusan — satu skala spasi 4/8/12/16/24 dan tetap terbaca pada 360px.

### 4.3 Ekspor

- PDF konten: kolom ke-10 "Tautan", label "Buka konten", anotasi URI (`/Subtype /Link`) per baris;
  URL absolut via `getAppUrl()`; diuji `pdfjs-dist getAnnotations()` di `tests/content-pdf-links.test.ts`.
- CSV: kolom "Tautan Konten" absolut (tanpa formula `HYPERLINK`), status 4 label kanonik,
  streaming per chunk, rate limit, dan audit log tetap.

## 5. Rekonsiliasi staging (backtest)

`npm run test:backtest` (PGlite, fixture deterministik) — **119/119 pemeriksaan PASS**,
bukti `docs/audit/evidence/r13-backtest-reconcile.json`. Cakupan baru:

- Total kategori = total approved A1; porsi kategori berjumlah 100,0 dan mengikuti hitungan.
- Seri 12 bulan: 12 titik, berakhir pada bulan Jakarta berjalan, kunci berurutan,
  total = jumlah titik = SQL `approved_at` dalam jendela.
- Irisan jenis konten = SQL per `content_type` (UNCLASSIFIED digabung); porsi 100,0.
- Tren jenis dan tema mencocokkan seri bulanan per bulan; total EDUFAST = SQL dalam jendela.
- Peta: total tier cabang = total tier wilayah = approved; kategori agregat konsisten;
  jumlah institusi + missing = total; institusi tanpa koordinat tetap masuk total;
  `maxTotal` = agregat terbesar; per peran (wilayah/cabang/stakeholder) semua tier = A1 scope.

## 6. Gates Phase 8 — final (2026-11-09)

Semua gate dijalankan ulang setelah perbaikan audit dan formatter. Perintah dijalankan
berurutan; tidak ada gate yang dilewati.

| Gate                                   | Hasil                                                                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                         | PASS                                                                                                                                                                               |
| `npm run typecheck`                    | PASS                                                                                                                                                                               |
| `npm test`                             | **45 berkas, 308/308 PASS**                                                                                                                                                        |
| `npm run build`                        | PASS (termasuk run ulang pasca-`format`; 60+ rute dibangun)                                                                                                                        |
| `npm run test:backtest`                | **119/119 PASS** — `docs/audit/evidence/r13-backtest-reconcile.json`                                                                                                               |
| `npm run audit:routes`                 | PASS (hanya peringatan yang diharapkan: 404 publik, RBAC 403 dashboard admin untuk wilayah/cabang)                                                                                 |
| `npm run test:e2e`                     | **162 lulus, 3 dilewati, 0 gagal** (15,9 menit; workers 1; jeda rate-limit dipatuhi)                                                                                               |
| `scripts/ui-quality-audit.mjs`         | **123/123 halaman PASS**, 0 temuan, 0 page error — `docs/audit/evidence/ui-v36/ui-audit.json`                                                                                      |
| `scripts/dashboard-visual-audit.mjs`   | **12/12 PASS** (4 peran × 1440/768/375) — `docs/audit/evidence/dashboard-v36/visual-audit.json` + 12 PNG                                                                           |
| `scripts/dashboard-export-capture.mjs` | **6/6 ekspor satu halaman A4 landscape** + PNG 300 DPI — `docs/audit/evidence/ui-v36/pdf/`                                                                                         |
| `npm run format:check`                 | PASS — `.prettierignore` kini mengecualikan `public/vendor`; `pdf.worker.min.mjs` dipulihkan persis ke blob HEAD (sha1 cocok, 1.375.838 byte) agar cocok dengan pdfjs-dist 4.10.38 |
| Tangkapan layar per peran              | **92 PNG** — 4 peran × 360/768/1280/1440 untuk dashboard, detail konten, halaman detail, kinerja, notifikasi, SLA (`docs/audit/evidence/ui-v36/screenshots/`)                      |

Catatan audit:

- Ambang tebal grafik dibuat sadar-orientasi: kolom vertikal 14–32px, batang horizontal
  10–16px; batang tipis horizontal tidak lagi salah dianggap kolom.
- Audit tren bulanan memakai tabel SR-only 12 baris sebagai saksi jujur (Recharts tidak
  merender grup batang untuk bulan bernilai nol); gate menuntut 12 baris + minimal 1 batang.
- Bug dev-only `Performance.measure` hilang setelah server audit dijalankan bersih
  (`PORT=3300 npm run dev:e2e`, log di luar proyek). Semua artefak audit ditulis di luar
  pohon proyek selama pengujian agar Turbopack tidak memicu HMR di tengah render.
- Tabel Kinerja tetap dapat digulir horizontal di dalam regionnya (10 kolom); overflow
  tingkat halaman 0px pada semua peran dan lebar.

Pemeriksaan visual manual (bukti di `ui-v36/screenshots/`):

- Master 1440/360 dashboard dan detail: kartu kategori + porsi, tabel detail terbaca,
  panel keputusan utuh pada 360px.
- Wilayah 1440 Detail Konten: filter menyatu tanpa jenis organisasi, header sortable dengan
  `aria-sort`, hanya 4 status kanonik, metadata keputusan menyatu di kolom Status.
- Wilayah 1440/768 Kinerja: hanya lima filter (periode, cabang, jenis instansi, status target,
  pencarian); tidak ada kontrol numerik.
- Wilayah 1440 Notifikasi: kontainer lebar, jarak kartu 16–20px, status belum dibaca jelas.
- Client 1440 dashboard: 3 kartu (tanpa institusi), Input Konten hijau tepat di bawah Dashboard,
  donat jenis konten, tiga tren bulanan.

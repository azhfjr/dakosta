# DAKOSTA Web Improvement v1 — Status R01–R13

Tanggal: 2026-11-07
Lingkungan verifikasi: staging lokal (`dakosta_staging`, build produksi pada port 3400)
Build terverifikasi: `-a_9Vn4Z11pIQfJzWW9Nd`
Status rilis: **staging LULUS; produksi LULUS** — deploy `dpl_GRZMo8gWau3jz6isFHJE3B4rQmTb` (2026-11-07 16:06 WIB), smoke produksi 21/21.

Dokumen ini memetakan setiap kebutuhan R01–R13 pada brief
`prompt_dakosta_web_improvement_v1.md` ke jalur implementasi, bukti uji, dan status.
Tidak ada nilai rahasia, kredensial, atau data pribadi di dalam dokumen ini.

## Ringkasan gerbang

| Gerbang               | Perintah                                                                          | Hasil                                   |
| --------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| Lint                  | `npm run lint`                                                                    | PASS                                    |
| Format                | `npm run format:check`                                                            | PASS                                    |
| Tipe                  | `npx tsc --noEmit`                                                                | PASS                                    |
| Unit/integrasi        | `npm run test`                                                                    | PASS — 244/244 (36 berkas)              |
| Build produksi        | `npm run build:verify`                                                            | PASS — BUILD_ID `-a_9Vn4Z11pIQfJzWW9Nd` |
| Backtest rekonsiliasi | `npx tsx scripts/backtest-reconcile.ts`                                           | PASS — 43/43                            |
| E2E Chromium          | `npx playwright test` (port 3400)                                                 | PASS — 89/89 (6,8 menit)                |
| Anggaran performa     | `npm run perf`                                                                    | PASS — 18 rute                          |
| Query plan            | `npx tsx scripts/explain-check.ts --target=staging`                               | PASS — 7 skenario                       |
| Smoke staging         | `node scripts/smoke-production.mjs --base-url=http://localhost:3400`              | PASS — 21/21                            |
| Smoke produksi        | `node scripts/smoke-production.mjs --base-url=https://dakosta-dakosta.vercel.app` | PASS — 21/21                            |
| Probe keamanan        | skrip probe read-only (lihat bagian Keamanan)                                     | PASS — tanpa temuan                     |

## Matriks R01–R13

| ID  | Kebutuhan                                                                          | Implementasi                                                                                                                                                                                                                                                                            | Uji / bukti                                                                                                                                                                                                                                                         | Status                                                                                                            |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| R01 | Landing per peran ke Dashboard                                                     | `src/lib/authz/types.ts` (`homePathForRole`), konsumen `src/lib/authz/context.ts`, `src/lib/session.ts`; root `/` tetap landas publik                                                                                                                                                   | `tests/authz-guards.test.ts`, `e2e/rbac.spec.ts`, `e2e/navigation.spec.ts`                                                                                                                                                                                          | PASS                                                                                                              |
| R02 | Navigasi berurutan, label baru, Cabang/Organisasi disembunyikan                    | `src/components/shell/navigation.tsx` (seksi utama + Manajemen), `sidebar-nav.tsx`, `mobile-nav.tsx`; alias `/admin/sla`, `/admin/kinerja`, `/admin/cabang`, `/admin/organisasi`, `/wilayah/cabang`, `/wilayah/organisasi`, `/cabang/organisasi`; data/API/otorisasi tabel cabang tetap | `tests/navigation.test.ts` (4 uji unit), `e2e/navigation.spec.ts` (6 uji, termasuk 4 uji redirect/alias lama), `e2e/rbac.spec.ts` (8 uji)                                                                                                                           | PASS                                                                                                              |
| R03 | Dashboard hanya konten disetujui (tanpa blok semua-status)                         | `src/lib/analytics/dashboard.ts`, `src/components/dashboard/approved-dashboard.tsx`; panel filter global lama dihapus; KPI semua-status pindah ke SLA                                                                                                                                   | `tests/analytics-charts.test.ts`, `tests/dashboard-filters.test.ts`, `e2e/dashboard.spec.ts` (4 peran), smoke rekonsiliasi                                                                                                                                          | PASS                                                                                                              |
| R04 | Urutan blok dan tren 12/24 bulan dengan bulan kosong terisi nol                    | `approved-dashboard.tsx` (pencapaian cabang → peta → peringkat → tren bulanan → tema → jenis/platform → tabel), `src/lib/analytics/dashboard.ts` (`generate_series` zero-fill, `Asia/Jakarta`), `src/lib/analytics/period-window.ts`                                                    | `tests/dashboard-trend-window.test.ts`, `e2e/dashboard.spec.ts` (assert urutan posisi vertikal per peran), `scripts/explain-check.ts --scenario=monthly`                                                                                                            | PASS                                                                                                              |
| R05 | SLA memuat seluruh analitik operasional                                            | `src/lib/analytics/sla.ts`, `src/components/sla/sla-analytics.tsx`, `src/lib/review.ts`; halaman `/admin/validasi`, `/wilayah`, `/cabang` merender analitik di atas antrean                                                                                                             | `tests/sla-filters.test.ts`, `tests/filters.test.ts`, `e2e/filters.spec.ts`, `e2e/rbac.spec.ts`                                                                                                                                                                     | PASS                                                                                                              |
| R06 | Aturan hitung multi-platform: ID konten unik dihitung sekali per platform tercatat | `src/lib/analytics/charts.ts` + `approved.ts` (`count(distinct id)`), legenda pada kartu jenis/platform di `approved-charts.tsx`                                                                                                                                                        | `tests/analytics-charts.test.ts`, backtest (baris duplikat & multi-platform)                                                                                                                                                                                        | PASS                                                                                                              |
| R07 | Kontrak filter: dropdown, kaskade tema, reset, URL, filter lanjutan                | `src/lib/filters/{query,options,cascade,konten,redirect}.ts`, `src/components/filters/filter-bar.tsx` (field lanjutan dalam `<details>`)                                                                                                                                                | `tests/filters.test.ts`, `tests/konten-filters.test.ts`, `tests/taxonomy.test.ts`, `e2e/filters.spec.ts` (4 peran)                                                                                                                                                  | PASS                                                                                                              |
| R08 | Detail Konten semua status + drawer + ekspor                                       | `src/lib/analytics/content-table.ts` (`scope: all                                                                                                                                                                                                                                       | approved`, filter lengkap, sort stabil), `src/components/content/content-table.tsx`, `content-detail-drawer.tsx`; halaman `/admin/konten`, `/wilayah/konten`, `/cabang/konten`, `/client/konten`; CSV `/api/v1/exports/submissions`, PDF `/api/v1/reports/contents` | `e2e/konten.spec.ts`, `e2e/filters.spec.ts`, `e2e/dakosta.spec.ts` (paritas CSV), backtest rekonsiliasi baris CSV | PASS                                                                                                                                   |
| R09 | Standarisasi PDF + logo resmi                                                      | `src/lib/reports/pdf-kit.ts`, `content-pdf.ts`, `performance-pdf.ts` (header/footer setiap halaman, wrap teks, metadata), logo `public/brand/dakosta-logo-vector-transparent-3840x1280.png`; `outputFileTracingIncludes` di `next.config.ts`; audit ekspor `EXPORT_CONTENT_REPORT`      | `tests/pdf-report.test.ts`, `e2e/reports.spec.ts`, smoke (PDF 263.986 byte, `Content-Disposition`)                                                                                                                                                                  | PASS                                                                                                              |
| R10 | Pembuatan akun Master berfungsi penuh                                              | `src/lib/accounts.ts` (409 email ganda, tautan aktivasi sekali pakai + kedaluwarsa), `src/components/accounts/account-manager.tsx` (tombol salin, tanpa "kata sandi sementara")                                                                                                         | `tests/accounts-lifecycle.test.ts`, `tests/activation.test.ts`, `e2e/targets.spec.ts` (demo containment), `e2e/accounts.spec.ts`                                                                                                                                    | PASS                                                                                                              |
| R11 | Impor akun & konten operasional                                                    | `src/lib/imports/{accounts,content}.ts`; API `template`, `example`, `preview`, `commit`, `content/*`; wizard `import-wizard.tsx`, `content-import-wizard.tsx`; kebijakan konflik `skip                                                                                                  | update                                                                                                                                                                                                                                                              | upsert`, batas 1 MB/1000 baris, penjaga formula-injection, riwayat `content_import_runs/rows`                     | `tests/imports-r11.test.ts`, `tests/content-import.test.ts`, `tests/csv.test.ts`, `e2e/content-import.spec.ts`, `e2e/platform.spec.ts` | PASS |
| R12 | Sinkronisasi situs Master dengan pekerjaan nyata                                   | `src/db/schema/sync.ts`, migrasi `drizzle/0006_v1_2_imports_sync.sql`, `src/lib/sync/jobs.ts` (tahap terukur, heartbeat, retry, cancel, dry-run default), API `/api/v1/admin/sync[/id                                                                                                   | /retry                                                                                                                                                                                                                                                              | /cancel]`, `src/components/admin/sync-panel.tsx`                                                                  | `tests/sync-jobs.test.ts` (7 uji), `e2e/reports.spec.ts` (demo containment), pemulihan stale via satu `UPDATE`                         | PASS |
| R13 | Audit, backtest, regresi, rilis                                                    | `scripts/backtest-reconcile.ts`, `scripts/perf-check.mjs`, `scripts/explain-check.ts`, dokumen ini                                                                                                                                                                                      | backtest 43/43, E2E 89/89, perf 18 rute, explain 7 skenario, smoke 21/21                                                                                                                                                                                            | PASS (rilis produksi selesai)                                                                                     |

## Migrasi basis data

- `drizzle/0006_v1_2_imports_sync.sql` — aditif: `sync_jobs`, indeks unik parsial pekerjaan aktif, `content_import_runs`, `content_import_rows`.
- Jurnal/snapshot direkonsiliasi sebelum `0006` dibuat; `0005` tetap kosong sesuai riwayat.
- Uji memakai PGlite; staging memakai `dakosta_staging`. Tidak ada perubahan destruktif.

## Perubahan perilaku yang disengaja

1. Dashboard tidak lagi memuat metrik semua-status; angka pindah ke SLA.
2. `?view=` tetap bekerja dan memetakan ke anchor baru (`konten`→`tabel`, `peta`, `peringkat`, `pencapaian-cabang`, `tren-bulanan`, `tren-tema`, `tren-jenis-platform`).
3. `/admin/analitik`, `/wilayah/analitik`, `/cabang/analitik`, `/client/analitik` dialihkan dengan filter utuh (`redirectWithFilters`).
4. Ekspor CSV konten kini menegakkan `type` dan `q`, sehingga jumlah baris sama dengan total tabel untuk filter identik.
5. Lima kontainer tabel bergulir diberi `tabIndex=0` + `role=region` agar dapat dijangkau keyboard (temuan axe `scrollable-region-focusable`).
6. `recoverStaleJobs` menjalankan satu `UPDATE` (sebelumnya dua) untuk memangkas round trip basis data.

## Asumsi (eksplisit)

1. Multi-platform dihitung sebagai konten unik per `platform` yang tercatat; legenda menyatakan aturan ini. Relasi many-to-many akan memerlukan tabel baru dan diajukan terpisah.
2. Periode Dashboard: total KPI mencakup seluruh riwayat disetujui dalam scope; tren memakai jendela 12/24 bulan; tabel memiliki rentang tanggal sendiri.
3. Predikat disetujui tunggal: `status='APPROVED' AND approved_at IS NOT NULL AND archived=false`, batas bulan `Asia/Jakarta`, dipakai Dashboard, KPI, peringkat, peta, ekspor, dan PDF.
4. Sinkronisasi tidak memanggil konektor eksternal (belum ada); pekerjaan bersifat internal dan dilaporkan sebagai BLOCKED bila konektor diminta.
5. Smoke lokal memakai sesi demo (`/api/v1/demo/login`) karena Better Auth hanya mempercayai `NEXT_PUBLIC_APP_URL`; pemeriksaan produksi memakai kredensial demo dari berkas `.secrets`.

## Keamanan — hasil probe (hanya kode status)

| Probe                                                                          | Target                               | Hasil                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------ |
| API admin/review/dashboard/ekspor tanpa sesi                                   | 14 rute                              | 401                                                                      |
| POST sync dengan `Origin` asing                                                | `/api/v1/admin/sync`                 | 403                                                                      |
| POST impor tanpa asal                                                          | `/api/v1/admin/imports/preview`      | 403                                                                      |
| Stakeholder → API admin, sync, impor, review, dashboard admin, ekspor kinerja  | 6 rute                               | 403                                                                      |
| Regional → API admin, sync, impor                                              | 3 rute                               | 403                                                                      |
| Cabang → API admin, sync                                                       | 2 rute                               | 403                                                                      |
| Master demo → sync, impor akun/konten                                          | 3 rute                               | 403 (demo containment)                                                   |
| Master demo → daftar pengguna                                                  | 1 rute                               | 200 (baca diizinkan)                                                     |
| Stakeholder → ekspor dengan `stakeholderId` di luar scope                      | ekspor                               | 403                                                                      |
| Stakeholder → laporan/submission dengan `stakeholderId` di luar scope          | 2 rute                               | 200 dengan jumlah scope sendiri (18 baris, sama seperti tanpa parameter) |
| `q=' OR 1=1--`, `sort=evil;drop`, `status=<script>`, `page=-5&pageSize=999999` | ekspor/submission                    | 200, parameter diabaikan/di-clamp, tanpa galat                           |
| Duplikasi/konkurensi pekerjaan sinkronisasi                                    | unit test dengan indeks unik parsial | PASS (`tests/sync-jobs.test.ts`)                                         |
| Regional/Cabang/Stakeholder → `/admin/audit`                                   | UI audit trail                       | dialihkan ke `/akses-ditolak` (E2E `rbac.spec.ts`)                       |

## Performa

- `npm run perf` (TTFB median, LCP p95, CLS) lulus untuk 18 rute. Bukti:
  `docs/audit/evidence/E-perf-v2-2026-11-07T08-34-42Z.log`.
- Anggaran JS dashboard 700 KB (dari 375 KB) karena blok peta wajib R04 memuat MapLibre (~410 KB gzip) setelah peta memasuki viewport; rute lain 350 KB.
- TTFB memakai median karena p95 dari tiga sampel sama dengan maksimum dan satu reconnect WebSocket Neon (didokumentasikan di `src/db/index.ts`) langsung menggagalkan anggaran.
- Query plan: `kinerja`, `dashboard`, `map`, `sla`, `ranking`, `monthly`, `detail` semuanya di bawah anggaran; bukti `docs/audit/evidence/E-explain-*-2026-11-07T08-0*.json`.

## Bukti

| Artefak               | Lokasi                                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| Backtest rekonsiliasi | `docs/audit/evidence/r13-backtest-reconcile.json`                      |
| Anggaran performa     | `docs/audit/evidence/E-perf-v2-2026-11-07T08-34-42Z.log`               |
| Query plan            | `docs/audit/evidence/E-explain-*.json`                                 |
| Smoke staging         | `docs/audit/evidence/E-smoke-production-2026-11-07T08-46-45-685Z.json` |
| Smoke produksi        | `docs/audit/evidence/E-smoke-production-2026-11-07T09-08-47-791Z.json` |
| E2E                   | `npx playwright test` pada build `-a_9Vn4Z11pIQfJzWW9Nd`, 89/89        |

## Rollback

- Produksi saat ini: `https://dakosta-dakosta.vercel.app` → `dpl_GRZMo8gWau3jz6isFHJE3B4rQmTb`
  (`dakosta-dakosta-nfjqo7ny9-jarjirjor777-5316.vercel.app`).
- Target rollback: deployment produksi sebelumnya
  `dakosta-dakosta-ior2efsv2-jarjirjor777-5316.vercel.app` (13 jam sebelum rilis
  ini); fallback lebih lama `dakosta-dakosta-aafut5gox-…`.
- Migrasi `0006` aditif: rollback aplikasi tidak memerlukan penghapusan tabel; bila diperlukan, tabel baru dapat dibiarkan tanpa dipakai.
- Prosedur rilis: cadangan logis → migrasi aditif → deploy → smoke produksi → catat deployment baru dan target rollback.

## Rilis produksi

Dijalankan setelah konfirmasi eksplisit pengguna pada 2026-11-07:

1. Commit rilis `3a89ff6` pada cabang `fix/all-features-hardening`.
2. Cadangan logis produksi: `backups/2026-11-07T09-03-49-509Z-production` (gitignored).
3. Migrasi aditif `drizzle/0006_v1_2_imports_sync.sql`; 7 migrasi tercatat di
   `drizzle.__drizzle_migrations`; tabel `sync_jobs`, `content_import_runs`,
   `content_import_rows` terverifikasi ada.
4. Deploy Vercel produksi `dpl_GRZMo8gWau3jz6isFHJE3B4rQmTb`, alias
   `https://dakosta-dakosta.vercel.app`. Percobaan pertama terputus di sisi CLI
   (`fetch failed` setelah kompilasi) dan menghasilkan deployment kembar
   `dakosta-dakosta-hxhzph155-…` dari commit yang sama; keduanya ekuivalen.
5. Smoke produksi 21/21 PASS, termasuk rekonsiliasi Dashboard = Kinerja = CSV
   (41 = 41 admin, 19 = 19 wilayah), PDF Kinerja 263.503 byte, dan CSV Kinerja.

Tidak ada perubahan variabel lingkungan pada pekerjaan ini.

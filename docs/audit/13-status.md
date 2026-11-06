# D13 — Status Jujur

**Diperbarui:** 2026-11-07 (remediasi audit v2, branch `fix/all-features-hardening`). Dokumen ini memisahkan **status terkini pasca-remediasi** dari **baseline rilis v1.1 (historis)**. Setiap angka menyebut artefak dan waktunya; angka tanpa artefak tidak dipakai.

Label: DONE (bukti lulus), PARTIAL (sebagian), BLOCKED, NOT RUN.

## Status terkini — remediasi audit v2 (2026-11-07)

Fase F0–F5 sudah di-commit (`4607b9f`, `b57a7ce`, `edcba20`, `dde0234`, `599502c`, `b88c4b6`); F6 (verifikasi penuh) dijalankan dan dicatat di bawah ini. Seluruh perintah dijalankan lokal pada **staging** (`dakosta_staging`), bukan produksi.

| Area                       | Status                    | Angka terverifikasi                                                                                                                                                                           | Artefak / waktu                                                                  |
| -------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Lint                       | DONE (PASS)               | exit 0                                                                                                                                                                                        | `npm run lint`, 2026-11-07 03:03                                                 |
| Typecheck                  | DONE (PASS)               | exit 0                                                                                                                                                                                        | `npm run typecheck`, 2026-11-07 03:03                                            |
| Unit/integration           | DONE (174/174 PASS)       | 27 berkas, 174 tes, 9,09 dtk                                                                                                                                                                  | `npm test`, 2026-11-07 03:03                                                     |
| Build produksi             | DONE (PASS)               | exit 0, `.next-verify` (staging env)                                                                                                                                                          | `npm run build:verify`, 2026-11-07 03:04                                         |
| Format                     | DONE (PASS)               | exit 0, seluruh berkas sesuai                                                                                                                                                                 | `npm run format:check`, 2026-11-07 03:04                                         |
| E2E penuh F6               | DONE (86/86 PASS)         | 13 spec (a11y, content-draft, content-import, dakosta, dashboard, filters, konten, navigation, platform, rbac, reports, targets, security), 7,0 mnt; DB staging direset sebelum & sesudah run | `.next-verify` + `start:verify` port 3400, 2026-11-07 03:15–03:22                |
| Axe WCAG 2.2 AA            | DONE (0 serious/critical) | 16 kunjungan axe (`wcag2a/2aa/21a/21aa/22aa`) di 4 peran: publik 2, Master 4, Wilayah 4, Cabang 4, Stakeholder 2                                                                              | `e2e/a11y.spec.ts` (test 1–5) pada run di atas                                   |
| Reflow & overflow          | DONE (0 overflow)         | 320px: 11 kunjungan; matriks 640/768/1440: 24 kunjungan; ambang `scrollWidth - innerWidth ≤ 1`                                                                                                | `e2e/a11y.spec.ts` (test 6–13) pada run di atas                                  |
| Navigasi seluler           | DONE (PASS)               | 360px, menu Cabang terbuka                                                                                                                                                                    | `e2e/a11y.spec.ts` (test 14) pada run di atas                                    |
| Smoke staging F6           | DONE (16/16 PASS)         | Login 4 peran, 2 anchor dashboard per peran, Konten wilayah/cabang sort+filter, aktivasi, 307 stakeholder, 403 tanpa Origin, 413 body > 1 MB, 429 login berulang                              | `node .tmp-smoke-staging.mjs` terhadap `http://localhost:3400`, 2026-11-07 03:22 |
| Inventaris rute (terkini)  | DONE (dihitung ulang)     | 47 `route.ts` API, 56 handler, 33 handler mutasi                                                                                                                                              | hitung statis `find`/`grep`, 2026-11-07 02:37                                    |
| Unit & E2E (jumlah berkas) | DONE (dihitung ulang)     | 27 berkas unit, 13 spec E2E                                                                                                                                                                   | hitung statis, 2026-11-07 02:37                                                  |
| Deploy produksi v2         | NOT RUN                   | Menunggu F6 (lulus) dan konfirmasi terpisah untuk backfill `is_demo` produksi                                                                                                                 | —                                                                                |

Catatan metode: E2E F5/F6 dijalankan terhadap **build produksi** (`build:verify` → `start:verify`, port 3400) dengan `PLAYWRIGHT_BASE_URL`. Mode dev Turbopack sempat masuk loop rebuild/HMR setelah proses dev dimatikan paksa (cache `.next-e2e` korup); menghapus cache memulihkannya, tetapi build produksi dipakai agar hasil gate deterministik dan setara rilis.

### Perbaikan reviewer F6

Tinjauan independen read-only atas `01c237b..HEAD` tidak menemukan BLOCKER. Delapan temuan lanjutan diperbaiki sebelum gate:

- CSV Dashboard kini meneruskan `attribution` (tanggal disetujui vs tanggal dibuat) ke `/api/v1/exports/submissions`, sehingga ekspor identik dengan angka KPI di layar; parameter ikut tercatat di audit ekspor.
- Kunci cache analitik dashboard menyertakan `attribution` agar dua basis tanggal tidak saling menimpa.
- Chart SLA keputusan diberi label "operasional" dan satuan `hari` (sebelumnya `hr`) pada kedua tempat.
- `readJson` menegakkan batas 1 MB saat streaming (bukan setelah seluruh body dibuffer), tetap memetakan pelanggaran ke 413.
- Filter sumber Faskes FKTP menyertakan faskes tanpa kelas (sama dengan `sourceOfOrganization`), menutup ketidakcocokan label/filter.
- Smoke produksi mengirim Origin/Referer pada probe RBAC negatif agar penolakan benar-benar berasal dari guard peran, bukan guard same-origin.
- Uji E2E platform/rbac/targets diselaraskan dengan kontrak containment demo: aksi master yang diblokir (kebijakan EDUFAST, pratinjau impor akun, pencabutan sebelum step-up) diasersi 403 `FORBIDDEN`; baris target memakai cakupan `Tema Mobile JKN` yang benar-benar ada pada periode berjalan.

## Baseline rilis v1.1 (historis, 2026-11-02)

Angka di bawah mendeskripsikan rilis v1.1 dan **tidak** berlaku untuk kondisi pasca-remediasi. Baseline `51c92be`; artefak tersimpan di `docs/audit/v2-audit-2026-11/evidence/` dan `backups/`.

| Area                                 | Status                                 | Bukti                                                                                                                                                                                                                                             |
| ------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit statis D1–D13                  | DONE                                   | `docs/audit/**`                                                                                                                                                                                                                                   |
| Lint                                 | DONE (PASS)                            | `npm run lint` → exit 0                                                                                                                                                                                                                           |
| Typecheck                            | DONE (PASS)                            | `npx tsc --noEmit` → exit 0                                                                                                                                                                                                                       |
| Unit/integration                     | DONE (120/120 PASS)                    | `npm test` → 19 berkas, 120 tes (termasuk fixture 2.400 konten dan seed PGlite); register `E-05`                                                                                                                                                  |
| Dataset demo produksi (2.400 konten) | DONE (produksi terverifikasi)          | Seed `E-seed-demo-production-2026-11-01T22-36-40Z.log`; verify DB+HTTP `E-verify-demo-production-2026-11-01T22-38-04Z.log`; smoke 21/21 `E-smoke-production-2026-11-01T22-38-54-291Z.json`; spot-check G7 `E-spot-check-2026-11-01T22-40-37Z.log` |
| Format                               | DONE (PASS)                            | `npm run format:check` → semua berkas sesuai                                                                                                                                                                                                      |
| Build produksi                       | DONE (PASS)                            | `npm run build:verify` → `.next-verify`                                                                                                                                                                                                           |
| E2E Playwright                       | PARTIAL — 53/54 lulus pada build rilis | `.tmp-e2e-final.log`; kegagalan tunggal = data target sisa run lama, lulus setelah reset                                                                                                                                                          |
| A11y axe (WCAG 2.1 AA)               | DONE (PASS)                            | `e2e/a11y.spec.ts` lulus pada semua run (4 tes)                                                                                                                                                                                                   |
| Perf 14 rute (100k)                  | DONE (PASS)                            | `E-perf-100k-2026-11-01T18-08-44.log`                                                                                                                                                                                                             |
| Load 50 VU/5m (100k)                 | GAGAL pada build rilis `85feaa9`       | `E-load-read-2026-11-01T13-50-18-420Z.json` → p95 4.021 ms; lulus 09:33 pada build pra-rilis (p95 1.867 ms)                                                                                                                                       |
| Load 200/500 VU, soak                | GAGAL — dijalankan pada jaringan rusak | `E-load-soak-2026-11-01T15-23-52-009Z.json` (200 VU, p95 14,9 dtk, 78.111 error, 0 5xx); `E-load-export-2026-11-01T15-29-54-279Z.json`                                                                                                            |
| Query plan (4 skenario)              | DONE (PASS)                            | `E-explain-*-2026-11-01T11-12-*.json`                                                                                                                                                                                                             |
| Rekonsiliasi angka                   | DONE (PASS)                            | `platform.spec.ts` rekonsiliasi + smoke produksi; register `E-19`                                                                                                                                                                                 |
| `npm audit --omit=dev`               | DONE (0 kerentanan)                    | `npm audit --omit=dev` → found 0 vulnerabilities                                                                                                                                                                                                  |
| Migrasi aditif 0004/0005             | DONE (PASS)                            | 30 DDL tanpa DROP/TRUNCATE/DELETE; reheasal staging tercatat                                                                                                                                                                                      |
| Deploy produksi                      | DONE (di-override pengguna)            | `dpl_ub12np1amRNyc5V5Np7LePXG4wqt`; smoke 21/21 `E-smoke-production-2026-11-01T17-37-35-067Z.json`                                                                                                                                                |

## Implementasi paket

| Paket                                             | Status |
| ------------------------------------------------- | ------ |
| S0 Fondasi migrasi + capability + periode + guard | DONE   |
| S1 Aktivasi lokasi                                | DONE   |
| S2 IA + SLA Check                                 | DONE   |
| S3 Periode + target instansi                      | DONE   |
| S4 Kinerja + print/PDF/CSV                        | DONE   |
| S5 Dashboard merge + peta agregat                 | DONE   |
| S6 Performa & keamanan                            | DONE   |
| S7 Regresi + a11y + docs                          | DONE   |

## Keputusan yang ditutup

- DEC-01 SLA berakhir pada persetujuan cabang terakhir — `src/lib/sla.ts`, diuji `tests/sla`.
- DEC-02 Target per instansi — `src/lib/targets.ts`, `src/components/admin/target-manager.tsx`, E2E `targets.spec.ts`.
- DEC-03 Konsistensi bulan/kuartal/tahun — `src/lib/periods.ts`, `tests/periods.test.ts`, E2E rekonsiliasi.
- DEC-04 Geolokasi sekali saat aktivasi, tanpa GPS per konten — `src/lib/activation.ts`, `src/app/aktivasi-lokasi/page.tsx`, `src/app/api/v1/activation/location`.
- DEC-05 Cetak browser + PDF Kinerja; PDF Dashboard/Peta lama dihapus — `src/lib/reports/performance-pdf.ts`, `src/app/api/v1/reports/performance/route.ts`, `src/app/api/v1/exports/performance/route.ts`; rute `reports/achievement` sudah tidak ada.
- DEC-06 Atribusi `approved_at` zona Asia/Jakarta — agregasi SQL `at time zone 'Asia/Jakarta'`, diuji E2E.

## Ketahanan koneksi Neon (staging)

Endpoint staging memakai pooler Neon dan memutus WebSocket secara berkala. Perbaikan di `src/db/index.ts` + `src/db/retry.ts`:

- listener `pool.on("error")` mencegah `uncaughtException` dari soket mati;
- `query_timeout=15000` (batas klien) membuat kueri menggantung gagal cepat; parameter startup `options`/`statement_timeout` **tidak dipakai** karena endpoint pooled menolaknya (`08P01`);
- pembacaan (`SELECT`/CTE baca) diulang sekali saat galat transien; penulisan tidak diulang;
- `connectionTimeoutMillis=30000`, `idleTimeoutMillis=10000`, `DB_POOL_MAX` default 3 (staging uji 20).

Hasil: error tak tertangani pada suite turun dari berulang menjadi **0**; sisa kegagalan E2E bersifat transien jaringan dan lulus saat dijalankan ulang terisolasi (5/5 lulus, 2,1 menit).

## Hasil beban dan diagnosis lingkungan (2026-11-01)

Build rilis `85feaa9` diuji pada staging lokal (port 3400, `DB_POOL_MAX=20`, Neon staging us-east-1):

| Uji                | Hasil                                                                  | Status       |
| ------------------ | ---------------------------------------------------------------------- | ------------ |
| Tahap 1 — 50 VU/5m | 22,5 rps; p50 1.826 ms; p95 4.021 ms; p99 6.086 ms; error 0; 5xx 0     | GAGAL ambang |
| Diagnostik 20 VU   | `/client` p50 4.706 ms; DB aktif 1–2 dari 21 koneksi                   | DB idle      |
| Probe 5 VU/60s     | 0,5 rps; p50 7.505 ms; p95 17.739 ms; error 0; 5xx 0                   | GAGAL ambang |
| Jaringan           | RTT TCP 790 ms ke Neon, 333 ms ke 1.1.1.1; `SELECT 1` idle 1,7–4,3 dtk | Memburuk     |
| Tahap 2–3          | tidak dijalankan                                                       | NOT RUN      |
| Soak 200 VU/30m    | 18,9 rps; p95 14,9 dtk; p99 30 dtk; 78.111 error; 0 5xx                | GAGAL        |
| Ekspor 20 VU/5m    | 22,5 rps; p95 1.142 ms; p99 4.317 ms; 2.707 error; 0 5xx               | GAGAL        |

Karena probe **5 VU** pun gagal sementara tidak ada 5xx dan basis data menganggur, penyebabnya adalah latensi/ketidakstabilan jalur jaringan lokal ke Neon saat pengujian; log server mencatat 1.427 `timeout exceeded when trying to connect`. Run 50 VU yang lulus pukul 09:33 UTC pada build pra-rilis (p95 1.867 ms) menunjukkan aplikasi dapat memenuhi ambang saat jaringan normal.

**G6 tetap belum lulus.** Atas instruksi eksplisit pengguna pada 2026-11-02 ("Continue finish all the task. Deploy!"), deploy produksi dilanjutkan dengan tetap mencatat G6 sebagai gerbang yang belum lulus. Kapasitas platform produksi Vercel/Neon tetap **NOT VERIFIED** (tidak ada stress produksi).

## Deploy produksi (2026-11-02)

- Backup logis `backups/2026-11-01T13-46-04-747Z-production/` (30 tabel + manifest) diverifikasi sebelum mutasi.
- Migrasi aditif 0004/0005 diterapkan ke produksi (`MIGRATE_CONFIRM=apply-production`).
- Backfill lokasi sintetis hanya akun demo: dry-run 32 kandidat, diterapkan 32; akun non-demo tidak disentuh.
- Deploy pertama `dpl_5s8UGAPRzLqNw6P3BziSDihJTqFy` READY tetapi `/api/health` 503: pool mengirim parameter startup `options` (`statement_timeout`) yang ditolak endpoint pooled Neon (`08P01`). Rollback `vercel promote` ke `dpl_ywPaDgPyV6upfddusrSxU57uW9sU` memulihkan health 200 `db:ok` — bukti rollback nyata.
- Perbaikan `51c92be` memakai `query_timeout` sisi klien; typecheck 0 galat dan 111/111 tes lulus.
- Deploy final `dpl_ub12np1amRNyc5V5Np7LePXG4wqt` READY; alias `https://dakosta-dakosta.vercel.app`; health 200 `db:ok`.
- Smoke produksi 21/21 PASS `E-smoke-production-2026-11-01T17-37-35-067Z.json`: health, header keamanan, 401/307, login 4 peran, halaman per peran, RBAC negatif, PDF/CSV Kinerja, rekonsiliasi dashboard=CSV, PDF lama 404.
- Catatan operasional: Vercel memblokir deploy CLI yang membawa metadata commit dengan author tak terverifikasi; deploy rilis dilakukan dari snapshot `git archive` di luar direktori git sehingga tidak ada atribusi commit.

## Perluasan dataset demo (2026-11-02)

- Backup logis pra-mutasi `backups/2026-11-01T22-32-46-590Z-production/` (manifest target `production`).
- Dry-run `E-seed-demo-production-dryrun-2026-11-01T22-33-18Z.log`: 24 periode, 2.400 konten, 648 target, tanpa menulis.
- Percobaan seed pertama `E-seed-demo-production-2026-11-01T22-34-11Z.log` gagal di `delete from stakeholders` karena satu konten non-demo `DKS-202611-JK563` (dibuat akun demo lewat UI, `is_demo=false`) menahan FK; transaksi rollback penuh.
- Atas persetujuan pengguna, satu baris penghalang dihapus — `E-demo-blocker-delete-2026-11-01T22-36-32Z.log`.
- Seed ulang lulus `E-seed-demo-production-2026-11-01T22-36-40Z.log`: 32 akun, 2.400 konten (APPROVED 1.380, pending 60), lokasi 2.400, revisi 2.400, ulasan 2.500, target 648, notifikasi/outbox 2.565, audit 2.503.
- Verifikasi read-only lulus DB + HTTP `E-verify-demo-production-2026-11-01T22-38-04Z.log`: akun 32/32, konten 2.400, approved 40/40, target 60/40, konten master 2.400, peta 1.745, wilayah A 1.080, antrean cabang A1 9, mitra 120.
- Smoke produksi 21/21 `E-smoke-production-2026-11-01T22-38-54-291Z.json`, termasuk rekonsiliasi dashboard = Kinerja = CSV.
- Spot-check G7 `E-spot-check-2026-11-01T22-40-37Z.log`: master 40/60, 40/40, 60/59; target 27 baris; CSV regional 9 baris, cabang 3 baris; stakeholder 2/3, 2/3, 3/2; semua halaman 200.
- Tidak ada perubahan kode runtime aplikasi, deploy, atau variabel environment.

## Temuan ditunda (keputusan pengguna, 2026-11-07)

Enam temuan audit v2 sengaja tidak dikerjakan pada remediasi ini dan tetap tercatat di roadmap:

| Temuan  | Alasan penundaan                                      | Rujukan roadmap                 |
| ------- | ----------------------------------------------------- | ------------------------------- |
| FND-006 | Enkripsi backup butuh manajemen kunci terpisah        | `06-remediation-roadmap.md` R14 |
| FND-008 | CI/SAST/SBOM/observability di luar repo tanpa remote  | `06-remediation-roadmap.md` R16 |
| FND-015 | CSP nonce mengubah header global                      | `06-remediation-roadmap.md` R20 |
| FND-017 | Redesain SSE/kuota butuh arsitektur worker            | `06-remediation-roadmap.md` R18 |
| FND-018 | Penghapusan API tanpa konsumen perlu keputusan produk | `06-remediation-roadmap.md` R21 |
| FND-019 | Retensi data butuh kebijakan retensi                  | `06-remediation-roadmap.md` R19 |

## Risiko tersisa

- Kapasitas platform produksi Vercel/Neon tidak diuji beban; dinyatakan NOT VERIFIED (tidak ada stress produksi).
- Konten yang dibuat akun demo lewat UI tersimpan `is_demo=false`; seed ulang berikutnya bisa gagal di FK `RESTRICT`. Sebelum reseed, identifikasi dan (dengan persetujuan) hapus/reklasifikasi baris tersebut.
- Endpoint pooled Neon menolak parameter startup (`options`, `statement_timeout`); batas kueri harus tetap di sisi klien (`query_timeout`).
- Staging WAN menyebabkan flakiness E2E; produksi berada di region yang sama dengan basis data.
- Data uji sintetis; tidak ada PII.
- G6 (beban 50/200/500 VU + soak) masih belum lulus; deploy dilakukan atas instruksi eksplisit pengguna.

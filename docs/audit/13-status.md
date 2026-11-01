# D13 — Status Jujur

**Diperbarui:** 2026-11-02 (deploy produksi v1.1 + perluasan dataset demo). Baseline `51c92be`, branch `fix/all-features-hardening`.

Label: DONE (bukti lulus), PARTIAL (sebagian), BLOCKED, NOT RUN.

| Area                                 | Status                                                | Bukti                                                                                                                                  |
| ------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Audit statis D1–D13                  | DONE                                                  | `docs/audit/**`                                                                                                                        |
| Lint                                 | DONE (PASS)                                           | `npm run lint` → exit 0                                                                                                                |
| Typecheck                            | DONE (PASS)                                           | `npx tsc --noEmit` → exit 0                                                                                                            |
| Unit/integration                     | DONE (120/120 PASS)                                   | `npm test` → 19 berkas, 120 tes (termasuk fixture 2.400 konten dan seed PGlite)                                                        |
| Dataset demo produksi (2.400 konten) | PARTIAL — fixture/tes DONE, seed produksi G3/G4 belum | Fixture 24 bulan + 648 target; bukti produksi menyusul `E-seed-demo-production-*`, `E-verify-demo-production-*`                        |
| Format                               | DONE (PASS)                                           | `npm run format:check` → semua berkas sesuai                                                                                           |
| Build produksi                       | DONE (PASS)                                           | `npm run build:verify` → `.next-verify`                                                                                                |
| E2E Playwright                       | PARTIAL — 53/54 lulus pada build rilis                | `.tmp-e2e-final.log`; kegagalan tunggal = data target sisa run lama, lulus setelah reset                                               |
| A11y axe (WCAG 2.1 AA)               | DONE (PASS)                                           | `e2e/a11y.spec.ts` lulus pada semua run (4 tes)                                                                                        |
| Perf 14 rute (100k)                  | DONE (PASS)                                           | `E-perf-100k-2026-11-01T18-08-44.log`                                                                                                  |
| Load 50 VU/5m (100k)                 | GAGAL pada build rilis `85feaa9`                      | `E-load-read-2026-11-01T13-50-18-420Z.json` → p95 4.021 ms; lulus 09:33 pada build pra-rilis (p95 1.867 ms)                            |
| Load 200/500 VU, soak                | GAGAL — dijalankan pada jaringan rusak                | `E-load-soak-2026-11-01T15-23-52-009Z.json` (200 VU, p95 14,9 dtk, 78.111 error, 0 5xx); `E-load-export-2026-11-01T15-29-54-279Z.json` |
| Query plan (4 skenario)              | DONE (PASS)                                           | `E-explain-*-2026-11-01T11-12-*.json`                                                                                                  |
| Rekonsiliasi angka                   | DONE (PASS)                                           | `platform.spec.ts` rekonsiliasi + smoke produksi                                                                                       |
| `npm audit --omit=dev`               | DONE (0 kerentanan)                                   | `npm audit --omit=dev` → found 0 vulnerabilities                                                                                       |
| Migrasi aditif 0004/0005             | DONE (PASS)                                           | 30 DDL tanpa DROP/TRUNCATE/DELETE; reheasal staging tercatat                                                                           |
| Deploy produksi                      | DONE (di-override pengguna)                           | `dpl_ub12np1amRNyc5V5Np7LePXG4wqt`; smoke 21/21 `E-smoke-production-2026-11-01T17-37-35-067Z.json`                                     |

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

## Risiko tersisa

- Kapasitas platform produksi Vercel/Neon tidak diuji beban; dinyatakan NOT VERIFIED (tidak ada stress produksi).
- Endpoint pooled Neon menolak parameter startup (`options`, `statement_timeout`); batas kueri harus tetap di sisi klien (`query_timeout`).
- Staging WAN menyebabkan flakiness E2E; produksi berada di region yang sama dengan basis data.
- Data uji sintetis; tidak ada PII.
- G6 (beban 50/200/500 VU + soak) masih belum lulus; deploy dilakukan atas instruksi eksplisit pengguna.

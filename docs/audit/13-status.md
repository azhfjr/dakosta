# D13 — Status Jujur

**Diperbarui:** 2026-11-01 (rilis v1.1). Baseline `c0724ac`, branch `fix/all-features-hardening`.

Label: DONE (bukti lulus), PARTIAL (sebagian), BLOCKED, NOT RUN.

| Area                     | Status                                 | Bukti                                                                                    |
| ------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Audit statis D1–D13      | DONE                                   | `docs/audit/**`                                                                          |
| Lint                     | DONE (PASS)                            | `npm run lint` → exit 0                                                                  |
| Typecheck                | DONE (PASS)                            | `npx tsc --noEmit` → exit 0                                                              |
| Unit/integration         | DONE (111/111 PASS)                    | `npm test` → 18 berkas, 111 tes                                                          |
| Format                   | DONE (PASS)                            | `npm run format:check` → semua berkas sesuai                                             |
| Build produksi           | DONE (PASS)                            | `npm run build:verify` → `.next-verify`                                                  |
| E2E Playwright           | PARTIAL — 53/54 lulus pada build rilis | `.tmp-e2e-final.log`; kegagalan tunggal = data target sisa run lama, lulus setelah reset |
| A11y axe (WCAG 2.1 AA)   | DONE (PASS)                            | `e2e/a11y.spec.ts` lulus pada semua run (4 tes)                                          |
| Perf 14 rute (100k)      | DONE (PASS)                            | `E-perf-100k-2026-11-01T18-08-44.log`                                                    |
| Load 50 VU/5m (100k)     | DONE (PASS)                            | `E-load-read-2026-11-01T09-33-26-443Z.json`                                              |
| Load 200/500 VU, soak    | lihat bagian Hasil beban               | `docs/audit/evidence/E-load-*.json`                                                      |
| Query plan (4 skenario)  | DONE (PASS)                            | `E-explain-*-2026-11-01T11-12-*.json`                                                    |
| Rekonsiliasi angka       | DONE (PASS)                            | `platform.spec.ts` rekonsiliasi + smoke produksi                                         |
| `npm audit --omit=dev`   | DONE (0 kerentanan)                    | `npm audit --omit=dev` → found 0 vulnerabilities                                         |
| Migrasi aditif 0004/0005 | DONE (PASS)                            | 30 DDL tanpa DROP/TRUNCATE/DELETE; reheasal staging tercatat                             |
| Deploy produksi          | lihat bagian Rilis                     |

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
- `statement_timeout=15000` membuat kueri menggantung gagal cepat;
- pembacaan (`SELECT`/CTE baca) diulang sekali saat galat transien; penulisan tidak diulang;
- `connectionTimeoutMillis=30000`, `idleTimeoutMillis=10000`, `DB_POOL_MAX` default 3 (staging uji 20).

Hasil: error tak tertangani pada suite turun dari berulang menjadi **0**; sisa kegagalan E2E bersifat transien jaringan dan lulus saat dijalankan ulang terisolasi (5/5 lulus, 2,1 menit).

## Risiko tersisa

- Kapasitas platform produksi Vercel/Neon tidak diuji beban; dinyatakan NOT VERIFIED (tidak ada stress produksi).
- Node lokal 22.x vs runtime Vercel 24.x.
- Staging WAN menyebabkan flakiness E2E; produksi berada di region yang sama dengan basis data.
- Data uji sintetis; tidak ada PII.

# DAKOSTA v1.1 — Indeks Audit

**Baseline pembekuan:** commit `c0724ac2a77436c224866f5ed004a0f9f5dec0cf` (2026-11-01 00:53:08 +0700), working tree bersih saat audit dimulai.
**Prompt sumber:** `01-sources/master-prompt-v1.1.md`, 199 baris, SHA-256 `5d9c333d5f209c6f96f9aaf84a6ed7731b621f212d3c90e7747f5438c9083c93`.
**Lingkungan audit:** repo lokal + database staging `dakosta_staging` (`.env.staging.local`, `APP_ENV=staging`). Produksi hanya diakses read-only pada smoke terakhir; **tidak ada stress test produksi**.

## Status artefak

| #   | Artefak                                                       | Status                                                       |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| D1  | `01-sources/master-prompt-v1.1.md`, `01-sources/decisions.md` | DONE                                                         |
| D2  | `02-executive-summary.md`                                     | DONE                                                         |
| D3  | `03-traceability-matrix.md` (DAK-R01…R103)                    | DONE                                                         |
| D4  | `04-rbac-matrix.md`                                           | DONE                                                         |
| D5  | `05-ia-menu-mapping.md`                                       | DONE                                                         |
| D6  | `06-issue-register.md`                                        | DONE                                                         |
| D7  | `07-option-matrix.md`                                         | DONE                                                         |
| D8  | `08-ui-ux-design.md`                                          | DONE                                                         |
| D9  | `09-technical-design.md`                                      | DONE                                                         |
| D10 | `10-performance-plan.md`                                      | DONE (baseline); load results NOT RUN until Phase 4          |
| D11 | `11-uat-nonregression.md`                                     | DONE                                                         |
| D12 | `12-open-questions.md`                                        | DONE                                                         |
| D13 | `13-status.md`                                                | DONE, diperbarui per fase                                    |
| —   | `evidence/`                                                   | DONE for static/tooling baseline; load/perf evidence pending |

## Gate saat audit (Fase 0–1)

| Gate                | Hasil               | Bukti                                                              |
| ------------------- | ------------------- | ------------------------------------------------------------------ |
| G1 lint             | PASS                | `npm run lint` tanpa output error                                  |
| G1 typecheck        | PASS                | `tsc --noEmit` tanpa error                                         |
| G1 build            | NOT RUN pada Fase 0 | dijalankan di Fase 3/5                                             |
| G1 format           | FAIL (pre-existing) | `npm run format:check` → 257 file belum Prettier                   |
| G2 unit/integration | PASS                | 15 file, 89 tes lulus (7,15 s)                                     |
| G3 E2E              | NOT RUN pada Fase 0 | dijalankan di Fase 4                                               |
| G4 a11y             | NOT RUN             | axe ada di E2E, belum dijalankan                                   |
| G5 performa         | NOT RUN             | `npm run perf` belum dijalankan                                    |
| G6 beban            | NOT RUN             | belum ada `scripts/load-test.mjs`                                  |
| G7 rekonsiliasi     | NOT RUN             | menunggu implementasi Kinerja                                      |
| G8 keamanan         | PARTIAL             | audit statis selesai; `npm audit` dan RBAC negatif menunggu Fase 4 |
| G9 migrasi/rollback | NOT RUN             | rehearsal staging menunggu migrasi aditif                          |
| G10 deploy          | NOT RUN             | hanya setelah G1–G9 hijau                                          |

## Blocker & risiko utama

1. **P0/P1 belum ada** pada audit statis; temuan tertinggi P1: celah guard capability pada API analitik/peta/ekspor/laporan, GPS per-konten bertentangan dengan DEC-04, dan laporan PDF lama masih tersedia.
2. **Format check gagal** karena 257 file belum diformat; akan diselesaikan sebelum gate rilis (format-only change).
3. **Belum ada tooling beban** (`k6`/autocannon/script) dan **belum ada CI**; script baru dibuat di S6/S7.
4. **Kapasitas produksi tidak dapat dibuktikan** tanpa stress produksi (dilarang); bukti hanya berlaku untuk staging lokal + Neon staging.
5. **Node lokal v22.22.3**, proyek Vercel diset 24.x; build lokal tetap valid, perbedaan runtime dicatat.

## Aturan bukti

Setiap klaim diberi label **FAKTA**, **KEPUTUSAN**, **ASUMSI**, **BELUM DIVERIFIKASI**, atau **NOT RUN**, dengan `path:line` atau perintah. Tidak ada angka performa yang diklaim sebelum tes nyata.

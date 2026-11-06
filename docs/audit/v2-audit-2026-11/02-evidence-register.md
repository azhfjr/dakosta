# Evidence Register — Audit DAKOSTA v2 (2026-11)

Dokumen ini memetakan setiap klaim audit ke berkas bukti `evidence/E-*`, perintah
yang dijalankan, lingkungan, dan waktu. Klaim tanpa bukti tidak boleh berstatus
`PASS`/`FAIL`; klaim tersebut ditulis `NOT TESTED` beserta prosedurnya.

- Baseline repo: `fix/all-features-hardening` @ `01c237b`
- Tanggal audit: 2026-11-06
- Produksi: `https://dakosta-dakosta.vercel.app` (read-only)
- Lokal: Node v22.22.3, npm 10.9.8, Playwright 1.64.1 (Chromium)

## 1. Bukti eksekusi audit ini

| ID   | Berkas                                                                            | Perintah                                                         | Lingkungan          | Waktu (UTC) | Membuktikan                                                          |
| ---- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------- | ----------- | -------------------------------------------------------------------- |
| E-01 | `evidence/E-preflight-2026-11-06T02-04-08Z.log`                                   | inspeksi repo + `GET /api/health`                                | lokal + produksi    | 02:04:08    | Baseline HEAD, toolchain, target, higiene kredensial, batasan        |
| E-02 | `evidence/E-static-lint-2026-11-06T02-09-47Z.log`, `…02-13-11Z.log`               | `npm run lint`                                                   | lokal               | 02:09–02:13 | ESLint exit 0                                                        |
| E-03 | `evidence/E-static-tsc-2026-11-06T02-12-08Z.log`                                  | `npx tsc --noEmit --incremental false`                           | lokal               | 02:12:08    | TypeScript 0 galat                                                   |
| E-04 | `evidence/E-static-format-2026-11-06T02-12-39Z.log`, `…02-13-05Z.log`             | `npm run format:check`                                           | lokal               | 02:12–02:13 | Prettier sesuai                                                      |
| E-05 | `evidence/E-static-vitest-2026-11-06T02-12-45Z.log`                               | `npx vitest run --reporter=verbose`                              | lokal (PGlite/mock) | 02:12:45    | 19 berkas, 120/120 tes lulus                                         |
| E-06 | `evidence/E-static-audit-prod-2026-11-06T02-13-25Z.json`                          | `npm audit --omit=dev --json`                                    | lokal + registry    | 02:13:25    | 0 kerentanan produksi                                                |
| E-07 | `evidence/E-static-audit-all-2026-11-06T02-13-37Z.json`                           | `npm audit --json`                                               | lokal + registry    | 02:13:37    | 25 advisories; 1 critical dev-only                                   |
| E-08 | `evidence/E-static-sbom-2026-11-06T02-14-20Z.json`                                | `npm sbom --omit=dev --sbom-format=cyclonedx`                    | lokal               | 02:14:20    | SBOM CycloneDX                                                       |
| E-09 | `evidence/E-static-secret-scan-2026-11-06T02-14-27Z.json`                         | `node harness/secret-scan.mjs`                                   | lokal               | 02:14:27    | 0 temuan secret pada file terlacak                                   |
| E-10 | `evidence/E-smoke-production-2026-11-06T02-15-15-181Z.json`, `E-smoke-audit-…log` | `node scripts/smoke-production.mjs --base-url=…`                 | produksi            | 02:15:15    | 21/21 pemeriksaan lulus                                              |
| E-11 | `evidence/E-verify-audit-2026-11-06T02-15-18Z.log`                                | `npx tsx scripts/verify-demo-production.ts --target=production`  | produksi            | 02:15:18    | 32/32 akun, 2.400 konten, 4 login, rekonsiliasi                      |
| E-12 | `evidence/E-probes-2026-11-06T02-17-04Z.json`                                     | `node harness/readonly-probes.mjs`                               | produksi            | 02:17:04    | 54 probe; 48 lulus, 6 gagal                                          |
| E-13 | `evidence/E-probe-analysis-2026-11-06T02-19-30Z.md`                               | analisis kode atas 6 kegagalan                                   | lokal               | 02:19:30    | Akar masalah P-009/038/042/043/044/045                               |
| E-14 | `evidence/E-probe-password-retest-2026-11-06T02-18-03Z.json`                      | retest `POST /api/v1/me/password` (sandi salah)                  | produksi            | 02:18:03    | 500 `INTERNAL_ERROR`, bukan 4xx                                      |
| E-15 | `evidence/E-a11y-2026-11-06T02-38-16-405Z.json` + `.log`                          | `npx playwright test --config harness/playwright.a11y.config.ts` | produksi, Chromium  | 02:38–02:42 | 45 halaman unik (46 kunjungan) axe WCAG 2.2 + keyboard/dialog/reflow |
| E-16 | `evidence/E-ttfb-2026-11-06T02-37-45-447Z.json` + `.log`                          | `node harness/ttfb-probe.mjs`                                    | produksi            | 02:37       | TTFB 5 rute, 3 sampel serial; median 59–402 ms, maks 592 ms          |
| E-17 | `evidence/E-inventory-2026-11-06T02-30-10Z.json`                                  | `node harness/inventory.mjs`                                     | lokal (statis)      | 02:30:10    | 59 halaman, 46 route, 56 handler, 32 mutasi                          |
| E-18 | `evidence/E-ops-review-2026-11-06.md`                                             | review statis + bukti historis                                   | lokal               | 02:28       | Migrasi, indeks, pooling, backup, CI, SSE, rate limit, performa      |
| E-19 | `evidence/E-reconciliation-2026-11-06.md`                                         | rekonsiliasi angka                                               | lokal               | 02:33       | Klaim dokumen vs runtime/statis                                      |
| E-20 | `03-feature-coverage-matrix.csv`                                                  | output `inventory.mjs`                                           | lokal               | 02:30       | 59 baris halaman + 56 baris handler                                  |
| E-21 | `evidence/E-static-code-citations-2026-11-06.md`                                  | inspeksi `rg`/`sed` pada kode terlacak                           | lokal (statis)      | 02:38       | Sitasi berkas:baris untuk temuan yang tidak dapat diuji read-only    |

## 2. Bukti historis yang dipakai (bukan hasil audit ini)

| ID   | Berkas                                                                                                                                                              | Waktu      | Dipakai untuk                         | Batasan                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------- | ----------------------------------------- |
| H-01 | `docs/audit/evidence/E-perf-100k-2026-11-01T18-08-44.log`                                                                                                           | 2026-11-01 | Anggaran performa 100k dataset        | Lokal, bukan produksi; tidak diulang      |
| H-02 | `docs/audit/evidence/E-explain-*-2026-11-01T11-12-*.json`                                                                                                           | 2026-11-01 | Query plan dashboard/kinerja/peta/SLA | Snapshot; tidak diulang                   |
| H-03 | `docs/audit/evidence/E-load-soak-2026-11-01T15-23-52-009Z.json`                                                                                                     | 2026-11-01 | Catatan kegagalan load/soak           | Jaringan rusak; **tidak** bukti kapasitas |
| H-04 | `.tmp-e2e-final.log`                                                                                                                                                | 2026-11-01 | E2E 49 lulus / 5 gagal dari 54        | Build rilis; tidak diulang                |
| H-05 | `.tmp-e2e-isolated.log`                                                                                                                                             | 2026-11-01 | 5/5 tes yang gagal lulus terisolasi   | Tidak membuktikan suite penuh             |
| H-06 | `docs/audit/13-status.md`                                                                                                                                           | 2026-11-02 | Klaim status D1–D13                   | Memuat klaim usang; lihat E-19            |
| H-07 | `docs/audit/evidence/E-seed-demo-production-2026-11-01T22-36-40Z.log`, `E-verify-demo-production-2026-11-01T22-38-04Z.log`, `E-spot-check-2026-11-01T22-40-37Z.log` | 2026-11-01 | Dataset 2.400 konten                  | Diverifikasi ulang oleh E-11              |

## 3. Klaim → bukti (ringkas)

| Klaim                                                  | Status           | Bukti              |
| ------------------------------------------------------ | ---------------- | ------------------ |
| Lint, typecheck, format bersih                         | PASS             | E-02, E-03, E-04   |
| Unit/integration 120/120                               | PASS             | E-05               |
| Tidak ada kerentanan dependensi produksi               | PASS             | E-06               |
| Ada 1 critical dev-only (`better-auth@1.4.22` via CLI) | FAIL (dev)       | E-07               |
| Secret tidak ter-commit                                | PASS             | E-09               |
| Smoke produksi 21/21                                   | PASS             | E-10               |
| Dataset 2.400 konten & 32 akun                         | PASS             | E-11               |
| API tanpa sesi → 401; halaman → 307                    | PASS             | E-12 (P-001…P-016) |
| RBAC lintas peran GET → 403                            | PASS             | E-12 (P-021…P-030) |
| `HEAD /api/v1/admin/imports` tanpa auth → 204          | FAIL             | E-12 (P-009)       |
| UUID invalid → 500                                     | FAIL             | E-12 (P-038), E-13 |
| CSRF origin asing pada 3 mutasi → 400/500              | FAIL             | E-12 (P-042…P-044) |
| Demo publish policy → 404 (bukan 403)                  | FAIL             | E-12 (P-045)       |
| Body 2 MB diterima (tanpa 413)                         | FAIL (tanpa cap) | E-12 (P-052)       |
| `x-request-id` klien diterima apa adanya               | FAIL (hardening) | E-12 (P-051)       |
| WCAG 2.2 AA                                            | FAIL             | E-15               |
| Keyboard, dialog, focus return                         | PASS             | E-15               |
| Reflow 320–1440 px & zoom 200/400%                     | FAIL (2 halaman) | E-15               |
| TTFB produksi < 1 dtk (warm)                           | PASS (indikatif) | E-16               |
| Kapasitas/load produksi                                | NOT TESTED       | H-03               |
| Backup plaintext berisi PII/auth                       | FAIL             | E-18 §4            |
| CI/SAST/SCA/observability                              | FAIL             | E-18 §5–6          |
| Retensi audit/notifikasi/outbox                        | FAIL             | E-18 §4            |
| Rollback prosedur                                      | PASS (dokumen)   | E-18 §8            |

## 4. Perintah reproduksi

```bash
# Static gates
npm run lint
npx tsc --noEmit --incremental false
npm run format:check
npx vitest run --reporter=verbose
npm audit --omit=dev --json
npm audit --json
npm sbom --omit=dev --sbom-format=cyclonedx
node docs/audit/v2-audit-2026-11/harness/secret-scan.mjs

# Produksi read-only
node scripts/smoke-production.mjs --base-url=https://dakosta-dakosta.vercel.app
npx tsx scripts/verify-demo-production.ts --target=production
node docs/audit/v2-audit-2026-11/harness/readonly-probes.mjs
node docs/audit/v2-audit-2026-11/harness/ttfb-probe.mjs

# A11y (Chromium)
npx playwright test --config docs/audit/v2-audit-2026-11/harness/playwright.a11y.config.ts

# Inventaris
node docs/audit/v2-audit-2026-11/harness/inventory.mjs
```

## 5. Sanitasi

- Tidak ada kata sandi, token, cookie, atau PII di seluruh `evidence/`.
- Kredensial hanya dibaca dari `.secrets/` oleh harness; nilai tidak dicetak.
- `.secrets/` dan `.env*` tidak disalin ke direktori audit.
- Temuan yang menyangkut data sensitif dicatat tanpa menyalin isi.

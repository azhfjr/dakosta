# D10 — Performance & Capacity Plan

**Status saat ini:** baseline statis selesai; performa 100k, query plan, dan beban baca tahap 1 sudah dijalankan. Tahap beban lanjutan dicatat di bagian Hasil.

## Baseline yang ada

| Alat                       | Cakupan                                                             | Status                                   |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| `scripts/perf-check.mjs`   | 8 rute, TTFB p95 ≤1.200 ms, LCP p95 ≤2.500 ms, CLS ≤0.1, JS ≤375 KB | DONE — 14/14 rute OK (100k, 2026-11-01)  |
| `scripts/audit-routes.mjs` | Route sweep per role, deteksi 5xx                                   | DONE                                     |
| Playwright                 | 9 spec E2E termasuk RBAC/axe                                        | DONE — lihat `13-status.md`              |
| Vitest                     | unit/integration                                                    | DONE — termasuk `tests/db-retry.test.ts` |
| Load test                  | `scripts/load-test.mjs` (read/mixed/soak/export)                    | DONE tahap 1; tahap lanjutan lihat Hasil |
| Query plan                 | `scripts/explain-check.ts`                                          | DONE — 4 skenario dalam anggaran         |
| CI/CD                      | belum ada                                                           | NOT RUN                                  |

## Capacity model

- **Beban data:** 100.000 submissions; ±300.000 review; 2.000 organisasi; 200 cabang; 20 wilayah; 12 bulan.
- **Beban pengguna:** 50/200/500/1.000 VU sintetis; campuran baca dashboard, filter/sort Kinerja, detail, submit, approval, ekspor, cetak.
- **Hosting uji:** server produksi lokal (`npm run start:verify`, port 3400) + Neon staging. Pool DB uji `DB_POOL_MAX=20`; produksi tetap 3.
- **Batas yang tidak dibuktikan:** kapasitas platform Vercel/Neon produksi. Dinyatakan **NOT VERIFIED**; tidak ada stress produksi.

## SLO uji

| Metrik                 | Target                                  |
| ---------------------- | --------------------------------------- |
| p95 interaktif         | ≤2.000 ms                               |
| p99                    | ≤4.000 ms                               |
| Stress p95             | ≤4.000 ms                               |
| Error rate tahap 1–3   | <1%, 5xx = 0                            |
| Soak                   | <1%, p95 ≤2.000 ms, memori stabil       |
| Query Kinerja 100k     | <500 ms                                 |
| Agregat Dashboard/Peta | <1.000 ms                               |
| SLA queue              | <500 ms                                 |
| CSV mulai mengalir     | <3.000 ms                               |
| PDF Kinerja            | <5.000 ms                               |
| Web Vitals             | LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 (p75) |

## Perintah

Perintah lengkap ada di rencana §10 dan `docs/audit/13-status.md` saat Fase 4. Ringkas:

```bash
npm run db:seed:load -- --target=staging --contents=100000 --orgs=2000 --branches=200 --regions=20
DB_POOL_MAX=20 npm run start:verify
PLAYWRIGHT_BASE_URL=http://localhost:3400 npm run perf
node scripts/load-test.mjs --base-url=http://localhost:3400 --profile=read --vus=50 --duration=5m --ramp=1m --max-p95=2000 --max-p99=4000 --max-error-rate=0.01
node scripts/load-test.mjs --base-url=http://localhost:3400 --profile=read --vus=200 --duration=10m --ramp=2m --max-p95=2000 --max-p99=4000 --max-error-rate=0.01
node scripts/load-test.mjs --base-url=http://localhost:3400 --profile=mixed --vus=500 --duration=15m --ramp=3m --max-p95=2000 --max-p99=4000 --max-error-rate=0.01 --max-5xx=0
node scripts/load-test.mjs --base-url=http://localhost:3400 --profile=read --vus=1000 --duration=10m --ramp=3m --max-p95=4000 --max-p99=8000 --max-error-rate=0.02
node scripts/load-test.mjs --base-url=http://localhost:3400 --profile=soak --vus=200 --duration=30m --ramp=2m --max-p95=2000 --max-error-rate=0.01
npx tsx scripts/explain-check.ts --target=staging --scenario=kinerja --period=2026-Q4
```

## Rencana optimasi berdasarkan diagnosis

1. Query tabel: hilangkan 3 subquery berkorelasi/baris; join agregat sekali.
2. Index komposit: `(status, approved_at)`, `(stakeholder_id, status, approved_at)`, `(branch_office_id, status, approved_at)` setelah snapshot.
3. Peta: agregasi server-side per institusi; tanpa pin per konten.
4. CSV: streaming; tanpa cap 2.000.
5. Frontend: lazy-load peta/chart; batasi transfer.
6. Pool DB: konfigurasi `DB_POOL_MAX`, default produksi 3; uji staging 20.
7. Pre-aggregation/MV hanya jika tes membuktikan perlu; belum diaktifkan.

## Hasil terverifikasi (staging, 100k konten)

Dataset: `E-seed-load-2026-11-01T10-28-55.log` — 100.000 konten, 100.704 ulasan, 24.000 target, 2.000 instansi, 200 cabang, 20 wilayah, semua `is_demo=true`.

Performa rute (`E-perf-100k-2026-11-01T18-08-44.log`, 14/14 OK):

| Rute                | TTFB p95 | LCP p95 | CLS   | JS KB |
| ------------------- | -------- | ------- | ----- | ----- |
| /admin              | 794 ms   | 908 ms  | 0.000 | 348   |
| /admin/analitik     | 448 ms   | 572 ms  | 0.000 | 353   |
| /admin/target       | 387 ms   | 848 ms  | 0.099 | 230   |
| /admin/konten       | 348 ms   | 1668 ms | 0.099 | 231   |
| /admin/konten/impor | 661 ms   | 768 ms  | 0.020 | 227   |
| /wilayah            | 381 ms   | 544 ms  | 0.000 | 222   |
| /wilayah/dashboard  | 428 ms   | 628 ms  | 0.000 | 356   |
| /wilayah/kinerja    | 995 ms   | 1520 ms | 0.043 | 231   |
| /cabang             | 408 ms   | 548 ms  | 0.000 | 222   |
| /cabang/dashboard   | 396 ms   | 564 ms  | 0.000 | 348   |
| /cabang/kinerja     | 439 ms   | 936 ms  | 0.043 | 231   |
| /cabang/review      | 805 ms   | 956 ms  | 0.000 | 222   |
| /client             | 356 ms   | 540 ms  | 0.000 | 356   |
| /client/analitik    | 474 ms   | 560 ms  | 0.000 | 353   |

Query plan (`E-explain-kinerja|dashboard|map|sla-2026-11-01T11-12-*.json`): keempat skenario memakai index dan berada di bawah anggaran (Kinerja <500 ms, Dashboard/Peta <1.000 ms, SLA <500 ms).

Beban baca tahap 1 (`E-load-read-2026-11-01T09-33-26-443Z.json`): 50 VU, 5 menit, 13.592 permintaan, 45,1 rps, p50 931 ms, p95 1.867 ms, p99 2.407 ms, error 0, 5xx 0, **pass**.

Tahap beban lanjutan (200/500/1.000 VU, soak 30 menit, ekspor/PDF) dijalankan setelah seed ulang akhir; hasilnya dicatat pada berkas `E-load-*.json` terbaru.

## Pelaporan

p50/p95/p99, throughput, error, query plan, ukuran transfer, Web Vitals, sampel. Tidak ada klaim “100k lancar” tanpa evidence.

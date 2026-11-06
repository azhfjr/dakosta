# Audit Website Menyeluruh DAKOSTA v2 — 2026-11

Direktori ini adalah hasil audit read-only (laporan + roadmap) atas aplikasi DAKOSTA. Tidak ada perubahan pada `src/`, `e2e/`, konfigurasi, database, atau deployment.

## Baseline

| Item          | Nilai                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Repo          | `C:\Users\PLN\Documents\Qoder\2026-10-30\b8cd74b6`                                                              |
| Branch / HEAD | `fix/all-features-hardening` · `01c237b0f3549547dcc9c1de0ef027f6caccfb6c`                                       |
| Produksi      | `https://dakosta-dakosta.vercel.app` (read-only)                                                                |
| Tanggal audit | 2026-11-06                                                                                                      |
| Toolchain     | Node v22.22.3, npm 10.9.8, Playwright 1.64.1 (Chromium-1223/1248)                                               |
| Stack         | Next.js 16.4.3 App Router, React 19.3, TypeScript, Tailwind v4, Drizzle ORM, Neon Postgres, Better Auth, Vercel |
| Standar       | OWASP Top 10:2021, OWASP API Security Top 10:2023, OWASP ASVS 5.0 Level 2, WCAG 2.2 AA                          |

## Isi direktori

| Berkas                           | Isi                                                                         |
| -------------------------------- | --------------------------------------------------------------------------- |
| `00-README.md`                   | Indeks, baseline, cara membaca label, status eksekusi                       |
| `01-laporan-utama.md`            | Laporan 10 seksi wajib                                                      |
| `02-evidence-register.md`        | Klaim → berkas `E-*` → perintah → timestamp                                 |
| `03-feature-coverage-matrix.csv` | 59 halaman + 46 route file API (56 handler)                                 |
| `04-findings.csv`                | Tabel temuan untuk triase                                                   |
| `05-test-matrix.csv`             | ID uji, environment, peran, hasil, bukti                                    |
| `06-remediation-roadmap.md`      | Bucket 0–48 jam / 1–2 minggu / 1–2 bulan / backlog                          |
| `harness/`                       | Tooling audit (`inventory.mjs`, harness axe WCAG 2.2) — bukan kode aplikasi |
| `evidence/`                      | `E-*.log/json/txt` tersanitasi                                              |

## Label yang dipakai

**Status eksistensi fitur**

- `VERIFIED` — ada di kode dan terbukti di runtime.
- `INFERRED` — ada di kode, belum diuji runtime.
- `UNKNOWN` — disebut dokumen, tidak ditemukan di kode.

**Status pengujian**

- `PASS` / `FAIL` — diuji dan punya bukti `E-*`.
- `BLOCKED` — tidak dapat diuji karena prasyarat gagal.
- `NOT TESTED` — belum diuji; wajib disertai prosedur pada laporan.

**Status bukti temuan**

- `CONFIRMED` — dibuktikan langsung (kode/konfigurasi/runtime).
- `SUSPECTED` — indikasi kuat, dampak belum dibuktikan runtime.
- `NOT TESTED` — tidak diuji.

## Ringkasan inventaris (F1)

Angka di bawah adalah **snapshot audit 2026-11-06** (commit `01c237b`). Setelah remediasi F1–F5, inventaris berubah: 47 `route.ts` (56 handler, 33 mutasi), 27 berkas unit, 13 spec E2E — lihat `docs/audit/13-status.md` untuk angka terkini beserta artefaknya.

- 59 `page.tsx`; 12 di antaranya redirect-only (mis. `/admin/laporan` → `/admin/analitik`).
- 46 `route.ts` API dengan 56 handler; 32 handler mutasi (POST/PATCH/DELETE/PUT).
- 3 endpoint publik (4 handler): `/api/health` GET, `/api/auth/[...all]` GET+POST, `/api/v1/demo/login` POST (mode demo).
- 32 handler khusus MASTER_ADMIN; 3 handler review MASTER_ADMIN|BRANCH_ADMIN; 16 handler scope-dependent.
- 6 handler mutasi tidak memakai `assertSameOrigin`; 18 tidak memakai `consumeRateLimit`.
- 11 handler mutasi master tidak memiliki guard demo (revoke/policy/target/outbox/import preview).
- Tidak ada unit test di `src/`; unit test berada di `tests/` (19 berkas) dan E2E di `e2e/` (9 spec, 54 tes).

## Trust boundary (ringkas)

1. **Browser → Vercel edge** — TLS, HSTS, CSP/header keamanan dari `next.config.ts`.
2. **Vercel → `src/proxy.ts`** — hanya memeriksa keberadaan cookie sesi; bukan otorisasi peran.
3. **Server Component/layout** — `requireRole` pada layout `/admin`, `/wilayah`, `/cabang`, `/client`; `requireAuth`/`requireUser` untuk halaman lain.
4. **API Route Handler** — `getApiUser`, `requireMasterApi`, `requireApiRole`; capability check pada endpoint analitik/ekspor/peta; scope predicate SQL pada data konten.
5. **Drizzle ORM → Neon** — query parameterized; koneksi pooled (`@neondatabase/serverless`).
6. **Egress keluar** — hanya tile peta `tiles.openfreemap.org` (via `src/lib/geo.ts` dan CSP); font di-host sendiri. Tidak ada panggilan pihak ketiga lain ditemukan di `src/`.

## Reproduksi

```bash
# Inventaris & coverage matrix
node docs/audit/v2-audit-2026-11/harness/inventory.mjs

# Static gates
npm run lint
npx tsc --noEmit
npm run format:check
npx vitest run --reporter=verbose

# Produksi read-only (smoke yang sudah ada)
node scripts/smoke-production.mjs --base-url=https://dakosta-dakosta.vercel.app
npx tsx scripts/verify-demo-production.ts --target=production

# Harness WCAG 2.2 (Chromium)
npx playwright test --config docs/audit/v2-audit-2026-11/harness/playwright.a11y.config.ts
```

## Batasan

- Read-only: tidak ada uji mutasi bisnis, reset/seed, load/stress, atau brute force.
- Firefox/WebKit/screen reader: NOT TESTED.
- Temuan yang hanya dapat dibuktikan lewat mutasi nyata ditandai `SUSPECTED` dengan prosedur reproduksi.

## Status eksekusi

| Fase               | Status             | Catatan                                              |
| ------------------ | ------------------ | ---------------------------------------------------- |
| F0 Preflight       | Selesai            | `evidence/E-preflight-2026-11-06T02-04-08Z.log`      |
| F1 Inventory       | Selesai            | `03-feature-coverage-matrix.csv`, `E-inventory-*`    |
| Checkpoint B       | Disetujui pengguna | lanjut F2                                            |
| F2.1 Static gates  | Selesai            | `E-static-*`                                         |
| F2.2 Produksi      | Selesai            | `E-smoke-production-*`, `E-verify-audit-*`           |
| F2.3 Safe probes   | Selesai            | `E-probes-*`, `E-probe-analysis-*`                   |
| F2.4 A11y Chromium | Selesai            | `E-a11y-*`                                           |
| F2.5 Ops & TTFB    | Selesai            | `E-ops-review-*`, `E-ttfb-*`                         |
| F3 Validasi        | Selesai            | `E-reconciliation-*`; koreksi jumlah halaman/handler |
| F4 Laporan         | Selesai            | `01-laporan-utama.md`, `05-test-matrix.csv`          |
| F5 Roadmap & QG    | Selesai            | `06-remediation-roadmap.md`; QG-1…QG-7               |
| Checkpoint D       | Menunggu review    | Draf laporan untuk ditinjau pengguna                 |
| Checkpoint E       | Belum              | Persetujuan commit dokumen audit                     |

## Quality Gates (QG-1…QG-7)

| Gate | Kriteria                                                                                     | Status | Bukti                                                                  |
| ---- | -------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| QG-1 | 100% baris `PASS`/`FAIL` di matriks uji memiliki referensi bukti dengan timestamp/lingkungan | PASS   | `05-test-matrix.csv`; E-01…E-21; baris historis memakai H-04/H-05/H-02 |
| QG-2 | Angka unit/E2E/a11y/route/handler dihitung ulang; selisih dijelaskan                         | PASS   | E-05, E-17, E-19, E-15                                                 |
| QG-3 | Semua P0/P1 dibaca ulang; status bukti konsisten                                             | PASS   | FND-001 dibaca dua kali (kandidat → pasca P-045 + E-21); tidak ada P0  |
| QG-4 | 10 seksi laporan lengkap; tidak ada klaim tanpa bukti; `NOT TESTED` eksplisit                | PASS   | `01-laporan-utama.md` §1–§10; `05-test-matrix.csv`                     |
| QG-5 | Tidak ada password/token/cookie/PII di laporan/evidence                                      | PASS   | E-09; pemindaian pola rahasia pada 42 berkas audit (0 nilai nyata)     |
| QG-6 | `git status` hanya menampilkan `docs/audit/v2-audit-2026-11/**`                              | PASS   | `git status --porcelain` 2026-11-06T02:43:39Z                          |
| QG-7 | Minimal 5 perintah di README dapat dijalankan ulang                                          | PASS   | 7 blok perintah pada bagian Reproduksi                                 |

Catatan QG-1: baris historis yang tidak dijalankan ulang (E2E, query plan)
memakai arsip `H-*` dan ditandai `PARTIAL (historis)`/`PASS (historis)`.
Catatan QG-5: pemindaian menemukan pola regex pembaca kredensial di harness,
bukan nilai kredensial; tidak ada sandi/token yang tersalin.

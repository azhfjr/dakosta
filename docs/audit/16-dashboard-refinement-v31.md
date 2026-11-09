# Laporan Rilis Dashboard Dakosta v3.1 (Refinement)

- Tanggal rilis: 8 November 2026 (WIB)
- Branch kerja: `fix/all-features-hardening`
- Commit rilis: `04f8fc7` (refinement + perbaikan hash) dan `535a500` (fit satu layar untuk 10 baris peringkat)
- Status deploy: **PRODUCTION** — `dpl_59uYtGsJUDEZUfdYdvtGZAibjFq3`, alias `https://dakosta-dakosta.vercel.app`, smoke produksi 21/21

> **Superseded (9 November 2026):** Kepadatan satu layar dan gate 1440×900 pada laporan ini digantikan oleh `17-dashboard-restoration-v32.md`. Butir 2 di bawah juga tidak akurat: bar sejak v3.1 dihitung terhadap total kategori, bukan terhadap nilai maksimum baris yang tampil.

## 1. Ringkasan perubahan

v3.1 mempertahankan information architecture, kontrak data approved-only, dan seluruh keputusan D1–D10 dari rilis v3 (`dpl_6hFKpQpbAcZDnFTXwGDQhJNZiCd2`). Perubahan bersifat presentasional dan navigasi:

1. **Kepadatan satu layar 1440×900.** Shell (container, header halaman, skeleton, footer) dipadatkan; scorecard ringkasan, chart konten per cabang, panel peringkat, peta, dan panel tema memakai ritme `xl` yang lebih rapat sehingga dashboard Master dengan 8 cabang dan 10 baris peringkat pada keempat kategori tetap muat dalam satu layar.
2. **Bar peringkat proporsional terhadap himpunan yang tampil.** `rankingShare()` menghitung persentase terhadap nilai maksimum baris yang ditampilkan, bukan terhadap total kategori, sehingga bar teratas selalu penuh dan baris lain terbaca proporsional. Format persentase memakai satu desimal gaya Indonesia (`formatShareId`).
3. **Perbaikan navigasi hash (root cause Next.js 16.4.3).** Checklist cabang tidak lagi dapat menghasilkan `#anchor#anchor` saat berpindah kembali ke rute hidrasi.
4. **Gate visual diperkuat.** Audit visual 4 peran × 3 viewport dan verifikasi live produksi 4 peran pada 1440×900 dijalankan ulang; kegagalan fit pada data produksi penuh tertangkap oleh gate live dan diperbaiki sebelum rilis final.

## 2. Perbaikan hash: akar masalah dan solusi

Gejala: memilih wilayah pada checklist saat berada di `/admin#tema-konten` lalu mereset pilihan menghasilkan URL `#tema-konten#tema-konten`, sehingga anchor meleset.

Akar masalah di Next.js 16.4.3:

1. `create-initial-router-state.js` menyemai route cache dengan `createHrefFromUrl(location)` yang **menyertakan hash hidrasi** (`discoverKnownRoute`).
2. `app-router-state.js` (`navigateUsingPrefetchedRouteTree`) menghitung `canonicalUrl = route.canonicalUrl + url.hash`.
3. Cache key tidak membedakan hash, sehingga navigasi ke pathname+search yang sama memakai entri ber-hash dan menambahkan hash sekali lagi pada setiap navigasi.

Solusi di `src/components/dashboard/branch-checklist.tsx`:

- `hydrationHref` menangkap URL hidrasi (path + search + hash) sekali di module scope sebelum navigasi klien.
- Bila target sama dengan rute hidrasi dan hash saat ini sama dengan hash hidrasi, navigasi dilakukan tanpa hash; canonical Next memulihkan hash tepat satu kali (tidak pernah ada URL ganda yang ditulis).
- Layout effect normalisasi tetap dipertahankan sebagai jaring pengaman untuk jalur lain (mis. hash berbeda), menulis tepat satu hash setelah navigasi commit.

Regresi ditutup oleh `e2e/filters.spec.ts` (skenario wilayah → reset dengan hash awal) yang gagal pada build produksi sebelum perbaikan dan lulus 3/3 run berulang setelahnya.

## 3. File utama

### 3.1 Ditambahkan

| File                                        | Alasan                                                              |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/dashboard/ranking.ts`              | `rankingShare()` + `formatShareId()`; skala bar terhadap set tampil |
| `tests/dashboard-ranking.test.ts`           | Unit test proporsi bar, pembulatan persentase, dan batas nilai      |
| `docs/audit/16-dashboard-refinement-v31.md` | Laporan rilis ini                                                   |

### 3.2 Diubah

| File                                                                                                                           | Perubahan                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `src/components/dashboard/branch-checklist.tsx`                                                                                | Perbaikan hash Next (hydrationHref, navigasi tanpa hash, normalisasi layout effect) |
| `src/components/dashboard/category-ranking.tsx`                                                                                | Bar proporsional; ritme baris/padding `xl` agar 10 baris muat satu layar            |
| `src/components/dashboard/dashboard-overview.tsx`                                                                              | Jarak antar-section `xl` dipadatkan                                                 |
| `src/components/dashboard/scorecards.tsx`, `stat-card.tsx`                                                                     | Scorecard dense dan tema lebih ringkas                                              |
| `src/components/dashboard/branch-stack-chart.tsx`, `dashboard-map.tsx`, `theme-panel.tsx`                                      | Tinggi kartu dan label dipadatkan tanpa mengurangi isi                              |
| `src/components/shell/app-shell.tsx`, `page-container.tsx`, `page-header.tsx`, `page-skeleton.tsx`                             | Padding dan tipografi shell untuk layar 900px                                       |
| `src/components/site-footer.tsx`                                                                                               | Footer kompak                                                                       |
| `src/app/admin/page.tsx`, `src/app/wilayah/dashboard/page.tsx`, `src/app/cabang/dashboard/page.tsx`, `src/app/client/page.tsx` | Penyesuaian header halaman dashboard                                                |
| `e2e/dashboard.spec.ts`, `e2e/filters.spec.ts`, `e2e/a11y.spec.ts`                                                             | Assertion satu layar, urutan anchor, dan regresi hash                               |
| `scripts/dashboard-visual-audit.mjs`                                                                                           | Audit 12 tangkapan dengan pemeriksaan fit dan overflow                              |
| `docs/audit/evidence/dashboard-v3/*`                                                                                           | Screenshot dan `visual-audit.json` diperbarui                                       |

Tidak ada perubahan skema, endpoint publik, variabel lingkungan, aturan approval, atau data produksi.

## 4. Gate verifikasi

| Gate                                                            | Hasil                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npx prettier --check` (file berubah)                           | Lulus                                                                                                               |
| `npm run lint`                                                  | Exit 0, tanpa temuan                                                                                                |
| `npm run typecheck`                                             | Exit 0                                                                                                              |
| `npm test`                                                      | **38 file, 259 test lulus**                                                                                         |
| `npm run test:backtest`                                         | **67/67 check lulus**; `r13-backtest-reconcile.json` (generatedAt `2026-11-08T05:03:27.573Z`)                       |
| `npm run build:verify`                                          | Exit 0; build produksi dengan env staging                                                                           |
| `PLAYWRIGHT_BASE_URL=http://localhost:3400 npx playwright test` | **100 passed (7.7m)** terhadap production build `.next-verify`                                                      |
| `node scripts/dashboard-visual-audit.mjs`                       | **12/12** tangkapan; 0 overflow; 0 console/page error; `visual-audit.json` (generatedAt `2026-11-08T04:52:25.800Z`) |
| `node scripts/smoke-production.mjs`                             | **21/21 PASS**; `E-smoke-production-2026-11-08T05-02-35-303Z.json`                                                  |
| Verifikasi live 4 peran (1440×900)                              | 4/4 PASS; tinggi 900px, 12/12 anchor ada dan terurut, toolbar filter 1, peta siap                                   |

Gate live memakai kredensial demo yang dibaca dari `.secrets` tanpa mencetak nilainya. Rate limit login demo tidak diubah dan tidak di-bypass.

## 5. Verifikasi produksi

Deploy final: `dpl_59uYtGsJUDEZUfdYdvtGZAibjFq3`

1. Alias produksi `https://dakosta-dakosta.vercel.app` aktif; `/api/health` 200.
2. Smoke produksi 21/21: health, header keamanan, 401/307 tanpa sesi, login 4 peran, halaman per peran, RBAC negatif (403), PDF/CSV Kinerja, rekonsiliasi Dashboard = Kinerja = CSV (41 = 41 admin, 19 = 19 wilayah), CSV konten.
3. Verifikasi live 1440×900 pada data produksi penuh (Master 1.381 konten, 8 cabang, 19 baris peringkat; Regional 9; Branch 3; Stakeholder 1):
   - master: height 900/900, anchor 12/12 terurut
   - regional: height 900/900, anchor 12/12 terurut
   - branch: height 900/900, anchor 12/12 terurut
   - stakeholder: height 900/900, anchor 12/12 terurut
4. Screenshot produksi: `docs/audit/evidence/dashboard-v3/production-{master,regional,branch,stakeholder}-1440.png`.

Catatan iterasi: deploy antara `dpl_6ZXR6QxAoggHT31HF2Jd6KW23MNs` sempat dipromosikan, lalu gate live menemukan tinggi Master 939px pada data produksi penuh (dataset demo lokal hanya memiliki 5 baris FKTP sehingga tidak mereproduksi). Perbaikan `535a500` memadatkan ritme baris `xl` tanpa mengurangi 10 baris teratas, dan deploy final lulus gate tersebut.

## 6. Rollback

- Target rollback: **`dpl_6hFKpQpbAcZDnFTXwGDQhJNZiCd2`** (rilis Dashboard v3, 2026-11-08 05:30 WIB).
- Rollback aplikasi tidak memerlukan pemulihan basis data: tidak ada migrasi skema, seed, atau perubahan data pada rilis ini.
- Prosedur: promosikan deployment rollback melalui Vercel (`vercel promote dpl_6hFKpQpbAcZDnFTXwGDQhJNZiCd2`) lalu jalankan smoke produksi.

## 7. Risiko dan catatan

| Risiko                                                          | Mitigasi / status                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Dataset demo lokal tidak mereproduksi volume peringkat produksi | Gate live 1440×900 dijalankan pada produksi dengan 4 peran sebagai penentu akhir     |
| Bar proporsional berubah bila filter cabang mengubah set tampil | `rankingShare()` memakai nilai maksimum himpunan tampil; unit test mengunci perilaku |
| Hash ganda dapat muncul pada navigasi lain di masa depan        | Layout effect normalisasi tetap ada; E2E hash dijalankan pada suite penuh            |
| Kepadatan `xl` menurunkan ruang baca                            | Perubahan hanya pada breakpoint `xl`; tampilan 768/375 diuji ulang tanpa overflow    |
| Kapasitas produksi belum diuji beban (G6)                       | Tidak berubah dari status sebelumnya; dinyatakan NOT VERIFIED                        |

Data produksi tetap sintetis/demo; tidak ada PII, NIK, atau nomor JKN.

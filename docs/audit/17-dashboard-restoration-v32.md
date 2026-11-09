# Laporan Restorasi Dashboard Dakosta v3.2

- Tanggal rilis: 9 November 2026
- Branch kerja: `fix/all-features-hardening`
- Commit rilis: `63219f5`
- Status deploy: **PRODUCTION** — `dpl_3jMB35EEUcnFZtyHrPwLo6VaKRCT`, alias `https://dakosta-dakosta.vercel.app`, smoke produksi 21/21
- Rollback target: Dashboard v3.1 `dpl_59uYtGsJUDEZUfdYdvtGZAibjFq3`

## 1. Konteks permintaan

Permintaan pengguna: kembalikan konsep dashboard seperti sebelum update terakhir (konsep v3, commit `9b0a9d3`), atur seluruh chart dan peta menjadi proporsional, hilangkan tumpang tindih spacing, dan pertahankan filter inline horizontal pada blok Kolaborasi. Kualitas visual dan keterbacaan menjadi prioritas, bukan pemaksaan muat satu layar.

v3.2 karena itu mengembalikan komposisi dan skala v3, mempertahankan perbaikan fungsional v3.1 (toolbar filter inline, bar peringkat proporsional, perbaikan hash Next.js 16.4.3), dan mengganti gate "satu layar 1440×900" dengan gate proporsi dan non-overlap yang diukur mesin.

## 2. Diagnosis v3.1

1. **Kepadatan satu layar.** v3.1 memadatkan shell, scorecard, chart, peta, dan panel tema pada breakpoint `xl` agar dashboard Master muat 900px. Hasilnya ritme baca sempit dan chart/peta kehilangan ruang, sementara gate tetap rapuh terhadap volume data produksi (insiden tinggi 939px pada data penuh).
2. **Komposisi menyimpang dari v3.** Ringkasan, peta, dan tema ditempatkan berdampingan dalam grid dua kolom; peringkat dipaksa empat kolom. Konsep v3 yang disetujui menempatkan chart per cabang selebar konten, peringkat 2×2, dan peta selebar konten di dalam blok Kolaborasi.
3. **Dokumentasi skala bar tidak akurat.** `16-dashboard-refinement-v31.md` menyatakan bar diskalakan terhadap nilai maksimum baris yang tampil. Kode sejak v3.1 memakai `rankingShare(row.total, score)` dengan `score` = total kategori, sehingga bar teratas tidak selalu penuh. Perilaku kode dipertahankan; dokumen tersebut ditandai superseded.

## 3. Komposisi v3.2

Urutan dan proporsi yang dipulihkan:

1. **Shell.** `main` memakai `lg:py-8`, container `gap-6`, judul halaman `text-2xl`, footer mengikuti skala v3.
2. **Ringkasan.** Dua scorecard (`p-4 sm:p-5`, nilai `text-3xl`) di atas, lalu chart Konten per Cabang selebar konten (`max-h-[440px]`, tinggi minimum 180px, tinggi baris minimum 46px, label 168px).
3. **Kolaborasi.** Judul `text-lg` dan toolbar filter inline horizontal (Wilayah, Cabang, Pilih Semua, hitungan) dengan kontrol `h-9`; peringkat dalam grid 2×2 (`gap-4`) dengan skor `text-2xl` dan bar `h-1.5`; peta selebar konten di bawah peringkat (`h-[260px] sm:h-[340px]`).
4. **Tema Konten.** Grid `lg:grid-cols-3`: satu kolom scorecard tema (`p-4`, nilai `text-2xl`), dua kolom kartu donut dan legenda (`h-[230px]`, legenda `max-h-[230px]` dengan area gulir).
5. **Anchor.** Seluruh bagian dashboard memakai `scroll-mt-20` agar deep link tidak tertutup header lengket.

Suspense per bagian, error boundary, kontrak data approved-only, dan perbaikan hash tidak berubah.

## 4. Gate proporsi menggantikan gate satu layar

Gate "halaman muat satu layar" dihapus. Penggantinya mengukur elemen nyata di browser:

- **E2E `e2e/dashboard.spec.ts`** pada 1440×900 dan 375×812:
  - overflow horizontal ≤ 1px;
  - setiap pasangan bagian berurutan berjarak ≥ 8px;
  - panel peringkat ≥ 520px (desktop) / ≥ 320px (mobile);
  - panel sebaris memiliki lebar, top, dan tinggi yang sama (toleransi 1px) serta tidak saling tumpang tindih;
  - chart ≥ 1000px × 180px (desktop) / ≥ 280px (mobile), SVG ter-render, dan tidak ada overflow internal (kecuali state kosong yang sah);
  - peta ≥ 1000px × 320px (desktop) / ≥ 280px × 240px (mobile), judul di atas kanvas;
  - donut ≥ 210px persegi dan tidak menimpa legenda;
  - track bar peringkat ≥ 5px;
  - pada mobile, panel berbagi tepi kiri dan tidak tumpang tindih.
- **`scripts/dashboard-visual-audit.mjs`**: 4 peran × 3 viewport; memeriksa kelengkapan 12 anchor, status peta, overflow, ukuran minimum chart/peta/panel/donut, jarak minimum 16px antar bagian, nol overlap, dan tinggi bar. Tinggi halaman hanya dilaporkan sebagai informasi.

## 5. Pengukuran

Data demo lokal (Master 4 cabang/27 konten, Regional 2 cabang/25, Branch 21, Stakeholder 1):

| Peran       | Viewport | Chart    | Peta     | Panel | Donut | Bar | Gap min | Overflow | Tinggi halaman |
| ----------- | -------- | -------- | -------- | ----- | ----- | --- | ------- | -------- | -------------- |
| master      | 1440     | 1062×216 | 1102×340 | 544   | 336   | 6   | 16      | 0        | 2545           |
| master      | 768      | 678×216  | 718×340  | 352   | 331   | 6   | 16      | 0        | 2845           |
| master      | 375      | 309×216  | 341×260  | 343   | 309   | 6   | 16      | 0        | 4146           |
| regional    | 1440     | 1062×180 | 1102×340 | 544   | 336   | 6   | 16      | 0        | 2451           |
| regional    | 768      | 678×180  | 718×340  | 352   | 331   | 6   | 16      | 0        | 2787           |
| regional    | 375      | 309×180  | 341×260  | 343   | 309   | 6   | 16      | 0        | 4088           |
| branch      | 1440     | 1062×180 | 1102×340 | 544   | 336   | 6   | 16      | 0        | 2393           |
| branch      | 768      | 678×180  | 718×340  | 352   | 331   | 6   | 16      | 0        | 2709           |
| branch      | 375      | 309×180  | 341×260  | 343   | 309   | 6   | 16      | 0        | 3976           |
| stakeholder | 1440     | 1062×180 | 1102×340 | 544   | 336   | 6   | 16      | 0        | 2299           |
| stakeholder | 768      | 678×180  | 718×340  | 352   | 331   | 6   | 16      | 0        | 2635           |
| stakeholder | 375      | 309×180  | 341×260  | 343   | 309   | 6   | 16      | 0        | 3826           |

Halaman pada 1440 memang menggulir; itu konsekuensi yang diterima dari pemulihan skala v3. Peta selebar 1102px pada 1440 mengisi kanvas tanpa letterboxing berlebih (ditinjau pada tangkapan layar keempat peran), sehingga tidak diperlukan penyesuaian tinggi peta.

## 6. Gate verifikasi

| Gate                                                            | Hasil                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npx prettier --check` (file berubah)                           | Lulus                                                                                           |
| `npm run lint`                                                  | Exit 0                                                                                          |
| `npm run typecheck`                                             | Exit 0                                                                                          |
| `npm test`                                                      | **38 file, 259 test lulus** (5 skipped)                                                         |
| `npm run test:backtest`                                         | **67/67 check lulus**; `r13-backtest-reconcile.json` generatedAt `2026-11-08T17:41:33.445Z`     |
| `npm run build:verify`                                          | Exit 0; `.next-verify` dengan env staging                                                       |
| `PLAYWRIGHT_BASE_URL=http://localhost:3400 npx playwright test` | **101 passed (10.2m)**, termasuk 2 test layout proporsional desktop/mobile                      |
| `node scripts/dashboard-visual-audit.mjs`                       | **12/12 lolos**; 0 overlap; gap min 16px; 0 overflow; peta siap; 0 console/page error           |
| Tinjauan tangkapan layar 1440/768/375 (4 peran)                 | Proporsional, tanpa tumpang tindih, filter inline horizontal utuh, peta dan donut terbaca penuh |
| `node scripts/smoke-production.mjs`                             | **21/21 PASS**; health, header, 401/307, login 4 peran, RBAC 403, PDF/CSV, rekonsiliasi 41 = 41 |
| Audit live produksi 4 peran (1440×900)                          | **4/4 PASS**; 0 overlap, gap min 16px, 0 overflow, peta siap, 0 page error                      |

Rate limit login demo tidak diubah dan tidak di-bypass. Server verifikasi berjalan di port 3400 terhadap build produksi.

## 7. File yang berubah

Tidak ada perubahan skema, kueri data, aturan approval, autentikasi, variabel lingkungan, atau data produksi.

| File                                                                                                                                 | Perubahan                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `src/components/shell/app-shell.tsx`, `page-container.tsx`, `page-header.tsx`, `page-skeleton.tsx`, `src/components/site-footer.tsx` | Skala shell v3 dipulihkan; prop `dense`/`gap="compact"` dihapus                                          |
| `src/app/admin/page.tsx`, `src/app/wilayah/dashboard/page.tsx`, `src/app/cabang/dashboard/page.tsx`, `src/app/client/page.tsx`       | Prop kepadatan dihapus; header dan notice kembali ke skala v3                                            |
| `src/components/dashboard/stat-card.tsx`, `scorecards.tsx`                                                                           | Varian `default`/`compact`; skor ringkasan `text-3xl`, tema `text-2xl`; anchor `scroll-mt-20`            |
| `src/components/dashboard/dashboard-overview.tsx`                                                                                    | Komposisi v3: ringkasan vertikal, Kolaborasi 2×2 + peta selebar konten, tema terpisah                    |
| `src/components/dashboard/branch-stack-chart.tsx`                                                                                    | Tinggi minimum 180px, tinggi baris v3, area gulir `max-h-[440px]`                                        |
| `src/components/dashboard/category-ranking.tsx`                                                                                      | Panel skala v3, skor `text-2xl`, bar proporsional terhadap total kategori, hook pengukuran dipertahankan |
| `src/components/dashboard/dashboard-map.tsx`                                                                                         | Peta selebar konten `h-[260px] sm:h-[340px]`, kontrol navigasi tanpa kompas                              |
| `src/components/dashboard/theme-panel.tsx`                                                                                           | Grid 1+2 kolom, donut 230px, legenda dapat digulir, empty state v3                                       |
| `src/components/dashboard/branch-checklist.tsx`                                                                                      | Hanya kelas (toolbar `h-9`, teks `text-sm`); logika perbaikan hash tidak disentuh                        |
| `e2e/dashboard.spec.ts`                                                                                                              | Gate proporsi/no-overlap desktop dan mobile menggantikan assertion satu layar                            |
| `scripts/dashboard-visual-audit.mjs`                                                                                                 | Pengukuran layout per peran/viewport; gate ukuran, gap, overlap; status peta                             |
| `docs/audit/evidence/dashboard-v3/*`, `docs/audit/evidence/r13-backtest-reconcile.json`                                              | Screenshot dan evidence diperbarui                                                                       |

## 8. Koreksi dokumentasi

- `16-dashboard-refinement-v31.md` ditandai superseded. Butir "bar proporsional terhadap himpunan tampil" tidak akurat: sejak v3.1 bar selalu dihitung terhadap total kategori (`rankingShare(row.total, score)`), sehingga bar teratas hanya penuh bila baris tersebut meliputi seluruh kategori. Unit test `tests/dashboard-ranking.test.ts` mengunci perilaku ini.
- Gate satu layar 1440×900 tidak lagi berlaku. Dokumen status merujuk laporan ini untuk definisi gate yang aktif.

## 9. Rilis produksi dan rollback

Deploy final: `dpl_3jMB35EEUcnFZtyHrPwLo6VaKRCT` dari commit `63219f5`, dipromosikan ke alias `https://dakosta-dakosta.vercel.app`.

1. `/api/health` 200 dan alias produksi aktif.
2. Smoke produksi **21/21 PASS**: health, header keamanan, 401/307 tanpa sesi, login 4 peran, halaman per peran, RBAC negatif (403), PDF/CSV Kinerja, rekonsiliasi dashboard = Kinerja = CSV (41 = 41 admin, 19 = 19 wilayah), CSV konten. Evidence `E-smoke-production-2026-11-09T01-00-42-952Z.json`.
3. Audit live 1440×900 pada data produksi penuh (Master 1.381 konten, 8 cabang, 19 baris peringkat):
   - master: chart 1062×416 (8 bar), peta 1102×340, donut 336×230, tinggi 3187px
   - regional: chart 1062×180, peta 1102×340, donut 336×230, tinggi 2545px
   - branch: chart 1062×180, peta 1102×340, donut 336×230, tinggi 2393px
   - stakeholder: chart 1062×180, peta 1102×340, donut 336×230, tinggi 2299px
   - Keempat peran: 12/12 anchor ada dan terurut, toolbar filter tunggal, panel 544px, bar 6px, 0 overlap, gap min 16px, 0 overflow, peta siap, 0 page error.
4. Screenshot produksi: `docs/audit/evidence/dashboard-v3/production-{master,regional,branch,stakeholder}-1440.png`; evidence `production-live-audit.json` (generatedAt `2026-11-09T01:03:51.539Z`).
5. Rollback: promosikan kembali `dpl_59uYtGsJUDEZUfdYdvtGZAibjFq3` (v3.1) lalu jalankan smoke produksi. Tidak ada migrasi skema atau perubahan data pada rilis ini, sehingga tidak diperlukan pemulihan basis data.

## 10. Risiko dan catatan

| Risiko                                                     | Mitigasi / status                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Halaman 1440 menggulir                                     | Disengaja; gate proporsi memastikan chart, peta, dan panel tidak dikorbankan untuk satu layar |
| Volume peringkat produksi lebih besar dari dataset demo    | Terverifikasi live: Master 8 bar chart, 19 baris peringkat, chart 1062×416, 0 overflow        |
| Kategori tanpa konten menampilkan kartu kosong yang tinggi | Empty state eksplisit; tinggi kartu mengikuti grid 2×2 agar sejajar                           |
| Peta membutuhkan basemap eksternal                         | Gate membedakan state `ready`/`empty`/`failed`; audit menuntut peta siap pada semua tangkapan |
| Data demo sintetis                                         | Tidak ada PII/NIK/JKN; dataset demo berlabel DEMO                                             |

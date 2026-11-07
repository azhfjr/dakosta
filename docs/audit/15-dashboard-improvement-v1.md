# Laporan Implementasi Dashboard Dakosta v3

- Tanggal laporan: 8 November 2026 (WIB)
- Plan acuan: `C:\Users\PLN\.qoder\plans\clever-bay-buck.md`
- Brief acuan: `dakosta-dashboard-improvement-prompt-v1.md`
- Branch kerja: `fix/all-features-hardening`
- Status deploy: **NOT RUN** — menunggu otorisasi terpisah

## 1. Ringkasan perubahan dan alasan

Dashboard di empat rute (Master, Wilayah, Cabang, Stakeholder) diganti total menjadi satu halaman ringkas yang urutannya tetap: A1 scorecard → A2 konten per cabang → Kolaborasi (checklist + B1–B4 + peta) → Tema Konten (C1–C2). Seluruh angka, peringkat, tooltip, legenda, dan peta berasal dari satu jalur data server-side yang memakai predicate approved kanonik (`approvedContentCondition()`), scope per peran (`contentScopePredicate`), dan filter cabang yang diinterseksi di server.

Alasan utama:

1. Dashboard lama menampilkan tren bulanan, tabel, peringkat, dan filter periode/status yang tidak diminta brief dan membingungkan.
2. Universe cabang lama memakai filter status `ACTIVE`, sehingga “X dari Y cabang” tidak faktual.
3. Peta lama memakai centroid cabang buatan; brief meminta koordinat institusi asli dengan total yang jujur.
4. Definisi “tervalidasi” harus tunggal dan tidak boleh berbeda antar section.
5. Filter cabang baru harus shareable, aman dari URL di luar scope, dan mengubah B/C tanpa mengubah A.

Keputusan plan D1–D10 direalisasikan seluruhnya:

| Kode | Realisasi                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1   | Semua agregat memakai `approvedContentCondition()`; tidak ada definisi kedua                                                                        |
| D2   | Universe cabang = seluruh cabang dalam scope otorisasi tanpa filter status; cabang kosong/nonaktif tetap dihitung pada Y dan tampil di A2/checklist |
| D3   | Atribusi cabang memakai `stakeholders.branchOfficeId` live                                                                                          |
| D4   | Total all-time; parameter `period` lama diabaikan, bukan ditafsirkan ulang                                                                          |
| D5   | Konten tanpa cabang masuk A1 dan baris “belum terhubung” di A2                                                                                      |
| D6   | Stakeholder tanpa cabang: checklist `not-applicable`, B/C memakai scope organisasi                                                                  |
| D7   | Peta memakai `stakeholders.latitude/longitude`; tidak ada titik fiktif                                                                              |
| D8   | Non-EDUFAST mencakup `mainTheme NULL` legacy; sub-tema NULL menjadi “Tanpa sub-tema”                                                                |
| D9   | Default checklist semua cabang; pilihan kosong menghasilkan empty state eksplisit                                                                   |
| D10  | URL `cabang` berulang; tanpa parameter = semua; `cabang=none` = kosong; ID di luar scope diinterseksi server-side                                   |

Tidak ada perubahan pada SLA, Kinerja, Detail Konten, Red Notice, Notifikasi, aturan approval/auto-validasi, skema database, endpoint publik, atau konfigurasi produksi.

## 2. Daftar file

### 2.1 Ditambahkan

| File                                              | Alasan                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/lib/analytics/dashboard-overview.ts`         | Snapshot server-side A/B/C: query agregat, cache per user/selection, ranking, tema, partisi peta |
| `src/lib/filters/branch-selection.ts`             | Parser/serializer `cabang`, interseksi ID dalam scope, helper tri-state                          |
| `src/lib/dashboard/types.ts`                      | Kontrak DTO bersama untuk analytics dan komponen                                                 |
| `src/components/dashboard/dashboard-overview.tsx` | Komposisi urutan A1→A2→Kolaborasi→Tema, anchor, landmark                                         |
| `src/components/dashboard/scorecards.tsx`         | Scorecard A1, kategori, dan tema (format `X dari Y cabang`)                                      |
| `src/components/dashboard/branch-stack-chart.tsx` | A2 stacked horizontal, label membungkus, area gulir, tabel SR, tanpa animasi                     |
| `src/components/dashboard/branch-checklist.tsx`   | Checklist cabang, Pilih Semua tri-state, sinkronisasi URL, status pending                        |
| `src/components/dashboard/category-ranking.tsx`   | Skor kategori + daftar Top 10 + bar proporsional + zero state                                    |
| `src/components/dashboard/theme-panel.tsx`        | C1/C2 + donut sub-tema Non-EDUFAST + legenda persentase                                          |
| `src/components/dashboard/dashboard-states.tsx`   | Skeleton, error state dengan “Coba lagi”, section boundary                                       |
| `tests/branch-selection.test.ts`                  | 14 unit test kontrak selection                                                                   |
| `tests/dashboard-theme.test.ts`                   | 4 unit test label/persentase tema                                                                |
| `scripts/dashboard-visual-audit.mjs`              | Audit visual 4 peran × 3 viewport, deteksi overflow/galat                                        |
| `docs/audit/15-dashboard-improvement-v1.md`       | Laporan ini                                                                                      |

### 2.2 Diubah

| File                                                                                                                                              | Alasan                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/app/admin/page.tsx`, `src/app/wilayah/dashboard/page.tsx`, `src/app/cabang/dashboard/page.tsx`, `src/app/client/page.tsx`                    | Parse `cabang`, panggil summary/filtered, hapus FilterBar dan filter lama, render `DashboardOverview`         |
| `src/components/dashboard/dashboard-map.tsx`                                                                                                      | Rewrite peta: titik institusi asli, cluster total, popup 4 kategori, missing list, retry, tanpa fly animation |
| `src/components/dashboard/stat-card.tsx`                                                                                                          | Varian compact untuk scorecard tanpa mengubah pemakaian lain                                                  |
| `src/lib/chart-theme.ts`                                                                                                                          | Warna kategori konsisten + gaya tooltip                                                                       |
| `src/lib/dashboard/view.ts`                                                                                                                       | Pemetaan anchor lama ke anchor baru; `peta` dipertahankan                                                     |
| `src/lib/filters/query.ts`                                                                                                                        | Menambahkan `cabang` ke daftar parameter filter                                                               |
| `scripts/backtest-reconcile.ts`                                                                                                                   | Fixture dan pemeriksaan dashboard v3: 72 fixture, 67 check                                                    |
| `scripts/explain-check.ts`                                                                                                                        | Skenario SQL dashboard/map/ranking mengikuti query baru                                                       |
| `e2e/dashboard.spec.ts`, `e2e/a11y.spec.ts`, `e2e/filters.spec.ts`, `e2e/dakosta.spec.ts`, `e2e-empty/empty.spec.ts`, `e2e-empty/global-setup.ts` | Cakupan urutan, filter, a11y, empty state, dan header same-origin untuk login empty suite                     |
| `tests/dashboard-filters.test.ts`                                                                                                                 | Menyesuaikan kontrak filter lama yang masih berlaku                                                           |
| `docs/audit/14-improvement-v1-status.md`                                                                                                          | Referensi anchor/tren lama diperbarui                                                                         |
| `docs/audit/evidence/r13-backtest-reconcile.json`                                                                                                 | Bukti backtest diregenerasi                                                                                   |

### 2.3 Dihapus

| File                                              | Alasan                                                    |
| ------------------------------------------------- | --------------------------------------------------------- |
| `src/lib/analytics/dashboard.ts`                  | Modul tren/agregat lama; tidak ada konsumen non-Dashboard |
| `src/lib/dashboard-map.ts`                        | Peta centroid cabang lama                                 |
| `src/components/dashboard/approved-dashboard.tsx` | Dashboard lama pengganti                                  |
| `src/components/dashboard/approved-charts.tsx`    | Chart tren/tabel lama                                     |
| `tests/dashboard-trend-window.test.ts`            | Menguji jendela tren yang sudah dihapus                   |

### 2.4 Bukti dan log baru

`docs/audit/evidence/dashboard-v3/` berisi 12 screenshot peran × viewport, 3 screenshot tooltip, screenshot error peta, `visual-audit.json`, `tooltip-audit.json`, dan `map-error-retry.json`. Log gate: `E-e2e-full-2026-11-08.log`, `E-e2e-empty-final-2026-11-08.log`, `E-perf-v3-final-2026-11-07T18-23-04Z.log`, serta tujuh `E-explain-*.json` terbaru.

### 2.5 Catatan file di luar plan

- `src/components/admin/target-manager.tsx` dan `e2e/targets.spec.ts` sudah berubah di working tree sebelum pekerjaan Dashboard v3 (perbaikan tautan capaian ke `/admin/konten`). Tidak disentuh dalam pekerjaan ini; perubahannya kompatibel dengan penghapusan filter Dashboard lama.
- `tsconfig.json` terdaftar `M` oleh Git tetapi tidak memiliki diff konten (hanya perbedaan line ending).
- `e2e/navigation.spec.ts` tidak memerlukan perubahan: anchor `#peta` dan redirect `/wilayah/peta` serta `/cabang/peta` tetap kompatibel, dan suite navigasi lulus pada run penuh.
- `loading.tsx`/`error.tsx` untuk keempat route-group sudah ada dan diwarisi oleh rute dashboard; tidak ada file state baru yang perlu ditambahkan.

## 3. Matriks A1–C2

| Item                                                                               | Status   | Bukti                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 Total Konten Tervalidasi + Cabang dengan Konten (`X dari Y`)                    | **DONE** | Backtest: total 57 = SQL approved; universe Master 4 cabang; X/Y = 3/4; regional 3 cabang; branch 1/1; stakeholder 1/1. E2E keempat peran memeriksa `\d+ dari \d+ cabang`; screenshot `master-1440/768/375.png` dll.                                                       |
| A2 Konten per Cabang (4 kategori, legenda, total, sort stabil, cabang nol, scroll) | **DONE** | Backtest: cabang + unassigned = A1; jumlah kategori = total cabang; urutan total desc lalu nama; cabang nonaktif kosong tetap tampil dengan 0. E2E urutan/keberadaan; screenshot; tooltip terverifikasi di 3 viewport.                                                     |
| Checklist cabang (default semua, tri-state, shared B/C, empty eksplisit, aman URL) | **DONE** | 14 unit test parser/serializer; E2E Pilih Semua → `cabang=none` → semua; pilihan parsial indeterminate; `cabang` di luar scope menghasilkan 0 tanpa mengubah A.                                                                                                            |
| B1–B4 Skor kategori + 10 Teratas                                                   | **DONE** | Backtest: setiap total kategori = SQL; ranking ≤10, menurun, deterministik, tiap baris ≤ skor; FKTP dibatasi tepat 10; nama institusi sama di cabang berbeda tetap terpisah. E2E daftar ≤10 dan menurun; zero state tanpa bar palsu.                                       |
| B5 Peta Sebaran Konten                                                             | **DONE** | Backtest: approved peta = A1; mapped + missing = approved; institusi tanpa koordinat ada di `missingLocations` dan tidak muncul di titik; jumlah kategori per titik = total titik. E2E total berlokasi/legenda; fault injection error + retry; screenshot peta 12/12 siap. |
| C1 Konten EDUFAST                                                                  | **DONE** | Backtest EDUFAST + Non-EDUFAST = total; unit test label; E2E scorecard.                                                                                                                                                                                                    |
| C2 Konten Non-EDUFAST + donut sub-tema                                             | **DONE** | Backtest jumlah sub-tema = Non-EDUFAST; persentase largest-remainder berjumlah 100,0%; baris legacy `mainTheme NULL` terhitung; `TANPA_SUB_TEMA` = 2 sesuai fixture; E2E persentase legenda = 100%; stakeholder dengan 0 Non-EDUFAST menampilkan empty state jujur.        |

## 4. Matriks 13 acceptance test

| #   | Kriteria                                                                                              | Status   | Bukti                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hanya konten approved di semua angka                                                                  | **DONE** | Backtest membandingkan A1/kategori/peta dengan SQL `status='APPROVED' AND approved_at IS NOT NULL AND archived=false`; fixture DRAFT/SUBMITTED/REVISION_REQUIRED/REJECTED/REVOKED/arsip/null approved_at tidak masuk                   |
| 2   | Tidak ada duplikasi JOIN; kategori dan EDUFAST benar                                                  | **DONE** | Backtest: jumlah kategori = total; A2 = A1; EDUFAST + Non = total; dua konten URL sama tetap dihitung sesuai baris tersimpan                                                                                                           |
| 3   | Semua peran ter-scope; URL termodifikasi tidak bypass                                                 | **DONE** | Backtest role matrix (Master 57, Regional 37, Branch 28, Stakeholder 19); `cabang` luar scope = 0. E2E “cabang di luar cakupan tidak membuka data” untuk 4 peran                                                                       |
| 4   | Y = semua cabang scope, termasuk nol/nonaktif                                                         | **DONE** | Backtest Master 4 cabang termasuk `INACTIVE` tanpa konten; `branchesWithContent` 3; regional 3 cabang; branch/stakeholder 1                                                                                                            |
| 5   | Filter isolation: A tetap, B+C konsisten berubah                                                      | **DONE** | E2E `cabang=none`: A1 tidak berubah, semua kategori/tema = 0. Backtest empty selection = 0 dan subset = SQL cabang tersebut                                                                                                            |
| 6   | Top 10 maks 10, menurun, nama+cabang+jumlah; skor tidak dibatasi Top 10                               | **DONE** | Backtest 8 institusi ranking + fixture lain → tepat 10 baris FKTP; E2E memeriksa urutan dan `count <= 10`; skor panel diambil dari agregat penuh                                                                                       |
| 7   | Total peta cocok scope/filter; koordinat nyata; missing jujur                                         | **DONE** | Backtest mapped+missing=approved; titik memakai koordinat stakeholder; sentinel tanpa koordinat tercatat di missing. E2E + screenshot peta                                                                                             |
| 8   | EDUFAST/Non exact; donut hanya Non; total/persentase konsisten                                        | **DONE** | Backtest + 4 unit test tema + E2E persentase 100%; label NULL “Tanpa sub-tema”                                                                                                                                                         |
| 9   | Urutan DOM persis A1→A2→Kolaborasi→checklist→FKRTL→FKTP→Pemda→Stakeholder→peta→Tema→EDUFAST→Non+donut | **DONE** | E2E `SECTION_ORDER` + offset DOM untuk 4 peran; visual audit memastikan 12 anchor ada di semua 12 tangkapan                                                                                                                            |
| 10  | Tidak ada label “Blok”/internal, copy Indonesia natural, tanpa target karangan                        | **DONE** | E2E menolak `Blok \d`, `#tren-*`, `#tabel`, `#peringkat`; grep gate tidak menemukan label internal; tidak ada angka target di UI                                                                                                       |
| 11  | Audit visual 1440/768/375 tanpa overflow/tumpang tindih/tooltip terblokir                             | **DONE** | `visual-audit.json`: 12/12 ok, overflow 0px, 0 console/page error, peta siap. `tooltip-audit.json`: 3/3 tooltip di dalam viewport dan area gulir. Screenshot `*-{1440,768,375}.png`, `tooltip-*.png`                                   |
| 12  | Loading/error/empty nol dan opsi parsial; keyboard dasar + focus terlihat                             | **DONE** | Empty suite 3/3 (nol + empty state jujur); `map-error-retry.json` semua true; E2E a11y keyboard skip link/checklist/area gulir, outline terlihat; axe + reflow 320px. Catatan: section boundary generik tidak di-fault-inject terpisah |
| 13  | Tidak ada regresi di luar Dashboard/auth/approval                                                     | **DONE** | Suite penuh 97 passed; empty suite 3 passed; unit 255 passed; build 31/31 halaman                                                                                                                                                      |

## 5. Verifikasi nyata

### 5.1 Gate statis dan unit

| Perintah                                                                      | Hasil                                               |
| ----------------------------------------------------------------------------- | --------------------------------------------------- |
| `npm run lint`                                                                | Exit 0, tanpa temuan                                |
| `npx prettier --write` pada file yang diubah lalu `npm run format:check`      | “All matched files use Prettier code style!”        |
| `npm run typecheck`                                                           | Exit 0                                              |
| `npm test`                                                                    | 37 file, 255 test lulus, 11,44 detik                |
| `npx vitest run tests/branch-selection.test.ts tests/dashboard-theme.test.ts` | 2 file, 18 test lulus                               |
| `npm run build:verify`                                                        | Exit 0, “Compiled successfully”, 31/31 static pages |

### 5.2 Backtest

`npm run test:backtest` — **72 fixture, 67/67 check lulus**; bukti `docs/audit/evidence/r13-backtest-reconcile.json` (generatedAt `2026-11-07T18:52:04.513Z`).

Cakupan baru yang menutup gap plan: cabang nonaktif tanpa konten, nama institusi sama di cabang berbeda, lebih dari 10 institusi ranking, konten tanpa tema/sub-tema legacy, dan institusi dengan koordinat tidak valid. Karena skema live mewajibkan koordinat `NOT NULL` dan rentang valid, fixture koordinat buruk memakai pelonggaran constraint khusus PGlite; jalur defensif UI tetap diuji tanpa mengubah data produksi.

### 5.3 E2E, empty, performa, explain

| Perintah                                                     | Hasil dan bukti                                                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PLAYWRIGHT_BASE_URL=http://localhost:3300 npm run test:e2e` | **97 passed (7,3m)**; `E-e2e-full-2026-11-08.log`                                                                                                      |
| `npm run test:e2e:empty`                                     | **3 passed (40,1s)**; `E-e2e-empty-final-2026-11-08.log`                                                                                               |
| `npm run perf`                                               | 17 rute OK; TTFB 12–19 ms; LCP p95 ≤ 1616 ms; CLS 0,000; JS 209 KB; “Seluruh anggaran performa terpenuhi.”; `E-perf-v3-final-2026-11-07T18-23-04Z.log` |
| `npx tsx scripts/explain-check.ts --target=staging`          | 7 skenario `passed=true` dengan anggaran 1000 ms; `E-explain-{dashboard,detail,kinerja,map,monthly,ranking,sla}-2026-11-07T18-3*.json`                 |

Catatan eksekusi: suite penuh dijalankan terhadap production build di port 3300 melalui `PLAYWRIGHT_BASE_URL` karena kompilasi cold Turbopack pada server dev terkelola melewati timeout test. Sumber yang diuji sama; rate limit login demo tidak diubah dan tidak di-bypass.

### 5.4 Audit visual dan fault injection

| Perintah                                  | Hasil                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `node scripts/dashboard-visual-audit.mjs` | 12/12 lolos; overflow horizontal 0 px; 0 console/page error; peta siap; `visual-audit.json` (generatedAt `2026-11-07T18:54:55.682Z`) |
| Audit tooltip chart (3 viewport)          | `tooltip-audit.json`: `ok=true`, tooltip di dalam viewport dan area gulir, tanpa console error                                       |
| Fault injection basemap diblokir          | `map-error-retry.json`: loading, failure, retry, loading ulang, agregat tetap tampil, 0 page error                                   |

Screenshot utama:

- `docs/audit/evidence/dashboard-v3/master-{1440,768,375}.png`
- `docs/audit/evidence/dashboard-v3/regional-{1440,768,375}.png`
- `docs/audit/evidence/dashboard-v3/branch-{1440,768,375}.png`
- `docs/audit/evidence/dashboard-v3/stakeholder-{1440,768,375}.png`
- `docs/audit/evidence/dashboard-v3/tooltip-{1440,768,375}.png`
- `docs/audit/evidence/dashboard-v3/map-error-retry-1440.png`

### 5.5 Grep gate dan audit diff

- Tidak ada `Blok \d`, `tren bulanan`, `#tren-bulanan`, `#tren-tema`, `#tabel`, `#peringkat`, `#semua-konten`, atau region “Filter dasbor” lama di UI Dashboard (grep + E2E).
- Diff hanya menyentuh file Dashboard dan dependensinya, test/harness, dokumentasi, dan evidence. Tidak ada perubahan SLA/Kinerja/Detail Konten, skema, endpoint publik, atau konfigurasi produksi.
- Perubahan di luar plan yang sudah ada sebelumnya dicatat pada §2.5.

## 6. Risiko, asumsi reversible, dan langkah berikutnya

| Risiko                                                                                 | Mitigasi / status                                                                                                                      |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Universe cabang kini mencakup cabang nonaktif sehingga Y bisa lebih besar dari UI lama | Disengaja (D2); backtest menguji cabang nonaktif kosong; dapat dikembalikan tanpa migrasi                                              |
| Konten tanpa cabang/tema tidak muncul di B/C                                           | Tetap dihitung di A1/A2 dan catatan “belum terhubung”; Non-EDUFAST mencakup tema NULL                                                  |
| Nama institusi sama tergabung                                                          | Group by stakeholder ID + branch ID; fixture duplikat membuktikan terpisah                                                             |
| Peta bocor lintas scope lewat URL                                                      | Interseksi server-side dan `contentScopePredicate`; E2E/backtest lintas scope                                                          |
| Payload peta besar                                                                     | Agregat per institusi, batas 5000 titik dengan flag truncation, cache per seleksi                                                      |
| Cache basi setelah approval                                                            | `invalidateReadCache()` existing; key mencakup user/role/scope/selection                                                               |
| Performa chart baru                                                                    | Recharts hanya client section, animasi nonaktif, peta lazy; seluruh anggaran perf terpenuhi                                            |
| Missing coordinate tidak mungkin di data live                                          | Skema `NOT NULL` + check range; jalur defensif diuji via pelonggaran test-only; UI tetap menampilkan catatan bila terjadi anomali data |

Asumsi reversible: D2, D4, D5, D8, dan D10 dapat diubah tanpa migrasi karena hanya memengaruhi query/URL/UI. Tidak ada data produksi yang dihapus, di-seed, atau diubah.

Langkah berikutnya (di luar plan ini):

1. Otorisasi eksplisit untuk deploy, lalu jalankan prosedur rilis yang sudah ada.
2. Setelah deploy, jalankan smoke read-only dan pantau cache/error map.
3. Evaluasi apakah label “Cabang dengan Konten” perlu penjelasan tambahan bagi peran regional.

## 7. Status deployment

**NOT RUN.** Tidak ada deploy, migrasi, seed, reset, atau perubahan environment pada plan ini. Tidak ada klaim produksi. Server verifikasi lokal port 3300 dihentikan setelah seluruh bukti dikumpulkan.

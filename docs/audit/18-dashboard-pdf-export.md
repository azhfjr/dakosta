# Unduh Dashboard Dakosta sebagai PDF

- Tanggal: 9 November 2026
- Branch kerja: `fix/all-features-hardening`
- Status deploy: **BELUM DEPLOY** — produksi tetap pada Dashboard v3.2 `dpl_3jMB35EEUcnFZtyHrPwLo6VaKRCT`
- Rencana: `C:\Users\PLN\.qoder\plans\calm-haven-marten.md`

## 1. Permintaan

Tombol **Unduh PDF** pada menu Dashboard untuk keempat peran (Master, Wilayah, Cabang, Stakeholder), dengan header dan footer berlogo Dakosta, kualitas tinggi, dan seluruh chart tampil utuh pada unduhan.

## 2. Pendekatan

Vercel tidak menyediakan headless Chromium (Playwright hanya devDependency) dan kanvas MapLibre GL berbasis WebGL tidak dapat ditangkap server-side tanpa basemap lokal. Karena itu PDF dibuat **server-side dengan `pdf-lib`** — stack yang sama dengan laporan Kinerja dan Detail Konten — dan **setiap chart digambar ulang sebagai vektor** dari data yang sama:

| Chart UI             | Representasi PDF                                                    |
| -------------------- | ------------------------------------------------------------------- |
| Konten per Cabang    | Batang bertumpuk horizontal, skala global `max(branch.total)`       |
| Peringkat Kolaborasi | 4 panel (FKRTL/FKTP/PEMDA/STAKEHOLDER), 10 baris + bar proporsional |
| Peta institusi       | Scatter koordinat asli, proyeksi equirectangular, graticule         |
| Donut tema           | Sektor anulus vektor dari poligon 1°, legenda warna literal         |

Bukan screenshot, bukan print CSS, bukan html2canvas/jsPDF. Hasil tajam di semua zoom, tidak pernah terpotong oleh `max-h-[440px]` UI, dan tidak menambah dependensi.

## 3. Endpoint dan otorisasi

- `GET /api/v1/reports/dashboard` — `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- Capability `export:read` (dimiliki keempat peran); anonim 401, tanpa capability 403.
- Rate limit 8 permintaan / 60 detik per `user.id + IP`, envelope 429 standar dengan header rate limit.
- Audit `EXPORT_DASHBOARD_REPORT` (action string, tanpa migrasi) dengan ringkasan mode filter, cabang, total approved, titik peta, dan tema.
- Filter `?cabang=` menerima nilai berulang maupun koma melalui `searchParams.getAll("cabang")` + `branchFilterValues`.
- Snapshot live via `getDashboardSummaryUncached` / `getDashboardFilteredUncached` (melewati `cachedRead`, sesuai kontrak `read-cache.ts`), scoping dan predicate approved identik dengan halaman UI.
- Respons: `application/pdf`, `Cache-Control: no-store`, `X-Request-Id`, `Content-Disposition: attachment; filename="dashboard-dakosta-<role-slug>-<YYYY-MM-DD>.pdf"` (tanggal UTC; isi dokumen memakai WIB).

## 4. Komposisi PDF (A4 landscape 841,89 × 595,28, margin 36)

Header setiap halaman: judul bagian, subtitle cakupan/peran/filter, logo Dakosta 26pt di kanan. Footer setiap halaman: `DAKOSTA - Dashboard - <cakupan> - Halaman x dari y` + logo Dakosta 11pt di kanan.

1. **Ringkasan & Konten per Cabang.** Strip meta, 6 kartu KPI, catatan `unassignedApproved` bila ada, batang bertumpuk seluruh cabang dengan gridline, tick, dan legenda 4 kategori. Bila tidak muat, lanjut halaman "(lanjutan)"; tidak ada baris terpotong.
2. **Peringkat Kolaborasi** (2 halaman). FKRTL + FKTP, lalu PEMDA + STAKEHOLDER; setiap panel total kategori, 10 baris, dan bar proporsional memakai `rankingShare` yang sama dengan UI.
3. **Sebaran Institusi.** Semua titik `filtered.map.points` (maks 5.000), bounds dari data + padding, label top-12 dengan halo dan collision-skip, rail total mapped/missing/truncated, legenda kategori dominan, dan daftar institusi tanpa lokasi (dipaginasi). Caption eksplisit "Peta skematik berdasarkan koordinat institusi, tanpa basemap."
4. **Tema Konten.** Donut Non-EDUFAST vektor, legenda lengkap dengan warna literal (dipaginasi), kartu EDUFAST/Non-EDUFAST, dan catatan konten tanpa tema.

`planDashboardPages(input)` adalah fungsi murni yang dipakai unit test untuk membuktikan invariant: gabungan seluruh halaman = seluruh cabang, seluruh tema, dan seluruh titik. Data kosong menghasilkan empty-state eksplisit, bukan error.

Ringkasan KPI dan chart per cabang sengaja memakai `summary` (cakupan peran) seperti blok Ringkasan UI; bagian peringkat, peta, dan tema mengikuti filter. Perilaku ini diverifikasi E2E: "filter cabang kosong mengubah kolaborasi dan tema tanpa mengubah ringkasan".

## 5. File yang berubah

| File                                                                                                                           | Jenis                       |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `src/lib/reports/dashboard-pdf.ts`                                                                                             | baru — renderer vektor      |
| `src/app/api/v1/reports/dashboard/route.ts`                                                                                    | baru — endpoint PDF         |
| `src/components/dashboard/dashboard-export-button.tsx`                                                                         | baru — tombol Unduh PDF     |
| `src/lib/analytics/dashboard-overview.ts`                                                                                      | 2 passthrough uncached      |
| `src/lib/chart-theme.ts`                                                                                                       | palet literal PDF           |
| `src/lib/filters/branch-selection.ts`                                                                                          | ekspor `branchFilterValues` |
| `src/app/admin/page.tsx`, `src/app/wilayah/dashboard/page.tsx`, `src/app/cabang/dashboard/page.tsx`, `src/app/client/page.tsx` | slot aksi tombol            |
| `tests/dashboard-pdf.test.ts`, `tests/branch-selection.test.ts`, `e2e/reports.spec.ts`                                         | tes                         |
| `scripts/smoke-production.mjs`                                                                                                 | 2 cek produksi              |
| `docs/audit/18-dashboard-pdf-export.md`, `docs/audit/13-status.md`                                                             | dokumentasi                 |

Tidak ada perubahan skema, seed, data produksi, autentikasi, aturan approval, variabel lingkungan, atau dependensi.

## 6. Verifikasi

| Gate              | Hasil          | Bukti                                                                                                     |
| ----------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| Prettier          | PASS           | 14 file berubah, `npx prettier --check` bersih                                                            |
| ESLint            | PASS           | `npm run lint` exit 0                                                                                     |
| Typecheck         | PASS           | `npm run typecheck` exit 0                                                                                |
| Unit test         | PASS (265/265) | `npm test`; termasuk 20 tes dashboard PDF/filter; render berat diberi timeout 30 dtk                      |
| Build produksi    | PASS           | `npm run build:verify` exit 0, route muncul di `app-paths-manifest.json`                                  |
| E2E               | PASS (28/28)   | `e2e/reports.spec.ts` + `e2e/dashboard.spec.ts` terhadap server verify port 3400                          |
| Unduhan per peran | PASS (5/5)     | admin, regional, branch, client, regional `?cabang=none`; semua 200, 5 halaman, A4 landscape              |
| Audit visual      | PASS           | Halaman 1–5 diperiksa di viewer PDF Chromium: logo di setiap halaman, tanpa teks terpotong/tumpang tindih |

## 7. Risiko

- Tampilan vektor dapat berbeda kosmetik dari Recharts; data, palet literal, dan `rankingShare` sama sehingga angka konsisten.
- Peta skematik dapat disalahartikan sebagai peta nyata; caption, graticule, dan daftar institusi tanpa lokasi disertakan.
- Universum besar menambah halaman lanjutan; produksi saat ini kecil (27 konten Master) dan rate limit 8/menit membatasi ekspor beruntun.
- Nama file memakai tanggal UTC sementara isi memakai WIB; mengikuti konvensi ekspor yang sudah ada dan WIB dicantumkan di dokumen.

## 8. Rollback

Tidak ada migrasi atau perubahan data. Rollback cukup mengembalikan commit fitur; produksi tetap pada deployment v3.2 sampai deploy baru dipromosikan.

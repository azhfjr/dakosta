# Dashboard v3.4 — Chart Kompak, PDF Satu Halaman, dan Infografis

- Tanggal: 9 November 2026
- Branch kerja: `fix/all-features-hardening`
- Status deploy: **DONE** — `dpl_9dMaPC3hj5PjdLkL2CM8htwb9iVw` (detail di bagian 10)
- Rencana: `C:\Users\PLN\.qoder\plans\calm-haven-marten.md`
- Menggantikan: `18-dashboard-pdf-export.md` (v3.3, lima halaman + peta). Dokumen 18 dipertahankan sebagai riwayat.

## 1. Permintaan

1. Bar chart **Konten per Cabang** terlalu tinggi dan renggang sehingga komparasi antar cabang tidak jelas; range dipersempit dan dirapatkan.
2. Unduhan PDF memuat **seluruh chart kecuali peta dalam satu halaman A4**.
3. Fitur **Unduh Infografis**: satu gambar resolusi tinggi berisi seluruh informasi dan chart (kecuali peta).
4. Progres pekerjaan ditampilkan di browser internal Qoder.
5. Audit dan backtest sebelum deploy, lalu deploy ke produksi (otorisasi eksplisit pengguna).
6. Umpan balik lanjutan: tombol PDF dan Infografis digabung menjadi **satu tombol dengan dropdown format**.

## 2. Chart kompak (UI)

Skala tetap linear dan jujur (tanpa log/sqrt); yang dipadatkan adalah geometri:

| Properti       | Sebelum       | v3.4                                  |
| -------------- | ------------- | ------------------------------------- |
| Pitch baris    | ≥ 46 px       | 32 px                                 |
| Tinggi bar     | hingga 30 px  | 14 px (maksimum `maxBarSize` 16)      |
| Tinggi chart   | hingga 440 px | data-driven 150–340 px, gulir di luar |
| Tick sumbu     | padat         | 4 tick bernilai bulat                 |
| Font tick/meta | 11–12 px      | 10 px                                 |

Semua cabang tetap ditampilkan; area chart bergulir bila melebihi 340 px, tanpa pemotongan data. Gate visual diperbarui ke tinggi 140–380 px. Hasil audit final: chart 1062×150–164 px (1440), 678×150–164 px (768), 309×150–164 px (375), 0 overlap, 0 overflow horizontal.

## 3. PDF satu halaman

`src/lib/reports/dashboard-pdf.ts` ditulis ulang. Halaman tunggal A4 landscape (841,89 × 595,28, margin 24):

1. **Header** (≈46 pt): judul "Dashboard DAKOSTA", subtitle cakupan/peran/filter, logo Dakosta.
2. **Strip KPI** (≈48 pt): 6 kartu — Total Konten Tervalidasi, Cabang dengan Konten, FKRTL, FKTP, Pemda, Stakeholder — plus catatan `unassignedApproved`. Dua kartu pertama memakai label "seluruh cakupan" saat filter cabang aktif karena nilainya memang scope-wide, sama seperti blok Ringkasan UI.
3. **Kiri — Konten per Cabang** (≈400 × 286 pt): batang bertumpuk, 4 tick bulat, legenda 4 kategori, total per baris.
4. **Kanan — Peringkat Kolaborasi 2×2** (≈384 × 286 pt): 10 baris per kategori, bar proporsional `rankingShare` yang sama dengan UI, empty-state per panel.
5. **Band bawah — Tema Konten** (≈94 pt): kartu EDUFAST/Non-EDUFAST, donut vektor, legenda dua kolom dengan warna literal, catatan konten tanpa tema.
6. **Footer**: `DAKOSTA - Dashboard - <cakupan>` + logo Dakosta 11 pt.

Peta dihapus dari PDF. Tidak ada pagination.

### Agregasi cabang

- ≤ 18 cabang: seluruh baris tampil.
- > 18 cabang: 15 teratas + baris **"Cabang lainnya (n)"**. Baris agregat hanya menampilkan total tanpa bar karena menjumlah cabang tersembunyi akan mendominasi skala; nilainya tetap direkonsiliasi di unit test sehingga total PDF = total data.

`planDashboardPage(input)` adalah fungsi murni yang dipakai unit test: rekonsiliasi total cabang, agregasi, 4×10 peringkat, legenda tema, dan empty-state eksplisit saat data kosong. `renderDashboardPdf` selalu menghasilkan tepat 1 halaman, termasuk untuk data kosong.

## 4. Infografis PNG

`src/lib/reports/infographic.ts` merasterisasi **PDF yang sama** di klien dengan `pdfjs-dist@4.10.38`:

- Dynamic import (tidak membebani muatan awal), worker statis di `/vendor/pdf.worker.min.mjs` (1.375.838 byte), `isEvalSupported: false`.
- Skala `300/72` → kanvas 3508×2481 px (8,7 MP, di bawah batas 4096 px), latar putih, ekspor `image/png`.
- Tidak ada renderer kedua: satu sumber kebenaran (PDF) sehingga isi infografis identik dengan unduhan PDF.
- Hanya berjalan saat pengguna memilih format; indikator loading ditampilkan pada tombol.

## 5. Endpoint dan otorisasi

`GET /api/v1/reports/dashboard` (tidak berubah path):

| Aspek         | Perilaku                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Format        | Default PDF; `?format=infographic` hanya mengubah audit + header, body tetap PDF (di-raster di klien) |
| Capability    | `export:read`; anonim 401, tanpa capability 403                                                       |
| Rate limit    | 8 permintaan / 60 detik per `user.id + IP`, bucket sama untuk kedua format                            |
| Audit         | `EXPORT_DASHBOARD_REPORT` / `EXPORT_DASHBOARD_INFOGRAPHIC` (action string, tanpa migrasi)             |
| Header format | `X-Report-Format: pdf` atau `infographic`, `X-Infographic-Filename` (hanya mode infografis)           |
| Nama file     | `dashboard-dakosta-<peran>-<YYYY-MM-DD>.pdf`, `infografis-dakosta-<peran>-<YYYY-MM-DD>.png`           |

Tanggal nama file memakai **WIB** (`jakartaToday`), konsisten dengan isi dokumen.

## 6. Tombol unduh tunggal

`dashboard-export-button.tsx` menjadi satu tombol **"Unduh"** (`variant="outline"`, ikon Download + ChevronDown) yang membuka `DropdownMenu` berisi:

- **PDF — satu halaman A4**
- **Infografis — PNG 300 DPI** (`3508 × 2481 piksel, isi sama dengan PDF`)

Trigger memiliki `aria-label="Unduh dashboard"`, `aria-haspopup="menu"`, `data-dashboard-export-trigger`; opsi memakai `data-dashboard-export-option="pdf|infographic"`. Saat proses: trigger disabled, `aria-busy`, label "Menyiapkan...". Error ditampilkan inline (`aria-live="polite"`) di bawah tombol, bukan JSON mentah. Revoke object URL ditunda 10 detik agar unduhan tidak batal di Firefox/Safari. Keyboard/Escape/fokus ditangani Radix. Komponen yang sama dipasang di keempat dashboard.

## 7. Verifikasi

| Gate             | Hasil | Bukti                                                                                                  |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| Prettier         | PASS  | 20 file fitur                                                                                          |
| ESLint           | PASS  | 0 temuan (scratch `.tmp*` diabaikan)                                                                   |
| Typecheck        | PASS  | `tsc --noEmit` exit 0                                                                                  |
| Vitest           | PASS  | 268 tes / 40 file; 6 tes dashboard PDF + tes infografis                                                |
| Build produksi   | PASS  | `npm run build:verify` → `.next-verify`                                                                |
| Playwright penuh | PASS  | **104/104** tes, 8,5 menit, port 3400 (seluruh spec, bukan hanya reports/dashboard)                    |
| Visual audit     | PASS  | **12/12** kombinasi (4 peran × 3 viewport), 0 overlap, 0 error halaman                                 |
| Backtest         | PASS  | 67/67 (`npm run test:backtest`) — dashboard = Kinerja = SQL                                            |
| Deep review      | PASS  | Temuan major diperbaiki (skala agregat, label KPI, asersi teks PDF, nama file WIB, dsb.)               |
| Inspeksi PDF     | PASS  | 5 varian (master, master `?cabang=`, regional, cabang, stakeholder): 1 halaman A4, logo, tanpa kliping |
| Inspeksi PNG     | PASS  | 3508×2481, magic `89504e47…`, ±505 KB, isi identik PDF                                                 |

Ukuran PDF final 264–267 KB per varian. Infografis ±505 KB karena seni vektor datar terkompresi baik pada PNG lossless.

## 8. Keputusan yang dipertimbangkan

- **Log/sqrt scale ditolak** — komparasi harus jujur; pemadatan dilakukan pada geometri, bukan skala.
- **Peta dihapus dari PDF/infografis** — WebGL MapLibre tidak dapat dirender server-side tanpa basemap lokal; peta tetap lengkap di UI.
- **Rasterisasi PDF di klien, bukan renderer PNG kedua** — menjamin isi identik dan menghindari duplikasi logika chart.
- **Batas 18 baris cabang** — menjamin satu halaman terbaca; UI tetap menampilkan semua cabang.
- **Satu tombol dropdown** — sesuai umpan balik pengguna; mengurangi dua tombol menjadi satu kontrol dengan aksesibilitas Radix.

## 9. Risiko dan rollback

Tidak ada perubahan skema, seed, data produksi, autentikasi, aturan approval, atau variabel lingkungan. Satu dependensi klien baru (`pdfjs-dist@4.10.38`). Rollback = promosikan ulang deployment v3.2 `dpl_3jMB35EEUcnFZtyHrPwLo6VaKRCT` atau revert commit fitur, lalu jalankan smoke.

## 10. Deploy produksi

| Item            | Nilai                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| Commit fitur    | `6468128` — `feat(dashboard): compact branch chart, one-page PDF, and infographic export` |
| Deployment      | `dpl_9dMaPC3hj5PjdLkL2CM8htwb9iVw`                                                        |
| URL deployment  | `https://dakosta-dakosta-d4i3o6nrq-jarjirjor777-5316.vercel.app`                          |
| Alias produksi  | `https://dakosta-dakosta.vercel.app`                                                      |
| Waktu           | 9 November 2026, 09.49 WIB                                                                |
| Rollback target | v3.2 `dpl_3jMB35EEUcnFZtyHrPwLo6VaKRCT`                                                   |

Smoke produksi `node scripts/smoke-production.mjs` — **25/25 LULUS** (evidence `docs/audit/evidence/E-smoke-production-2026-11-09T02-50-30-370Z.json`):

- Health, header keamanan, redirect unauth, API 401, login 4 peran, seluruh halaman dashboard/kinerja 200.
- RBAC 403 regional/cabang tetap ditolak.
- PDF Kinerja 263.503 byte dan PDF dashboard 265.764 byte valid; nama file per periode/peran benar.
- Infografis dashboard: 200, body PDF satu halaman, header `X-Infographic-Filename` bernama PNG.
- Rekonsiliasi Dashboard = Kinerja = CSV: 41 = 41 (admin) dan 19 = 19 (wilayah).
- CSV Kinerja/konten terunduh; route PDF lama 404.
- Aset worker `GET /vendor/pdf.worker.min.mjs` → 200 `application/javascript`, 1.375.838 byte.

Rollback tanpa migrasi: promosikan ulang `dpl_3jMB35EEUcnFZtyHrPwLo6VaKRCT` atau revert commit `6468128`, lalu jalankan smoke.

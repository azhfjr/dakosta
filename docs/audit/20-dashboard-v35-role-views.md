# D20 — Dashboard v3.5: bar chart sederhana, ranking tanpa persentase, aksi kanan, tampilan per peran

**Tanggal:** 2026-11-09
**Branch:** `fix/all-features-hardening`
**Status:** implemented + seluruh gate lokal/E2E/audit lulus; **belum di-commit, belum di-deploy**
**Baseline produksi:** v3.4 `dpl_9dMaPC3hj5PjdLkL2CM8htwb9iVw` (rollback target tetap v3.4)

## 1. Permintaan

Enam permintaan pengguna: (1) ganti stacked chart Konten per Cabang menjadi bar chart biasa dengan rekomendasi chart yang tepat; (2) hapus persentase pada ranking, cukup peringkat, bar, dan jumlah konten per FKRTL/FKTP/Pemda/Stakeholder; (3) pindahkan tombol Unduh/SLA ke sisi kanan header dan terapkan konsep yang sama ke seluruh halaman; (4) perbaiki narasi tombol yang kaku; (5) sesuaikan PDF dan infografis dengan dashboard baru pada kualitas tertinggi; (6) terapkan dashboard per peran (Master, Regional, Branch, Stakeholder).

Gate keras tambahan: spacing tidak terlalu lebar maupun rapat, proporsi tepat di dalam dan antar chart, berlaku untuk semua peran dan menu, dan audit kualitas UI/UX dilakukan menyeluruh di setiap fase.

## 2. Rekomendasi bar chart

**Horizontal single-series bar chart, urut menurun, satu warna merek, label nilai di ujung bar.**

- Nama cabang/institusi panjang dan banyak; sumbu Y horizontal menghindari label miring atau terpotong, termasuk di 375px.
- Pertanyaan utama adalah perbandingan besaran, bukan komposisi. Satu seri total adalah encoding paling jujur; komposisi kategori tetap tersedia lewat tooltip dan tabel `sr-only`.
- Grouped empat seri membuat 4× tinta visual; stacked mengulang masalah v3.4; skala log menyesatkan untuk data ini.
- Tanpa garis rata-rata: rata-rata antar-scope mudah disalahartikan; urutan + label nilai sudah cukup.

Spesifikasi terpasang: `BarChart layout="vertical"`, satu `<Bar dataKey="plotTotal">`, `maxBarSize=14`, radius `[0,4,4,0]`, warna `var(--brand-green-700)`, tanpa animasi, grid horizontal nonaktif, 4 tick sumbu X, margin `{ top: 4, right: valueMargin, bottom: 0, left: 4 }`, label nama 10px dengan wrap maksimum dua baris, label nilai 11px `tabular` di ujung bar, area scroll `max-h-[360px]`, tabel aksesibel seluruh baris.

Dua koreksi hasil review sebelum gate:

1. **Bar agregat tidak boleh meratakan bar nyata.** Skala sumbu X dihitung dari bar non-agregat; bar agregat dipotong pada skala tertinggi dan diberi catatan “Bar agregat dipotong pada skala tertinggi; nilai sebenarnya tertera pada label.” Label, tooltip, dan tabel tetap memuat total sebenarnya.
2. **Baris padat diberi anggaran label dua baris.** Tanpa ini, label tiga baris dapat saling menimpa pada kanvas 380px. Grafik cabang juga dibatasi 10 bar bernama + bar “Cabang lainnya (n)” agar pitch bar tetap terbaca; total panel tetap rekonsiliasi karena bar agregat memuat sisanya.

Catatan review: `chartCount` dan `aggregatedCount` pada plan PDF tidak dibaca renderer, tetapi dipertahankan karena dikunci unit test rekonsiliasi (`tests/dashboard-pdf.test.ts`); menghapusnya akan melemahkan gate, bukan menyederhanakan kode.

## 3. Matriks peran

| Bagian             | Master (nasional)             | Regional (wilayah)            | Branch (cabang)                  | Stakeholder (organisasi)                       |
| ------------------ | ----------------------------- | ----------------------------- | -------------------------------- | ---------------------------------------------- |
| KPI                | Total + Cabang dengan konten  | Total + Cabang dengan konten  | Total + Institusi dengan konten  | Total, Institusi, EDUFAST, Non-EDUFAST         |
| Chart              | Bar per cabang (10 + agregat) | Bar per cabang (10 + agregat) | Bar per institusi (12 + agregat) | —                                              |
| Filter cabang      | Ya                            | Ya                            | Tidak (seluruh cakupan)          | Tidak (seluruh cakupan)                        |
| Ranking 4 kategori | Ya                            | Ya                            | Ya                               | —                                              |
| Peta               | Ya                            | Ya                            | Ya                               | —                                              |
| Tema EDUFAST       | Ya                            | Ya                            | Ya                               | Ya (band tema penuh; kartu mini disembunyikan) |
| Judul halaman      | Dashboard nasional            | Dashboard wilayah             | Dashboard cabang                 | Beranda {nama}                                 |
| Aksi kanan         | Unduh laporan + Cek SLA       | Unduh laporan + Lihat kinerja | Unduh laporan + Cek SLA cabang   | Unduh laporan + Lapor konten                   |
| Anchor terakhir    | `#peta`                       | `#peta`                       | `#peta`                          | `#tema-konten`                                 |

Kontrak tunggal `DashboardVariant` (`national | regional | branch | stakeholder`) dipakai UI dan PDF. `selectionForDashboard` memaksa `{ mode: "not-applicable" }` untuk Branch dan Stakeholder, sehingga `?cabang=none` tidak dapat mengosongkan dashboard mereka. `?cabang=` pada Master/Regional tetap divalidasi terhadap cabang yang diizinkan server.

## 4. Narasi tombol

| Lokasi                  | Sebelum                                    | Sesudah                                                       |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Trigger unduh           | Unduh                                      | Unduh laporan                                                 |
| Aria trigger            | Unduh dashboard                            | Unduh laporan dashboard                                       |
| Menu PDF                | PDF — satu halaman A4 / chart kecuali peta | PDF siap cetak / Satu halaman A4, semua chart kecuali peta    |
| Menu infografis         | Infografis — PNG 300 DPI / 3508 × 2481     | Gambar siap dibagikan / PNG 300 DPI, tampilan sama dengan PDF |
| Dashboard Master        | Buka SLA                                   | Cek SLA                                                       |
| Dashboard Regional      | Buka kinerja wilayah                       | Lihat kinerja wilayah                                         |
| Dashboard Branch        | Buka SLA                                   | Cek SLA cabang                                                |
| Target                  | Buka ringkasan periode                     | Lihat ringkasan periode                                       |
| Validasi/Cabang/Wilayah | Dashboard / Kinerja                        | Lihat dashboard / Lihat kinerja                               |
| Detail konten           | Buka konten                                | Lihat konten                                                  |
| Error unduh             | Unduhan gagal. Coba lagi sebentar.         | Laporan belum bisa diunduh. Coba lagi sebentar.               |
| Error infografis        | Gagal membuat infografis PNG. Coba lagi.   | Gambar belum bisa dibuat. Coba lagi.                          |

Istilah produk (SLA, Kinerja, EDUFAST, Lapor konten) dipertahankan; hanya kata “Buka” dan label ekspor yang dihaluskan.

## 5. Sistem spacing dan gate angka

Skala 4px: 4/8/12/16/20/24/32. Hierarki section 24 (mobile 20) > kartu 16 (mobile 12–16) > mikro 8–12. `PageContainer` memakai `gap-5 sm:gap-6`; dashboard `space-y-5 sm:space-y-6`; grid kartu `gap-3 sm:gap-4`; padding panel `p-4 sm:p-5`; heading ke konten `mt-3` (12); label ke nilai `mt-1` (4).

Gate yang diukur otomatis oleh `scripts/ui-quality-audit.mjs` (123 halaman: 56 rute × 1440 dan 375, 11 halaman padat × 768):

| Metrik                        | Minimum | Maksimum | Hasil final |
| ----------------------------- | ------- | -------- | ----------- |
| Jarak antar section dashboard | 20      | 32       | lulus       |
| Jarak antar kartu             | 12      | 20       | lulus       |
| Padding panel                 | 16      | 24       | lulus       |
| Tinggi chart                  | 140     | 380      | lulus       |
| Tebal bar                     | 10      | 16       | lulus       |
| Track ranking                 | 6       | 8        | lulus       |
| Tinggi peta                   | 260     | 360      | lulus       |
| Donut tema                    | 210     | 240      | lulus       |
| Tinggi tombol                 | 36      | 40       | lulus       |
| Target sentuh mobile          | 40      | —        | lulus       |
| Overflow horizontal           | 0       | 1px      | 0px         |
| Overlap panel/tombol          | 0       | 0        | lulus       |
| Teks terpotong                | 0       | 0        | lulus       |
| Selisih tinggi pasangan panel | 0       | 2px      | lulus       |

E2E `dashboard.spec.ts` menegakkan band yang sama di 4 dashboard × 2 viewport, termasuk selisih tinggi pasangan panel ≤2px, label nilai tanpa `%`, dan bar proporsional.

## 6. Perubahan data dan kontrak

- `src/lib/dashboard/variant.ts` (baru): `dashboardVariant`, `dashboardSections`, `selectionForDashboard`, `dashboardViewAnchor`. Branch/Stakeholder selalu `not-applicable`; anchor `konten-per-cabang` dipetakan ke `konten-per-institusi` untuk branch dan ke `ringkasan` untuk stakeholder.
- `src/lib/dashboard/institutions.ts` (baru): `buildInstitutionChart` — top 12 institusi, sisa diagregasi ke `remaining`, rekonsiliasi total/kategori; tanpa query baru (`institutionRows` yang sudah ada).
- `src/lib/dashboard/types.ts`: `DashboardInstitutionRow`, `DashboardInstitutionChart`, `DashboardFiltered.institutionChart`.
- Route `api/v1/reports/dashboard`: meneruskan `role` ke renderer dan memakai `selectionForDashboard`; audit tetap `EXPORT_DASHBOARD_REPORT`/`EXPORT_DASHBOARD_INFOGRAPHIC`.
- Tidak ada perubahan skema, seed, data produksi, autentikasi, aturan approval, rate limit, atau environment variable. Tidak ada dependensi baru.

## 7. PDF dan infografis

- Tetap **satu halaman A4 landscape** (841,89 × 595,28pt), margin 24pt, header/footer dengan logo, font minimum 6pt.
- Komposisi mengikuti varian: national/regional = bar per cabang (maksimum baris PDF + agregat); branch = bar per institusi (12 + agregat, sisa PDF ikut dilipat ke agregat agar total selalu rekonsiliasi); stakeholder = 4 KPI + band tema, tanpa chart dan tanpa ranking.
- Ranking tanpa persentase: nomor peringkat, nama, jumlah, bar proporsional.
- Infografis tetap rasterisasi PDF yang sama pada 300 DPI (3508 × 2481), sehingga otomatis identik dengan PDF baru; tidak ada renderer kedua.
- Ekspor diverifikasi untuk 6 kombinasi: `master-all`, `master-subset`, `regional-all`, `regional-subset`, `branch-all`, `stakeholder-all` (`docs/audit/evidence/ui-v35/pdf/`).

Keputusan yang dicatat: strip KPI PDF memuat 6 kartu (total, cakupan, FKRTL, FKTP, Pemda, Stakeholder) untuk peran non-stakeholder dan 4 kartu untuk stakeholder, sedangkan dashboard layar memuat 2 KPI sesuai matriks peran. Ini disengaja: PDF adalah artefak ekspor lengkap satu halaman, dan angka KPI PDF sudah direkonsiliasi dengan dashboard pada backtest. Tidak ada angka baru yang dihitung; hanya rincian kategori yang sama ditampilkan lebih eksplisit.

## 8. Hasil audit UI/UX

### Audit seluruh menu

- `AUDIT_MODE=gate`, baseline `docs/audit/evidence/ui-v35/phase2-menu.json`, hasil `docs/audit/evidence/ui-v35/final.json`.
- **123/123 halaman lulus, 0 temuan (0 existing, 0 baseline, 0 NEW)**, 0 overflow horizontal, 0 page error.
- Cakupan: Master 23 rute + 1 detail, Regional 12 rute + 1 detail, Branch 12 rute + 1 detail, Stakeholder 6 rute + 1 detail; 3 viewport (1440×900, 768×1024, 375×812).

### Audit visual dashboard per peran

`node scripts/dashboard-visual-audit.mjs` → `docs/audit/evidence/dashboard-v35/visual-audit.json`:
**12/12 tangkapan layar lulus** (4 peran × 3 viewport), overflow 0px, overlap 0, gap sesuai band, peta 340/320/260px, error halaman 0. Stakeholder diverifikasi tanpa peta dan tanpa chart.

### Defect ledger yang ditutup

| Defect                                                          | Status | Bukti                                              |
| --------------------------------------------------------------- | ------ | -------------------------------------------------- |
| Overflow horizontal 233px pada `/client/konten/[id]` (existing) | fixed  | audit final 0 temuan                               |
| Filter cabang menghitung grup wilayah saat popover tertutup     | fixed  | `e2e/filters.spec.ts` membuka checklist lebih dulu |
| Anchor a11y stakeholder menunggu `#peta` yang sudah tidak ada   | fixed  | anchor `#tema-konten` di `e2e/a11y.spec.ts`        |
| Nama region chart tidak lagi cocok setelah judul baru           | fixed  | “Konten per Cabang, dapat digulir”                 |
| Label nilai bisa terpotong pada total panjang                   | fixed  | margin kanan dinamis 44–72px                       |
| Kartu compact memakai padding 16px juga di desktop              | fixed  | `p-4 sm:p-5`                                       |
| Kartu tema tidak sama tinggi dengan donut                       | fixed  | `h-full` + `lg:grid-rows-2`                        |
| Bar agregat berpotensi meratakan bar nyata                      | fixed  | domain dari bar non-agregat + catatan              |
| Label tiga baris berpotensi menimpa pada kanvas 380px           | fixed  | anggaran dua baris + top-10 cabang                 |
| PDF institusi memotong baris tanpa melipat sisa ke agregat      | fixed  | agregat menghitung overflow                        |
| Tombol “Buka …” masih kaku di dua halaman detail                | fixed  | “Lihat konten”                                     |
| Popover checklist tanpa `aria-controls`/`aria-expanded`         | fixed  | atribut ditambahkan                                |

## 9. Gate verifikasi

| Gate                       | Hasil                                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| Prettier (berkas berubah)  | PASS                                                                        |
| ESLint                     | PASS (0 error, 0 warning)                                                   |
| Typecheck (`tsc --noEmit`) | PASS                                                                        |
| Unit/integration           | 286/286 PASS (42 berkas)                                                    |
| Dashboard unit tests       | 28/28 PASS (variant, institutions, ranking, PDF)                            |
| Build verify               | PASS (`.next-verify`)                                                       |
| E2E penuh                  | 132/132 PASS (8,8 mnt) pada build final; dashboard + page-header 47/47 PASS |
| Visual audit per peran     | 12/12 PASS                                                                  |
| Audit UI/UX semua menu     | 123/123 PASS, 0 NEW                                                         |
| Backtest rekonsiliasi      | 72/72 PASS (termasuk `institutionChart`)                                    |

## 10. Risiko dan mitigasi

| Risiko                                        | Mitigasi                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| UI dan PDF menyimpang antar peran             | Satu kontrak `DashboardVariant` dipakai bersama; unit test matriks + PDF 1 halaman per varian            |
| Header baru memengaruhi banyak halaman        | `e2e/page-header.spec.ts` 22 tes pada 11 halaman beraksi + audit seluruh menu                            |
| Agregat menyembunyikan institusi/cabang kecil | Bar agregat berlabel jumlah + total; catatan footer; tabel aksesibel memuat semua baris yang ditampilkan |
| Nama panjang di 375px                         | Wrap dua baris, label 10px, lebar label 156px, tanpa ellipsis pada angka                                 |
| Filter branch/stakeholder diabaikan           | Disengaja; diuji `selectionForDashboard` dan E2E `?cabang=none`                                          |
| Angka berubah karena perubahan UI             | Tidak ada perubahan predicate/query; backtest dashboard = Kinerja = SQL lulus 72/72                      |

## 11. Rollback

Tidak ada migrasi data atau perubahan variabel lingkungan. Rollback = promosikan ulang deployment v3.4 `dpl_9dMaPC3hj5PjdLkL2CM8htwb9iVw` (alias `dakosta-dakosta.vercel.app`). Commit fitur v3.5 adalah `a937c55`; tidak ada commit lain yang perlu dibalik.

## 12. Deploy produksi (2026-11-09)

| Area                | Hasil                                                                                                                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commit rilis        | `a937c55` — `feat(dashboard): ship v3.5 role-aware views with simple bar charts`                                                                                                                                                                                                                               |
| Deployment produksi | `dpl_5dnHcwACpnC6ZcTp7FftALfbikhY`, status Ready, build 1 mnt; alias `dakosta-dakosta.vercel.app`                                                                                                                                                                                                              |
| Smoke produksi      | 25/25 PASS — health, header keamanan, 401/307, login 4 peran, RBAC 403, PDF Kinerja 263.503 B, PDF dashboard 265.564 B, infografis 200, CSV, rekonsiliasi 41 = 41 dan 19 = 19; evidence `E-smoke-production-2026-11-09T06-08-33-486Z.json`                                                                     |
| Audit live 4 peran  | 4/4 PASS — aksi header rata kanan (tepi 1408 = 1408), ranking tanpa persen, chart cabang/institusi sesuai peran, stakeholder tanpa ranking/peta/filter, 375px tanpa overflow; evidence `production-live-audit.json` + 8 tangkapan layar                                                                        |
| Verifikasi dataset  | PARTIAL — tier DB berhenti pada `RESUBMITTED` 19 vs 20 dan tier HTTP pada approved bulan berjalan 41 vs 40; drift demo satu konten yang di-approve lewat alur demo, bukan akibat deploy. Tidak ada penulisan data; smoke membuktikan dashboard = CSV = Kinerja (41 = 41, 19 = 19). Data produksi tidak diubah. |
| Rollback target     | v3.4 `dpl_9dMaPC3hj5PjdLkL2CM8htwb9iVw`                                                                                                                                                                                                                                                                        |

Tidak ada skema, seed, data produksi, autentikasi, aturan approval, rate limit, atau variabel lingkungan yang diubah.

### Temuan di luar cakupan v3.5

Form login dapat melakukan submit GET bawaan apabila dikirim sebelum React selesai hydration (perilaku lama, bukan perubahan v3.5): kredensial dapat muncul di URL. Audit live menghindari kondisi ini dengan menunggu hydration. Disarankan patch terpisah (mis. `method="post"` atau menonaktifkan tombol sampai hydration) berikut gate dan smoke tersendiri.

### Superseded oleh v3.6 (2026-11-09)

Status deploy dan rollback di dokumen ini berlaku untuk v3.5 dan **tidak lagi menjadi acuan produksi**. v3.6 (`271a926`, deployment `dpl_EfSURKdQPH5XTbB4iKTMXsEH6oep`) menggantikannya: sembilan status konten menjadi empat di database (migrasi `0007_fantastic_prowler.sql`), dashboard memakai kontrak baru (kartu kategori + porsi, tren 12 bulan, irisan jenis konten, tren jenis/tema, peta tier region→cabang→institusi), dan rollback target menjadi v3.5 `dpl_5dnHcwACpnC6ZcTp7FftALfbikhY` dengan syarat CHECK dilonggarkan lebih dulu. Buku bukti v3.6: `docs/audit/21-v36-dashboard-workflow.md`; status terkini: `docs/audit/13-status.md`.

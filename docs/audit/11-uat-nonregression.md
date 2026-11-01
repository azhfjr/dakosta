# D11 — UAT per Role & Matriks Non-Regresi

## UAT

| Role             | Skenario                                                                | Ekspektasi                                                                                           |
| ---------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Master Admin     | Login, kelola akun/hierarki, target, kebijakan SLA, audit               | Semua aksi berhasil; tidak melihat password; audit tercatat                                          |
| Admin Kedeputian | Buka SLA Check, Dashboard, Kinerja; coba approve                        | SLA/Dashboard/Kinerja terisi scope wilayah; approve/revisi → 403                                     |
| Admin Cabang     | SLA Check, approve/revisi/tolak, Dashboard, Kinerja, print/PDF/CSV      | Aksi review berhasil; data hanya cabang sendiri; angka konsisten                                     |
| Stakeholder      | Aktivasi lokasi, lapor konten tanpa GPS per konten, lihat status/revisi | Wizard tanpa langkah lokasi; konten memakai lokasi instansi; status benar                            |
| Akun GRACE       | Login sebelum aktivasi                                                  | Banner + tenggat; akses operasional tetap boleh sampai tenggat (default)                             |
| Akun PENDING     | Login baru sebelum aktivasi                                             | Hanya onboarding/bantuan; route operasional redirect `/aktivasi-lokasi`; API 403 `LOCATION_REQUIRED` |

## Matriks non-regresi

| Area      | Kasus                                                                                |
| --------- | ------------------------------------------------------------------------------------ |
| Konten    | Draft, submit, revisi, resubmit, approve, reject, revoke; `first_submitted_at` tetap |
| Status    | Semua transisi sah; transisi terlarang 409                                           |
| Hak akses | Cross-branch/cross-region 403/404; IDOR; direct link; role switch                    |
| Angka     | Dashboard = peta = Kinerja = CSV = print = PDF untuk filter/periode sama; selisih 0  |
| Periode   | Bulan, triwulan, tahun; pergantian tahun; timezone WIB; reapproval/revoke            |
| Target    | Target ada, kosong (N/A), 0 (N/A), perubahan target historis                         |
| Akun lama | GRACE, backfill demo, tidak ada lockout mendadak                                     |
| Tagging   | Tidak ada prompt lokasi per konten; lokasi konten dari instansi                      |
| Cetak     | Browser print + PDF identik; PDF lama Peta/Dashboard tidak ada                       |
| Desain    | Responsif mobile/tablet/desktop; a11y; print                                         |
| Beban     | 100k staging; threshold §10.4                                                        |

## Kriteria blokir rilis

P0/P1 terbuka, data loss, kebocoran scope, angka tidak rekonsiliasi, migrasi gagal, atau gate G1–G9 merah.

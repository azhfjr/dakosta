# D7 — Matriks Opsi Perubahan Substantif

Format: **A minimal / B seimbang (rekomendasi default) / C struktural**. Opsi yang melanggar DEC-01–06 ditandai.

| Topik                | Opsi A                                             | Opsi B (dipilih)                                                                                                   | Opsi C                                   | Rollback / risiko                                         |
| -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------- |
| IA Kedeputian/Cabang | Tambah SLA Check/Kinerja tanpa menghapus menu lama | **Ubah `/wilayah`,`/cabang` menjadi SLA Check; tambah `/dashboard`,`/kinerja`; redirect menu lama setelah parity** | Rewrite seluruh route tree               | Redirect dipertahankan; risiko deep link diuji E2E        |
| SLA                  | Tanpa target durasi; hanya aging                   | **Tanpa target bawaan + kebijakan Master opsional (24×7, submit pertama, revisi tidak pause)**                     | Target per kategori + kalender jam kerja | Kebijakan disimpan di `sla_policies`; dapat dinonaktifkan |
| Lokasi               | Aktivasi sekali + guard + grace                    | **Sama, plus backfill demo sintetis dan halaman bantuan**                                                          | GPS per konten (melanggar DEC-04)        | **C ditolak**; rollback = status GRACE                    |
| Target               | Pertahankan target stakeholder/subTema             | **Target instansi per bulan; triwulan/tahun = penjumlahan; histori append-only**                                   | Target triwulan/tahun independen         | Tabel histori; data lama tetap                            |
| Peta                 | Pin konten dengan limit                            | **Agregasi server-side per cabang/instansi + tabel alternatif**                                                    | Clustering viewport pin konten           | Peta baru dapat dimatikan; data sumber tetap              |
| Ekspor               | Cap 2.000 (status quo)                             | **Streaming CSV ter-scope**                                                                                        | Background job + unduhan                 | Stream dapat dibatasi rate limit                          |
| PDF                  | PDF lama Peta/Dashboard                            | **PDF Kinerja pdf-lib + browser print**                                                                            | Headless browser server                  | PDF lama dihapus; route 404                               |
| Performa             | Perbaikan query + index                            | **Query rewrite + index komposit + lazy load + pool configurable**                                                 | Materialized view/counter                | MV menambah invalidation; belum perlu tanpa bukti         |
| Guard API            | Per-route manual                                   | **Capability guard eksplisit di semua API sensitif**                                                               | Gateway policy terpusat                  | Risiko regresi 403 diuji E2E                              |
| Akun lama            | Lockout langsung                                   | **GRACE 30 hari + banner + tenggat**                                                                               | Bertahap per unit                        | Tidak ada bypass; Master dapat memperpanjang              |

## Keputusan yang masih menunggu user

Tidak ada yang memblokir implementasi karena default F1–F4 telah disetujui melalui rencana. Perubahan default (mis. target SLA angka, radius kantor, otoritas target) hanya mengubah konfigurasi, bukan kode.

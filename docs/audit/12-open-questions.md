# D12 — Pertanyaan Lanjutan & Parameter

**Q1–Q6 / DEC-01–06 terkunci.** Tidak ditanyakan ulang.

## Default F1–F4 yang dipakai (disetujui melalui rencana)

| ID  | Default                                                                                      | Dampak jika diubah                                                     |
| --- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| F1  | Tanpa target durasi; aging/resubmit/final approval; submit pertama; 24×7; revisi tidak pause | Mengisi target hari/kalender mengaktifkan overdue di UI, tanpa migrasi |
| F2  | Sekali saat aktivasi; akurasi ≤150 m; radius kantor tidak memblokir; >50 km ditandai         | Threshold/radius dapat diubah via kebijakan                            |
| F3  | Master; target instansi bulanan; roll-up penjumlahan; N/A jika kosong; histori               | Otoritas/roll-up dapat diubah; data lama tetap                         |
| F4  | GRACE 30 hari; demo backfill sintetis; histori geotag dipertahankan                          | Tenggat dapat diperpanjang Master                                      |

## Parameter operasional yang masih terbuka (tidak memblokir)

| ID  | Pertanyaan                                         | Default sementara                                       | Konsekuensi                                                     |
| --- | -------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| O1  | Satuan target = jumlah konten approved?            | Ya                                                      | Jika satuan lain, perlu kolom unit (sudah ada `reporting_unit`) |
| O2  | Cut-off administratif selain akhir bulan kalender? | Akhir bulan kalender WIB                                | Cut-off khusus perlu kebijakan baru                             |
| O3  | Timezone kanonik?                                  | `Asia/Jakarta`                                          | Perubahan timezone menggeser batas periode                      |
| O4  | Reapproval setelah revoke?                         | Tidak didukung; revoke terminal                         | Jika dibutuhkan, alur baru + `approved_at` baru                 |
| O5  | Pelaporan historis saat approval dicabut?          | Tidak dihitung (approved_at null); histori review tetap | Laporan historis “pernah approved” tidak tersedia               |
| O6  | Target akun serentak saat uji beban?               | 1.000 VU opsional                                       | Kapasitas riil dicatat dari hasil tes                           |

## Catatan

Tidak ada pertanyaan yang menghalangi audit read-only. Semua parameter di atas dapat diubah tanpa mengubah kontrak API.

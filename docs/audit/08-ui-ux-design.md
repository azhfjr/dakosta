# D8 — Rancangan UI/UX v1.1

## Site map role

```
Admin Kedeputian Wilayah          Admin Cabang
/wilayah  (SLA Check)             /cabang  (SLA Check + aksi review)
/wilayah/dashboard                /cabang/dashboard
/wilayah/kinerja                  /cabang/kinerja
/wilayah/organisasi               /cabang/organisasi
/wilayah/red-notice               /cabang/red-notice
/wilayah/notifikasi               /cabang/notifikasi
/wilayah/konten/[id]              /cabang/konten/[id]
                                  /cabang/review/[id]
```

## SLA Check

- **Header:** judul “SLA Check Konten”, scope, last updated, tombol “Muat ulang”.
- **Kartu ringkas:** Menunggu review, Dalam review, Perlu revisi, Disetujui periode ini, Overdue (hanya jika kebijakan aktif; jika tidak, “Belum ada target SLA”).
- **Filter:** status, organisasi, sub-tema, pencarian, urutan (terlama/terbaru), halaman.
- **Tabel:** referensi, judul, instansi, status, versi, aging (hari), resubmit, submit pertama, review terakhir, aksi.
- **Aksi Cabang:** buka detail review (approve/revisi/tolak). **Kedeputian:** hanya “Lihat detail”.
- **Riwayat:** timeline submit → review → revisi → resubmit → approval final.
- **Empty state:** “Tidak ada konten pada filter ini.” **Error:** retry + request ID.

## Dashboard

Urutan: filter periode (bulan/triwulan/tahun) + sumber → kartu approved/target → chart tren → distribusi → **peta agregat** → tabel konten + pencarian/sort/pagination → tombol CSV + print.

- Peta: legenda “Jumlah konten approved per instansi/cabang”, popover nama + jumlah + persentase, tombol “Tampilkan tabel” untuk keyboard/screen reader.
- Tanpa tombol PDF laporan lama.
- Default metrik = `approved_at`; label periode dan timezone eksplisit.

## Kinerja

- Filter: periode (bulan/triwulan/tahun), jenis instansi, cabang (Kedeputian), status target, rentang %, pencarian.
- Tabel: Kedeputian, Cabang, Instansi, Jenis, Target, Realisasi approved, Selisih, %, Status, Periode, Diperbarui.
- Target kosong = **N/A**, bukan 0%.
- Sort server-side + secondary sort; pagination dengan total benar; sticky header; progress bar tidak menggantikan angka.
- Tombol: **Cetak** (`window.print()` halaman print-friendly) dan **PDF Kinerja** (unduh). Keduanya memakai filter/scope yang sama dan menyatakan cakupan “semua baris terfilter”.
- Mobile: tabel menjadi kartu; kolom dapat disembunyikan.

## Aktivasi lokasi (`/aktivasi-lokasi`)

- Penjelasan: lokasi diperlukan sekali untuk validasi akun; tidak dapat diganti pin manual.
- Tombol “Aktifkan lokasi” → browser Geolocation; status loading; jika ditolak/tidak akurat → pesan, langkah retry, tautan bantuan, tetap `PENDING_LOCATION`.
- Consent checkbox sebelum kirim.
- Tidak ada tombol lewati.

## Aksesibilitas

- Fokus terlihat, urutan tab logis, label ARIA, `aria-live` untuk status, kontras ≥4.5:1, target sentuh ≥44px, `prefers-reduced-motion` dihormati.
- Peta selalu punya alternatif tabel; chart punya ringkasan teks.
- Print: header/footer, page break, warna aman cetak.

## Microcopy

- “SLA dihitung sampai approval final Admin Cabang.”
- “Target belum ditetapkan” / N/A.
- “Lokasi akun Anda belum tervalidasi. Selesaikan aktivasi untuk melanjutkan.”
- “Konten yang dicabut tidak dihitung pada periode mana pun.”

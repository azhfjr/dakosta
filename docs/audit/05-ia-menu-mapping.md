# D5 — Menu Mapping as-is → to-be

**Sumber as-is:** [navigation.tsx:32](file:///C:/Users/PLN/Documents/Qoder/2026-10-30/b8cd74b6/src/components/shell/navigation.tsx#L32).

## Admin Kedeputian Wilayah (`/wilayah`) dan Admin Cabang (`/cabang`)

| Menu as-is | Route as-is                                 | To-be                                                        | Perlakuan fitur                                                                                                                                                                |
| ---------- | ------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ringkasan  | `/wilayah`, `/cabang`                       | **1. SLA Check Konten** (`/wilayah`, `/cabang`)              | Antrean, aging, status, revisi/resubmit, tenggat (jika kebijakan diisi), riwayat, filter, aksi review untuk Cabang; Kedeputian read-only. Ringkasan KPI dipindah ke Dashboard. |
| Review     | `/cabang/review`                            | **Digabung ke SLA Check**                                    | Approve, revisi, tolak, checklist, catatan, riwayat tetap; `/cabang/review/[id]` dipertahankan sebagai halaman aksi; `/cabang/review` redirect ke `/cabang`.                   |
| Analitik   | `/wilayah/analitik`, `/cabang/analitik`     | **2. Dashboard** (`/wilayah/dashboard`, `/cabang/dashboard`) | Semua chart, filter sumber, tabel konten, dan CSV digabung. Route lama redirect.                                                                                               |
| Peta       | `/wilayah/peta`, `/cabang/peta`             | **Digabung ke Dashboard**                                    | Peta agregat per cabang (Kedeputian) / per instansi (Cabang), keyboard + tabel alternatif; tanpa pin per konten; tanpa PDF peta. Route lama redirect.                          |
| Laporan    | `/wilayah/laporan`, `/cabang/laporan`       | **Digabung ke Dashboard**                                    | CSV + browser print; menu Laporan dihapus setelah parity.                                                                                                                      |
| Konten     | `/wilayah/konten`, `/cabang/konten`         | **Dihapus dari nav**                                         | Daftar dan pencarian pindah ke Dashboard; detail `/wilayah/konten/[id]`, `/cabang/konten/[id]` dipertahankan untuk drill-down.                                                 |
| —          | —                                           | **3. Kinerja** (`/wilayah/kinerja`, `/cabang/kinerja`)       | Tabel per instansi FKRTL/FKTP/Pemda/Stakeholder, filter periode/instansi/status, sort server-side, pagination, browser print, PDF Kinerja, CSV.                                |
| Organisasi | `/wilayah/organisasi`, `/cabang/organisasi` | Dipertahankan                                                | Bukan duplikasi.                                                                                                                                                               |
| Red Notice | `/wilayah/red-notice`, `/cabang/red-notice` | Dipertahankan                                                | Bukan duplikasi.                                                                                                                                                               |
| Notifikasi | `/wilayah/notifikasi`, `/cabang/notifikasi` | Dipertahankan                                                | Bukan duplikasi.                                                                                                                                                               |

**Urutan nav target:** SLA Check → Dashboard → Kinerja → Organisasi → Red Notice → Notifikasi.

## Master Admin (`/admin`)

| Menu as-is                              | To-be                      | Catatan                                                                                                                                                                                                                          |
| --------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ringkasan                               | Dipertahankan              | —                                                                                                                                                                                                                                |
| Validasi                                | Dipertahankan              | —                                                                                                                                                                                                                                |
| Konten, Peta, Analitik, Target, Laporan | Dipertahankan untuk Master | `/admin/laporan` saat ini **dead link** ([navigation.tsx:47](file:///C:/Users/PLN/Documents/Qoder/2026-10-30/b8cd74b6/src/components/shell/navigation.tsx#L47)); dibuat redirect ke `/admin/analitik` agar deep link tidak mati. |
| SLA (baru)                              | `/admin/sla`               | Kebijakan SLA Master (target durasi opsional, kalender, pause revisi).                                                                                                                                                           |
| Lokasi (baru)                           | `/admin/lokasi`            | Monitoring status aktivasi lokasi akun non-Master.                                                                                                                                                                               |

## Stakeholder (`/client`)

Tidak berubah pada v1.1 kecuali wizard tidak lagi meminta lokasi per konten. Analitik dan konten tetap.

## Redirect/deep link

| Route lama                                                                  | Tujuan                |
| --------------------------------------------------------------------------- | --------------------- |
| `/wilayah/analitik`, `/wilayah/peta`, `/wilayah/laporan`, `/wilayah/konten` | `/wilayah/dashboard`  |
| `/cabang/analitik`, `/cabang/peta`, `/cabang/laporan`, `/cabang/konten`     | `/cabang/dashboard`   |
| `/cabang/review`                                                            | `/cabang` (SLA Check) |
| `/wilayah/konten/[id]`, `/cabang/konten/[id]`, `/cabang/review/[id]`        | Tetap berfungsi       |
| `/admin/laporan`                                                            | `/admin/analitik`     |

## Fitur yang dihapus

- Langkah lokasi per konten pada wizard (DEC-04).
- Menu Peta/Laporan/Konten terpisah untuk Kedeputian/Cabang setelah parity.
- PDF laporan dari Peta/Dashboard (tetap ada PDF Kinerja).

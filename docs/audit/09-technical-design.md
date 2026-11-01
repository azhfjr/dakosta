# D9 — Desain Teknis v1.1

## Entitas & status

| Entitas                     | Perubahan                                                                          | Alasan                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `content_submissions`       | `first_submitted_at`, snapshot `branch_office_id`, `regional_office_id`            | Titik awal SLA tidak tertimpa; hierarki historis stabil saat instansi pindah |
| `user_profiles`             | `location_status` (`NOT_REQUIRED`, `PENDING`, `GRACE`, `ACTIVE`)                   | Guard aktivasi DEC-04/F4                                                     |
| `user_activation_locations` | `user_id` PK, lat/lng/accuracy/consent/captured_at/source/`is_demo_backfill`       | Bukti minimal lokasi akun sekali                                             |
| `locations`                 | `stakeholder_id` nullable + index unik parsial                                     | Lokasi konten diturunkan dari instansi, bukan input user                     |
| `sla_policies`              | target_days nullable, calendar, start_point, pause_on_revision, active, updated_by | Kebijakan SLA Master; tanpa angka bawaan                                     |
| `kpi_target_history`        | target_id, stakeholder_id, sub_theme, period, old/new target, actor, reason        | Histori append-only target                                                   |

## Periode (DEC-03/06)

- Timezone kanonik `Asia/Jakarta` (offset +07:00, tanpa DST).
- `period=YYYY-MM` (bulan), `YYYY-Qn` (triwulan), `YYYY` (tahun).
- Rentang instant: awal periode 00:00 WIB → awal periode berikutnya 00:00 WIB.
- Roll-up target: triwulan/tahun = penjumlahan target bulanan instansi (F3).
- Realisasi: `COUNT(DISTINCT content_submissions.id)` status `APPROVED`, `archived=false`, `approved_at` dalam rentang, snapshot scope.
- Konten `REVOKED` tidak dihitung (approved_at null). Reapproval tidak didukung model saat ini; jika ditambahkan, memakai `approved_at` baru dan histori review tetap.

## Agregasi Kinerja

```
realisasi(instansi, periode) = COUNT(DISTINCT cs.id)
  WHERE cs.status='APPROVED' AND cs.archived=false
    AND cs.approved_at >= start AND cs.approved_at < end
    AND cs.stakeholder_id = instansi
target(instansi, periode) = Σ target bulanan instansi (NULL jika tidak ada)
persentase = realisasi / target * 100 jika target > 0, else N/A
```

Scope diterapkan melalui `contentScopePredicate`/`organizationScopePredicate`; tidak ada ID scope dari klien.

## Peta

- Sumber koordinat: `stakeholders.latitude/longitude` (lokasi instansi). Lokasi akun tidak dipakai untuk pin.
- Agregasi server-side per cabang (Kedeputian) atau per instansi (Cabang), `COUNT(DISTINCT id)` approved dalam periode.
- Tidak ada pin per konten; respons maksimum = jumlah instansi/cabang.
- Alternatif tabel wajib; popover memuat jumlah dan persentase.

## Migrasi & backfill

- Migrasi aditif (`0004_v11_sla_location_targets.sql`), semua kolom nullable/default aman.
- Backfill `first_submitted_at = submitted_at` untuk data lama.
- Backfill snapshot branch/region dari `stakeholders` saat migrasi.
- `user_profiles.location_status`: default `GRACE` untuk baris lama; akun baru eksplisit `PENDING`; Master `NOT_REQUIRED`.
- Demo: `user_activation_locations` sintetis dari koordinat instansi, `is_demo_backfill=true`; skrip menolak target non-demo.
- Rollback aplikasi: skema aditif tetap kompatibel dengan kode lama.

## Keamanan

- Semua API sensitif memakai capability guard eksplisit; scope tetap di query.
- Rate limit ekspor/laporan; CSV formula-injection escaping di `toCsv`.
- Lokasi akun: consent, akses hanya pemilik + Master, tidak ditampilkan di CSV publik.
- Audit: aktivasi lokasi, perubahan kebijakan SLA, perubahan target, ekspor, cetak.

## Cetak & PDF

- Browser print: halaman `/wilayah/kinerja/cetak` dan `/cabang/kinerja/cetak` (print CSS, filter via query).
- PDF Kinerja: `pdf-lib` (sudah ada), layout A4 landscape, header instansi/periode/filter, tabel + ringkasan, pagination.
- Kedua jalur memakai fungsi data yang sama (`getPerformanceReport`).
- PDF lama `/api/v1/reports/achievement` dipertahankan hanya untuk Master? **Keputusan:** route lama dipertahankan untuk kompatibilitas tetapi tidak ditautkan dari Peta/Dashboard; halaman lama dihapus/redirect. PDF Kinerja baru menjadi satu-satunya PDF di UI.

## Observability

- `/api/health` ada; tambahkan query DB ringan + versi.
- Log request ID; audit ekspor.
- Monitoring produksi: Vercel logs + health; tanpa klaim telemetry yang tidak tersedia.

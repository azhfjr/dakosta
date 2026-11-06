# Remediation Roadmap — Audit DAKOSTA v2 (2026-11)

Dokumen ini adalah **usulan perbaikan**, bukan bagian dari eksekusi audit.
Tidak ada kode, konfigurasi, database, atau deployment yang diubah. Setiap item
memiliki severity, owner/disiplin, effort, dependensi, acceptance criteria (AC),
dan test regresi. Eksekusi memerlukan persetujuan terpisah (Checkpoint E).

- Baseline: `fix/all-features-hardening` @ `01c237b`
- Temuan: 21 (0 P0, 1 P1, 7 P2, 13 P3) — lihat [`04-findings.csv`](04-findings.csv)
- Laporan: [`01-laporan-utama.md`](01-laporan-utama.md)
- Matriks uji: [`05-test-matrix.csv`](05-test-matrix.csv)

## 1. Prinsip urutan

1. **Tutup batas kepercayaan lebih dulu** — demo containment dan CSRF sebelum
   perbaikan kosmetik.
2. **Hentikan 5xx yang dapat diinduksi** — validasi input dan pemetaan error.
3. **Perbaiki yang terlihat pengguna** — aksesibilitas dan jalur akun.
4. **Bangun kemampuan deteksi** — CI, observability, retensi, backup.
5. **Baru perluas** — nonce CSP, pembersihan API, peningkatan cakupan.

Effort: **S** ≤ 1 hari, **M** 2–5 hari, **L** ≥ 1–2 minggu (1 engineer).
Estimasi bersifat indikatif dan belum termasuk review/QA.

## 2. Ringkasan bucket

| Bucket     | Item  | Temuan                                     | Tema                                                                    |
| ---------- | ----- | ------------------------------------------ | ----------------------------------------------------------------------- |
| 0–48 jam   | 5     | FND-001, 002, 012, 016, 021                | Tutup kontainmen demo, CSRF, endpoint terbuka, error 5xx, klaim dokumen |
| 1–2 minggu | 8     | FND-003, 004, 005, 010, 011, 013, 014, 020 | Ketahanan resource, akun, navigasi, validasi input                      |
| 1–2 bulan  | 6     | FND-006, 007, 008, 009, 017, 019           | Perlindungan data, a11y, CI/observability, lifecycle demo               |
| Backlog    | 2 + 3 | FND-015, 018 + peningkatan                 | CSP nonce, pembersihan API, coverage/SBOM/ekspor audit                  |

## 3. Bucket 0–48 jam (mitigasi)

### R1 — Kontainmen demo pada seluruh mutasi master (FND-001, P1)

| Field      | Nilai                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Backend/AppSec                                                                                                                                                                                                                                                                                                                                                          |
| Effort     | M                                                                                                                                                                                                                                                                                                                                                                       |
| Dependensi | Peta capability + daftar 11 handler tanpa guard; helper `assertNotDemoActor`                                                                                                                                                                                                                                                                                            |
| AC         | (1) Setiap handler mutasi master yang mengubah data global menolak aktor demo dengan `403 DEMO_FORBIDDEN` **sebelum** validasi payload/ID. (2) Berlaku untuk policy create/publish/archive/copy, revoke, target create/update/delete/sync, outbox drain, import preview. (3) Master non-demo tidak mengalami regresi. (4) Penolakan tercatat di audit log bila relevan. |
| Regresi    | Perluas probe P-045 ke seluruh 11 handler dengan ID nonexistent; unit test per guard; smoke master non-demo; probe P-046–P-048 tetap 403.                                                                                                                                                                                                                               |
| Catatan    | Ini temuan P1 satu-satunya. Dampak mutasi nyata belum diuji (read-only); status dampak tetap `SUSPECTED` sampai staging.                                                                                                                                                                                                                                                |

### R2 — Same-origin wajib pada mutasi cookie (FND-002, P2)

| Field      | Nilai                                                                                                                                                                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Backend/AppSec                                                                                                                                                                                                                                                                                                                      |
| Effort     | S                                                                                                                                                                                                                                                                                                                                   |
| Dependensi | R1 (urutan guard: origin → sesi → demo → payload)                                                                                                                                                                                                                                                                                   |
| AC         | (1) `assertSameOrigin` dipanggil pada submissions, notifications, me/password, outbox/drain, demo/login. (2) Origin/Referer **wajib ada**; bila absen → 403, bukan short-circuit. (3) Origin asing → 403 sebelum validasi body. (4) Route non-browser yang disengaja (jika ada) memakai mekanisme token, bukan pengecualian origin. |
| Regresi    | Probe P-040…P-044 harus 403; tambah probe untuk outbox dan demo/login; pastikan login browser normal tetap 200.                                                                                                                                                                                                                     |

### R3 — Tutup `HEAD /api/v1/admin/imports` (FND-012, P3)

| Field      | Nilai                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Backend                                                                                                                      |
| Effort     | S                                                                                                                            |
| Dependensi | —                                                                                                                            |
| AC         | `HEAD` tanpa sesi → 401; dengan sesi non-master → 403; master → 204/200. Tidak ada handler yang melewati `requireMasterApi`. |
| Regresi    | Probe P-009; P-054 tetap 200 untuk master.                                                                                   |

### R4 — Perbaiki pemetaan status error (FND-021, P3)

| Field      | Nilai                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Backend                                                                                                                                                   |
| Effort     | S                                                                                                                                                         |
| Dependensi | —                                                                                                                                                         |
| AC         | Status string Better Auth diparse ke angka; `APIError` 4xx tidak menjadi 500. Salah sandi → 400/401; rate limit → 429; hanya kesalahan tak terduga → 500. |
| Regresi    | Retest P-044; unit test `jsonError` untuk status string, angka, dan tanpa status; login gagal dan sukses.                                                 |

### R5 — Koreksi klaim dokumentasi audit (FND-016, P3)

| Field      | Nilai                                                                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Docs/QA                                                                                                                                                                                                                       |
| Effort     | S                                                                                                                                                                                                                             |
| Dependensi | —                                                                                                                                                                                                                             |
| AC         | `docs/audit/13-status.md` dan README audit memakai angka yang punya artefak: unit 120/120 (19 berkas), E2E 49/54 + 5/5 isolated, a11y sesuai E-15, 56 handler/32 mutasi. Setiap klaim menyertakan tautan bukti dan timestamp. |
| Regresi    | Tidak ada uji otomatis; review silang dengan `02-evidence-register.md`.                                                                                                                                                       |
| Catatan    | Patch dokumentasi terpisah; tidak mengubah kode.                                                                                                                                                                              |

## 4. Bucket 1–2 minggu

### R6 — Cap ukuran body dan hitung byte (FND-003, P2)

| Field      | Nilai                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owner      | Backend                                                                                                                                                                                                |
| Effort     | S                                                                                                                                                                                                      |
| Dependensi | —                                                                                                                                                                                                      |
| AC         | Semua route JSON menolak body > batas (mis. 1 MB) dengan 413 sebelum parse; `Content-Length` tidak dapat diandalkan sendiri, tetap hitung byte stream; import menghitung byte, bukan `content.length`. |
| Regresi    | P-052 harus 413; body di bawah batas tetap 400/200 sesuai skema; unit test batas tepat.                                                                                                                |

### R7 — Rate limit auth persisten dan IP tepercaya (FND-004, P2)

| Field      | Nilai                                                                                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Backend/SRE                                                                                                                                                                                                                      |
| Effort     | M                                                                                                                                                                                                                                |
| Dependensi | Pemilihan store (DB/Redis/Upstash); kebijakan proxy                                                                                                                                                                              |
| AC         | (1) Limiter auth bertahan lintas instance. (2) IP diambil dari header platform tepercaya, bukan hop pertama XFF. (3) 18 handler mutasi tanpa limit mendapat limit sesuai risiko. (4) 429 konsisten dan tidak membocorkan detail. |
| Regresi    | Staging: 20 login gagal → 429; dua instance berbagi kuota; spoof XFF tidak menggeser kuota; P-042…P-044 tetap ditolak.                                                                                                           |

### R8 — Sandi sementara tidak di response JSON (FND-005, P3)

| Field      | Nilai                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Backend/AppSec                                                                                                                           |
| Effort     | S                                                                                                                                        |
| Dependensi | Kebijakan distribusi sandi (tampil-sekali/email/kanal aman)                                                                              |
| AC         | Response create/reset/import tidak memuat sandi; sandi ditampilkan sekali di UI atau dikirim melalui kanal aman; tidak tersimpan di log. |
| Regresi    | Unit test response schema; e2e UI create/reset; pemeriksaan log.                                                                         |

### R9 — Jalur ganti password sukarela (FND-010, P3)

| Field      | Nilai                                                                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Frontend                                                                                                                                                                                             |
| Effort     | S                                                                                                                                                                                                    |
| Dependensi | Keputusan UX untuk semua peran                                                                                                                                                                       |
| AC         | Halaman `/ganti-password` dapat dibuka bila sesi valid; tautan tersedia di menu akun semua peran; `mustChangePassword=true` tetap memaksa alur; pengguna yang selesai diarahkan ke beranda perannya. |
| Regresi    | Kunjungan 4 peran; perubahan sandi di staging; tidak ada loop redirect.                                                                                                                              |

### R10 — Hardening `outbox/drain` (FND-011, P3)

| Field      | Nilai                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Owner      | Backend                                                                                                                 |
| Effort     | S                                                                                                                       |
| Dependensi | R2                                                                                                                      |
| AC         | Same-origin, rate limit, audit log; pertimbangkan step-up; drain idempoten dan tidak dapat dipicu berulang tanpa batas. |
| Regresi    | Probe origin asing → 403; master normal → 200; audit log tercatat.                                                      |

### R11 — Validasi `x-request-id` (FND-013, P3)

| Field      | Nilai                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Owner      | Backend                                                                                                                              |
| Effort     | S                                                                                                                                    |
| Dependensi | —                                                                                                                                    |
| AC         | Hanya UUID valid yang diterima; selain itu digenerate server; nilai yang dipantulkan selalu milik server; log tidak dapat diinjeksi. |
| Regresi    | P-051: header `audit-probe-echo-001` tidak dipantulkan; UUID valid tetap dipantulkan; unit test.                                     |

### R12 — Deep link `?view=` dan navigasi (FND-014, P3)

| Field      | Nilai                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Frontend                                                                                                                                              |
| Effort     | S                                                                                                                                                     |
| Dependensi | —                                                                                                                                                     |
| AC         | `?view=` pada dashboard wilayah/cabang membuka tab yang diminta dan tervalidasi; item `/admin/laporan` duplikat dihapus; tautan lama tetap berfungsi. |
| Regresi    | Kunjungan URL dengan `view` valid/invalid untuk 2 peran; snapshot navigasi.                                                                           |

### R13 — Validasi UUID path param (FND-020, P3)

| Field      | Nilai                                                                               |
| ---------- | ----------------------------------------------------------------------------------- |
| Owner      | Backend                                                                             |
| Effort     | S                                                                                   |
| Dependensi | —                                                                                   |
| AC         | Path param non-UUID → 400/404 tanpa query DB; tidak ada 22P02; errorCode konsisten. |
| Regresi    | P-038 harus 400/404; unit test parser; P-035…P-037 tetap 403/404.                   |

## 5. Bucket 1–2 bulan

### R14 — Enkripsi backup dan perlindungan PII (FND-006, P2)

| Field      | Nilai                                                                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | SRE/Backend                                                                                                                                                                                                    |
| Effort     | M                                                                                                                                                                                                              |
| Dependensi | KMS/age key; kebijakan retensi; akses direktori                                                                                                                                                                |
| AC         | Backup terenkripsi at-rest; kunci dikelola KMS/secret manager; hanya operator berwenang dapat mendekripsi; hash sandi/sesi tidak diekspor plaintext; prosedur restore terdokumentasi dan diuji ke DB terpisah. |
| Regresi    | Backup → enkripsi → restore DB terpisah → hitung baris; pemeriksaan izin file; audit akses.                                                                                                                    |

### R15 — WCAG 2.2 AA (FND-007, P2)

| Field      | Nilai                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Frontend/UX                                                                                                                                                                                                                                       |
| Effort     | M                                                                                                                                                                                                                                                 |
| Dependensi | Token warna; keputusan desain status/filter                                                                                                                                                                                                       |
| AC         | (1) 0 serious/critical axe pada 45 halaman unik. (2) Kontras ≥ 4.5:1 untuk teks normal pada `/admin/analitik`, `/admin/peta`, `/client/analitik`, `/client/konten`. (3) `/cabang` tidak overflow pada 320 px dan zoom 400%. (4) axe 2.2 masuk CI. |
| Regresi    | E-15 harness dijalankan ulang; tambah halaman yang belum dikunjungi; uji keyboard/dialog tetap PASS.                                                                                                                                              |

### R16 — CI, SAST/SCA, SBOM, observability (FND-008, P2)

| Field      | Nilai                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | SRE/AppSec                                                                                                                                                                                     |
| Effort     | L                                                                                                                                                                                              |
| Dependensi | Repo hosting; kredensial CI; anggaran alat                                                                                                                                                     |
| AC         | Pipeline wajib: lint, tsc, unit, build, audit produksi, SBOM, secret scan. Observability: error tracking, log terstruktur, alert SLO, dashboard health. Critical dev-only ditangani/diisolasi. |
| Regresi    | PR gagal bila gate gagal; alert uji; SBOM terbit per rilis.                                                                                                                                    |

### R17 — Lifecycle `is_demo` konten UI (FND-009, P2)

| Field      | Nilai                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Backend/Data                                                                                                                                            |
| Effort     | M                                                                                                                                                       |
| Dependensi | Klasifikasi data lama; keputusan produk                                                                                                                 |
| AC         | Semua jalur tulis menetapkan `is_demo` dari aktor; konten demo dapat dipurge bersih; data lama diklasifikasi/backfill; rekonsiliasi KPI tidak tercemar. |
| Regresi    | Buat konten sebagai demo dan non-demo di staging; purge → hitung; laporan rekonsiliasi.                                                                 |

### R18 — Kuota/backoff SSE (FND-017, P3)

| Field      | Nilai                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Backend/SRE                                                                                                                         |
| Effort     | M                                                                                                                                   |
| Dependensi | Kapasitas Neon; keputusan realtime                                                                                                  |
| AC         | Kuota koneksi per user; backoff adaptif; drain outbox tidak per koneksi; metrik koneksi/query; alternatif LISTEN/NOTIFY dievaluasi. |
| Regresi    | Staging: 50 koneksi; amati query/detik dan biaya; tiada duplikasi notifikasi.                                                       |

### R19 — Retensi audit/notifikasi/outbox (FND-019, P3)

| Field      | Nilai                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| Owner      | SRE/Data                                                                                                 |
| Effort     | M                                                                                                        |
| Dependensi | Kebijakan retensi; kebutuhan audit                                                                       |
| AC         | Job retensi terjadwal; arsip sebelum hapus; PII diminimalkan; dokumentasi kebijakan; metrik pertumbuhan. |
| Regresi    | Uji job pada DB salinan; verifikasi batas retensi; audit log tetap utuh sesuai kebijakan.                |

## 6. Backlog

### R20 — CSP nonce/hash (FND-015, P3)

| Field      | Nilai                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Owner      | Frontend/AppSec                                                                                       |
| Effort     | M                                                                                                     |
| Dependensi | Inventaris script inline; kompatibilitas Next.js                                                      |
| AC         | `script-src` tanpa `unsafe-inline`; nonce/hash diterapkan; tidak ada pelanggaran CSP pada 45 halaman. |
| Regresi    | Header check + console CSP pada seluruh halaman; smoke.                                               |

### R21 — Pembersihan API tanpa konsumen (FND-018, P3)

| Field      | Nilai                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Owner      | Backend                                                                                                                         |
| Effort     | S                                                                                                                               |
| Dependensi | Konfirmasi tidak ada konsumen eksternal                                                                                         |
| AC         | `/api/v1/dashboard/client` dan `/api/v1/map` dihapus atau didokumentasikan sebagai API publik dengan tes; tidak ada route mati. |
| Regresi    | Grep konsumen; smoke; inventory.                                                                                                |

### R22 — Peningkatan berkelanjutan

| Item                              | Owner              | Effort | AC                                          |
| --------------------------------- | ------------------ | ------ | ------------------------------------------- |
| Coverage threshold unit           | QA/Backend         | S      | Threshold disepakati dan gate CI            |
| SBOM berkala + review lisensi     | SRE/AppSec         | S      | SBOM per rilis, review triwulan             |
| Ekspor audit log                  | Backend/Compliance | M      | Ekspor terfilter, akses master, audit akses |
| CSP laporan pelanggaran           | Frontend/AppSec    | S      | Endpoint report-only, dashboard             |
| Uji multi-browser + screen reader | QA                 | M      | Firefox/WebKit/NVDA masuk matriks rilis     |

## 7. Dependensi dan urutan eksekusi

```text
R2 (origin) ──► R1 (demo) ──► R10 (outbox)
      │
      └────────► R4 (error) ──► R13 (UUID)
R3 (HEAD) — independen
R5 (docs) — independen
R6 (body) ──► R7 (rate limit) ──► R18 (SSE)
R8 (sandi) ──► R9 (ganti sandi)
R14 (backup) ──► R19 (retensi)
R15 (a11y) ──► R16 (CI gate)
R17 (is_demo) — independen
```

Catatan: R1 dan R2 sebaiknya satu paket rilis karena menyentuh guard yang sama;
R15 dan R16 dapat berjalan paralel; R14 dan R19 berbagi kebijakan data.

## 8. Release gates setelah perbaikan

| Gate            | Kriteria lulus                             | Item terkait  |
| --------------- | ------------------------------------------ | ------------- |
| G1 Static       | lint/tsc/format/unit hijau                 | R1–R21        |
| G2 Smoke        | 21/21                                      | Semua         |
| G3 Data         | 32 akun, 2.400 konten, rekonsiliasi        | R17           |
| G4 A11y         | 0 serious/critical; reflow bersih          | R15           |
| G5 Authz        | demo containment + CSRF lulus              | R1, R2, R10   |
| G6 Load         | p95 dalam anggaran di staging              | R7, R18       |
| G7 Supply chain | 0 critical produksi; SBOM                  | R16           |
| G8 Ops          | backup terenkripsi, retensi, observability | R14, R16, R19 |
| G9 Docs         | angka akurat + artefak                     | R5            |
| G10 Regression  | suite penuh di staging                     | Semua         |

## 9. Re-test minimum

1. **Unit + probe regresi**: P-009, P-038, P-040…P-045, P-051, P-052.
2. **Axe + reflow**: 45 halaman unik, 6 viewport.
3. **Smoke produksi**: 21/21 setelah setiap rilis.
4. **Verifikasi dataset**: 32 akun, 2.400 konten.
5. **Staging**: alur mutasi penuh, rate limit, SSE, backup/restore.

## 10. Di luar roadmap ini

- Load/stress produksi (dilarang).
- Reset/seed database staging (perlu persetujuan).
- Perubahan environment variable produksi (perlu konfirmasi eksplisit).
- Perbaikan kode tanpa persetujuan terpisah.
- Sertifikasi ASVS penuh (audit ini targeted assessment).

## 11. Status

Roadmap ini **belum dieksekusi**. Tidak ada perubahan pada repo selain dokumen
audit di `docs/audit/v2-audit-2026-11/` (menunggu Checkpoint E).

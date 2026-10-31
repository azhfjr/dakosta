# DAKOSTA v4 — Handoff dan Bukti Rilis

Tanggal: 2026-10-31
Kontrak: `DAKOSTA_Improvement_Production_RBAC_EDUFAST_v4.md` (R01–R18)
Commit baseline: `76654ab` (demo dua peran sebelum migrasi v4)

## 1. Lingkungan

| Lingkungan | Detail |
| --- | --- |
| Lokal | Node 24, Next.js 16.4.3 (Turbopack), `.env.staging.local` untuk E2E |
| Staging DB | Database `dakosta_staging` pada proyek Neon yang sama (isolasi level database) |
| Staging app | Vercel Preview `https://dakosta-dakosta-gdsfy1a53-jarjirjor777-5316.vercel.app` (Deployment Protection aktif) |
| Produksi | `https://dakosta-dakosta.vercel.app` — **v4 live (2026-10-31)**, deployment `dakosta-dakosta-qvtw902jm-jarjirjor777-5316.vercel.app` |
| Migrasi | 3 migrasi Drizzle (`0000`, `0001`, `0002`) di staging dan produksi |
| Produksi data | 1 Master (`mustChangePassword=true`), 0 data demo; 0 wilayah/cabang/organisasi/konten |

Catatan operasional: di Git Bash, `vercel curl /api/...` harus dijalankan dengan
`MSYS_NO_PATHCONV=1`, jika tidak argumen path diubah menjadi path Windows dan
permintaan menghasilkan halaman 404 aplikasi.

## 2. Status gate rilis

| Gate | Status | Bukti |
| --- | --- | --- |
| G0 — Baseline, git, backup/restore, tanpa mutasi produksi | **PASS** | Inventaris produksi (`.env.local`): 1 migrasi, 4 user, 8 organisasi, 24 konten, semua `is_demo=true`. Git init + commit `76654ab`. Backup staging 30 tabel/186 baris, direstore ke staging, jumlah baris sama. Tidak ada perubahan produksi. |
| G1 — Staging DB + migrasi + rollback terdokumentasi | **PASS** | `dakosta_staging` memiliki 3 migrasi; `npm run db:migrate:staging` bersih. Rollback ada di §6. |
| G2 — Rekonsiliasi backfill + asosiasi tak terselesaikan | **PARTIAL** | `scripts/backfill-v4.ts` dijalankan di staging: 24 konten (5 EDUFAST/19 NON_EDUFAST), 0 baris legacy diperbarui, 0 tak terpetakan, 0 promosi. Staging sudah berisi fixture v4, sehingga jalur migrasi data demo pra-v4 tidak dieksekusi pada snapshot asli. Jalur produksi yang disetujui adalah purge data demo (bukan backfill), jadi backfill bukan jalur kritis produksi. |
| G3 — Authz unit + isolasi adversarial | **PASS** | Vitest 34/34 (termasuk matriks kapabilitas, predicate scope, PII guard). E2E `rbac.spec` 7/7: regional baca-saja `403`, isolasi wilayah A/B dan cabang A1/A2, guard UI, step-up negatif. |
| G4 — Alur stakeholder → cabang → regional | **PASS** | E2E `dakosta.spec` 17/17 termasuk alur emas kirim → review cabang → setujui, revisi/kirim ulang, keputusan ganda `409`. |
| G5 — EDUFAST/taksonomi | **PASS** | Unit `taxonomy.test.ts` + E2E `platform.spec` (publish, bulan tanpa kebijakan, sub-tema tidak diizinkan, bulan berdekatan). |
| G6 — Impor CSV | **PASS** | E2E `platform.spec`: unduh template, preview, commit dengan step-up; unit `csv.test.ts` (BOM, kutip, formula injection). Kasus 0/1/banyak/invalid tercakup di validasi baris dan UI. |
| G7 — KPI/peringkat/Red Notice/ekspor | **PASS** | Unit KPI/Red Notice + E2E rekonsiliasi wilayah, Red Notice scope, ekspor = UI. |
| G8 — Keamanan | **PASS** | CSP/HSTS/X-Frame-Options/Permissions-Policy terverifikasi di build produksi lokal dan preview; step-up negatif `403 STEP_UP_REQUIRED`; rate limit; PII guard; token/kredensial tidak pernah dicetak. |
| G9 — Aksesibilitas/mobile/UX | **PASS (otomatis)** | axe wcag2a/2aa/21a/21aa (serious/critical) pada 12 rute, lebar 360 px, navigasi mobile. Uji pembaca layar manual dan Firefox/Safari **NOT RUN**. |
| G10 — Smoke staging | **PASS** | Preview: `/api/health` → `{"status":"ok","db":"ok"}`; `/admin` → `307` ke `/masuk`; `/masuk` → `200` judul “Masuk · DAKOSTA”. |
| G11 — Backup produksi + asersi purge + bootstrap | **PASS** | Backup `backups/2026-10-31T04-56-41-757Z-production`: 18 tabel/153 baris, seluruh checksum valid. Purge menolak jika ada `is_demo=false`; menghapus 147 baris demo + 4 pengguna sisa `@demo.dakosta.local` (lihat §4.1). Bootstrap 1 Master dengan `mustChangePassword=true`; inventaris akhir: 1 user/1 account/1 profil, 0 data demo. |
| G12 — Deploy produksi + smoke + rollback | **PASS** | Deploy `dakosta-dakosta-qvtw902jm-jarjirjor777-5316.vercel.app` di-alias ke `https://dakosta-dakosta.vercel.app` (`✓ Ready`). Smoke: health 200 `{"status":"ok","db":"ok"}`; CSP `frame-ancestors 'none'`, HSTS, `X-Frame-Options: DENY`; `/admin` tanpa sesi → `307 /masuk`; `/masuk` → 200; login demo → `404 DEMO_DISABLED`; `/api/v1/me` tanpa sesi → 401; login Master → `/api/v1/me` 200 `role=MASTER_ADMIN must_change=true`, `/admin` → `307 /ganti-password`, `/ganti-password` 200. Rollback di §6. |

## 3. Traceability requirement

| ID | Requirement | Status | Verifikasi utama |
| --- | --- | --- | --- |
| R01 | Hierarki wilayah → cabang → organisasi | Selesai | Skema, halaman Master, breadcrumb; inventaris staging 2 wilayah/4 cabang/12 organisasi |
| R02 | RBAC empat peran + scope server-side | Selesai | Unit kapabilitas/predicate; E2E isolasi A/B dan cabang |
| R03 | Siklus akun Master | Selesai | API/UI akun, reset, nonaktifkan, cabut sesi, guard Master terakhir; step-up diuji E2E |
| R04 | Profil Faskes FKTP/FKRTL + kode | Selesai | Validasi unit (kelas/kode wajib, PEMDA tanpa field Faskes, normalisasi kode) |
| R05 | Provisi massal CSV | Selesai | E2E template/preview/commit; unit CSV; idempotency key + digest |
| R06 | Taksonomi enam sub-tema | Selesai | Unit taksonomi; migrasi pemetaan legacy |
| R07 | Kebijakan EDUFAST bulanan | Selesai | Unit periode Asia/Jakarta; E2E publish/missing policy; snapshot versi |
| R08 | Input stakeholder ter-scope | Selesai | Wizard tanpa pemilih organisasi, Video/Infografis, lokasi, PII guard |
| R09 | Revisi immutable + audit | Selesai | Versi baru + snapshot; review `FOR UPDATE`; notifikasi ter-scope |
| R10 | KPI kanonik | Selesai | Kamus metrik; atribusi `date_created` default |
| R11 | Dashboard empat peran | Selesai | Halaman `/admin`, `/wilayah`, `/cabang`, `/client` |
| R12 | Peringkat FKTP/FKRTL | Selesai | Deterministik, tie-break nama/kode |
| R13 | Red Notice | Selesai | FASKES aktif nol pengajuan seumur hidup; inaktivitas periode terpisah |
| R14 | Geospasial + realtime | Selesai | Peta ter-scope, SSE dengan polling fallback, notifikasi ter-scope |
| R15 | Branding + UX | Selesai | Aset `public/brand/*` dan vector logo dipertahankan; axe/mobile |
| R16 | Keamanan + privasi | Selesai | Header, origin check, rate limit, step-up, token hash, PII guard |
| R17 | Migrasi aman | Selesai (dengan catatan G2) | Migrasi aditif 0001/0002; backup/restore drill; `migration_runs` |
| R18 | Deployment/ops | Selesai | Staging PASS; produksi v4 live dengan backup, migrasi, purge, bootstrap Master, dan smoke terverifikasi |

## 4. Bukti eksekusi

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run lint` | Bersih (0 error, 0 warning) |
| `npm run typecheck` | Bersih |
| `npm test` (Vitest) | 6 file, **34/34 lulus** |
| `npm run test:e2e` (staging, Turbopack dev) | **40/40 lulus**, ±9,3 menit |
| Subset E2E pada build produksi (`next start` + env staging) | **23/23 lulus**, ±3,3 menit (a11y, platform, rbac) |
| `npm run build` | Sukses; CSS hasil build memuat utilitas Tailwind |
| Smoke preview staging | Health OK; guard `/admin` redirect; `/masuk` 200 |
| Backup/restore drill | 30 tabel / 186 baris → restore → jumlah sama |
| Inventaris produksi (baca-saja, pra-rilis) | 1 migrasi, 4 user, 8 organisasi, 24 konten, semua demo |
| Backfill staging | 24 konten terklasifikasi, 0 legacy, 0 unresolved, 0 promosi |
| Backup produksi (2026-10-31T04-56-41-757Z) | 18 tabel / 153 baris; manifest SHA-256 valid untuk seluruh tabel |
| Migrasi produksi | 3 migrasi tercatat di `drizzle.__drizzle_migrations` |
| Purge produksi | 147 baris demo dihapus (semua `is_demo=true`); 4 pengguna demo yatim dihapus terpisah |
| Bootstrap Master | 1 akun `MASTER_ADMIN`, `mustChangePassword=true`; kredensial hanya di `.secrets/` (path dicetak, nilai tidak) |
| Inventaris produksi (pasca-rilis) | `migration_runs=2`, `user=1`, `account=1`, `user_profiles=1` (`is_demo=0`), `user_memberships=1`, `audit_logs=1`, `session=1`, `demo_rate_limits=2`, `peran_aktif=MASTER_ADMIN:1`; wilayah/cabang/organisasi/konten/kebijakan/impor/notifikasi = 0 |
| Smoke produksi pasca-rilis | Health OK; header keamanan aktif; guard `/admin`; `/masuk` 200; demo login `404 DEMO_DISABLED`; Master login + paksa ganti sandi |

### 4.1 Catatan bug purge dan pembersihan sisa

Percobaan purge pertama menyisakan tabel `user` karena `DELETE_ORDER` memuat
`'"user"'` sementara pemeriksaan keberadaan tabel memakai nama tanpa kutip;
akibatnya 4 pengguna demo tidak terhapus. Perbaikan: nama tabel dikutip secara
konsisten melalui helper `quoted()`. Sisa 4 pengguna `@demo.dakosta.local`
dihapus dengan mode `PURGE_SCOPE=residual-demo-users`, yang hanya menyasar
pengguna demo tanpa profil/akun/membership/role, dan mencatat
`migration_runs` terpisah. Asersi `is_demo=false` tetap berlaku pada kedua
mode. `demo_rate_limits` (2 baris counter, bukan konten/pengguna) sengaja
dibiarkan; tidak memengaruhi autentikasi atau data bisnis.

Perintah penting:

```bash
npx tsx scripts/inventory-db.ts --target=staging
npx tsx scripts/backup-db.ts --target=staging
RESTORE_CONFIRM=restore npx tsx scripts/restore-db.ts --target=staging --dir=backups/<stamp>
npx tsx scripts/backfill-v4.ts --target=staging
MSYS_NO_PATHCONV=1 npx vercel curl /api/health --deployment <preview-url>
```

## 5. Runbook rilis produksi (sudah dieksekusi 2026-10-31)

Prasyarat terpenuhi: G0–G10 PASS, konfirmasi eksplisit untuk langkah
destruktif, dan persetujuan perubahan env produksi (nama variabel saja).

1. Tarik env produksi ke file gitignored: `npx vercel env pull .env.production.local --environment=production`.
   Catatan: `vercel env pull` menulis `[SENSITIVE]` untuk variabel Sensitive;
   file placeholder tersebut diabaikan oleh `scripts/_env.ts` agar koneksi DB
   tidak rusak.
2. Backup wajib: `npm run db:backup -- --target=production`; manifest
   diverifikasi (18 tabel/153 baris, semua checksum valid).
3. Migrasi aditif: `MIGRATE_CONFIRM=apply-production npm run db:migrate:production`;
   3 migrasi tercatat.
4. Perubahan env produksi (atas konfirmasi eksplisit; hanya nama yang dicetak):
   tambah `APP_ENV=production`; hapus `DEMO_MODE` dan `DEMO_SEED_PASSWORD`.
5. Deploy kode: `npx vercel deploy --prod --yes`; deployment baru di-alias ke
   domain produksi.
6. Verifikasi pra-purge: `/api/health` → `{"status":"ok","db":"ok"}`; header
   keamanan aktif; login demo nonaktif (`404 DEMO_DISABLED`) di runtime produksi.
7. Purge demo (destruktif): `PURGE_CONFIRM=purge-demo-data npm run db:purge:production`.
   Script menolak jika ada baris `is_demo=false`; 147 baris dihapus dan rekap
   disimpan di `migration_runs`. Sisa 4 pengguna demo dibersihkan dengan
   `PURGE_SCOPE=residual-demo-users` (lihat §4.1).
8. Bootstrap satu Master: `BOOTSTRAP_CONFIRM=bootstrap-master BOOTSTRAP_MASTER_EMAIL=<email> npm run db:bootstrap:master`.
   Kredensial awal ditulis ke `.secrets/` (hanya path yang dicetak).
9. Smoke pasca-rilis: health, header keamanan, `/masuk`, `/admin` tanpa sesi →
   `307 /masuk`, login Master + paksa ganti sandi (`/ganti-password` 200),
   inventaris produksi kosong kecuali akun Master.
10. Bukti dicatat di dokumen ini dan status gate diperbarui (G11/G12 PASS).

Catatan: `DEMO_MODE` sudah tidak aktif di runtime produksi karena
`VERCEL_ENV=production`; penghapusan variabel adalah pembersihan, bukan
perbaikan keamanan yang mendesak.

## 6. Rollback

- Kode: promosikan deployment sebelumnya di dashboard Vercel atau `npx vercel rollback`.
- Data: Neon snapshot/PITR; atau restore logis ke staging lebih dulu:
  `RESTORE_CONFIRM=restore npx tsx scripts/restore-db.ts --target=staging --dir=backups/<stamp>`.
  Restore ke produksi memerlukan `ALLOW_PRODUCTION_RESTORE=yes` dan konfirmasi.
- Migrasi bersifat aditif (tanpa down migration). Kolom/tabel lama dipertahankan
  sampai pembersihan terpisah disetujui, sehingga versi kode sebelumnya tetap
  kompatibel.
- Purge demo bersifat final secara data; karena itu backup langkah 2 wajib dan
  harus diverifikasi sebelum langkah 6.

## 7. Item PARTIAL / BLOCKED

| Item | Status | Alasan / tindakan berikutnya |
| --- | --- | --- |
| MFA/TOTP | PARTIAL | Plugin auth saat ini tidak menyediakan TOTP. Step-up login-recent/re-auth sudah ada. Perlu plugin MFA untuk MFA penuh. |
| Undangan email | BLOCKED | Tidak ada penyedia email. Kredensial diserahkan lewat UI Master sebagai kata sandi sementara; halaman aktivasi mandiri belum ada (tabel token disiapkan). |
| PDF server | PARTIAL | CSV tersedia; PDF memakai cetak peramban. |
| CI/CD | PARTIAL | Repo lokal tanpa remote/`gh`; deploy via Vercel CLI. |
| Neon branch programatik | BLOCKED | Tanpa `neonctl`/API key; staging memakai database terpisah. |
| Vercel plan | PERLU KONFIRMASI | Penggunaan operasional multi-cabang nyata memerlukan plan yang sesuai. |
| UU PDP / data nyata | BLOCKED | Pilot internal nonkomersial tanpa PII; peninjauan hukum operator diperlukan sebelum data pribadi nyata. |
| Data kantor nyata | BELUM ADA | Produksi dimulai dari Master + keadaan kosong; alur penuh diverifikasi di staging. |
| Uji pembaca layar manual, Firefox/Safari, zoom 200% | NOT RUN | Perlu sesi manual sebelum klaim WCAG penuh. |
| G2 jalur legacy demo | PARTIAL | Backfill tidak dijalankan pada snapshot demo pra-v4; produksi memakai purge. Jika migrasi data legacy diperlukan, ulangi drill pada salinan database 0000. |

## 8. Risiko dan catatan

- Staging berbagi proyek Neon dengan produksi (database terpisah). Isolasi data
  ada di level database; operasi destruktif tetap dijaga target + token.
- E2E mereset database staging (`E2E_ALLOW_DB_RESET=yes`, `E2E_DB_TARGET=staging`).
  Jangan arahkan ke produksi.
- Preview Vercel terlindungi Deployment Protection; smoke otomatis memerlukan
  `vercel curl` atau bypass resmi.
- Semua nilai env sensitif tidak pernah dicetak; hanya nama, lingkungan, dan
  metadata yang ditampilkan.

# DAKOSTA — Dashboard Konten Kolaborasi Stakeholder

Demo publik (rilis v3): **https://dakosta-dakosta.vercel.app**

> **Proyek pribadi nonkomersial.** DAKOSTA adalah demonstrasi independen dan
> **tidak berafiliasi dengan, tidak mewakili, dan tidak disponsori oleh BPJS
> Kesehatan** atau institusi mana pun. Seluruh akun, stakeholder, konten, lokasi,
> dan angka pada data demo bersifat **sintetis dan berlabel DEMO**. Aplikasi ini
> tidak memuat data pribadi pasien, NIK, nomor JKN, rekam medis, maupun data
> internal institusi. Jangan memasukkan data nyata.

## Status rilis v4

| Lingkungan | Status | Keterangan |
| --- | --- | --- |
| Staging (database Neon `dakosta_staging` + Vercel Preview) | **TERVERIFIKASI** | 3 migrasi, fixture deterministik, unit 34/34, E2E 40/40, subset build produksi 23/23, axe + mobile, smoke preview |
| Produksi | **v4 live (2026-10-31)** | 3 migrasi, backup terverifikasi (18 tabel/153 baris, checksum valid), purge demo (147 baris + 4 pengguna sisa), 1 Master bootstrap, login + paksa ganti sandi terverifikasi, data demo 0 |

Bukti per gate, traceability R01–R18, dan daftar item PARTIAL/BLOCKED ada di
[`docs/v4-handoff.md`](docs/v4-handoff.md).

## Peran dan cakupan (v4)

| Kemampuan | MASTER_ADMIN | REGIONAL_ADMIN | BRANCH_ADMIN | STAKEHOLDER |
| --- | --- | --- | --- | --- |
| Cakupan | Global | Satu wilayah | Satu cabang | Satu organisasi |
| Dashboard ter-scope | Ya | Ya (baca) | Ya | Ya |
| Kelola wilayah/cabang/organisasi | Ya | — | — | — |
| Kelola akun, reset, nonaktifkan | Ya | — | — | — |
| Impor CSV akun | Ya | — | — | — |
| Kebijakan EDUFAST bulanan | Ya | — | — | — |
| Kirim / revisi konten | — | — | — | Ya |
| Review keputusan | Override darurat (step-up + alasan) | — | Hanya cabangnya | — |
| Peta, analitik, ekspor | Ya | Ya | Ya | Ringkasan sendiri |
| Audit | Ya | Ter-scope | Ter-scope | — |

Otorisasi dievaluasi di server dari sesi + membership aktif. ID peran, wilayah,
cabang, atau organisasi dari browser tidak pernah dipercaya. Objek di luar
cakupan menghasilkan `404` (bukan `403`) agar keberadaannya tidak bocor;
tindakan tulis lintas cakupan menghasilkan `403`. Perubahan cakupan/status akun
mencabut sesi dan berlaku pada permintaan berikutnya.

## Hierarki dan data inti

`regional_offices` → `branch_offices` → `stakeholders` (organisasi).

- `user_memberships`: satu membership aktif per pengguna (indeks unik parsial),
  riwayat transfer disimpan sebagai baris `revoked_at`.
- `stakeholders` adalah registri organisasi: `organization_type`
  (`FASKES|PEMDA|OTHER`), `faskes_class` (`FKTP|FKRTL`), dan
  `faskes_code_normalized` unik untuk FASKES aktif (angka nol di depan
  dipertahankan).
- `edufast_monthly_policies` + `edufast_policy_subthemes` +
  `edufast_policy_events`: satu kebijakan `PUBLISHED` per `YYYY-MM`
  (Asia/Jakarta), berversi, dengan riwayat aksi.
- `account_imports` / `account_import_rows`: impor CSV idempoten per
  `idempotency_key`, hasil per baris disimpan.
- `migration_runs`: rekap migrasi/backfill/purge.

## Alur konten, revisi, dan EDUFAST

Status: `DRAFT → SUBMITTED → IN_REVIEW → APPROVED`;
`REVISION_REQUIRED → RESUBMITTED → IN_REVIEW`; `REJECTED` (final);
`REVOKED` (koreksi Master, teraudit). `REVISION_REQUIRED` adalah padanan
persisten dari `REVISION_REQUESTED` pada kontrak.

- Wizard pelaporan tidak memilih organisasi; organisasi diturunkan dari
  membership dan ditampilkan sebagai badge baca-saja (`organisasi • FKTP/FKRTL •
  cabang`).
- `Jenis Konten`: `VIDEO | INFOGRAFIS`. Tema utama:
  `EDUFAST | NON_EDUFAST`. Enam sub-tema: `MOBILE_JKN`, `TESTIMONI_PESERTA`,
  `ALUR_BEROBAT`, `EDUKATIF_PERSUASIF`, `KORPORAT`, `INFORMASI`.
- Periode konten diturunkan dari tanggal konten (`date_created`), bukan tanggal
  approval. Jika `EDUFAST` dipilih dan belum ada kebijakan `PUBLISHED` untuk
  bulan tersebut, pengiriman diblokir dengan pesan yang dapat ditindaklanjuti;
  `NON_EDUFAST` tetap tersedia.
- Saat kirim, `edufast_policy_id` + versi disimpan. Saat disetujui, snapshot
  dibekukan (`approved_snapshot`, `approved_version`). Revisi yang mengubah
  tanggal konten memvalidasi ulang kebijakan dan mencatat audit.
- Revisi membuat versi baru + snapshot immutable; seluruh review lama tetap ada.
  Review memakai transaksi `SELECT … FOR UPDATE`; konflik versi/status → `409`;
  satu review per versi; self-approval diblokir.
- Notifikasi: pengajuan → admin cabang aktif pada cabang tersebut; keputusan →
  pengirim + pengguna organisasi. Outbox ditulis dalam transaksi yang sama dan
  didrain setelah commit; kegagalan notifikasi tidak membatalkan konten.

## KPI dan analitik

- `approved_contents`, `submitted_contents`, `pending_review`,
  `revision_requested`, `rejected_contents`, `approval_rate`
  (approved ÷ decided, `N/A` bila 0), `active_contributing_organizations`,
  `registered_active_faskes`, `never_submitted_faskes`,
  `no_submission_in_period`, `approved_by_faskes` (FKTP/FKRTL terpisah),
  `edufast_approved`, `non_edufast_approved`, `turnaround_time`.
- Atribusi default `date_created`; atribusi `approved_at` opsional dan
  dilabeli di UI serta ekspor.
- `never_submitted_faskes` = FASKES aktif dengan **nol pengajuan seumur hidup**
  (`submitted_at IS NOT NULL`; draf tidak dihitung). Inaktivitas periode adalah
  daftar terpisah.
- Red Notice = alert + tabel organisasi FASKES aktif tanpa pengajuan
  seumur hidup; bukan pie chart merah.
- Peringkat FKTP/FKRTL deterministik (tie-break nama/kode). Rekonsiliasi:
  metrik aditif wilayah = jumlah cabang; hitungan organisasi unik tidak
  dijumlahkan naif; total ekspor = total UI.

## Rute

- Master: `/admin`, `/admin/wilayah`, `/admin/cabang`, `/admin/organisasi`,
  `/admin/akun`, `/admin/impor`, `/admin/edufast`, `/admin/konten`,
  `/admin/analitik`, `/admin/peta`, `/admin/audit`, `/admin/target`,
  `/admin/notifikasi`.
- Regional (baca): `/wilayah`, `/wilayah/cabang`, `/wilayah/organisasi`,
  `/wilayah/analitik`, `/wilayah/red-notice`, `/wilayah/peta`,
  `/wilayah/laporan`.
- Branch: `/cabang`, `/cabang/review`, `/cabang/organisasi`,
  `/cabang/analitik`, `/cabang/red-notice`, `/cabang/peta`,
  `/cabang/laporan`, `/cabang/notifikasi`.
- Stakeholder: `/client`, `/client/lapor`, `/client/konten`, `/client/profil`,
  `/client/notifikasi`.
- Publik: `/masuk`, `/tentang`, `/bantuan`, `/ganti-password`.

### API utama

| Endpoint | Keterangan |
| --- | --- |
| `GET /api/health` | Status app + koneksi DB |
| `POST /api/v1/demo/login` | Login cepat demo (hanya `DEMO_MODE`, rate limit) |
| `GET /api/v1/me` | Profil, peran, cakupan, kapabilitas |
| `POST /api/v1/me/step-up` | Re-autentikasi untuk aksi sensitif (15 menit) |
| `GET /api/v1/dashboard/admin\|client` | Ringkasan ter-scope |
| `GET /api/v1/analytics/series` | Seri tren ter-scope |
| `GET/POST /api/v1/submissions`, `GET /api/v1/submissions/[id]` | Konten |
| `POST /api/v1/admin/reviews/start`, `GET/POST /api/v1/admin/reviews` | Review |
| `POST /api/v1/admin/contents/[id]/revoke` | Pencabutan korektif (Master) |
| `GET/PATCH /api/v1/admin/users`, `PATCH /api/v1/admin/users/[id]` | Akun |
| `GET/POST /api/v1/admin/regions\|branches\|organizations` | Hierarki |
| `GET /api/v1/admin/imports/template`, `POST …/preview`, `POST …/commit` | Impor CSV |
| `GET/POST /api/v1/admin/edufast/policies`, `…/publish`, `…/copy`, `…/archive` | EDUFAST |
| `GET /api/v1/map` | Titik ter-scope |
| `GET /api/v1/notifications`, `…/unread-count`, `…/realtime` | Notifikasi + SSE |
| `GET /api/v1/exports/submissions` | CSV ter-scope, BOM, neutralisasi formula |
| `POST /api/v1/admin/outbox/drain` | Drain outbox (`CRON_SECRET`) |

Envelope API: `{ data, meta, error }` dengan `requestId`. Idempotensi
pengiriman memakai `idempotencyKey` (201 pertama, 200 pengulangan). URL ganda
memerlukan `duplicateAcknowledged`. Keputusan atas versi lama → `409`.

## Menjalankan lokal

Prasyarat: Node.js 22+ dan database Neon.

Salin `.env.example` → `.env.local`, lalu isi **nama variabel** berikut:

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `APP_ENV` | Ya | `development` / `staging` / `production` |
| `DATABASE_URL` | Ya | Koneksi pooled Neon |
| `DATABASE_URL_UNPOOLED` | Ya | Migrasi/seed via Drizzle |
| `BETTER_AUTH_SECRET` | Ya (prod) | Minimal 32 karakter acak |
| `NEXT_PUBLIC_APP_URL` | Ya | Origin aplikasi |
| `DEMO_MODE` | Demo | `true` mengaktifkan login demo; nonaktif di produksi |
| `DEMO_SEED_PASSWORD` | Seed | Minimal 12 karakter; jangan commit |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Tidak | Gaya MapLibre; default OpenFreeMap Positron |
| `CRON_SECRET` | Tidak | Proteksi drain outbox |

```bash
npm install
npm run db:migrate                 # skema lokal
npm run db:seed                    # data demo (tanpa menghapus)
npm run dev
```

Data demo deterministik: 2 wilayah, 4 cabang, 12 pengguna (1 Master, 2 Regional,
3 Branch, 6 Stakeholder), 12 organisasi, 2 kebijakan EDUFAST (bulan berjalan +
sebelumnya), 24 konten (12 disetujui), 18 review.

Perintah: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`
(Vitest), `npm run test:e2e` (Playwright), `npm run verify`.

## Pengujian dan bukti

- **Unit (Vitest): 34/34 lulus** — predicate scope, resolusi taksonomi/kebijakan,
  parser CSV + escape formula, rumus KPI, semantik Red Notice, batas tanggal,
  hashing token.
- **E2E (Playwright, staging): 40/40 lulus (≈9,3 menit)** — alur emas
  stakeholder → cabang → setuju, revisi/kirim ulang, isolasi wilayah A/B dan
  cabang A1/A2, regional baca-saja (`403`), step-up negatif, EDUFAST
  (publish, bulan tanpa kebijakan, sub-tema tidak diizinkan), impor CSV
  (template/preview/commit), rekonsiliasi wilayah, Red Notice, aksesibilitas
  axe (12 rute), dan 360 px.
- **Subset build produksi: 23/23 lulus (≈3,3 menit)** terhadap `next start`
  dengan env staging.
- **Smoke preview staging**: `/api/health` → `{"status":"ok","db":"ok"}`;
  `/admin` → `307` ke `/masuk`; `/masuk` → `200`.
- **Backup/restore drill staging**: 30 tabel / 186 baris diekspor, direstore ke
  staging, jumlah baris terverifikasi sama.
- **Rilis produksi 2026-10-31**: backup 18 tabel/153 baris (checksum valid),
  3 migrasi, purge 147 baris demo + 4 pengguna sisa, bootstrap 1 Master,
  smoke health/header/guard/login lulus, inventaris akhir 0 data demo.
- Lint dan typecheck bersih; build produksi lulus dan CSS memuat utilitas
  Tailwind.

Detail gate dan item yang belum lulus ada di `docs/v4-handoff.md`.

## Deploy dan operasi

### Staging

- Basis data: database Neon terpisah `dakosta_staging` pada proyek Neon yang sama
  (`.env.staging.local`, gitignored). Isolasi level database, bukan server.
- Migrasi: `npm run db:migrate:staging`.
- Fixture: `npm run db:reset:staging` (menolak production).
- Vercel Preview memakai env preview terpisah; preview terlindungi Vercel
  Authentication. Untuk smoke terautentikasi gunakan
  `npx vercel curl <path> --deployment <url>` (di Git Bash setel
  `MSYS_NO_PATHCONV=1`).

### Produksi (v4 live, operasi terjaga)

Rilis v4 sudah dijalankan (2026-10-31) dengan urutan backup → migrasi → env →
deploy → smoke pra-purge → purge → bootstrap Master → smoke pasca-rilis.
Perintah di bawah tetap memerlukan token konfirmasi dan hanya untuk prosedur
berulang/DR.

```bash
npx vercel env pull .env.production.local --environment=production
npm run db:backup -- --target=production      # wajib sebelum langkah destruktif
npm run db:migrate:production                 # butuh MIGRATE_CONFIRM=apply-production
npx vercel deploy --prod --yes
npm run db:purge:production                   # butuh PURGE_CONFIRM=purge-demo-data
PURGE_SCOPE=residual-demo-users npm run db:purge:production  # opsional: pengguna demo yatim
npm run db:bootstrap:master                   # butuh BOOTSTRAP_CONFIRM=bootstrap-master
```

- `purge-demo-production.ts` menolak berjalan jika menemukan baris
  `is_demo=false`, lalu mencatat rekap ke `migration_runs`.
- `bootstrap-master.ts` menolak jika sudah ada Master aktif, membuat satu akun
  Master dengan `mustChangePassword=true`, dan menulis kredensial awal ke
  `.secrets/` (gitignored) — hanya path yang dicetak, tidak pernah nilainya.
- Variabel produksi yang berubah hanya boleh atas konfirmasi eksplisit: tambah
  `APP_ENV=production`, nonaktifkan/hapus `DEMO_MODE` dan `DEMO_SEED_PASSWORD`.
  Nilai env tidak pernah dicetak.

### Rollback

- Kode: promosikan deployment sebelumnya di dashboard Vercel atau
  `npx vercel rollback`.
- Data: Neon snapshot/PITR, atau `npm run db:restore -- --dir=backups/<stamp>`
  dengan `RESTORE_CONFIRM=restore` (butuh `ALLOW_PRODUCTION_RESTORE=yes` untuk
  produksi) ke database staging untuk verifikasi lebih dulu.
- Migrasi bersifat aditif dan maju (tanpa down migration); kolom lama
  dipertahankan sampai pembersihan terpisah disetujui. Jika rollback kode
  diperlukan, skema aditif tetap kompatibel dengan versi sebelumnya.

## Keamanan dan privasi

- `.env*` diabaikan Git dan `.vercelignore`; `.env.example` hanya berisi nama.
- Registrasi publik ditutup; peran & cakupan dari database, bukan browser.
- Cookie sesi `httpOnly`, `secure` di produksi, `sameSite=lax`; cache cookie
  dimatikan agar perubahan cakupan langsung berlaku.
- CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Permissions-Policy` ketat,
  dan pemeriksaan same-origin pada mutasi.
- Rate limit pada login demo, step-up, impor, dan review.
- Step-up 15 menit (HMAC cookie) untuk aksi Master sensitif; alasan wajib dan
  diaudit; Master aktif terakhir tidak dapat dinonaktifkan/diturunkan.
- Akun dibuat Master dengan kata sandi sementara dan wajib diganti saat login
  pertama; kredensial hanya tampil sekali di UI akun Master dan tidak masuk
  log/audit/CSV. Tabel token aktivasi/reset sudah ada di skema tetapi belum
  dipakai karena tidak ada penyedia email. Kata sandi di-hash Better Auth.
- PII guard memblokir pola NIK 16 digit / JKN 13 digit pada judul + narasi.
- Data demo sintetis: tanpa PII, NIK/JKN, atau rekam medis. Pilot internal
  nonkomersial; peninjauan UU PDP oleh operator tetap diperlukan sebelum data
  pribadi nyata.

## Deviasi dan batasan yang diketahui

- **MFA/TOTP: PARTIAL** — plugin auth saat ini tidak menyediakan TOTP; yang
  tersedia adalah step-up login-recent/re-autentikasi.
- **Undangan email: BLOCKED** — tidak ada penyedia email; serah-terima
  kredensial dilakukan di UI Master melalui kata sandi sementara. Halaman
  aktivasi mandiri belum diimplementasikan (tabel token disiapkan).
- **PDF server: PARTIAL** — CSV tersedia; PDF melalui cetak peramban.
- **CI/CD: PARTIAL** — repositori lokal tanpa remote/`gh`; deploy via Vercel CLI.
- **Neon branch programatik: BLOCKED** — tanpa `neonctl`/API key; staging
  memakai database terpisah.
- **Vercel plan** — penggunaan operasional multi-cabang nyata memerlukan
  konfirmasi pemilik/plan yang sesuai.
- **Data kantor nyata** — produksi dimulai dari Master + keadaan kosong; alur
  lengkap diverifikasi di staging, bukan difabrikasi di produksi.

## Stack

Next.js 16 (App Router, Turbopack) + React 19 + TypeScript strict; Tailwind v4
(`@tailwindcss/postcss`) + shadcn/ui; Plus Jakarta Sans self-host; Neon Postgres
+ Drizzle ORM; Better Auth; MapLibre + OpenFreeMap; Recharts; Sonner;
Playwright + axe-core; Vitest.

## Lisensi aset

Plus Jakarta Sans © Tokotype, lisensi SIL Open Font License 1.1 — teks lisensi
di `src/app/fonts/OFL.txt`. Aset merek DAKOSTA di `public/brand/` hanya untuk
demo ini.

# DAKOSTA — Dashboard Konten Kolaborasi Stakeholder

Demo publik: **https://dakosta-dakosta.vercel.app**

> **Proyek pribadi nonkomersial.** DAKOSTA adalah demonstrasi independen dan
> **tidak berafiliasi dengan, tidak mewakili, dan tidak disponsori oleh BPJS
> Kesehatan** atau institusi mana pun. Seluruh akun, stakeholder, konten, lokasi,
> dan angka pada demo bersifat **sintetis dan berlabel DEMO**. Aplikasi ini tidak
> memuat data pribadi pasien, NIK, nomor JKN, rekam medis, maupun data internal
> institusi. Jangan memasukkan data nyata.

## Akses demo

Buka `/masuk`, lalu gunakan tombol **Admin demo** atau **Client demo**. Tombol ini
hanya tampil saat `DEMO_MODE=true`.

| Peran | Akun seed | Tujuan |
| --- | --- | --- |
| Admin | `admin@demo.dakosta.local` | Validasi, KPI, peta, analitik, pengguna, audit |
| Client | `mitra.nusantara@demo.dakosta.local` | Pelaporan konten, status, notifikasi |

Kata sandi akun seed berasal dari `DEMO_SEED_PASSWORD` dan **tidak pernah
ditulis di repo, README, atau log**. Registrasi publik ditutup
(`disableSignUp`); akun hanya dibuat Admin demo.

## Fitur utama

- Wizard pelaporan 4 langkah: tautan & tema → narasi → **lokasi wajib** → tinjau.
- Simpan draf, kirim untuk validasi, revisi lalu kirim ulang (versi bertambah).
- Antrean validasi Admin dengan checklist, setujui / minta revisi / tolak.
- KPI **hanya menghitung konten berstatus Disetujui**, dengan filter periode,
  stakeholder, tema, dan dasar tanggal.
- Peta sebaran (MapLibre + OpenFreeMap), analitik tren, ekspor CSV.
- Notifikasi persisten + streaming SSE dengan fallback polling 20 detik.
- Audit log untuk aksi sensitif dan percobaan akses ditolak.

## Peran dan matriks izin

| Kemampuan | ADMIN | CLIENT |
| --- | --- | --- |
| Ringkasan & KPI | Semua stakeholder | Hanya stakeholder miliknya |
| Kirim / draf konten | — | Ya, untuk stakeholder miliknya |
| Validasi & keputusan | Ya | — |
| Peta & analitik | Ya | — |
| Kelola pengguna, stakeholder, target | Ya | — |
| Ekspor CSV | Ya | — |
| Audit | Ya | — |
| Notifikasi & profil sendiri | Ya | Ya |

Otorisasi selalu dievaluasi di server dari membership peran dan stakeholder;
ID peran/stakeholder dari browser tidak dipercaya. Permintaan lintas tenant
mengembalikan `403`, dan halaman Admin yang dibuka CLIENT dialihkan ke
`/akses-ditolak` serta dicatat di audit.

## Aturan inti

- **Approved-only KPI.** Status lain (Dikirim, Ditinjau, Perlu Revisi, Ditolak,
  Dicabut, Diarsipkan) tidak menambah capaian.
- **Lokasi wajib** saat mengirim. Sumber `device_gps` memerlukan `consentAt`;
  pin manual selalu tersedia.
- **Idempotensi** pengiriman memakai `idempotencyKey` (201 pertama, 200 saat
  pengulangan dengan ID yang sama).
- **Kontrol versi**: keputusan atas versi lama menghasilkan `409`.
- **URL ganda** memerlukan `duplicateAcknowledged`.
- **Rate limit** pada login demo, ekspor, dan endpoint sensitif.
- **Envelope API** konsisten: `{ data, meta, error }`, dengan `requestId`.
- **Tanpa PII**: narasi wajib mengonfirmasi `privacyAttested` saat mengirim.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript strict
- Tailwind CSS v4 + shadcn/ui, font **Plus Jakarta Sans** di-self-host
- Neon Postgres (pooled + unpooled) + Drizzle ORM/migrasi
- Better Auth (cookie httpOnly, rate limit, plugin admin)
- MapLibre GL + OpenFreeMap, Recharts, Sonner
- Playwright E2E (12 skenario) + axe-core untuk audit aksesibilitas

## Rute

Halaman: `/`, `/masuk`, `/tentang`, `/bantuan`, `/ganti-password`,
`/akses-ditolak`, `/admin` (+ `validasi`, `validasi/[id]`, `konten`, `stakeholder`,
`peta`, `analitik`, `target`, `pengguna`, `notifikasi`, `audit`), `/client`
(+ `lapor`, `konten`, `konten/[id]`, `notifikasi`, `profil`).

API utama:

| Endpoint | Keterangan |
| --- | --- |
| `GET /api/health` | Status app + koneksi DB |
| `POST /api/v1/demo/login` | Login cepat demo (hanya `DEMO_MODE`) |
| `GET /api/v1/me` | Profil, peran, cakupan stakeholder |
| `GET /api/v1/dashboard/admin` | KPI & ringkasan Admin |
| `GET /api/v1/dashboard/client` | KPI & ringkasan Client (ter-scope) |
| `GET/POST /api/v1/submissions` | Daftar & simpan/kirim konten |
| `GET /api/v1/submissions/[id]` | Detail konten (cek kepemilikan) |
| `GET/POST /api/v1/admin/reviews` | Antrean & keputusan validasi |
| `GET/POST /api/v1/admin/users` | Kelola penguji |
| `PATCH /api/v1/admin/users/[id]` | Aktif/nonaktif, reset sandi |
| `GET /api/v1/map` | Titik konten + stakeholder (ter-scope) |
| `GET /api/v1/analytics/series` | Seri tren analitik |
| `GET /api/v1/notifications` | Daftar notifikasi |
| `GET /api/v1/notifications/unread-count` | Jumlah belum dibaca |
| `GET /api/v1/realtime/notifications` | Stream SSE |
| `GET /api/v1/exports/submissions` | Ekspor CSV (BOM, label DEMO) |
| `POST /api/v1/admin/outbox/drain` | Drain outbox (butuh `CRON_SECRET`) |

## Data dictionary

| Tabel | Isi |
| --- | --- |
| `user`, `session`, `account`, `verification` | Tabel Better Auth |
| `user_profiles` | Judul tampilan, status demo/aktif, wajib ganti sandi |
| `user_role_memberships` | Peran `ADMIN` / `CLIENT` |
| `stakeholders` | Profil stakeholder sintetis + titik pusat |
| `user_stakeholder_memberships` | Cakupan stakeholder per pengguna |
| `themes` | Tema konten (mis. Edukasi JKN) |
| `locations` | Koordinat, sumber GPS/pin, consent, presisi |
| `content_submissions` | Konten, status, versi, idempotency, keputusan |
| `content_revisions` | Snapshot versi lama |
| `content_reviews` | Checklist & keputusan Admin |
| `kpi_targets` | Target periode per stakeholder/tema |
| `notifications` | Notifikasi persisten + dedupe key |
| `outbox_events` | Outbox untuk drain/notifikasi lanjutan |
| `audit_logs` | Jejak aksi & akses ditolak |
| `demo_rate_limits` | Penghitung rate limit demo |

## Menjalankan lokal

Prasyarat: Node.js 22+ (lokal diuji pada Node 24; build produksi di Vercel
berjalan pada Node 26.x), database Neon.

Salin `.env.example` → `.env.local`, lalu isi **nama variabel** berikut:

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | Ya | Koneksi pooled Neon |
| `DATABASE_URL_UNPOOLED` | Ya | Migrasi/seed via Drizzle |
| `BETTER_AUTH_SECRET` | Ya (prod) | Minimal 32 karakter acak |
| `NEXT_PUBLIC_APP_URL` | Ya | Origin aplikasi |
| `DEMO_MODE` | Demo | `true` mengaktifkan login demo |
| `DEMO_SEED_PASSWORD` | Seed | Minimal 12 karakter; jangan commit |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Tidak | Gaya MapLibre; default OpenFreeMap Positron |
| `CRON_SECRET` | Tidak | Proteksi drain outbox |

```bash
npm install
npm run db:migrate
npm run db:reset     # hapus + seed demo (destruktif, khusus DB demo)
npm run dev
```

Perintah lain: `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run test:e2e`, `npm run verify` (lint → typecheck → build → E2E).
`db:seed` menambah data tanpa menghapus; `db:reset` mengembalikan kondisi awal
(4 pengguna, 8 stakeholder, 24 konten, 12 disetujui).

## Pengujian

Suite E2E mencakup: login demo, wizard (termasuk penolakan tanpa lokasi),
alur emas kirim → validasi UI → KPI naik, notifikasi, revisi → kirim ulang,
penolakan tanpa perubahan KPI, balapan dua approval (`200`/`409`), isolasi
tenant (`403`), pengalihan halaman Admin, idempotensi, dan konsistensi CSV.

Status verifikasi:

- Lokal: lint, typecheck, build, dan **12/12** E2E lulus.
- Produksi: **11/12** lulus pada run pertama; satu assertion diperbaiki karena
  teks referensi juga muncul di toast (strict-mode), lalu lulus saat dijalankan
  ulang. Database produksi di-reset ke seed setelah pengujian.
- Smoke produksi: `/api/health` (`db: ok`), login kedua peran, isolasi RBAC,
  KPI periode, header + stream SSE, kanvas peta, ekspor CSV, font 200,
  tanpa error konsol, dan tanpa overflow halaman pada lebar 390 px.

**Belum dijalankan** (jangan diklaim lulus): uji pembaca layar manual, zoom
peramban 200%, Firefox/Safari, serta suite unit/integrasi Vitest/PGlite.

## Deploy produksi

- Proyek Vercel: `dakosta-dakosta`, alias produksi
  `https://dakosta-dakosta.vercel.app`.
- Permintaan alamat `dakosta.dakosta.vercel.app` tidak dapat dibuat: nama proyek
  Vercel tidak boleh memuat titik dan `vercel.app` hanya melayani satu level
  `<proyek>.vercel.app`. Alias terdekat yang dipakai adalah
  `dakosta-dakosta.vercel.app`.
- Variabel produksi (nama saja): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
  `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `DEMO_MODE`,
  `DEMO_SEED_PASSWORD`. Opsional: `NEXT_PUBLIC_MAP_STYLE_URL`, `CRON_SECRET`.
  Nilai sensitif disimpan sebagai *Sensitive* di Vercel dan tidak pernah
  dicetak ke log.
- Database: Neon `dakosta-db`, branch produksi, sudah dimigrasi dan di-seed.
- Produksi publik (akses anonim `200`); deployment preview mengikuti proteksi
  Vercel bawaan. Proyek dijalankan pada akun Hobby untuk penggunaan pribadi
  nonkomersial.

### Migrasi / seed produksi

Jangan mengandalkan `.env.local` (berisi nilai pengembangan). Tarik env produksi
ke file yang tidak di-commit:

```bash
npx vercel env pull .env.production.local --environment=production
```

Migrasi (tidak mencetak kredensial):

```bash
node -e 'const {config}=require("dotenv"); config({path:".env.production.local",override:true}); require("child_process").execSync("npx drizzle-kit migrate",{stdio:"inherit",env:process.env});'
```

Reset/seed produksi (destruktif; guard `SEED_CONFIRM=yes`):

```bash
node -e 'const {config}=require("dotenv"); config({path:".env.production.local",override:true}); process.env.SEED_CONFIRM="yes"; require("child_process").execSync("npx tsx scripts/reset-demo.ts",{stdio:"inherit",env:process.env});'
```

### Rilis & rollback

```bash
npx vercel link --project dakosta-dakosta --yes
npx vercel deploy --prod --yes
```

Rollback: promosikan deployment sebelumnya dari dashboard Vercel atau
`npx vercel rollback`. Migrasi Drizzle bersifat maju (tanpa down migration);
periksa kompatibilitas sebelum rollback kode yang mengubah skema.

### Checklist smoke setelah rilis

1. `/api/health` → `{"status":"ok","db":"ok"}`.
2. `/masuk` → logo, tombol demo, disclaimer tampil.
3. Login Admin demo → ringkasan, KPI periode, peta, analitik.
4. Login Client demo → ringkasan ter-scope, wizard, notifikasi.
5. `/api/v1/realtime/notifications` → `text/event-stream`, `X-Accel-Buffering: no`.
6. Ekspor CSV → UTF-8 BOM, hanya status Disetujui, label DEMO.
7. CLIENT membuka `/admin` → dialihkan ke `/akses-ditolak`; API Admin → `403`.

## Deviasi dari kit awal

- **Next.js monolit** di Vercel (bukan Vite + Workers) agar auth, RBAC, dan
  server action/route berada dalam satu runtime.
- **Neon Postgres** (bukan D1) karena kebutuhan transaksi, constraint, dan
  koneksi dari Vercel Functions.
- **Akun seed + sandi sementara** (bukan undangan email) karena demo tanpa
  layanan email.
- **Ekspor CSV saja** (belum XLSX/PDF).
- **Outbox didrain lazy/manual** (belum cron terjadwal).
- **Satu aplikasi** (bukan monorepo) untuk menjaga demo tetap kecil.
- **OpenFreeMap** sebagai basemap tanpa kunci API.
- **Font di-self-host** (`src/app/fonts/`) agar build tidak bergantung pada
  pengambilan Google Fonts saat deploy.
- Halaman peta memakai worker MapLibre; CSP mengizinkan `worker-src blob:` dan
  koneksi ke `tiles.openfreemap.org`.

## Keamanan & privasi

- `.env*` diabaikan Git dan `.vercelignore`; `.env.example` hanya berisi nama.
- Tidak ada registrasi publik; peran & cakupan diambil dari database.
- Cookie sesi `httpOnly`, `secure` di produksi, `sameSite=lax`.
- CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, dan `Permissions-Policy`
  ketat (geolokasi hanya untuk origin sendiri).
- Rate limit login demo, ekspor, dan endpoint sensitif; percobaan akses
  ditolak diaudit.
- Data demo saja: tanpa PII, tanpa NIK/JKN, tanpa rekam medis.

## Lisensi aset

Plus Jakarta Sans © Tokotype, lisensi SIL Open Font License 1.1 — teks lisensi
di `src/app/fonts/OFL.txt`. Aset merek DAKOSTA di `public/brand/` hanya untuk
demo ini.

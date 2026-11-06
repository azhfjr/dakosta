# Laporan Audit Website Menyeluruh DAKOSTA v2 — 2026-11

| Item                 | Nilai                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Repo / branch / HEAD | `C:\Users\PLN\Documents\Qoder\2026-10-30\b8cd74b6` · `fix/all-features-hardening` · `01c237b`     |
| Produksi             | `https://dakosta-dakosta.vercel.app` (read-only)                                                  |
| Tanggal audit        | 2026-11-06                                                                                        |
| Standar              | OWASP Top 10:2021, OWASP API Security Top 10:2023, OWASP ASVS 5.0 Level 2 (targeted), WCAG 2.2 AA |
| Metode               | Review statis + runtime read-only + harness audit terpisah                                        |
| Sifat                | Laporan + roadmap; **tidak ada perubahan kode/konfigurasi/DB/deployment**                         |

---

## 1. Executive Summary

DAKOSTA v2 adalah aplikasi Next.js 16 (App Router) dengan empat peran
(`MASTER_ADMIN`, `REGIONAL_ADMIN`, `BRANCH_ADMIN`, `STAKEHOLDER`), 59 halaman,
46 route API (56 handler), dan dataset demo produksi 2.400 konten / 32 akun.
Audit ini menggabungkan review kode, gate statis, smoke produksi, 54 probe
negatif read-only, harness axe WCAG 2.2 pada Chromium, probe TTFB, dan review
operasional.

**Kesimpulan:** tidak ditemukan P0. Baseline fungsional produksi sehat
(smoke 21/21, 32/32 akun, 2.400 konten, unit 120/120), tetapi terdapat
**1 temuan P1** pada containment aktor demo dan **7 temuan P2** pada CSRF,
batas resource, rate limit, perlindungan backup, WCAG 2.2, tata kelola
engineering, dan integritas flag demo. Tidak ada bukti kebocoran data nyata
pada audit read-only ini; seluruh dampak mutasi ditandai `SUSPECTED` dan tidak
dieksploitasi.

| Severity | Jumlah | Ringkas                                                                                                                               |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | 0      | —                                                                                                                                     |
| P1       | 1      | Demo actor tidak diblokir pada 11 mutasi master (policy/target/revoke/outbox)                                                         |
| P2       | 7      | CSRF 5 endpoint; tanpa cap body; rate limit auth; backup plaintext; WCAG 2.2; tanpa CI/observability; `is_demo=false` untuk konten UI |
| P3       | 13     | HEAD imports 204; UUID 500; `jsonError` 500; `x-request-id`; CSP; retensi; SSE; API mati; dokumentasi usang; dll.                     |

**Lima risiko teratas**

1. **P1 — Batas demo tidak utuh.** `DEMO_BLOCKED` hanya mencakup 5 capability;
   11 handler mutasi master tidak memiliki guard demo. Probe membuktikan
   `POST /admin/edufast/policies/publish` mengembalikan 404 (bukan 403),
   artinya guard demo tidak ada; dengan `policyId` valid, aktor demo dapat
   mempublikasikan kebijakan global. Dampak mutasi nyata tidak dieksekusi
   (`SUSPECTED`).
2. **P2 — CSRF defense tidak konsisten.** Tiga endpoint mutasi
   (`/submissions`, `/notifications`, `/me/password`) merespons body dengan
   `Origin: https://evil.example` sebagai 400/500, bukan 403. `SameSite=Lax`
   memitigasi eksploitasi browser modern, tetapi kontrol server tidak lengkap.
3. **P2 — Resource consumption.** Body JSON 2 MB diparse penuh (tidak ada 413),
   dan 18 handler mutasi tidak memakai rate limit. Limiter Better Auth
   in-memory per instance.
4. **P2 — Backup plaintext.** Backup NDJSON mencakup tabel auth (hash sandi,
   sesi) dan PII tanpa enkripsi/retensi.
5. **P2 — WCAG 2.2 AA belum terpenuhi.** 4 halaman memiliki `color-contrast`
   serious (rasio 3,04–4,39:1) dan `/cabang` overflow 9 px pada 320 px/zoom 400%.

**Postur rilis:** produksi saat ini adalah **demo sintetis**. Tidak ada
indikasi data nyata terekspos. Untuk kelanjutan demo, risiko dapat diterima
dengan catatan P1/P2 masuk roadmap 0–48 jam dan 1–2 minggu. Untuk penggunaan
dengan pengguna/PII nyata, gate G4/G5/G8/G9 di §9 harus lulus terlebih dahulu.

**Batasan penting:** audit ini **read-only**. Tidak ada uji mutasi bisnis,
reset/seed, load/stress, brute force, atau perubahan izin. Karena itu, 32
handler mutasi dan seluruh alur tulis berstatus `NOT TESTED`; temuan yang hanya
dapat dibuktikan dengan mutasi nyata ditandai `SUSPECTED`.

---

## 2. Audit Scope & Evidence Register

### 2.1 Ruang lingkup

| Dalam scope                                                                    | Di luar scope                                             |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 59 `page.tsx`, 46 `route.ts` (56 handler), server components, library authz/DB | Vercel/Neon console, WAF, PITR, konfigurasi platform      |
| Konfigurasi keamanan (`next.config.ts`, cookies, CSP, proxy)                   | Integrasi pihak ketiga selain tile peta                   |
| Skrip verifikasi, unit test, E2E statis, dokumentasi audit                     | Load/stress produksi, perubahan data/izin, perbaikan kode |
| Produksi read-only (GET/HEAD, login demo, smoke)                               | Subdomain lain, email delivery, perangkat nyata           |

**Definisi read-only yang dipakai:** GET/HEAD; login demo yang sudah menjadi
bagian smoke; unit test in-memory (PGlite/mock); lint/typecheck/format;
`npm audit`/SBOM; secret scan; axe pada halaman GET; probe negatif dengan
payload **invalid/nonexistent** sehingga tidak dapat membuat/mengubah data.
Login sesi dan baris rate-limit adalah satu-satunya tulisan insidental.

### 2.2 Register bukti

Setiap klaim `PASS`/`FAIL` di laporan ini memiliki berkas `E-*` dengan
timestamp dan lingkungan. Register lengkap ada di
[`02-evidence-register.md`](02-evidence-register.md). Ringkasan:

| Kelompok      | Bukti            | Hasil                                                                      |
| ------------- | ---------------- | -------------------------------------------------------------------------- |
| Preflight     | E-01             | Baseline, toolchain, target, higiene kredensial                            |
| Static gates  | E-02…E-09        | Lint/tsc/format bersih; unit 120/120; audit prod 0; secret scan 0          |
| Produksi      | E-10, E-11       | Smoke 21/21; 32/32 akun; 2.400 konten                                      |
| Probe negatif | E-12, E-13, E-14 | 54 probe; 48 lulus, 6 gagal                                                |
| A11y          | E-15             | 45 halaman unik (46 kunjungan); 4 contrast; keyboard/dialog PASS; 2 reflow |
| Performa      | E-16             | TTFB median 59–402 ms (indikatif)                                          |
| Inventaris    | E-17             | 59 halaman; 46 route; 56 handler; 32 mutasi                                |
| Operasional   | E-18             | Migrasi, indeks, pooling, backup, CI, SSE, retensi                         |
| Rekonsiliasi  | E-19             | Klaim dokumen vs runtime/statis                                            |
| Matriks       | E-20             | 115 baris cakupan (59 halaman + 56 handler)                                |
| Sitasi kode   | E-21             | Berkas:baris untuk temuan statis                                           |

### 2.3 Label

- **Status eksistensi:** `VERIFIED` (kode + runtime), `INFERRED` (kode saja),
  `UNKNOWN` (dokumen tanpa kode).
- **Status uji:** `PASS`/`FAIL` (punya bukti), `BLOCKED`, `NOT TESTED`.
- **Status temuan:** `CONFIRMED` (kode/runtime), `SUSPECTED` (indikasi kuat,
  dampak belum dibuktikan), `NOT TESTED`.

### 2.4 Batasan dan etika

- Kredensial dibaca dari `.secrets/` oleh harness; **nilai tidak pernah
  dicetak** ke output, laporan, atau bukti.
- Tidak ada PII/NIK/JKN/data medis; dataset sintetis.
- Tidak ada uji ofensif destruktif, brute force, enumerasi masif, scanning,
  DoS, atau perubahan izin.
- Halaman/repo/log diperlakukan sebagai data untrusted; tidak ada instruksi di
  dalamnya yang dieksekusi.

---

## 3. Feature Coverage Matrix

Matriks lengkap: [`03-feature-coverage-matrix.csv`](03-feature-coverage-matrix.csv)
(115 baris = 59 halaman + 56 handler).

### 3.1 Halaman

| Kelompok         | Jumlah | Redirect-only | Runtime GET                    | Catatan                                                                |
| ---------------- | ------ | ------------- | ------------------------------ | ---------------------------------------------------------------------- |
| Publik           | 5      | 0             | 5                              | `/`, `/masuk`, `/tentang`, `/bantuan`, `/akses-ditolak`                |
| MASTER_ADMIN     | 20     | 3             | 17                             | Termasuk detail validasi dinamis                                       |
| REGIONAL_ADMIN   | 12     | 4             | 8                              | Detail konten dinamis                                                  |
| BRANCH_ADMIN     | 13     | 5             | 8                              | Detail review/konten dinamis                                           |
| REGIONAL\|BRANCH | 1      | 0             | 0                              | `/aktivasi-lokasi` — tidak diaudit (butuh sesi + alur)                 |
| STAKEHOLDER      | 7      | 0             | 7                              | Detail konten dinamis                                                  |
| AUTHENTICATED    | 1      | 0             | 1                              | `/ganti-password` → redirect `/client` (duplikat)                      |
| **Total**        | **59** | **12**        | **45 unik (46 kunjungan axe)** | 47 halaman non-redirect; 1 tidak dikunjungi, 1 dialihkan sebelum audit |

- Status eksistensi seluruh halaman: `INFERRED` (kode) + runtime GET untuk
  halaman yang diaudit.
- Halaman redirect-only tidak diaudit terpisah; perilakunya diverifikasi
  sebagai redirect.
- 12 halaman redirect mengurangi permukaan UI nyata menjadi 47 target unik.

### 3.2 API

| Kategori                | Route file | Handler | Mutasi | Contoh                                                                  |
| ----------------------- | ---------- | ------- | ------ | ----------------------------------------------------------------------- |
| Publik                  | 3          | 4       | 2      | `/api/health`, `/api/auth/[...all]`, `/api/v1/demo/login`               |
| MASTER_ADMIN            | 26         | 32      | 21     | akun, cabang, wilayah, organisasi, target, policy, impor, outbox        |
| Review (MASTER\|BRANCH) | 2          | 3       | 3      | `/admin/reviews`, `/admin/reviews/start`, `/admin/contents/[id]/revoke` |
| Scope-dependent         | 14         | 16      | 6      | submissions, notifications, realtime, analytics, exports, reports       |
| **Total**               | **46**     | **56**  | **32** | —                                                                       |

### 3.3 Cakupan uji per fitur

| Fitur                                            | Eksistensi | Uji runtime                 | Status                  |
| ------------------------------------------------ | ---------- | --------------------------- | ----------------------- |
| Login 4 peran                                    | VERIFIED   | Smoke + verify              | PASS                    |
| RBAC GET lintas peran                            | VERIFIED   | 54 probe                    | PASS (kecuali temuan)   |
| Dashboard/kinerja/peta/analitik (GET)            | VERIFIED   | Axe + smoke + TTFB          | PASS dengan temuan a11y |
| Ekspor CSV/PDF                                   | VERIFIED   | Smoke (CSV/PDF)             | PASS                    |
| Notifikasi (GET/SSE)                             | VERIFIED   | Smoke GET; SSE tidak diuji  | PARTIAL                 |
| Submit/review/revise/revoke/import/target/policy | INFERRED   | **Tidak diuji (read-only)** | NOT TESTED              |
| Onboarding lokasi                                | INFERRED   | Tidak diuji                 | NOT TESTED              |
| Purge/seed/reset demo                            | INFERRED   | Tidak dijalankan            | NOT TESTED              |
| Audit log                                        | VERIFIED   | Tidak diuji runtime         | PARTIAL                 |

**Tidak ada klaim "seluruh fitur tercakup".** Cakupan runtime terbatas pada
GET, smoke, dan probe negatif. Seluruh alur mutasi bisnis berstatus
`NOT TESTED` beserta prosedur di §10.

---

## 4. Attack Surface & Architecture Overview

### 4.1 Trust boundary

```
Browser
  │  HTTPS + cookie HttpOnly/Secure/SameSite=Lax
  ▼
Vercel edge  ── HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy
  ▼
src/proxy.ts ── hanya cek keberadaan cookie sesi (bukan otorisasi peran)
  ▼
Layout / Server Component ── requireRole / requireAuth
  ▼
API Route Handler ── getApiUser / requireMasterApi / requireApiRole
  │                   capability check + scope predicate SQL
  ▼
Drizzle ORM (parameterized) ── Neon Postgres (pool max 3, query_timeout 15 dtk)
  │
  └── SSE /api/v1/realtime/notifications (poll 2,5 dtk, koneksi 55 dtk)

Egress keluar: tiles.openfreemap.org (peta) — tidak ada fetch pihak ketiga lain.
```

### 4.2 Kontrol yang terverifikasi baik

| Kontrol                                                                              | Bukti                                                            | Status        |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------- |
| Cookie sesi `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`                           | E-12 `cookieAttributes`                                          | PASS          |
| API tanpa sesi → 401; halaman → 307                                                  | E-12 P-001…P-016                                                 | PASS          |
| RBAC GET lintas peran → 403                                                          | E-12 P-021…P-030                                                 | PASS          |
| BOLA GET dengan UUID nonexistent → 404                                               | E-12 P-035…P-037                                                 | PASS          |
| `assertSameOrigin` menolak Origin asing (24 route file, 26 pemanggilan; probe P-040) | E-12 P-040                                                       | PASS          |
| SQL injection                                                                        | Drizzle parameterized; tidak ada `sql.raw` dengan input pengguna | PASS (statis) |
| XSS                                                                                  | Tidak ada `dangerouslySetInnerHTML`/`innerHTML`; React escaping  | PASS (statis) |
| CSV formula injection                                                                | `src/lib/csv.ts:1-13` menetralkan `= + - @ tab CR`               | PASS (statis) |
| Secret tidak ter-commit                                                              | E-09 (0 temuan)                                                  | PASS          |
| Header keamanan                                                                      | E-10                                                             | PASS          |
| Rekonsiliasi dashboard/kinerja/CSV                                                   | E-10                                                             | PASS          |

### 4.3 Peta OWASP Top 10:2021

| Kategori                             | Temuan terkait                                         | Status        |
| ------------------------------------ | ------------------------------------------------------ | ------------- |
| A01 Broken Access Control            | FND-001, 011, 012, 018                                 | **FAIL**      |
| A02 Cryptographic Failures           | FND-005, 006                                           | **FAIL**      |
| A03 Injection                        | FND-015 (CSP); SQLi/XSS/CSV injection terkendali       | PARTIAL       |
| A04 Insecure Design                  | FND-003, 004, 009, 017                                 | **FAIL**      |
| A05 Security Misconfiguration        | FND-012, 013, 015                                      | **FAIL**      |
| A06 Vulnerable & Outdated Components | E-07 (1 critical dev-only); tidak ada CI SCA           | PARTIAL       |
| A07 Identification & Auth Failures   | FND-004, 010, 021                                      | PARTIAL       |
| A08 Software & Data Integrity        | FND-009, 016                                           | **FAIL**      |
| A09 Logging & Monitoring             | FND-008, 013, 019                                      | **FAIL**      |
| A10 SSRF                             | Tidak ada fetch server-side yang dikendalikan pengguna | PASS (statis) |

### 4.4 Peta OWASP API Security Top 10:2023

| Kategori                                             | Temuan                                                | Status   |
| ---------------------------------------------------- | ----------------------------------------------------- | -------- |
| API1 BOLA                                            | GET lintas peran/nonexistent lulus; mutasi NOT TESTED | PARTIAL  |
| API2 Broken Authentication                           | FND-004, 021                                          | PARTIAL  |
| API3 Broken Object Property Level Authorization      | FND-001, 005                                          | **FAIL** |
| API4 Unrestricted Resource Consumption               | FND-003, 004, 017                                     | **FAIL** |
| API5 BFLA                                            | FND-001, 012                                          | **FAIL** |
| API6 Unrestricted Access to Sensitive Business Flows | FND-001, 011                                          | **FAIL** |
| API7 SSRF                                            | Tidak ditemukan                                       | PASS     |
| API8 Security Misconfiguration                       | FND-013, 015                                          | PARTIAL  |
| API9 Improper Inventory Management                   | FND-018                                               | PARTIAL  |
| API10 Unsafe Consumption of APIs                     | FND-020                                               | PARTIAL  |

### 4.5 ASVS 5.0 Level 2

Audit ini adalah **targeted assessment**, bukan sertifikasi ASVS penuh.
Chapter yang diperiksa: V2 (authentication), V3 (session), V4 (access control),
V5 (validation), V6 (cryptography), V7 (logging), V8 (data protection),
V14 (configuration). Chapter lain (mis. V9 komunikasi, V10 malicios code,
V11 business logic, V12 files, V13 API) hanya disentuh sebagian. Status
keseluruhan: **tidak memenuhi Level 2** karena FND-001/002/006/008.

---

## 5. Findings Table (P0 → P3)

Total 21 temuan: **0 P0, 1 P1, 7 P2, 13 P3**. Mirror CSV:
[`04-findings.csv`](04-findings.csv).

### P1

| ID      | Temuan                                                                                                                        | Status                                                   | Bukti            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------- |
| FND-001 | Demo actor tidak diblokir pada 11 handler mutasi master (policy publish/archive/copy, revoke, target, outbox, import preview) | CONFIRMED (kode); runtime P-045; dampak mutasi SUSPECTED | E-12, E-13, E-17 |

### P2

| ID      | Temuan                                                                              | Status                            | Bukti                        |
| ------- | ----------------------------------------------------------------------------------- | --------------------------------- | ---------------------------- |
| FND-002 | 5 endpoint mutasi tanpa `assertSameOrigin`; guard short-circuit bila Origin absen   | CONFIRMED (runtime P-042/043/044) | E-12, E-13                   |
| FND-003 | Tidak ada cap body JSON; 2 MB diparse; import menghitung karakter                   | CONFIRMED (P-052)                 | E-12                         |
| FND-004 | Limiter auth in-memory per instance; IP hop pertama XFF; 18 mutasi tanpa rate limit | SUSPECTED (kode)                  | E-17, E-18                   |
| FND-006 | Backup NDJSON plaintext mencakup auth/PII                                           | CONFIRMED (kode)                  | E-18 §4                      |
| FND-007 | WCAG 2.2 AA gagal: 4 halaman contrast, 2 reflow                                     | CONFIRMED (E-15)                  | E-15                         |
| FND-008 | Tidak ada CI/SAST/SCA/secret scan/observability                                     | CONFIRMED (repo)                  | E-18 §5–6                    |
| FND-009 | Konten UI oleh akun demo tersimpan `is_demo=false`                                  | CONFIRMED (kode)                  | `src/lib/submissions.ts:993` |

### P3

| ID      | Temuan                                                       | Status                 | Bukti                                      |
| ------- | ------------------------------------------------------------ | ---------------------- | ------------------------------------------ |
| FND-005 | Sandi sementara dikembalikan di response create/reset/import | CONFIRMED (kode)       | `src/lib/accounts.ts:326-392,581-597`      |
| FND-010 | Halaman ganti password sukarela tidak terjangkau             | CONFIRMED (kode)       | `ganti-password/page.tsx:18-19`            |
| FND-011 | `outbox/drain` tanpa CSRF/rate limit/step-up                 | CONFIRMED (kode)       | route + E-17                               |
| FND-012 | `HEAD /admin/imports` 204 tanpa auth                         | CONFIRMED (P-009)      | E-12                                       |
| FND-013 | `x-request-id` diterima apa adanya                           | CONFIRMED (P-051)      | E-12                                       |
| FND-014 | `?view=` diabaikan; nav `/admin/laporan` duplikat            | CONFIRMED (kode)       | `navigation.tsx:74`                        |
| FND-015 | CSP `script-src 'unsafe-inline'` tanpa nonce                 | CONFIRMED (config)     | `next.config.ts:27`                        |
| FND-016 | Dokumen audit memuat klaim usang/tanpa artefak               | CONFIRMED (E-19)       | E-19                                       |
| FND-017 | SSE polling 2,5 dtk tanpa rate limit/kuota                   | SUSPECTED (kode)       | `realtime/notifications/route.ts:13-15,51` |
| FND-018 | API tanpa konsumen: `/dashboard/client`, `/map`              | CONFIRMED (kode)       | E-17                                       |
| FND-019 | Tidak ada retensi audit/notifikasi/outbox                    | CONFIRMED (kode)       | E-18 §4                                    |
| FND-020 | UUID invalid → 500 (22P02)                                   | CONFIRMED (P-038)      | E-12, E-13                                 |
| FND-021 | `jsonError` salah memparse status string → 500               | CONFIRMED (P-044/E-14) | E-12, E-14                                 |

---

## 6. Finding Detail Cards

### FND-001 — Demo containment tidak utuh (P1)

- **Standar:** OWASP API5:2023 (BFLA), ASVS 4.1.1/4.2.1.
- **Lokasi:** `src/lib/authz/capabilities.ts:56-62`; 11 handler master
  (`publish/archive/copy policy`, `revoke`, `targets` POST/PATCH/DELETE/sync,
  `outbox/drain`, `imports/preview`).
- **Bukti:** E-17 (11 handler tanpa guard); E-12 P-045 (publish → 404, bukan 403);
  E-13 (analisis akar masalah).
- **Deskripsi:** `DEMO_BLOCKED` hanya memblokir 5 capability
  (`hierarchy:manage`, `organization:manage`, `account:manage`,
  `account:reset`, `import:manage`). Guard demo hanya dipasang di service
  akun/hierarki/impor. Mutasi master lain tidak memeriksa `isDemo`.
- **Dampak:** Aktor demo MASTER dapat mempublikasikan/mengarsipkan kebijakan
  global, mengubah target, atau merevoke konten non-demo bila mengetahui ID.
  Revoke/target sebagian tertahan step-up; publish tidak. Mutasi nyata tidak
  dieksekusi → dampak `SUSPECTED`.
- **Reproduksi (setelah izin):** login demo MASTER → `POST publish` dengan
  `policyId` valid → amati 200 dan versi policy berubah.
- **Remediasi:** Guard demo terpusat pada semua mutasi master; uji negatif per
  handler; capability `demo:contain` eksplisit.
- **AC:** 11 handler mengembalikan 403 untuk aktor demo; unit + probe regresi.

### FND-002 — CSRF defense tidak konsisten (P2)

- **Standar:** OWASP Top 10 A01/A05; ASVS 4.2.2.
- **Lokasi:** `src/app/api/v1/submissions/route.ts:43`,
  `src/app/api/v1/notifications/route.ts:63`,
  `src/app/api/v1/me/password/route.ts:20`,
  `src/app/api/v1/admin/outbox/drain/route.ts`,
  `src/app/api/v1/demo/login/route.ts`.
- **Bukti:** E-12 P-042 (400), P-043 (400), P-044 (500) dengan
  `Origin: https://evil.example`; E-13.
- **Deskripsi:** `assertSameOrigin` tidak dipanggil pada 5 endpoint. Bahkan bila
  dipanggil, fungsi short-circuit saat Origin absen
  (`src/lib/authz/guards.ts:170-185`).
- **Dampak:** Permintaan lintas asal dengan body valid dapat dieksekusi bila
  cookie terkirim. `SameSite=Lax` memitigasi POST lintas situs di browser
  modern, tetapi tidak melindungi klien non-browser atau skenario same-site.
- **Reproduksi:** kirim POST dengan Origin asing dan body invalid → 400/500,
  bukan 403.
- **Remediasi:** Wajibkan Origin/Referer pada semua mutasi; tolak bila absen;
  uji regresi.
- **AC:** 5 endpoint → 403 untuk Origin asing; 403/400 untuk Origin absen.

### FND-003 — Tanpa cap ukuran body (P2)

- **Standar:** OWASP API4:2023; ASVS 5.1.1.
- **Lokasi:** `src/app/api/v1/submissions/route.ts:47` dan seluruh route
  POST/PATCH; import konten.
- **Bukti:** E-12 P-052 (2 MB JSON → 400 setelah 2,2 dtk; bukan 413).
- **Dampak:** Memory/CPU per request dapat dipaksa; potensi DoS aplikatif.
- **Remediasi:** Cap byte sebelum parse (mis. 1 MB), 413; hitung byte pada
  import.
- **AC:** body > cap → 413; unit test batas.

### FND-004 — Rate limit auth dan mutasi (P2)

- **Standar:** OWASP API4/API2; ASVS 2.2.1.
- **Lokasi:** `src/lib/auth.ts:63-69` (in-memory), `src/lib/rate-limit.ts`
  (DB-backed), 18 handler tanpa limit (E-17).
- **Bukti:** E-17, E-18 §10.
- **Dampak:** Brute force/credential stuffing tersebar antar instance; XFF hop
  pertama dapat digeser; mutasi berisiko tanpa kuota.
- **Remediasi:** Limiter persisten untuk auth; normalisasi IP platform; limit
  pada mutasi berisiko.
- **AC:** 429 konsisten lintas instance; uji beban terkontrol di staging.

### FND-006 — Backup plaintext (P2)

- **Standar:** OWASP A02; ASVS 6.2.1.
- **Lokasi:** `scripts/backup-db.ts:48-82`.
- **Dampak:** Kebocoran file backup = kompromi kredensial (hash sandi, token
  sesi) dan PII.
- **Remediasi:** Enkripsi at-rest + KMS; rotasi/retensi; batasi akses.
- **AC:** backup terenkripsi; hanya operator berwenang dapat memulihkan.

### FND-007 — WCAG 2.2 AA (P2)

- **Standar:** WCAG 2.2 AA SC 1.4.3 (Contrast), 1.4.10 (Reflow).
- **Lokasi:** `src/components/analytics/analytics-content-table.tsx:231`,
  `analytics-filter-bar.tsx:155`, `src/app/globals.css:112`
  (`--status-revision: #b45309`), `/cabang`.
- **Bukti:** E-15:
  - `/admin/analitik` — 8 node, rasio 3,04:1 (butuh 4,5:1).
  - `/admin/peta` — 21 node, rasio 4,21–4,39:1.
  - `/client/analitik` — 3 node (3,04/3,06 + 4,39).
  - `/client/konten` — 1 node (4,39).
  - `/cabang` — overflow 9 px pada 320 px dan zoom 400%.
  - Keyboard, skip link, dialog, focus return: PASS.
- **Dampak:** Pengguna low-vision tidak dapat membaca teks status/filter;
  horizontal scroll pada layar sempit.
- **Remediasi:** Naikkan kontras token ≥4,5:1; perbaiki layout `/cabang`;
  tambahkan axe 2.2 ke CI.
- **AC:** 0 pelanggaran serious/critical pada 45 halaman unik; reflow ≤1 px.

### FND-008 — Tanpa CI/observability (P2)

- **Standar:** OWASP A06/A09; ASVS 14.2.
- **Bukti:** E-18 §5–6 (tidak ada `.github/workflows`, SDK observability,
  SLO/alert).
- **Dampak:** Regresi keamanan/kualitas tidak terdeteksi; insiden tidak
  terlihat.
- **Remediasi:** Pipeline CI (lint/tsc/test/audit/SBOM/secret scan); Sentry/OTel;
  alert SLO.
- **AC:** PR gagal bila gate gagal; error rate/availability terpantau.

### FND-009 — `is_demo=false` untuk konten UI (P2)

- **Standar:** Integritas data; OWASP A04.
- **Lokasi:** `src/lib/submissions.ts:993` (hardcoded `isDemo: false`).
- **Dampak:** Konten demo bercampur data non-demo; purge demo tidak lengkap;
  KPI tercemar.
- **Remediasi:** Set `is_demo` dari aktor pada semua jalur tulis; backfill;
  uji purge.
- **AC:** Konten dari akun demo selalu `is_demo=true`; purge 100%.

### FND-005 — Sandi sementara di response (P3)

- **Lokasi:** `src/lib/accounts.ts:326-392,581-597`;
  `src/lib/imports/accounts.ts:550`.
- **Deskripsi:** Sandi sementara dibuat server dan dikembalikan di JSON.
  Diperlukan untuk onboarding manual, tetapi tidak ada mode tampil-sekali.
- **Dampak:** Dapat tersimpan di log/proxy/browser history.
- **Remediasi:** Tampilkan sekali di UI; jangan di response JSON; atau kanal
  aman.
- **AC:** response create/reset tidak memuat sandi; UI menampilkan sekali.

### FND-010 — Ganti password sukarela tidak terjangkau (P3)

- **Lokasi:** `src/app/ganti-password/page.tsx:18-19` (redirect bila
  `mustChangePassword=false`); `src/app/client/profil/page.tsx:179`.
- **Dampak:** Pengguna tidak dapat mengganti sandi sukarela; admin tanpa jalur.
- **Remediasi:** Izinkan halaman untuk sesi valid; tautan di menu akun semua
  peran.
- **AC:** Semua peran dapat membuka `/ganti-password` dan berhasil mengganti.

### FND-011 — `outbox/drain` hardening (P3)

- **Lokasi:** `src/app/api/v1/admin/outbox/drain/route.ts`.
- **Dampak:** Pemicuan drain berulang oleh sesi master yang dikompromikan.
- **Remediasi:** Same-origin + rate limit + audit; pertimbangkan step-up.
- **AC:** 403 untuk Origin asing; 429 setelah kuota; audit tercatat.

### FND-012 — `HEAD /admin/imports` 204 (P3)

- **Lokasi:** `src/app/api/v1/admin/imports/route.ts:21-23`.
- **Bukti:** E-12 P-009.
- **Dampak:** Enumerasi endpoint administratif tanpa sesi.
- **Remediasi:** Hapus handler HEAD atau panggil `requireMasterApi`.
- **AC:** HEAD tanpa sesi → 401/405.

### FND-013 — `x-request-id` diterima apa adanya (P3)

- **Lokasi:** `src/lib/api.ts:12`.
- **Bukti:** E-12 P-051 (`audit-probe-echo-001` dipantulkan).
- **Dampak:** Pencemaran korelasi log/audit.
- **Remediasi:** Validasi UUID; generate bila invalid.
- **AC:** ID non-UUID diganti; ID valid dipertahankan.

### FND-014 — Deep link dan navigasi (P3)

- **Lokasi:** `src/app/cabang/dashboard/page.tsx` (tidak membaca `view`);
  `src/components/shell/navigation.tsx:74`.
- **Dampak:** Tautan `?view=` tidak membuka tab; item nav duplikat.
- **Remediasi:** Parse `searchParams.view`; hapus duplikat.
- **AC:** `?view=peta|konten` membuka tab yang benar; nav unik.

### FND-015 — CSP `unsafe-inline` (P3)

- **Lokasi:** `next.config.ts:27`.
- **Dampak:** Mitigasi XSS berkurang bila ada injeksi HTML.
- **Remediasi:** Nonce/hash; hapus `unsafe-inline`.
- **AC:** CSP tanpa `unsafe-inline` untuk script; halaman tetap berfungsi.

### FND-016 — Klaim dokumen usang (P3)

- **Bukti:** E-19 (E2E 49/54 vs klaim 53/54; a11y 7 tes vs klaim 4;
  30 vs 32 mutasi; 20 vs 19 berkas unit).
- **Dampak:** Keputusan rilis berbasis angka tidak akurat.
- **Remediasi:** Patch dokumentasi terpisah dengan artefak + timestamp.
- **AC:** Setiap angka di `13-status.md` menunjuk `E-*`.

### FND-017 — SSE polling (P3)

- **Lokasi:** `src/app/api/v1/realtime/notifications/route.ts:13-15,51`.
- **Dampak:** ±22 query per koneksi; konkurensi tinggi membebani Neon.
- **Remediasi:** Kuota koneksi, backoff, interval adaptif/LISTEN-NOTIFY.
- **AC:** Uji beban staging menunjukkan query/klien terkendali.

### FND-018 — API tanpa konsumen (P3)

- **Lokasi:** `GET /api/v1/dashboard/client`, `GET /api/v1/map`.
- **Dampak:** Permukaan API dan biaya uji tanpa manfaat.
- **Remediasi:** Hapus atau dokumentasikan + tes.
- **AC:** Tidak ada route tanpa konsumen/tes.

### FND-019 — Retensi data (P3)

- **Lokasi:** `audit_logs`, `notifications`, `outbox_events`.
- **Dampak:** Pertumbuhan data/PII tanpa batas.
- **Remediasi:** Job retensi + arsip + kebijakan hapus.
- **AC:** Data lebih lama dari kebijakan terhapus/terarsip otomatis.

### FND-020 — UUID invalid → 500 (P3)

- **Lokasi:** `src/lib/submissions.ts:354`.
- **Bukti:** E-12 P-038.
- **Dampak:** Error 5xx yang dapat diinduksi; noise alert.
- **Remediasi:** Validasi UUID sebelum query.
- **AC:** param invalid → 400/404.

### FND-021 — `jsonError` status string (P3)

- **Lokasi:** `src/lib/api.ts:83`; `node_modules/better-call/dist/error.mjs:97-108`.
- **Bukti:** E-12 P-044, E-14 (sandi salah → 500).
- **Dampak:** Kesalahan pengguna tampil sebagai 500; sulit ditriage.
- **Remediasi:** Parse status string; peta `APIError` ke 4xx.
- **AC:** sandi salah → 400/401; rate limit → 429.

---

## 7. Testing & Regression Matrix

| Grup               | Metode                                         | Lingkungan          | Hasil                          | Bukti          |
| ------------------ | ---------------------------------------------- | ------------------- | ------------------------------ | -------------- |
| Lint               | `npm run lint`                                 | lokal               | PASS                           | E-02           |
| Typecheck          | `tsc --noEmit`                                 | lokal               | PASS                           | E-03           |
| Format             | `prettier --check`                             | lokal               | PASS                           | E-04           |
| Unit/integration   | Vitest                                         | lokal (PGlite/mock) | 120/120, 19 berkas             | E-05           |
| SCA produksi       | `npm audit --omit=dev`                         | registry            | 0                              | E-06           |
| SCA penuh          | `npm audit`                                    | registry            | 25 (1 critical dev-only)       | E-07           |
| SBOM               | CycloneDX                                      | lokal               | dihasilkan                     | E-08           |
| Secret scan        | pola private key/token/JWT/password            | lokal               | 0 temuan                       | E-09           |
| Smoke produksi     | 21 checks                                      | produksi            | 21/21                          | E-10           |
| Verifikasi dataset | DB + HTTP                                      | produksi            | 32/32 akun, 2.400 konten       | E-11           |
| Probe negatif      | 54 probe                                       | produksi            | 48 PASS, 6 FAIL                | E-12           |
| A11y axe           | 45 halaman unik (46 kunjungan), tag 2.0–2.2 AA | produksi, Chromium  | 4 halaman FAIL                 | E-15           |
| Keyboard/focus     | skip link, Tab, dialog                         | produksi            | PASS                           | E-15           |
| Reflow             | 6 viewport, 13 rute                            | produksi            | 2 overflow                     | E-15           |
| TTFB               | 5 rute × 3 sampel                              | produksi            | 59–402 ms median (maks 592 ms) | E-16           |
| E2E (historis)     | Playwright                                     | build rilis         | 49/54; 5/5 isolated            | H-04, H-05     |
| Load/soak          | —                                              | —                   | NOT TESTED                     | H-03 (invalid) |
| Firefox/WebKit     | —                                              | —                   | NOT TESTED                     | —              |
| Screen reader      | —                                              | —                   | NOT TESTED                     | —              |

**Regresi minimum setelah perbaikan:** unit + probe P-009/038/042-045/051/052 +
axe 45 halaman unik + smoke 21 + review manual alur demo. E2E penuh memerlukan
staging dengan reset (di luar audit ini).

---

## 8. Remediation Roadmap

Ringkasan; detail acceptance criteria di
[`06-remediation-roadmap.md`](06-remediation-roadmap.md).

### 0–48 jam (mitigasi)

| Item                                                               | Temuan  | Owner          | Effort |
| ------------------------------------------------------------------ | ------- | -------------- | ------ |
| Guard demo pada policy publish/archive/copy + revoke/target/outbox | FND-001 | Backend/AppSec | M      |
| Same-origin pada 5 endpoint mutasi                                 | FND-002 | Backend        | S      |
| Hapus/auth `HEAD /admin/imports`                                   | FND-012 | Backend        | S      |
| Perbaiki parsing status `jsonError`                                | FND-021 | Backend        | S      |
| Patch klaim dokumentasi audit                                      | FND-016 | Docs/QA        | S      |

### 1–2 minggu

| Item                                       | Temuan  | Owner       | Effort |
| ------------------------------------------ | ------- | ----------- | ------ |
| Cap body + 413                             | FND-003 | Backend     | S      |
| Rate limit auth persisten + normalisasi IP | FND-004 | Backend/SRE | M      |
| Validasi `x-request-id`                    | FND-013 | Backend     | S      |
| Validasi UUID path param                   | FND-020 | Backend     | S      |
| Jalur ganti password sukarela              | FND-010 | Frontend    | S      |
| Deep link `?view=` + nav duplikat          | FND-014 | Frontend    | S      |
| Hardening outbox drain                     | FND-011 | Backend     | S      |
| Tampil-sekali sandi sementara              | FND-005 | Backend     | S      |

### 1–2 bulan

| Item                                           | Temuan           | Owner        | Effort |
| ---------------------------------------------- | ---------------- | ------------ | ------ |
| Enkripsi backup + retensi PII/audit            | FND-006, FND-019 | SRE/Backend  | M      |
| CI + SAST/SCA/SBOM/secret scan + observability | FND-008          | SRE/AppSec   | L      |
| Perbaikan kontras + reflow + axe di CI         | FND-007          | Frontend/UX  | M      |
| Lifecycle `is_demo` konten UI                  | FND-009          | Backend/Data | M      |
| Kuota/backoff SSE                              | FND-017          | Backend/SRE  | M      |

### Backlog

| Item                                               | Temuan  |
| -------------------------------------------------- | ------- |
| CSP nonce/hash                                     | FND-015 |
| Hapus/dokumentasikan API tanpa konsumen            | FND-018 |
| Coverage threshold, SBOM berkala, ekspor audit log | —       |

---

## 9. Release Gates & Re-test Plan

| Gate              | Kriteria                                   | Status saat audit         | Blocker            |
| ----------------- | ------------------------------------------ | ------------------------- | ------------------ |
| G1 Static         | lint/tsc/format/unit                       | PASS                      | —                  |
| G2 Smoke produksi | 21/21                                      | PASS                      | —                  |
| G3 Data           | 32 akun, 2.400 konten, rekonsiliasi        | PASS                      | —                  |
| G4 A11y           | 0 serious/critical WCAG 2.2 AA             | **FAIL**                  | FND-007            |
| G5 Authz          | demo containment + CSRF                    | **FAIL**                  | FND-001, 002       |
| G6 Load           | p95 dalam anggaran                         | **NOT TESTED**            | Bukti lama invalid |
| G7 Supply chain   | 0 critical produksi; SBOM                  | PASS (dev critical noted) | FND-008            |
| G8 Ops            | backup terenkripsi, retensi, observability | **FAIL**                  | FND-006/008/019    |
| G9 Docs           | angka akurat + artefak                     | **FAIL**                  | FND-016            |
| G10 Regression    | suite penuh di staging                     | NOT TESTED                | Read-only          |

**Keputusan:** produksi demo dapat dilanjutkan tanpa perubahan selama data
tetap sintetis dan akses demo dipahami publik. **Tidak ada rilis fitur baru**
sampai G4/G5 lulus dan P1 ditutup. Untuk data nyata, G6/G8 wajib lulus.

**Re-test plan**

1. Unit + probe regresi untuk FND-001/002/003/004/012/013/020/021.
2. Axe 45 halaman unik + reflow untuk FND-007.
3. Pemeriksaan konfigurasi backup/CI/observability untuk FND-006/008/019.
4. Smoke 21 + verify dataset setelah setiap perubahan.
5. Uji beban staging (bukan produksi) untuk FND-004/017 dan G6.

---

## 10. Unverified Areas & Next Actions

### 10.1 Tidak terverifikasi

| Area                                                                        | Alasan               | Prosedur berikutnya                                                             |
| --------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| 32 handler mutasi (submit/review/revise/revoke/import/target/policy/outbox) | Read-only            | Staging + reset; uji positif/negatif per peran; IDOR dengan ID milik peran lain |
| Step-up                                                                     | Tidak diuji          | Login + konfirmasi sandi; uji waktu kedaluwarsa                                 |
| Rate limit runtime                                                          | Tidak diuji          | Staging: 20 login gagal; amati 429 dan persistensi                              |
| Load/stress/soak                                                            | Dilarang di produksi | Staging 50/200 VU; jaringan stabil; catat p95/error                             |
| Firefox/WebKit                                                              | Tidak tersedia       | Playwright multi-browser di staging                                             |
| Screen reader                                                               | Tidak tersedia       | NVDA/VoiceOver manual pada 10 halaman utama                                     |
| Zoom 400% seluruh halaman                                                   | Subset               | Ulangi reflow untuk 45 halaman unik                                             |
| Vercel/Neon console (WAF, PITR, env)                                        | Di luar akses        | Review konfigurasi platform                                                     |
| Tile provider                                                               | Pihak ketiga         | Review kebijakan privasi/egress                                                 |
| Email/notifikasi eksternal                                                  | Tidak ada di kode    | Konfirmasi tidak ada kanal keluar                                               |
| Audit log tamper resistance                                                 | Tidak diuji          | Uji append-only/retensi                                                         |
| Backup restore                                                              | Tidak dijalankan     | Restore ke DB terpisah + verifikasi hitung                                      |
| PDF lintas dataset besar                                                    | Tidak diuji          | Uji 2.400 konten + 100k dataset                                                 |

### 10.2 Next actions

1. **Checkpoint D:** pengguna meninjau draf laporan ini.
2. Setujui roadmap 0–48 jam sebagai paket perbaikan terpisah (bukan audit ini).
3. Siapkan staging dengan reset terkontrol untuk menutup G6 dan alur mutasi.
4. Setelah perbaikan: jalankan re-test plan §9 dan perbarui evidence register.
5. **Checkpoint E:** persetujuan sebelum commit dokumen audit
   (`docs/audit/v2-audit-2026-11/**` saja).

### 10.3 Pernyataan penutup

Audit ini tidak menemukan bukti kebocoran data atau kompromi produksi.
Temuan utama bersifat **kontrol authorization/containment, ketahanan resource,
perlindungan data operasional, dan kualitas aksesibilitas** — semuanya dapat
diperbaiki tanpa mengubah arsitektur. Angka dan klaim di laporan ini dibatasi
oleh metode read-only; area yang tidak diuji dinyatakan eksplisit, bukan
diasumsikan lulus.

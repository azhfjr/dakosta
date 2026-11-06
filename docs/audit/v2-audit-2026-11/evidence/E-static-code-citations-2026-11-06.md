# Static Code Citations — Audit DAKOSTA v2 (2026-11)

Bukti statis untuk temuan yang tidak dapat dibuktikan lewat request read-only.
Metode: pembacaan kode dengan `rg`/`sed` pada `fix/all-features-hardening`
(`01c237b`), tanpa menjalankan mutasi. Waktu inspeksi: 2026-11-06T02:38Z.
Baris dapat bergeser bila kode berubah; verifikasi ulang dengan pola yang
disebut.

| Temuan          | Berkas:baris                                                              | Kutipan/perilaku yang diamati                                                                                                            |
| --------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| FND-001         | `src/lib/authz/capabilities.ts:56-62`                                     | `DEMO_BLOCKED` hanya berisi 5 capability: `hierarchy:manage`, `organization:manage`, `account:manage`, `account:reset`, `import:manage`. |
| FND-001         | `src/app/api/v1/admin/edufast/policies/publish/route.ts:16-19`            | `assertSameOrigin` + `requireMasterApi`; tidak ada assertion demo sebelum `publishPolicy`.                                               |
| FND-002         | `src/lib/authz/guards.ts:170-185`                                         | `assertSameOrigin`: `if (!origin) return;` — request tanpa Origin lolos guard.                                                           |
| FND-002         | `src/app/api/v1/submissions/route.ts:41-45`                               | `POST` memakai `getApiUserWithRole("CLIENT")`; tidak ada `assertSameOrigin`/`consumeRateLimit`.                                          |
| FND-002         | `src/app/api/v1/notifications/route.ts`                                   | `PATCH` tanpa `assertSameOrigin`; hanya sesi + validasi body.                                                                            |
| FND-002         | `src/app/api/v1/me/password/route.ts:20-23`                               | `POST` memakai `getApiUser`; tidak ada `assertSameOrigin`.                                                                               |
| FND-003         | `src/app/api/v1/submissions/route.ts:40-48`                               | `readJson` + `submissionInputSchema.parse` tanpa cap byte; body besar diparse penuh.                                                     |
| FND-004         | `src/lib/auth.ts:63-69`                                                   | Better Auth memakai limiter in-memory (global 60/60 dtk; sign-in 8/60 dtk; change-password 6/60 dtk).                                    |
| FND-004         | `src/lib/rate-limit.ts`                                                   | `consumeRateLimit` DB-backed untuk route yang memanggilnya; `getClientIp` memakai hop pertama `x-forwarded-for`.                         |
| FND-005         | `src/lib/accounts.ts:326,335,392`                                         | `generateTempPassword()` disimpan ke `password` create dan dikembalikan sebagai `tempPassword` pada hasil.                               |
| FND-005         | `src/lib/accounts.ts:581,584,597`                                         | Reset sandi menghasilkan `tempPassword`, memanggil `setPassword`, lalu mengembalikannya.                                                 |
| FND-005         | `src/lib/imports/accounts.ts:550`                                         | Hasil impor akun menyertakan `tempPassword` per akun.                                                                                    |
| FND-006         | `scripts/backup-db.ts:80-82`                                              | `select *` per tabel, `JSON.stringify(rows)`, ditulis ke `*.ndjson` plaintext tanpa enkripsi.                                            |
| FND-009         | `src/lib/submissions.ts:993`                                              | Payload konten baru menulis `isDemo: false` tanpa memeriksa aktor demo.                                                                  |
| FND-010         | `src/app/ganti-password/page.tsx:18-19`                                   | Halaman redirect ke `homePath` bila `mustChangePassword` false — tidak dapat diakses sukarela.                                           |
| FND-010         | `src/app/client/profil/page.tsx:179`                                      | Hanya profil STAKEHOLDER yang menautkan `/ganti-password`.                                                                               |
| FND-011         | `src/app/api/v1/admin/outbox/drain/route.ts`                              | `POST` master-only; tidak ada `assertSameOrigin`, `consumeRateLimit`, atau step-up.                                                      |
| FND-012         | `src/app/api/v1/admin/imports/route.ts:21-23`                             | `export async function HEAD() { return new NextResponse(null, { status: 204 }); }` tanpa auth.                                           |
| FND-013         | `src/lib/api.ts:12`                                                       | `getRequestId` mengembalikan `x-request-id` klien apa adanya, tanpa validasi format.                                                     |
| FND-014         | `src/lib/kpi/sql.ts:98-117`                                               | Parser filter hanya membaca `period`, `month`, `attribution`, `subTheme`, `stakeholderId`; tidak ada `view`.                             |
| FND-014         | `src/components/shell/navigation.tsx:74`                                  | Item `/admin/laporan` masih ada meski halaman redirect ke `/admin/analitik`.                                                             |
| FND-015         | `next.config.ts:27`                                                       | `script-src 'self' 'unsafe-inline'` tanpa nonce/hash.                                                                                    |
| FND-017         | `src/app/api/v1/realtime/notifications/route.ts:13-15,51`                 | `POLL_INTERVAL_MS = 2_500`, koneksi 55 dtk, `drainOutbox` dipanggil per koneksi.                                                         |
| FND-018         | `src/app/api/v1/dashboard/client/route.ts`, `src/app/api/v1/map/route.ts` | Tidak ditemukan pemanggil UI/tes; hanya terdaftar di inventaris.                                                                         |
| FND-019         | Skema Drizzle + `scripts/purge-demo-only.ts`                              | Tidak ada job retensi untuk `audit_logs`, `notifications`, `outbox_events`.                                                              |
| FND-020         | `src/lib/submissions.ts:354`                                              | `eq(schema.contentSubmissions.id, submissionId)` menerima string apa pun; PostgreSQL 22P02 menjadi 500.                                  |
| FND-021         | `src/lib/api.ts:83`                                                       | `Number(authLike?.status ?? authLike?.statusCode)`; nilai non-numerik menjadi `NaN` dan jatuh ke 500.                                    |
| Kontrol positif | `src/lib/csv.ts:1-13`                                                     | `FORMULA_PREFIX = /^[=+\-@\t\r]/` menetralkan formula injection; sel berisi `",\r\n` di-quote ganda.                                     |

## Catatan sanitasi

- Tidak ada nilai rahasia, token, cookie, atau PII dalam kutipan.
- Kutipan hanya menunjukkan kontrol/parameter, bukan data pengguna.

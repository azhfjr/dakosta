# Analisis Probe Negatif Aman — F2.3

- Tanggal: 2026-11-06T02:19:30Z
- Target: `https://dakosta-dakosta.vercel.app` (read-only)
- Harness: `harness/readonly-probes.mjs`
- Artefak mentah: `E-probes-2026-11-06T02-17-04Z.json` (54 probe: 48 PASS, 6 FAIL)
- Retest terpisah: `E-probe-password-retest-2026-11-06T02-18-03Z.json`

Semua probe yang gagal dianalisis sampai akar kode. Tidak ada payload bisnis valid
yang dikirim; tidak ada data dibuat atau diubah.

## Ringkasan 6 deviasi

| Probe | Rute                                                      | Peran       | Hasil | Harapan | Status    | Akar kode                                                                                                                            |
| ----- | --------------------------------------------------------- | ----------- | ----- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| P-009 | `HEAD /api/v1/admin/imports`                              | anon        | 204   | 401/405 | CONFIRMED | `src/app/api/v1/admin/imports/route.ts:21-23` — export `HEAD()` mengembalikan 204 tanpa auth                                         |
| P-038 | `GET /api/v1/submissions/not-a-uuid`                      | MASTER      | 500   | 400/404 | CONFIRMED | `src/lib/submissions.ts:354` — `eq(id, submissionId)` tanpa validasi UUID; Postgres menolak cast lalu error bocor sebagai 500        |
| P-042 | `POST /api/v1/submissions` (Origin: evil)                 | STAKEHOLDER | 400   | 403     | CONFIRMED | `src/app/api/v1/submissions/route.ts:43` — tidak ada `assertSameOrigin`; Zod menolak body invalid lebih dulu                         |
| P-043 | `PATCH /api/v1/notifications` (Origin: evil)              | STAKEHOLDER | 400   | 403     | CONFIRMED | `src/app/api/v1/notifications/route.ts:63` — tidak ada `assertSameOrigin`                                                            |
| P-044 | `POST /api/v1/me/password` (Origin: evil, password salah) | STAKEHOLDER | 500   | 403     | CONFIRMED | Tidak ada `assertSameOrigin`; error Better Auth dipetakan ke 500 oleh `src/lib/api.ts:83`                                            |
| P-045 | `POST /api/v1/admin/edufast/policies/publish` (UUID acak) | MASTER demo | 404   | 403     | CONFIRMED | `src/app/api/v1/admin/edufast/policies/publish/route.ts:16-19` — hanya `assertSameOrigin` + `requireMasterApi`; tidak ada demo guard |

## Akar 500 pada P-044 (dan kelas error Better Auth)

1. `better-call` menyimpan status sebagai string, bukan angka:
   `node_modules/better-call/dist/error.mjs:97-108` — `InternalAPIError` menyetel
   `this.status = status` (mis. `"BAD_REQUEST"`, `"FOUND"`) dan menghitung
   `this.statusCode = statusCodes[status]` (mis. 400).
2. `src/lib/api.ts:83` membaca `Number(authLike?.status ?? authLike?.statusCode)`.
   Karena `status` terisi string, `Number("BAD_REQUEST")` menghasilkan `NaN`,
   sehingga cabang 4xx dilewati dan jatuh ke `500 INTERNAL_ERROR` (baris 101-112).
3. Dampak: setiap kegagalan API Better Auth yang seharusnya 4xx (mis. password
   salah, sesi tidak valid) tampil sebagai 500. Ini juga menutupi respons yang
   benar untuk klien dan menyalahi kontrak error API.

## Akar P-009

Route mengekspor `HEAD` eksplisit tanpa guard:

```ts
export async function HEAD() {
  return new NextResponse(null, { status: 204 });
}
```

Ini bukan perilaku otomatis Next.js; handler ditulis manual. Endpoint tidak
membocorkan data (body kosong) tetapi memberi sinyal keberadaan route dan
melewati seluruh lapisan auth/audit.

## Akar P-038

`getSubmissionDetail` menerima `submissionId: string` dari path params dan
langsung memakainya di predicate `eq(schema.contentSubmissions.id, submissionId)`.
Kolom `id` bertipe `uuid`, sehingga Postgres mengembalikan
`invalid input syntax for type uuid`; error ini bukan `AppError`/`ZodError`,
jadi `jsonError` mengembalikannya sebagai 500. Rute serupa yang memvalidasi
UUID lebih dulu (mis. `z.string().uuid()`) tidak terkena.

## Akar P-042 / P-043 / P-044

Ketiga handler mutasi tidak memanggil `assertSameOrigin` sebelum membaca body:

- `src/app/api/v1/submissions/route.ts:43` (POST)
- `src/app/api/v1/notifications/route.ts:63` (PATCH)
- `src/app/api/v1/me/password/route.ts:20` (POST)

Sebagai pembanding, route yang memang memanggil guard mengembalikan 403 untuk
Origin asing: P-040 (`POST /api/v1/admin/reviews`, 403) dan P-045 (publish, 403
dari `assertSameOrigin`). Respons 400 pada P-042/P-043 berasal dari Zod
(`VALIDATION_ERROR`) karena body invalid; ini membuktikan guard absen, bukan
bekerja.

Catatan: `assertSameOrigin` juga short-circuit bila header `Origin` tidak ada
(`src/lib/authz/guards.ts:165-185`); P-041 menunjukkan body invalid tanpa Origin
menghasilkan 400, bukan 403.

## Akar P-045

`publishPolicy` dipanggil setelah `requireMasterApi`. Akun demo MASTER lolos
karena `DEMO_BLOCKED` hanya memuat lima capability
(`src/lib/authz/capabilities.ts:56-62`): `hierarchy:manage`, `organization:manage`,
`account:manage`, `account:reset`, `import:manage`. Tidak ada guard demo di
service EDUFAST policy. Respons 404 `Kebijakan tidak ditemukan` membuktikan
request mencapai service, bukan diblokir capability.

P-050 (review oleh BRANCH demo → 404) menunjukkan pola yang sama untuk alur
review. P-046/P-047 (revoke & target) tertutup oleh step-up 403, sehingga
kontainmen demo pada kedua alur itu belum dapat dibuktikan runtime dan
diklasifikasikan SUSPECTED.

## Kontrol yang terbukti bekerja

- Cookie sesi keempat peran: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Header keamanan: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, COOP,
  CORP, Permissions-Policy; `x-powered-by` absen.
- Scope isolation lintas peran: PASS (verify-demo-production).
- Step-up pada revoke dan target: 403 (P-046/P-047).
- Demo guard pada import konten: 403 (P-048) — kontrol positif.
- Rate limit export: `RateLimit-Limit: 10` (P-053).
- `x-request-id` dipantulkan apa adanya (P-051) — dicatat sebagai temuan P3.
- Body 2 MB: 400 validasi, tanpa 413 (P-052) — dicatat sebagai temuan P2.

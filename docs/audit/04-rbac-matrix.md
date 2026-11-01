# D4 — Matriks RBAC/ABAC (as-is dan target)

**Sumber kode:** `src/lib/authz/capabilities.ts`, `src/lib/authz/predicates.ts`, `src/lib/authz/guards.ts`, route API di `src/app/api/v1/**`.

## Matriks peran × modul

| Modul / aksi                        | Master Admin                  | Admin Kedeputian    | Admin Cabang              | Stakeholder        | Bukti                                                                                                                                                                                                                       |
| ----------------------------------- | ----------------------------- | ------------------- | ------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SLA Check — lihat antrean           | Semua                         | Wilayah (read-only) | Cabang sendiri            | —                  | target v1.1                                                                                                                                                                                                                 |
| SLA Check — approve/revisi/tolak    | Boleh (override)              | **Tidak boleh**     | **Boleh, cabang sendiri** | —                  | [review.ts:422](file:///C:/Users/PLN/Documents/Qoder/2026-10-30/b8cd74b6/src/lib/review.ts#L422), [reviews/route.ts:31](file:///C:/Users/PLN/Documents/Qoder/2026-10-30/b8cd74b6/src/app/api/v1/admin/reviews/route.ts#L31) |
| Dashboard (analitik+peta+tabel+CSV) | Global                        | Wilayah             | Cabang                    | Organisasi sendiri | target v1.1                                                                                                                                                                                                                 |
| Kinerja + print + PDF               | Global                        | Wilayah (read-only) | Cabang (read-only)        | —                  | target v1.1                                                                                                                                                                                                                 |
| Target per instansi                 | Kelola                        | Lihat               | Lihat                     | —                  | [capabilities.ts:32](file:///C:/Users/PLN/Documents/Qoder/2026-10-30/b8cd74b6/src/lib/authz/capabilities.ts#L32)                                                                                                            |
| Akun & hierarki                     | Kelola (tanpa lihat password) | Lihat               | Lihat                     | —                  | [capabilities.ts:19](file:///C:/Users/PLN/Documents/Qoder/2026-10-30/b8cd74b6/src/lib/authz/capabilities.ts#L19)                                                                                                            |
| Konten — buat/edit/submit           | Boleh                         | —                   | —                         | Milik organisasi   | [capabilities.ts:37](file:///C:/Users/PLN/Documents/Qoder/2026-10-30/b8cd74b6/src/lib/authz/capabilities.ts#L37)                                                                                                            |
| Ekspor CSV                          | Boleh                         | Boleh               | Boleh                     | Organisasi sendiri | `export:read` semua role                                                                                                                                                                                                    |
| Audit log                           | Boleh                         | Boleh               | Boleh                     | —                  | READ_ONLY                                                                                                                                                                                                                   |
| Red Notice                          | Boleh                         | Boleh               | Boleh                     | Organisasi sendiri | READ_ONLY                                                                                                                                                                                                                   |

## Matriks API (as-is)

| API                               | Guard saat ini                   | Scope     | Gap                                                   |
| --------------------------------- | -------------------------------- | --------- | ----------------------------------------------------- |
| `GET /api/v1/admin/reviews`       | `requireApiRole(MASTER, BRANCH)` | Ya        | — (regional 403 sesuai DEC-01)                        |
| `POST /api/v1/admin/reviews`      | role + rate limit + same-origin  | Ya        | —                                                     |
| `GET /api/v1/analytics/series`    | `getApiUser`                     | Ya        | tidak ada `analytics:read` eksplisit                  |
| `GET /api/v1/dashboard/admin`     | `getApiUser`                     | Ya        | tidak ada `analytics:read` eksplisit                  |
| `GET /api/v1/dashboard/client`    | `getApiUser`                     | Ya        | seharusnya role STAKEHOLDER                           |
| `GET /api/v1/map`                 | `getApiUser`                     | Ya        | tidak ada `map:read` eksplisit                        |
| `GET /api/v1/exports/submissions` | `getApiUser`                     | Ya        | tidak ada `export:read` eksplisit; cap 2.000          |
| `GET /api/v1/reports/achievement` | `getApiUser`                     | Ya        | tidak ada `performance:export`; stakeholder dapat PDF |
| `GET /api/v1/submissions`         | `getApiUser`                     | Ya        | semua role dapat list (ter-scope)                     |
| `POST /api/v1/submissions`        | `getApiUserWithRole(CLIENT)`     | Ya        | —                                                     |
| `GET /api/v1/admin/outbox/drain`  | `getApiUser`                     | **Tidak** | **P2: endpoint drain tanpa role guard**               |

## Target capability baru (S0)

| Capability           | Master | Kedeputian | Cabang | Stakeholder |
| -------------------- | ------ | ---------- | ------ | ----------- |
| `sla:read`           | ✓      | ✓          | ✓      | —           |
| `sla:review`         | ✓      | —          | ✓      | —           |
| `performance:read`   | ✓      | ✓          | ✓      | —           |
| `performance:export` | ✓      | ✓          | ✓      | —           |

Capability lama tetap dipertahankan. `REGIONAL_ADMIN` tetap `READ_ONLY` (tidak mendapat `sla:review`).

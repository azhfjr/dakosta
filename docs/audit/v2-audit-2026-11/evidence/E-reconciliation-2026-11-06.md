# Rekonsiliasi Angka — F3

- Tanggal: 2026-11-06
- Metode: hitung ulang dari runtime (vitest, Playwright, smoke, probe) dan statis
  (`inventory.mjs`, grep). Tidak ada mutasi data.
- Baseline: `fix/all-features-hardening` @ `01c237b`

## 1. Unit / integration

| Sumber                                                       | Klaim              | Terukur                   | Verdict               |
| ------------------------------------------------------------ | ------------------ | ------------------------- | --------------------- |
| `docs/audit/13-status.md:12`                                 | 120/120, 19 berkas | 120/120, 19 berkas (E-05) | **MATCH**             |
| `docs/audit/v2-audit-2026-11/00-README.md` (sebelum koreksi) | 20 berkas          | 19 berkas                 | **STALE** (dikoreksi) |

## 2. E2E Playwright

| Sumber                       | Klaim       | Terukur                                                                                   | Verdict                             |
| ---------------------------- | ----------- | ----------------------------------------------------------------------------------------- | ----------------------------------- |
| `docs/audit/13-status.md:16` | 53/54 lulus | `.tmp-e2e-final.log`: **49 lulus, 5 gagal, 54 total**; `.tmp-e2e-isolated.log`: 5/5 lulus | **STALE/OVERSTATED**                |
| `e2e/*.spec.ts` (statis)     | —           | 54 deklarasi `test(` (53 di dalam `describe` + 1 top-level di `dakosta.spec.ts:683`)      | Konsisten dengan 54 yang dieksekusi |
| `e2e/a11y.spec.ts` (statis)  | 4 tes       | **7 tes**; tag `wcag2a/2aa/21a/21aa` (tanpa `wcag22aa`)                                   | **STALE**; cakupan 2.2 tidak ada    |

Catatan: 5 kegagalan lama terkait sisa data target; lulus setelah reset pada run
terisolasi. Tidak ada run suite penuh 53/54 yang menjadi artefak, sehingga klaim
"53/54" tidak dapat dipertahankan. Audit ini tidak menjalankan E2E (read-only).

## 3. A11y

| Sumber                       | Klaim                              | Terukur                                                                                                                                                                                                                                                           | Verdict                                                                                  |
| ---------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `docs/audit/13-status.md:17` | axe WCAG 2.1 AA DONE (PASS), 4 tes | 7 tes, halaman terbatas; audit v2 45 halaman unik (46 kunjungan) menemukan **4 halaman dengan pelanggaran serious** (`/admin/analitik`, `/admin/peta`, `/client/analitik`, `/client/konten`) dan **2 overflow reflow** (`/cabang` 9 px pada 320 px dan zoom 400%) | **CONTRADICTED** untuk WCAG 2.2 AA; klaim lama hanya berlaku pada subset halaman/tag 2.1 |
| Harness v2 (E-15)            | —                                  | 45 halaman unik diaudit (46 kunjungan; 1 duplikat `/client` karena redirect `/ganti-password`); keyboard PASS; dialog PASS (focus inside + return); 0 pelanggaran di 41 halaman lain                                                                              | Baru                                                                                     |

Catatan: 4 pelanggaran adalah `color-contrast` (WCAG 2.0/2.1 SC 1.4.3), sehingga
bahkan klaim "WCAG 2.1 AA PASS" tidak berlaku untuk halaman-halaman tersebut.
Halaman `/ganti-password` diarahkan ke `/client` (lihat FND-010) dan diaudit
sebagai `/client`.

## 4. Route, halaman, dan handler

| Metrik                          | Klaim awal (plan/README) | Terukur (E-17)             | Delta                                               |
| ------------------------------- | ------------------------ | -------------------------- | --------------------------------------------------- |
| Halaman `page.tsx`              | 59                       | 59 (12 redirect-only)      | 0                                                   |
| Route file API                  | 46                       | 46                         | 0                                                   |
| Handler API                     | 56                       | 56                         | 0                                                   |
| Handler mutasi                  | 30                       | **32**                     | +2; penghitungan lama per file, sekarang per metode |
| Handler publik                  | 3 endpoint               | 3 endpoint / **4 handler** | +1 handler (auth GET+POST)                          |
| Handler MASTER_ADMIN            | 26 route file            | **32 handler**             | +6; per handler                                     |
| Handler review                  | 2 route file             | **3 handler**              | +1; per handler                                     |
| Handler scope-dependent         | 14 route file            | **16 handler**             | +2; per handler                                     |
| Mutasi tanpa `assertSameOrigin` | 6                        | 6                          | 0                                                   |
| Mutasi tanpa `consumeRateLimit` | 16                       | **18**                     | +2; per handler                                     |
| Mutasi master tanpa demo guard  | 10                       | **11**                     | +1; per handler                                     |

Angka final yang dipakai di laporan adalah angka **per handler** (E-17). Perbedaan
dengan angka lama dijelaskan oleh perbedaan satuan hitung (file vs handler), bukan
oleh perubahan kode.

## 5. Produksi

| Pemeriksaan                        | Klaim | Terukur                                                               | Verdict         |
| ---------------------------------- | ----- | --------------------------------------------------------------------- | --------------- |
| Smoke                              | 21/21 | 21/21 (E-10)                                                          | **MATCH**       |
| Akun demo                          | 32/32 | 32/32 (E-11)                                                          | **MATCH**       |
| Konten demo                        | 2.400 | 2.400 (E-11)                                                          | **MATCH**       |
| Login 4 peran                      | lulus | lulus (E-10, E-11)                                                    | **MATCH**       |
| Rekonsiliasi dashboard/kinerja/CSV | lulus | dashboard 40, CSV admin 40, kinerja wilayah 18, CSV wilayah 18 (E-10) | **MATCH**       |
| Probe negatif                      | —     | 54 probe; 48 lulus, 6 gagal (E-12)                                    | Baru            |
| TTFB                               | —     | median 59–402 ms; max 592 ms (E-16)                                   | Baru, indikatif |

## 6. Supply chain

| Pemeriksaan            | Klaim         | Terukur                                                                               | Verdict               |
| ---------------------- | ------------- | ------------------------------------------------------------------------------------- | --------------------- |
| `npm audit --omit=dev` | 0 kerentanan  | 0 (E-06)                                                                              | **MATCH**             |
| `npm audit` penuh      | tidak diklaim | 25 advisories; 1 critical dev-only `better-auth@1.4.22` via `@better-auth/cli` (E-07) | **Temuan baru (dev)** |
| SBOM                   | tidak ada     | CycloneDX dihasilkan (E-08)                                                           | Baru                  |
| Secret scan            | tidak ada     | 0 temuan (E-09)                                                                       | Baru                  |

## 7. Build dan load

| Item                   | Status                        | Alasan                                                              |
| ---------------------- | ----------------------------- | ------------------------------------------------------------------- |
| `npm run build:verify` | **NOT TESTED** pada audit ini | Di luar F2.1; klaim lama di `13-status.md` memakai artefak historis |
| Load 50 VU / soak      | **NOT TESTED**                | Read-only; bukti lama H-03 di jaringan rusak                        |
| Perf 100k              | **PASS historis** (H-01)      | Tidak diulang; bukan produksi                                       |

## 8. Koreksi dokumentasi yang diusulkan (belum diterapkan)

1. `13-status.md:16` — ganti "53/54" dengan "49/54; 5/5 lulus pada rerun terisolasi".
2. `13-status.md:17` — ganti "DONE (PASS), 4 tes" dengan "7 tes WCAG 2.1 pada subset
   halaman; WCAG 2.2 AA belum; audit v2 menemukan 4 halaman contrast + 2 reflow".
3. `00-README.md` — angka handler per metode (sudah dikoreksi di direktori v2).
4. `13-status.md:84` — "111/111" adalah pernyataan historis untuk commit `51c92be`,
   bukan klaim current; pertahankan dengan anotasi commit.

import { z } from "zod";

import { jakartaToday } from "@/lib/dates";

export const PLATFORMS = [
  "INSTAGRAM",
  "FACEBOOK",
  "X",
  "TIKTOK",
  "YOUTUBE",
  "WEBSITE",
  "LAINNYA",
] as const;

export type Platform = (typeof PLATFORMS)[number];

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Gunakan format tanggal YYYY-MM-DD.");

const publishedUrlSchema = z
  .string()
  .trim()
  .min(12, "Tautan konten wajib diisi.")
  .max(2048, "Tautan terlalu panjang.")
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Tautan harus berupa URL https yang valid.");

export const submissionLocationSchema = z.object({
  latitude: z
    .number()
    .finite("Koordinat tidak valid.")
    .min(-90, "Lintang minimal -90.")
    .max(90, "Lintang maksimal 90."),
  longitude: z
    .number()
    .finite("Koordinat tidak valid.")
    .min(-180, "Bujur minimal -180.")
    .max(180, "Bujur maksimal 180."),
  label: z
    .string()
    .trim()
    .min(3, "Beri nama lokasi minimal 3 karakter.")
    .max(160, "Nama lokasi terlalu panjang."),
  source: z.enum(["device_gps", "manual_pin"]),
  accuracyMeters: z.number().finite().positive().max(100_000).nullish(),
  consentAt: z.string().datetime({ offset: true }).nullish(),
});

export type SubmissionLocationInput = z.infer<typeof submissionLocationSchema>;

export const submissionInputSchema = z
  .object({
    action: z.enum(["DRAFT", "SUBMIT"]),
    submissionId: z.string().uuid().optional(),
    idempotencyKey: z.string().trim().min(8).max(120),
    stakeholderId: z.string().uuid("Stakeholder tidak valid."),
    publishedUrl: publishedUrlSchema,
    platform: z.enum(PLATFORMS, "Platform tidak dikenal."),
    themeId: z.string().uuid("Tema tidak valid."),
    title: z.string().trim().max(140, "Judul maksimal 140 karakter.").optional(),
    narrative: z.string().trim().max(5000, "Narasi maksimal 5000 karakter.").optional(),
    dateCreated: dateOnlySchema,
    publishedAt: dateOnlySchema.nullish(),
    location: submissionLocationSchema.nullish(),
    duplicateAcknowledged: z.boolean().optional(),
    privacyAttested: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    const today = jakartaToday();

    if (value.dateCreated > today) {
      context.addIssue({
        code: "custom",
        path: ["dateCreated"],
        message: "Tanggal pembuatan konten tidak boleh di masa depan.",
      });
    }

    if (value.publishedAt && value.publishedAt > today) {
      context.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Tanggal terbit tidak boleh di masa depan.",
      });
    }

    if (value.action !== "SUBMIT") return;

    if (!value.narrative || value.narrative.length < 40) {
      context.addIssue({
        code: "custom",
        path: ["narrative"],
        message: "Narasi minimal 40 karakter agar dapat divalidasi admin.",
      });
    }

    if (!value.location) {
      context.addIssue({
        code: "custom",
        path: ["location"],
        message: "Lokasi konten wajib ditandai sebelum dikirim.",
      });
    }

    if (!value.privacyAttested) {
      context.addIssue({
        code: "custom",
        path: ["privacyAttested"],
        message: "Konfirmasi bahwa konten tidak memuat data pribadi diperlukan.",
      });
    }

    if (value.location?.source === "device_gps" && !value.location.consentAt) {
      context.addIssue({
        code: "custom",
        path: ["location", "consentAt"],
        message: "Persetujuan penggunaan lokasi perangkat diperlukan.",
      });
    }
  });

export type SubmissionInput = z.infer<typeof submissionInputSchema>;

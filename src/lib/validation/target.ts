import { z } from "zod";

import { SUB_THEMES } from "@/lib/taxonomy";

export const targetMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Periode harus berformat YYYY-MM.");

export const targetCreateSchema = z.object({
  month: targetMonthSchema,
  stakeholderId: z.string().uuid().nullable().optional(),
  subTheme: z.enum(SUB_THEMES).nullable().optional(),
  targetCount: z.number().int().min(0).max(1_000_000),
  reportingUnit: z.string().trim().min(1).max(40).optional(),
});

export const targetUpdateSchema = z
  .object({
    stakeholderId: z.string().uuid().nullable().optional(),
    subTheme: z.enum(SUB_THEMES).nullable().optional(),
    targetCount: z.number().int().min(0).max(1_000_000).optional(),
    reportingUnit: z.string().trim().min(1).max(40).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Tidak ada perubahan yang dikirim.",
  });

export type TargetCreateInput = z.infer<typeof targetCreateSchema>;
export type TargetUpdateInput = z.infer<typeof targetUpdateSchema>;

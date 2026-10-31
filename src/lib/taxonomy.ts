export const MAIN_THEMES = ["EDUFAST", "NON_EDUFAST"] as const;
export type MainTheme = (typeof MAIN_THEMES)[number];

export const MAIN_THEME_LABELS: Record<MainTheme, string> = {
  EDUFAST: "EDUFAST",
  NON_EDUFAST: "Non-EDUFAST",
};

export const SUB_THEMES = [
  "MOBILE_JKN",
  "TESTIMONI_PESERTA",
  "ALUR_BEROBAT",
  "EDUKATIF_PERSUASIF",
  "KORPORAT",
  "INFORMASI",
] as const;
export type SubTheme = (typeof SUB_THEMES)[number];

export const SUB_THEME_LABELS: Record<SubTheme, string> = {
  MOBILE_JKN: "Mobile JKN",
  TESTIMONI_PESERTA: "Testimoni Peserta",
  ALUR_BEROBAT: "Alur Berobat",
  EDUKATIF_PERSUASIF: "Edukatif Persuasif",
  KORPORAT: "Korporat",
  INFORMASI: "Informasi",
};

export const CONTENT_TYPES = ["VIDEO", "INFOGRAFIS"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  VIDEO: "Video",
  INFOGRAFIS: "Infografis",
};

export const LEGACY_THEME_TO_SUBTHEME: Record<string, SubTheme> = {
  "edukasi-jkn": "INFORMASI",
  "layanan-primer": "INFORMASI",
  "kesehatan-ibu-anak": "INFORMASI",
  "pencegahan-penyakit": "INFORMASI",
  "transformasi-digital": "MOBILE_JKN",
  "mobile-jkn": "MOBILE_JKN",
  testimoni: "TESTIMONI_PESERTA",
  "alur-berobat": "ALUR_BEROBAT",
  "edukatif-persuasif": "EDUKATIF_PERSUASIF",
  korporat: "KORPORAT",
  informatif: "INFORMASI",
  informasi: "INFORMASI",
};

export function isMainTheme(value: unknown): value is MainTheme {
  return typeof value === "string" && (MAIN_THEMES as readonly string[]).includes(value);
}

export function isSubTheme(value: unknown): value is SubTheme {
  return typeof value === "string" && (SUB_THEMES as readonly string[]).includes(value);
}

export function isContentType(value: unknown): value is ContentType {
  return typeof value === "string" && (CONTENT_TYPES as readonly string[]).includes(value);
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function periodOfDate(dateOnly: string): string {
  return dateOnly.slice(0, 7);
}

export function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentPeriod(): string {
  return periodOfDate(jakartaToday());
}

export function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, 1));
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidPeriod(value: string): boolean {
  return PERIOD_PATTERN.test(value);
}

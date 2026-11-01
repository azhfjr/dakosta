const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export type PeriodGranularity = "MONTH" | "QUARTER" | "YEAR";

export type Period = {
  key: string;
  granularity: PeriodGranularity;
  year: number;
  month?: number;
  quarter?: number;
  /** Inclusive first calendar date in Asia/Jakarta (YYYY-MM-DD). */
  startDate: string;
  /** Inclusive last calendar date in Asia/Jakarta (YYYY-MM-DD). */
  endDate: string;
  /** Instant of 00:00:00 WIB on startDate. */
  start: Date;
  /** Exclusive instant of 00:00:00 WIB on the day after endDate. */
  endExclusive: Date;
  label: string;
};

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const ROMAN = ["I", "II", "III", "IV"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function jakartaParts(reference: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: read("year"), month: read("month"), day: read("day") };
}

function startInstant(year: number, month: number, day = 1): Date {
  return new Date(Date.UTC(year, month - 1, day) - WIB_OFFSET_MS);
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function build(
  granularity: PeriodGranularity,
  year: number,
  month: number,
  quarter?: number,
): Period {
  const startMonth =
    granularity === "YEAR"
      ? 1
      : granularity === "QUARTER"
        ? (quarter! - 1) * 3 + 1
        : month;
  const endMonth =
    granularity === "YEAR"
      ? 12
      : granularity === "QUARTER"
        ? startMonth + 2
        : startMonth;
  const endDay = lastDay(year, endMonth);
  const nextYear = endMonth === 12 ? year + 1 : year;
  const nextMonth = endMonth === 12 ? 1 : endMonth + 1;
  const key =
    granularity === "YEAR"
      ? String(year)
      : granularity === "QUARTER"
        ? `${year}-Q${quarter}`
        : `${year}-${pad(startMonth)}`;
  const label =
    granularity === "YEAR"
      ? `Tahun ${year}`
      : granularity === "QUARTER"
        ? `Triwulan ${ROMAN[quarter! - 1]} ${year}`
        : `${MONTH_NAMES[startMonth - 1]} ${year}`;
  return {
    key,
    granularity,
    year,
    month: granularity === "MONTH" ? startMonth : undefined,
    quarter: granularity === "QUARTER" ? quarter : undefined,
    startDate: dateKey(year, startMonth, 1),
    endDate: dateKey(year, endMonth, endDay),
    start: startInstant(year, startMonth, 1),
    endExclusive: startInstant(nextYear, nextMonth, 1),
    label,
  };
}

export function currentMonthPeriod(reference = new Date()): Period {
  const { year, month } = jakartaParts(reference);
  return build("MONTH", year, month);
}

export function currentQuarterPeriod(reference = new Date()): Period {
  const { year, month } = jakartaParts(reference);
  return build("QUARTER", year, month, Math.ceil(month / 3));
}

export function currentYearPeriod(reference = new Date()): Period {
  const { year } = jakartaParts(reference);
  return build("YEAR", year, 1);
}

export function monthPeriod(year: number, month: number): Period {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("Periode bulan tidak valid.");
  }
  return build("MONTH", year, month);
}

export function quarterPeriod(year: number, quarter: number): Period {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(quarter) ||
    quarter < 1 ||
    quarter > 4
  ) {
    throw new Error("Periode triwulan tidak valid.");
  }
  return build("QUARTER", year, year, quarter);
}

export function yearPeriod(year: number): Period {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    throw new Error("Periode tahun tidak valid.");
  }
  return build("YEAR", year, 1);
}

/**
 * Accepts `YYYY-MM`, `YYYY-Q1..Q4`, or `YYYY`. Invalid or absent input falls
 * back to the current month in Asia/Jakarta; the caller still receives a valid
 * period so pages never render an unbounded range.
 */
export function parsePeriod(
  input?: string | string[] | null,
  reference = new Date(),
): Period {
  const value = (Array.isArray(input) ? input[0] : input)?.trim();
  if (!value) return currentMonthPeriod(reference);
  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) {
    const year = Number(month[1]);
    const monthNumber = Number(month[2]);
    if (year >= 2000 && year <= 2200 && monthNumber >= 1 && monthNumber <= 12) {
      return monthPeriod(year, monthNumber);
    }
  }
  const quarter = /^(\d{4})-Q([1-4])$/i.exec(value);
  if (quarter) {
    const year = Number(quarter[1]);
    if (year >= 2000 && year <= 2200) {
      return quarterPeriod(year, Number(quarter[2]));
    }
  }
  const yearOnly = /^(\d{4})$/.exec(value);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (year >= 2000 && year <= 2200) return yearPeriod(year);
  }
  return currentMonthPeriod(reference);
}

export function periodOptions(reference = new Date()): {
  months: { value: string; label: string }[];
  quarters: { value: string; label: string }[];
  years: { value: string; label: string }[];
} {
  const { year, month } = jakartaParts(reference);
  const months: { value: string; label: string }[] = [];
  for (let offset = 0; offset < 24; offset += 1) {
    const index = year * 12 + (month - 1) - offset;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    const period = monthPeriod(y, m);
    months.push({ value: period.key, label: period.label });
  }
  const quarters: { value: string; label: string }[] = [];
  for (let offset = 0; offset < 8; offset += 1) {
    const index = year * 4 + Math.ceil(month / 3) - 1 - offset;
    const y = Math.floor(index / 4);
    const q = (index % 4) + 1;
    const period = quarterPeriod(y, q);
    quarters.push({ value: period.key, label: period.label });
  }
  const years: { value: string; label: string }[] = [];
  for (let y = year; y >= year - 5; y -= 1) {
    years.push({ value: String(y), label: `Tahun ${y}` });
  }
  return { months, quarters, years };
}

export function periodMonthKeys(period: Period): string[] {
  const [startYear, startMonth] = period.startDate.split("-").map(Number);
  const [endYear, endMonth] = period.endDate.split("-").map(Number);
  const keys: string[] = [];
  let cursor = startYear * 12 + (startMonth - 1);
  const last = endYear * 12 + (endMonth - 1);
  while (cursor <= last) {
    const year = Math.floor(cursor / 12);
    const month = (cursor % 12) + 1;
    keys.push(`${year}-${pad(month)}`);
    cursor += 1;
  }
  return keys;
}

export function previousPeriod(period: Period): Period {
  if (period.granularity === "YEAR") {
    return yearPeriod(period.year - 1);
  }
  if (period.granularity === "QUARTER") {
    return period.quarter === 1
      ? quarterPeriod(period.year - 1, 4)
      : quarterPeriod(period.year, period.quarter! - 1);
  }
  return period.month === 1
    ? monthPeriod(period.year - 1, 12)
    : monthPeriod(period.year, period.month! - 1);
}

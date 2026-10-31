const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const monthStartFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
});

const todayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const numberFormatter = new Intl.NumberFormat("id-ID");

export function jakartaMonthStart(reference = new Date()): Date {
  const parts = monthStartFormatter.formatToParts(reference);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");

  // WIB tidak memakai DST sehingga offset tetap UTC+7.
  return new Date(Date.UTC(year, month - 1, 1) - WIB_OFFSET_MS);
}

export function jakartaToday(reference = new Date()): string {
  return todayFormatter.format(reference);
}

export function formatDateId(value: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export function formatDateTimeId(value: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function formatNumberId(value: number): string {
  return numberFormatter.format(value);
}

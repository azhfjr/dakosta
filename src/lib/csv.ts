const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Cegah formula injection saat file dibuka di spreadsheet.
  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvHeaderLine(headers: string[]): string {
  // BOM membantu Excel mengenali UTF-8.
  return `\uFEFF${headers.map(cell).join(",")}\r\n`;
}

export function csvBody(rows: Array<Array<unknown>>): string {
  if (rows.length === 0) return "";
  return `${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  return csvHeaderLine(headers) + csvBody(rows);
}

export function csvFileName(
  prefix: string,
  date = new Date(),
  period?: string,
): string {
  if (period) return `${prefix}-${period}.csv`;
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return `${prefix}-${stamp}.csv`;
}

import { monthRange } from "@/lib/kpi/formulas";
import { periodMonthKeys, type Period } from "@/lib/periods";

/**
 * Month keys ending at the period's final month. Ensures trend charts always
 * include every month of a quarter/year period plus enough trailing context.
 */
export function trailingMonthKeys(period: Period, minimum = 6): string[] {
  const months = periodMonthKeys(period);
  const last = months[months.length - 1]!;
  const [year, month] = last.split("-").map(Number) as [number, number];
  const total = Math.max(minimum, months.length);
  const keys: string[] = [];
  for (let offset = total - 1; offset >= 0; offset -= 1) {
    const index = year * 12 + (month - 1) - offset;
    const keyYear = Math.floor(index / 12);
    const keyMonth = (index % 12) + 1;
    keys.push(`${keyYear}-${String(keyMonth).padStart(2, "0")}`);
  }
  return keys;
}

export function monthWindow(keys: string[]): { start: string; end: string } {
  const first = monthRange(keys[0]!);
  const last = monthRange(keys[keys.length - 1]!);
  return { start: first.startLocal, end: last.endLocal };
}

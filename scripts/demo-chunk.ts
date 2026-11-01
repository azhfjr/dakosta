/**
 * PostgreSQL allows at most 65,535 bind parameters per statement. Wide rows
 * (content submissions have ~35 columns) overflow that limit long before the
 * demo dataset is exhausted, so every large write is split into chunks.
 */
export const DEMO_CHUNK = 500;

export function chunk<T>(items: readonly T[], size = DEMO_CHUNK): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`Ukuran chunk tidak valid: ${size}`);
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Klasifikasi galat koneksi Neon (WebSocket putus) agar pembacaan bisa diulang
 * sekali. Penulisan tidak pernah diulang: transaksi sudah punya idempotensi
 * sendiri dan pengulangan buta dapat menggandakan efek.
 */
const TRANSIENT_PATTERN =
  /connection terminated|connection timeout|timeout exceeded|econnreset|econnrefused|epipe|socket hang up|websocket|terminating connection|server closed the connection/i;

function isWebSocketErrorEvent(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.type === "error" &&
    "timeStamp" in record &&
    !("message" in record && record.message)
  );
}

export function isTransientConnectionError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (isWebSocketErrorEvent(current)) return true;
    const record = current as { message?: unknown; cause?: unknown };
    if (
      typeof record.message === "string" &&
      TRANSIENT_PATTERN.test(record.message)
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

export function isRetriableRead(text: string): boolean {
  const trimmed = text.trim();
  if (/^select\b/i.test(trimmed))
    return !/\bfor (update|share)\b/i.test(trimmed);
  if (/^with\b/i.test(trimmed)) {
    return !/\b(insert|update|delete|merge)\b/i.test(trimmed);
  }
  return false;
}

export function statementText(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object" && "text" in input) {
    const text = (input as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return "";
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferenceCode(reference = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(reference);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";

  let suffix = "";
  for (let index = 0; index < 5; index += 1) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }

  return `DKS-${year}${month}-${suffix}`;
}

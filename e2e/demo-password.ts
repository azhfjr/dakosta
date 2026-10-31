import { config } from "dotenv";

config({ path: ".env.staging.local", quiet: true });

/**
 * Kata sandi demo hanya dibaca dari env dan tidak pernah dicetak ke output.
 */
export function demoPassword(): string {
  const value = process.env.DEMO_SEED_PASSWORD;
  if (!value) {
    throw new Error(
      "DEMO_SEED_PASSWORD tidak tersedia. Muat .env.staging.local sebelum menjalankan E2E.",
    );
  }
  return value;
}

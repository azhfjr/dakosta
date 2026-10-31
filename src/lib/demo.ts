export const DEMO_ACCOUNTS = {
  admin: {
    email: "admin@demo.dakosta.local",
    label: "Masuk sebagai Admin DEMO",
    redirectTo: "/admin",
  },
  client: {
    email: "mitra.nusantara@demo.dakosta.local",
    label: "Masuk sebagai Stakeholder DEMO",
    redirectTo: "/client",
  },
} as const;

export type DemoRole = keyof typeof DEMO_ACCOUNTS;

export function isDemoRole(value: unknown): value is DemoRole {
  return value === "admin" || value === "client";
}

export function getDemoSeedPassword(): string {
  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      "DEMO_SEED_PASSWORD wajib diatur (minimal 12 karakter). Nilai tidak pernah dicetak ke log.",
    );
  }
  return password;
}

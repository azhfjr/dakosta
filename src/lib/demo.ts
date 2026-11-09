import type { AppRole } from "@/lib/authz/types";

export const DEMO_ACCOUNTS = {
  admin: {
    email: "admin@demo.dakosta.local",
    label: "Master Admin",
    redirectTo: "/admin",
  },
  regional: {
    email: "wilayah.a@demo.dakosta.local",
    label: "Admin Wilayah A",
    redirectTo: "/wilayah/dashboard",
  },
  regionalB: {
    email: "wilayah.b@demo.dakosta.local",
    label: "Admin Wilayah B",
    redirectTo: "/wilayah/dashboard",
  },
  branch: {
    email: "cabang.a1@demo.dakosta.local",
    label: "Admin Cabang A1",
    redirectTo: "/cabang/dashboard",
  },
  branchA2: {
    email: "cabang.a2@demo.dakosta.local",
    label: "Admin Cabang A2",
    redirectTo: "/cabang/dashboard",
  },
  branchB1: {
    email: "cabang.b1@demo.dakosta.local",
    label: "Admin Cabang B1",
    redirectTo: "/cabang/dashboard",
  },
  client: {
    email: "mitra.nusantara@demo.dakosta.local",
    // The volume demo seeder provisions mitra.NN accounts instead; quick login
    // must resolve both datasets or the stakeholder role cannot sign in.
    alternateEmails: [
      "mitra.01@demo.dakosta.local",
      "mitra.02@demo.dakosta.local",
      "mitra.03@demo.dakosta.local",
    ],
    label: "Stakeholder",
    redirectTo: "/client",
  },
} as const;

export type DemoRole = keyof typeof DEMO_ACCOUNTS;

export const DEMO_ROLE_APP_ROLE: Record<DemoRole, AppRole> = {
  admin: "MASTER_ADMIN",
  regional: "REGIONAL_ADMIN",
  regionalB: "REGIONAL_ADMIN",
  branch: "BRANCH_ADMIN",
  branchA2: "BRANCH_ADMIN",
  branchB1: "BRANCH_ADMIN",
  client: "STAKEHOLDER",
};

export function isDemoRole(value: unknown): value is DemoRole {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(DEMO_ACCOUNTS, value)
  );
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

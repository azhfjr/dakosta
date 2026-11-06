import { describe, expect, it } from "vitest";

import {
  assertNotDemoActor,
  assertNotDemoMaster,
  DEMO_MUTATION_MESSAGE,
} from "@/lib/authz/demo-policy";
import { AppError } from "@/lib/errors";

describe("assertNotDemoActor", () => {
  it("menolak akun demo dengan 403", () => {
    try {
      assertNotDemoActor({ isDemo: true });
      throw new Error("guard tidak melempar galat");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.status).toBe(403);
      expect(appError.code).toBe("FORBIDDEN");
      expect(appError.message).toBe(DEMO_MUTATION_MESSAGE);
    }
  });

  it("meloloskan akun non-demo", () => {
    expect(() => assertNotDemoActor({ isDemo: false })).not.toThrow();
  });
});

describe("assertNotDemoMaster", () => {
  it("menolak Master demo dengan 403", () => {
    try {
      assertNotDemoMaster({ isDemo: true, role: "MASTER_ADMIN" });
      throw new Error("guard tidak melempar galat");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(403);
    }
  });

  it("meloloskan reviewer cabang demo agar alur demo tetap berjalan", () => {
    expect(() =>
      assertNotDemoMaster({ isDemo: true, role: "BRANCH_ADMIN" }),
    ).not.toThrow();
  });

  it("meloloskan Master non-demo", () => {
    expect(() =>
      assertNotDemoMaster({ isDemo: false, role: "MASTER_ADMIN" }),
    ).not.toThrow();
  });
});

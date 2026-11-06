import { describe, expect, it } from "vitest";

import {
  assertNotDemoActor,
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

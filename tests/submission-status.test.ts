import { describe, expect, it } from "vitest";

import { PENDING_STATUSES, normalizeStatus } from "@/lib/content-status";
import { AppError } from "@/lib/errors";
import { assertSubmissionEditable } from "@/lib/submissions";

function codeOf(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof AppError ? error.code : "UNKNOWN";
  }
}

describe("submission edit gate", () => {
  it("allows drafts and revision requests", () => {
    expect(codeOf(() => assertSubmissionEditable("DRAFT"))).toBeNull();
    expect(
      codeOf(() => assertSubmissionEditable("REVISION_REQUIRED")),
    ).toBeNull();
  });

  it("allows legacy revision statuses after normalization", () => {
    for (const status of ["REJECTED", "REVOKED"]) {
      expect(normalizeStatus(status)).toBe("REVISION_REQUIRED");
      expect(codeOf(() => assertSubmissionEditable(status))).toBeNull();
    }
  });

  it("rejects in-flight and approved statuses with an actionable conflict", () => {
    for (const status of ["SUBMITTED", "APPROVED"]) {
      expect(codeOf(() => assertSubmissionEditable(status))).toBe("CONFLICT");
    }
  });
});

describe("review gate", () => {
  it("keeps every status that a reviewer may decide", () => {
    expect([...PENDING_STATUSES]).toEqual(["SUBMITTED"]);
  });
});

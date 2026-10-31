import { describe, expect, it } from "vitest";

import { PENDING_STATUSES } from "@/lib/content-status";
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
    expect(codeOf(() => assertSubmissionEditable("REVISION_REQUIRED"))).toBeNull();
  });

  it("rejects terminal and in-flight statuses with an actionable conflict", () => {
    for (const status of [
      "SUBMITTED",
      "RESUBMITTED",
      "IN_REVIEW",
      "APPROVED",
      "REJECTED",
      "REVOKED",
      "ARCHIVED",
    ]) {
      expect(codeOf(() => assertSubmissionEditable(status))).toBe("CONFLICT");
    }
  });
});

describe("review gate", () => {
  it("keeps every status that a reviewer may decide", () => {
    expect([...PENDING_STATUSES].sort()).toEqual([
      "IN_REVIEW",
      "RESUBMITTED",
      "SUBMITTED",
    ]);
  });
});

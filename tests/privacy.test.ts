import { describe, expect, it } from "vitest";

import { duplicateDetails, duplicateMessage } from "@/lib/privacy/duplicate";

const match = {
  inScope: true,
  id: "sub-1",
  referenceCode: "DKS-2026-0001",
  status: "APPROVED",
  stakeholderName: "Klinik Sehat Nusantara",
};

describe("duplicate URL privacy", () => {
  it("returns no identity when no duplicate exists", () => {
    expect(duplicateDetails(null)).toEqual({ inScope: false });
  });

  it("never leaks identity for duplicates outside the reporter scope", () => {
    const details = duplicateDetails({ ...match, inScope: false });
    expect(details).toEqual({ inScope: false });
    const serialized = JSON.stringify(details);
    expect(serialized).not.toContain(match.referenceCode);
    expect(serialized).not.toContain(match.stakeholderName);
    expect(serialized).not.toContain(match.id);
    expect(duplicateMessage({ ...match, inScope: false })).not.toMatch(
      /organisasi lain|DKS-/,
    );
  });

  it("returns identifying detail only inside the reporter scope", () => {
    expect(duplicateDetails(match)).toEqual({
      inScope: true,
      submissionId: match.id,
      referenceCode: match.referenceCode,
      status: match.status,
      stakeholderName: match.stakeholderName,
    });
  });
});

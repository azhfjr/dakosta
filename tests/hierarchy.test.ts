import { describe, expect, it } from "vitest";

import {
  createOrganizationInputSchema,
  normalizeFaskesCode,
} from "@/lib/hierarchy-admin";

const base = {
  name: "Puskesmas Sukajadi",
  branchOfficeId: "11111111-1111-4111-8111-111111111111",
  serviceArea: "Kecamatan Sukajadi",
  latitude: -6.9,
  longitude: 107.6,
  status: "ACTIVE" as const,
};

describe("organization input", () => {
  it("accepts a Faskes with class and code", () => {
    const parsed = createOrganizationInputSchema.parse({
      ...base,
      organizationType: "FASKES",
      faskesClass: "FKTP",
      faskesCode: "0101U001",
    });
    expect(parsed.organizationType).toBe("FASKES");
  });

  it("rejects Faskes without a class", () => {
    const result = createOrganizationInputSchema.safeParse({
      ...base,
      organizationType: "FASKES",
      faskesCode: "0101U001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects Faskes without a code", () => {
    const result = createOrganizationInputSchema.safeParse({
      ...base,
      organizationType: "FASKES",
      faskesClass: "FKRTL",
    });
    expect(result.success).toBe(false);
  });

  it("rejects PEMDA carrying Faskes fields", () => {
    const result = createOrganizationInputSchema.safeParse({
      ...base,
      organizationType: "PEMDA",
      faskesClass: "FKTP",
      faskesCode: "0101U001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects coordinates outside the valid range", () => {
    const result = createOrganizationInputSchema.safeParse({
      ...base,
      organizationType: "OTHER",
      latitude: -95,
    });
    expect(result.success).toBe(false);
  });
});

describe("faskes code normalization", () => {
  it("trims and uppercases without dropping leading zeros", () => {
    expect(normalizeFaskesCode("  0101u001 ")).toBe("0101U001");
  });
});

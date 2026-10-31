import { describe, expect, it } from "vitest";

import {
  DRAFT_KEY_BASE,
  draftKey,
  fallbackStakeholderId,
  hydrateDraft,
  legacyDraftKey,
  serializeDraft,
  type WizardDraft,
} from "@/lib/submissions/draft";

const orgA = { id: "3f7c1d4e-2b8a-4f6e-9c1d-7e5a2b3c4d5e" };
const orgB = { id: "8a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d" };

describe("draftKey", () => {
  it("scopes keys per account so drafts never leak across accounts", () => {
    const a = draftKey("user-a", null);
    const b = draftKey("user-b", null);
    expect(a).not.toBe(b);
    expect(a).toBe(`${DRAFT_KEY_BASE}:user-a:new`);
  });

  it("uses the submission id for revision drafts", () => {
    expect(draftKey("user-a", "sub-1")).toBe(`${DRAFT_KEY_BASE}:user-a:sub-1`);
  });

  it("keeps the legacy key distinct from scoped keys", () => {
    expect(legacyDraftKey()).toBe(DRAFT_KEY_BASE);
    expect(draftKey("user-a", null)).not.toBe(legacyDraftKey());
  });
});

describe("hydrateDraft", () => {
  it("falls back to the single organization when the draft has no valid org", () => {
    const hydrated = hydrateDraft({ stakeholderId: "" }, [orgA]);
    expect(hydrated.stakeholderId).toBe(orgA.id);
  });

  it("rejects an organization outside the account membership", () => {
    const hydrated = hydrateDraft({ stakeholderId: orgB.id }, [orgA]);
    expect(hydrated.stakeholderId).toBe(orgA.id);
  });

  it("keeps a valid organization for multi-org accounts", () => {
    const hydrated = hydrateDraft({ stakeholderId: orgB.id }, [orgA, orgB]);
    expect(hydrated.stakeholderId).toBe(orgB.id);
  });

  it("leaves multi-org accounts unselected when the draft is empty", () => {
    expect(hydrateDraft(null, [orgA, orgB]).stakeholderId).toBe("");
    expect(fallbackStakeholderId([orgA, orgB])).toBe("");
  });

  it("drops unknown taxonomy values, invalid dates, and malformed locations", () => {
    const hydrated = hydrateDraft(
      {
        platform: "FRIENDSTER",
        contentType: "PODCAST",
        mainTheme: "EDUFAST",
        subTheme: "TIDAK_ADA",
        dateCreated: "31-10-2026",
        publishedAt: "2026-10-30",
        location: { latitude: 200, longitude: 0, source: "manual_pin" },
        stakeholderId: orgA.id,
      },
      [orgA],
    );
    expect(hydrated.platform).toBeUndefined();
    expect(hydrated.contentType).toBeUndefined();
    expect(hydrated.mainTheme).toBe("EDUFAST");
    expect(hydrated.subTheme).toBeUndefined();
    expect(hydrated.dateCreated).toBeUndefined();
    expect(hydrated.publishedAt).toBe("2026-10-30");
    expect(hydrated.location).toBeUndefined();
  });

  it("restores its own submission id and idempotency key", () => {
    const hydrated = hydrateDraft(
      {
        submissionId: "0d9f4c2a-6a1b-4b7c-9d8e-2f3a4b5c6d7e",
        idempotencyKey: "idem-12345678",
        stakeholderId: orgA.id,
      },
      [orgA],
    );
    expect(hydrated.submissionId).toBe("0d9f4c2a-6a1b-4b7c-9d8e-2f3a4b5c6d7e");
    expect(hydrated.idempotencyKey).toBe("idem-12345678");
  });

  it("ignores a non-uuid submission id from a tampered draft", () => {
    const hydrated = hydrateDraft({ submissionId: "not-a-uuid" }, [orgA]);
    expect(hydrated.submissionId).toBeUndefined();
  });

  it("round-trips a serialized draft without losing fields", () => {
    const draft: WizardDraft = {
      submissionId: null,
      idempotencyKey: "idem-abcdefgh",
      stakeholderId: orgA.id,
      publishedUrl: "https://example.demo/konten",
      platform: "INSTAGRAM",
      contentType: "VIDEO",
      mainTheme: "NON_EDUFAST",
      subTheme: "INFORMASI",
      title: "Judul",
      narrative: "Narasi yang cukup panjang untuk disimpan sebagai draf.",
      dateCreated: "2026-10-30",
      publishedAt: "2026-10-30",
      location: {
        latitude: -6.2,
        longitude: 106.8,
        source: "manual_pin",
        accuracyMeters: null,
        consentAt: null,
      },
      locationLabel: "Jakarta",
      privacyAttested: false,
    };
    const hydrated = hydrateDraft(JSON.parse(serializeDraft(draft)), [orgA]);
    expect(hydrated).toMatchObject({
      stakeholderId: orgA.id,
      publishedUrl: draft.publishedUrl,
      platform: "INSTAGRAM",
      contentType: "VIDEO",
      subTheme: "INFORMASI",
      dateCreated: "2026-10-30",
      locationLabel: "Jakarta",
    });
  });
});

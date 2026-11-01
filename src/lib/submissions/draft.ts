import { PLATFORMS } from "@/lib/validation/content";

export const DRAFT_KEY_BASE = "dakosta:lapor:draft:v1";

const CONTENT_TYPE_VALUES = ["VIDEO", "INFOGRAFIS"] as const;
const MAIN_THEME_VALUES = ["EDUFAST", "NON_EDUFAST"] as const;
const SUB_THEME_VALUES = [
  "MOBILE_JKN",
  "TESTIMONI_PESERTA",
  "ALUR_BEROBAT",
  "EDUKATIF_PERSUASIF",
  "KORPORAT",
  "INFORMASI",
] as const;

export type WizardDraft = {
  submissionId: string | null;
  idempotencyKey: string;
  stakeholderId: string;
  publishedUrl: string;
  platform: string;
  contentType: string;
  mainTheme: string;
  subTheme: string;
  title: string;
  narrative: string;
  dateCreated: string;
  publishedAt: string;
  privacyAttested: boolean;
};

export type DraftStakeholder = { id: string };

export function draftKey(
  ownerId: string,
  submissionId?: string | null,
): string {
  return `${DRAFT_KEY_BASE}:${ownerId}:${submissionId ?? "new"}`;
}

/** Draft global lama (pra-perbaikan) tidak boleh dipakai lintas akun. */
export function legacyDraftKey(): string {
  return DRAFT_KEY_BASE;
}

export function fallbackStakeholderId(
  stakeholders: DraftStakeholder[],
): string {
  return stakeholders.length === 1 ? stakeholders[0]!.id : "";
}

function isKnown<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === "string" && (values as readonly string[]).includes(value)
  );
}

function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Membersihkan draf dari localStorage. Field tak dikenal, organisasi di luar
 * keanggotaan akun, dan nilai kosong tidak dipulihkan. `submissionId` hanya
 * dipulihkan bila draf ini sendiri berasal dari kunci ber-scope akun yang sama;
 * server tetap memverifikasi kepemilikan saat menyimpan.
 */
export function hydrateDraft(
  raw: unknown,
  stakeholders: DraftStakeholder[],
): Partial<WizardDraft> {
  const fallback = fallbackStakeholderId(stakeholders);
  if (!raw || typeof raw !== "object") {
    return { stakeholderId: fallback };
  }
  const draft = raw as Partial<WizardDraft> & Record<string, unknown>;
  const hydrated: Partial<WizardDraft> = {
    stakeholderId: fallback,
  };

  if (
    typeof draft.submissionId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      draft.submissionId,
    )
  ) {
    hydrated.submissionId = draft.submissionId;
  }
  if (
    typeof draft.idempotencyKey === "string" &&
    draft.idempotencyKey.length >= 8 &&
    draft.idempotencyKey.length <= 120
  ) {
    hydrated.idempotencyKey = draft.idempotencyKey;
  }
  if (
    typeof draft.stakeholderId === "string" &&
    draft.stakeholderId.length > 0 &&
    stakeholders.some((item) => item.id === draft.stakeholderId)
  ) {
    hydrated.stakeholderId = draft.stakeholderId;
  }
  if (typeof draft.publishedUrl === "string") {
    hydrated.publishedUrl = draft.publishedUrl;
  }
  if (isKnown(PLATFORMS, draft.platform)) {
    hydrated.platform = draft.platform;
  }
  if (isKnown(CONTENT_TYPE_VALUES, draft.contentType)) {
    hydrated.contentType = draft.contentType;
  }
  if (isKnown(MAIN_THEME_VALUES, draft.mainTheme)) {
    hydrated.mainTheme = draft.mainTheme;
  }
  if (isKnown(SUB_THEME_VALUES, draft.subTheme)) {
    hydrated.subTheme = draft.subTheme;
  }
  if (typeof draft.title === "string") {
    hydrated.title = draft.title;
  }
  if (typeof draft.narrative === "string") {
    hydrated.narrative = draft.narrative;
  }
  if (isDateOnly(draft.dateCreated)) {
    hydrated.dateCreated = draft.dateCreated;
  }
  if (isDateOnly(draft.publishedAt) || draft.publishedAt === "") {
    hydrated.publishedAt = draft.publishedAt;
  }
  if (typeof draft.privacyAttested === "boolean") {
    hydrated.privacyAttested = draft.privacyAttested;
  }

  return hydrated;
}

export function serializeDraft(draft: WizardDraft): string {
  return JSON.stringify(draft);
}

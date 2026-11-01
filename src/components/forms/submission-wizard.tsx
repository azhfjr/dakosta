"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Loader2,
  MapPin,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/content/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_LABEL, type ContentStatus } from "@/lib/content-status";
import {
  draftKey as buildDraftKey,
  fallbackStakeholderId,
  hydrateDraft,
  legacyDraftKey,
} from "@/lib/submissions/draft";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  MAIN_THEMES,
  MAIN_THEME_LABELS,
  periodLabel,
  periodOfDate,
  SUB_THEMES,
  SUB_THEME_LABELS,
  type ContentType,
  type MainTheme,
  type SubTheme,
} from "@/lib/taxonomy";
import { PLATFORMS } from "@/lib/validation/content";

export type WizardStakeholder = {
  id: string;
  name: string;
  serviceArea: string;
  branchName: string | null;
  organizationType: string;
  faskesClass: string | null;
  latitude: number | null;
  longitude: number | null;
};

type StepNumber = 1 | 2 | 3;

type FieldErrors = Partial<
  Record<
    | "stakeholderId"
    | "publishedUrl"
    | "platform"
    | "contentType"
    | "mainTheme"
    | "subTheme"
    | "title"
    | "narrative"
    | "dateCreated"
    | "publishedAt"
    | "privacyAttested"
    | "form",
    string
  >
>;

/** Published EDUFAST policy per period (`YYYY-MM` → allowed sub-themes). */
export type EdufastPolicySnapshot = Record<string, SubTheme[]>;

type DuplicateInfo = {
  inScope?: boolean;
  submissionId?: string;
  referenceCode?: string;
  status?: string;
  stakeholderName?: string;
};

type SavedResponse = {
  data: {
    submission: {
      id: string;
      referenceCode: string;
      status: ContentStatus;
      version: number;
      submittedAt: string | null;
      updatedAt: string;
    };
  } | null;
  error: { code?: string; message?: string; details?: unknown } | null;
};

const STEPS: Array<{ number: StepNumber; title: string; hint: string }> = [
  { number: 1, title: "Tautan & tema", hint: "Sumber konten" },
  { number: 2, title: "Narasi", hint: "Ringkasan & tanggal" },
  { number: 3, title: "Tinjau", hint: "Kirim" },
];

export type SubmissionWizardInitial = {
  submissionId: string;
  referenceCode: string;
  stakeholderId: string;
  publishedUrl: string;
  platform: string;
  contentType: string | null;
  mainTheme: string | null;
  subTheme: string | null;
  title: string | null;
  narrative: string;
  dateCreated: string;
  publishedAt: string | null;
  decisionReason: string | null;
};

type DraftState = {
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

function createIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Cermin klien dari `detectPii` server agar pengguna mendapat umpan balik lebih awal. */
function detectClientPii(text: string): string | null {
  const patterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\b\d{16}\b/, label: "nomor 16 digit (mirip NIK)" },
    { pattern: /\b\d{13}\b/, label: "nomor 13 digit (mirip kartu JKN)" },
    {
      pattern: /\b(?:NIK|JKN|KIS|BPJS)\s*[:#=]?\s*\d{6,}/i,
      label: "nomor identitas berlabel",
    },
  ];
  for (const item of patterns) {
    if (item.pattern.test(text)) return item.label;
  }
  return null;
}

export function SubmissionWizard({
  stakeholders,
  edufastPolicies,
  today,
  draftOwnerId,
  initial,
}: {
  stakeholders: WizardStakeholder[];
  edufastPolicies: EdufastPolicySnapshot;
  today: string;
  draftOwnerId: string;
  initial?: SubmissionWizardInitial;
}) {
  const router = useRouter();
  const draftKey = buildDraftKey(draftOwnerId, initial?.submissionId ?? null);

  const [step, setStep] = useState<StepNumber>(initial ? 2 : 1);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const [submissionId, setSubmissionId] = useState<string | null>(
    initial?.submissionId ?? null,
  );
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [stakeholderId, setStakeholderId] = useState(
    initial?.stakeholderId ?? fallbackStakeholderId(stakeholders),
  );
  const [publishedUrl, setPublishedUrl] = useState(initial?.publishedUrl ?? "");
  const [platform, setPlatform] = useState<string>(
    initial?.platform ?? "INSTAGRAM",
  );
  const [contentType, setContentType] = useState<ContentType | "">(
    (initial?.contentType as ContentType | null) ?? "",
  );
  const [mainTheme, setMainTheme] = useState<MainTheme>(
    initial?.mainTheme === "EDUFAST" ? "EDUFAST" : "NON_EDUFAST",
  );
  const [subTheme, setSubTheme] = useState<SubTheme | "">(
    (initial?.subTheme as SubTheme | null) ?? "",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [narrative, setNarrative] = useState(initial?.narrative ?? "");
  const [dateCreated, setDateCreated] = useState(initial?.dateCreated ?? today);
  const [publishedAt, setPublishedAt] = useState(initial?.publishedAt ?? today);
  const [privacyAttested, setPrivacyAttested] = useState(false);
  const draftRef = useRef<{ key: string; draft: DraftState } | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [conflict, setConflict] = useState<{ message: string } | null>(null);
  const [pending, setPending] = useState<"DRAFT" | "SUBMIT" | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(
    null,
  );
  const [result, setResult] = useState<{
    id: string;
    referenceCode: string;
    status: ContentStatus;
  } | null>(null);

  const selectedStakeholder = useMemo(
    () => stakeholders.find((item) => item.id === stakeholderId) ?? null,
    [stakeholders, stakeholderId],
  );

  const period = periodOfDate(dateCreated);
  const policySubThemes = edufastPolicies[period] ?? [];
  const edufastBlocked =
    mainTheme === "EDUFAST" && policySubThemes.length === 0;
  const availableSubThemes: readonly SubTheme[] =
    mainTheme === "EDUFAST" && policySubThemes.length > 0
      ? policySubThemes
      : SUB_THEMES;

  useEffect(() => {
    // Hidrasi draf sekali setelah mount: localStorage tidak tersedia saat SSR.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      // Kunci global pra-perbaikan tidak pernah dipakai lagi.
      window.localStorage.removeItem(legacyDraftKey());
    } catch {
      // Penyimpanan lokal diblokir; tidak ada yang perlu dibersihkan.
    }
    if (initial) {
      setDraftLoaded(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const hydrated = hydrateDraft(JSON.parse(raw), stakeholders);
        if (typeof hydrated.submissionId === "string")
          setSubmissionId(hydrated.submissionId);
        if (typeof hydrated.idempotencyKey === "string")
          setIdempotencyKey(hydrated.idempotencyKey);
        if (typeof hydrated.stakeholderId === "string")
          setStakeholderId(hydrated.stakeholderId);
        if (typeof hydrated.publishedUrl === "string")
          setPublishedUrl(hydrated.publishedUrl);
        if (typeof hydrated.platform === "string")
          setPlatform(hydrated.platform);
        if (typeof hydrated.contentType === "string") {
          setContentType(hydrated.contentType as ContentType);
        }
        if (typeof hydrated.mainTheme === "string") {
          setMainTheme(hydrated.mainTheme as MainTheme);
        }
        if (typeof hydrated.subTheme === "string") {
          setSubTheme(hydrated.subTheme as SubTheme);
        }
        if (typeof hydrated.title === "string") setTitle(hydrated.title);
        if (typeof hydrated.narrative === "string")
          setNarrative(hydrated.narrative);
        if (typeof hydrated.dateCreated === "string")
          setDateCreated(hydrated.dateCreated);
        if (typeof hydrated.publishedAt === "string")
          setPublishedAt(hydrated.publishedAt);
        if (typeof hydrated.privacyAttested === "boolean")
          setPrivacyAttested(hydrated.privacyAttested);
      }
    } catch {
      // Draft lokal rusak — mulai dari formulir kosong.
    } finally {
      setDraftLoaded(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initial, draftKey, stakeholders]);

  // Akun satu organisasi selalu memakai organisasi tersebut.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (stakeholders.length === 1 && stakeholderId !== stakeholders[0]!.id) {
      setStakeholderId(stakeholders[0]!.id);
    }
  }, [stakeholders, stakeholderId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!draftLoaded || result) return;
    const draft: DraftState = {
      submissionId,
      idempotencyKey,
      stakeholderId,
      publishedUrl,
      platform,
      contentType,
      mainTheme,
      subTheme,
      title,
      narrative,
      dateCreated,
      publishedAt,
      privacyAttested,
    };
    draftRef.current = { key: draftKey, draft };
    // Ketikan cepat dibundel supaya localStorage tidak ditulis setiap karakter.
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // Penyimpanan lokal penuh atau diblokir; server tetap sumber kebenaran.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    draftLoaded,
    result,
    draftKey,
    submissionId,
    idempotencyKey,
    stakeholderId,
    publishedUrl,
    platform,
    contentType,
    mainTheme,
    subTheme,
    title,
    narrative,
    dateCreated,
    publishedAt,
    privacyAttested,
  ]);

  useEffect(() => {
    if (result) draftRef.current = null;
  }, [result]);

  useEffect(() => {
    function flush() {
      const current = draftRef.current;
      if (!current) return;
      try {
        window.localStorage.setItem(current.key, JSON.stringify(current.draft));
      } catch {
        // Tidak ada yang dapat dilakukan saat halaman ditinggalkan.
      }
    }
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  function validateStep(target: StepNumber): boolean {
    const next: FieldErrors = {};

    if (target >= 1) {
      if (stakeholders.length > 1 && !stakeholderId) {
        next.stakeholderId = "Pilih organisasi pelapor.";
      }
      if (!publishedUrl.trim())
        next.publishedUrl = "Tautan konten wajib diisi.";
      else if (!isValidHttpsUrl(publishedUrl.trim())) {
        next.publishedUrl = "Gunakan URL lengkap berawalan https://.";
      }
      if (!platform) next.platform = "Pilih platform konten.";
      if (!contentType)
        next.contentType = "Pilih jenis konten: Video atau Infografis.";
      if (mainTheme === "EDUFAST" && policySubThemes.length === 0) {
        next.mainTheme = `Belum ada kebijakan EDUFAST terbit untuk ${periodLabel(period)}. Pilih Non-EDUFAST atau hubungi Master Admin.`;
      }
      if (!subTheme) next.subTheme = "Pilih sub-tema konten.";
      else if (!availableSubThemes.includes(subTheme)) {
        next.subTheme =
          "Sub-tema tidak termasuk kebijakan EDUFAST periode ini.";
      }
    }

    if (target >= 2) {
      if (narrative.trim().length < 40) {
        next.narrative = "Narasi minimal 40 karakter agar dapat divalidasi.";
      }
      if (!dateCreated) next.dateCreated = "Tanggal pembuatan wajib diisi.";
      else if (dateCreated > today)
        next.dateCreated = "Tanggal tidak boleh di masa depan.";
      if (publishedAt && publishedAt > today) {
        next.publishedAt = "Tanggal terbit tidak boleh di masa depan.";
      }
    }

    if (target >= 3) {
      if (!privacyAttested) {
        next.privacyAttested =
          "Konfirmasi privasi wajib dicentang sebelum mengirim.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /** Draf hanya membutuhkan field minimum yang juga diwajibkan server. */
  function validateDraft(): boolean {
    const next: FieldErrors = {};
    if (!publishedUrl.trim()) next.publishedUrl = "Tautan konten wajib diisi.";
    else if (!isValidHttpsUrl(publishedUrl.trim())) {
      next.publishedUrl = "Gunakan URL lengkap berawalan https://.";
    }
    if (!platform) next.platform = "Pilih platform konten.";
    if (!dateCreated) next.dateCreated = "Tanggal pembuatan wajib diisi.";
    else if (dateCreated > today)
      next.dateCreated = "Tanggal tidak boleh di masa depan.";
    if (publishedAt && publishedAt > today) {
      next.publishedAt = "Tanggal terbit tidak boleh di masa depan.";
    }
    const pii = detectClientPii(`${title}\n${narrative}`);
    if (pii) {
      next.narrative = `Narasi terdeteksi memuat ${pii}. Hapus data pribadi sebelum menyimpan.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goToStep(target: StepNumber) {
    if (target > step && !validateStep(step)) return;
    setStep(target);
  }

  function resetWizard() {
    setResult(null);
    setStep(1);
    setSubmissionId(null);
    setIdempotencyKey(createIdempotencyKey());
    setStakeholderId(fallbackStakeholderId(stakeholders));
    setPublishedUrl("");
    setContentType("");
    setMainTheme("NON_EDUFAST");
    setSubTheme("");
    setTitle("");
    setNarrative("");
    setDateCreated(today);
    setPublishedAt(today);
    setPrivacyAttested(false);
    setErrors({});
    setConflict(null);
    setLastSavedAt(null);
    try {
      const keys = new Set([
        draftKey,
        buildDraftKey(draftOwnerId, submissionId),
      ]);
      keys.forEach((key) => window.localStorage.removeItem(key));
      window.localStorage.removeItem(legacyDraftKey());
    } catch {
      // abaikan
    }
  }

  async function handleSave(
    action: "DRAFT" | "SUBMIT",
    options?: { acknowledgeDuplicate?: boolean },
  ) {
    setErrors({});

    if (action === "SUBMIT") {
      if (!validateStep(3)) return;
      const pii = detectClientPii(`${title}\n${narrative}`);
      if (pii) {
        setErrors({
          narrative: `Narasi terdeteksi memuat ${pii}. Hapus data pribadi sebelum mengirim.`,
        });
        setStep(2);
        return;
      }
    } else if (!validateDraft()) {
      return;
    }

    setPending(action);

    const effectiveStakeholderId =
      stakeholders.length === 1 ? stakeholders[0]!.id : stakeholderId;

    const body = {
      action,
      submissionId: submissionId ?? undefined,
      idempotencyKey,
      stakeholderId: effectiveStakeholderId || undefined,
      publishedUrl: publishedUrl.trim(),
      platform,
      contentType: contentType || undefined,
      mainTheme: action === "SUBMIT" ? mainTheme : undefined,
      subTheme: subTheme || undefined,
      title: title.trim() || undefined,
      narrative: narrative.trim(),
      dateCreated,
      publishedAt: publishedAt || null,
      duplicateAcknowledged: options?.acknowledgeDuplicate ?? false,
      privacyAttested: action === "SUBMIT" ? privacyAttested : undefined,
    };

    try {
      const response = await fetch("/api/v1/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as SavedResponse | null;

      if (!response.ok || !payload?.data) {
        const code = payload?.error?.code;

        if (code === "DUPLICATE_URL" && payload?.error?.details) {
          setDuplicateInfo(payload.error.details as DuplicateInfo);
          return;
        }

        if (code === "PASSWORD_CHANGE_REQUIRED") {
          toast.error("Ubah kata sandi terlebih dahulu.");
          router.replace("/ganti-password");
          return;
        }

        if (code === "CONFLICT") {
          setConflict({
            message:
              payload?.error?.message ??
              "Konten ini sudah berubah status dan tidak dapat diubah lagi.",
          });
          return;
        }

        setErrors({
          form:
            payload?.error?.message ??
            "Konten tidak dapat disimpan. Coba lagi.",
        });
        return;
      }

      const saved = payload.data.submission;
      setIdempotencyKey(createIdempotencyKey());

      if (action === "DRAFT") {
        setSubmissionId(saved.id);
        setLastSavedAt(new Date());
        toast.success("Draf tersimpan. Anda dapat melanjutkan nanti.");
        return;
      }

      setResult({
        id: saved.id,
        referenceCode: saved.referenceCode,
        status: saved.status,
      });
      setSubmissionId(saved.id);
      setDuplicateInfo(null);
      try {
        window.localStorage.removeItem(draftKey);
        window.localStorage.removeItem(buildDraftKey(draftOwnerId, saved.id));
      } catch {
        // abaikan
      }
      toast.success(
        initial
          ? "Perbaikan terkirim ulang untuk validasi admin."
          : "Konten terkirim untuk validasi admin.",
      );
    } catch {
      setErrors({
        form: "Tidak dapat menghubungi server. Periksa koneksi Anda.",
      });
    } finally {
      setPending(null);
    }
  }

  async function copyReference(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Nomor referensi disalin.");
    } catch {
      toast.error("Tidak dapat menyalin. Salin manual.");
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-status-approved/25 bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-status-approved/10 text-status-approved">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Konten terkirim
            </h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              Konten Anda masuk antrean validasi admin. Capaian hanya akan
              dihitung setelah konten disetujui.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="font-mono text-sm tracking-wide text-brand-blue-800">
                {result.referenceCode}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyReference(result.referenceCode)}
              >
                <Copy className="size-4" aria-hidden />
                Salin referensi
              </Button>
              <StatusBadge status={result.status} />
            </div>
          </div>
        </div>

        <ol className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
          <li className="flex items-center gap-3 text-ink-muted">
            <Check className="size-4 text-status-approved" aria-hidden />
            Draf dibuat di perangkat Anda
          </li>
          <li className="flex items-center gap-3 text-ink-muted">
            <Check className="size-4 text-status-approved" aria-hidden />
            Dikirim untuk validasi
          </li>
          <li className="flex items-center gap-3 text-ink-muted">
            <span
              className="size-4 rounded-full border-2 border-status-submitted"
              aria-hidden
            />
            Menunggu keputusan admin
          </li>
        </ol>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="h-11 sm:flex-1">
            <Link href={`/client/konten/${result.id}`}>
              Lihat detail konten
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:flex-1"
            onClick={resetWizard}
          >
            Kirim konten lain
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Formulir pelaporan konten
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Tiga langkah singkat. Simpan draf kapan saja; draf tidak dihitung
          sebagai capaian.
        </p>

        {initial ? (
          <div className="mt-3 rounded-lg border border-status-revision/30 bg-status-revision/5 px-3 py-2 text-sm">
            <p className="font-medium text-foreground">
              Memperbaiki konten {initial.referenceCode}
            </p>
            {initial.decisionReason ? (
              <p className="mt-1 text-ink-muted">
                Catatan reviewer: {initial.decisionReason}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-ink-muted">
              Perubahan akan dikirim ulang sebagai revisi. Capaian tetap belum
              dihitung sampai disetujui.
            </p>
          </div>
        ) : null}

        <ol
          className="mt-4 grid gap-2 sm:grid-cols-4"
          aria-label="Langkah pelaporan"
        >
          {STEPS.map((item) => {
            const active = step === item.number;
            const complete = step > item.number;
            return (
              <li key={item.number} aria-current={active ? "step" : undefined}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.number < step) setStep(item.number);
                  }}
                  disabled={item.number > step}
                  className={[
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-brand-blue-500/40 bg-brand-blue-100/60"
                      : complete
                        ? "border-border bg-surface-muted"
                        : "border-border bg-surface opacity-70",
                    item.number < step ? "cursor-pointer" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      complete
                        ? "bg-status-approved text-white"
                        : active
                          ? "bg-brand-blue-700 text-white"
                          : "bg-surface-muted text-ink-muted",
                    ].join(" ")}
                    aria-hidden
                  >
                    {complete ? <Check className="size-3.5" /> : item.number}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {item.hint}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-6">
        {errors.form ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {errors.form}
          </p>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-surface-muted/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Organisasi pelapor
              </p>
              {stakeholders.length === 1 ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-semibold text-foreground">
                    {stakeholders[0]!.name}
                  </span>
                  <span className="text-ink-muted">•</span>
                  <span className="text-ink-muted">
                    {stakeholders[0]!.organizationType === "FASKES"
                      ? (stakeholders[0]!.faskesClass ?? "Faskes")
                      : stakeholders[0]!.organizationType === "PEMDA"
                        ? "Pemerintah Daerah"
                        : "Lainnya"}
                  </span>
                  {stakeholders[0]!.branchName ? (
                    <>
                      <span className="text-ink-muted">•</span>
                      <span className="text-ink-muted">
                        {stakeholders[0]!.branchName}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : (
                <Select value={stakeholderId} onValueChange={setStakeholderId}>
                  <SelectTrigger
                    id="lapor-stakeholder"
                    className="mt-2 h-11 w-full bg-surface"
                    aria-invalid={errors.stakeholderId ? true : undefined}
                  >
                    <SelectValue placeholder="Pilih organisasi" />
                  </SelectTrigger>
                  <SelectContent>
                    {stakeholders.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} — {item.serviceArea}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="mt-2 text-xs text-ink-muted">
                Organisasi mengikuti akun Anda dan tidak dapat diubah dari
                formulir.
              </p>
              {errors.stakeholderId ? (
                <p className="mt-1 text-sm text-destructive">
                  {errors.stakeholderId}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="lapor-platform">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger id="lapor-platform" className="h-11 w-full">
                    <SelectValue placeholder="Pilih platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {PLATFORM_LABEL[item] ?? item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.platform ? (
                  <p className="text-sm text-destructive">{errors.platform}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="lapor-content-type">Jenis konten</Label>
                <Select
                  value={contentType}
                  onValueChange={(value) =>
                    setContentType(value as ContentType)
                  }
                >
                  <SelectTrigger
                    id="lapor-content-type"
                    className="h-11 w-full"
                    aria-invalid={errors.contentType ? true : undefined}
                  >
                    <SelectValue placeholder="Video atau Infografis" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {CONTENT_TYPE_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.contentType ? (
                  <p className="text-sm text-destructive">
                    {errors.contentType}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="lapor-url">Tautan konten</Label>
              <Input
                id="lapor-url"
                type="url"
                inputMode="url"
                placeholder="https://contoh.demo/konten-anda"
                value={publishedUrl}
                onChange={(event) => setPublishedUrl(event.target.value)}
                aria-invalid={errors.publishedUrl ? true : undefined}
                className="h-11"
              />
              <p className="text-xs text-ink-muted">
                Harus https. Parameter pelacakan seperti utm_* akan diabaikan
                saat pemeriksaan duplikat.
              </p>
              {errors.publishedUrl ? (
                <p className="text-sm text-destructive">
                  {errors.publishedUrl}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="lapor-main-theme">Tema utama</Label>
                <Select
                  value={mainTheme}
                  onValueChange={(value) => {
                    setMainTheme(value as MainTheme);
                    setSubTheme("");
                  }}
                >
                  <SelectTrigger
                    id="lapor-main-theme"
                    className="h-11 w-full"
                    aria-invalid={errors.mainTheme ? true : undefined}
                  >
                    <SelectValue placeholder="Pilih tema utama" />
                  </SelectTrigger>
                  <SelectContent>
                    {MAIN_THEMES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {MAIN_THEME_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mainTheme === "EDUFAST" ? (
                  <p
                    className={[
                      "text-xs leading-relaxed",
                      edufastBlocked ? "text-destructive" : "text-ink-muted",
                    ].join(" ")}
                  >
                    {edufastBlocked
                      ? `Belum ada kebijakan EDUFAST terbit untuk ${periodLabel(period)}. Pilih Non-EDUFAST atau hubungi Master Admin.`
                      : `Kebijakan ${periodLabel(period)} mengizinkan ${policySubThemes.length} sub-tema.`}
                  </p>
                ) : (
                  <p className="text-xs text-ink-muted">
                    Non-EDUFAST tersedia untuk semua sub-tema pada bulan apa
                    pun.
                  </p>
                )}
                {errors.mainTheme ? (
                  <p className="text-sm text-destructive">{errors.mainTheme}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="lapor-sub-theme">Sub-tema</Label>
                <Select
                  value={subTheme}
                  onValueChange={(value) => setSubTheme(value as SubTheme)}
                  disabled={edufastBlocked}
                >
                  <SelectTrigger
                    id="lapor-sub-theme"
                    className="h-11 w-full"
                    aria-invalid={errors.subTheme ? true : undefined}
                  >
                    <SelectValue placeholder="Pilih sub-tema" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubThemes.map((item) => (
                      <SelectItem key={item} value={item}>
                        {SUB_THEME_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subTheme ? (
                  <p className="text-sm text-destructive">{errors.subTheme}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="lapor-title">Judul (opsional)</Label>
                <Input
                  id="lapor-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={140}
                  placeholder="Ringkasan singkat konten"
                  className="h-11"
                />
              </div>
              <p className="self-end text-xs leading-relaxed text-ink-muted">
                Periode EDUFAST dihitung dari tanggal pembuatan konten pada
                langkah berikutnya (Asia/Jakarta).
              </p>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between gap-2">
                <Label htmlFor="lapor-narrative">Narasi konten</Label>
                <span className="text-xs text-ink-muted">
                  {narrative.trim().length}/40
                </span>
              </div>
              <Textarea
                id="lapor-narrative"
                value={narrative}
                onChange={(event) => setNarrative(event.target.value)}
                rows={7}
                maxLength={5000}
                aria-invalid={errors.narrative ? true : undefined}
                placeholder="Jelaskan isi konten, pesan utama, dan konteks publikasinya."
              />
              <p className="text-xs text-ink-muted">
                Minimal 40 karakter. Jangan memuat data pribadi, nomor
                identitas, atau rekam medis.
              </p>
              {errors.narrative ? (
                <p className="text-sm text-destructive">{errors.narrative}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="lapor-date-created">Tanggal pembuatan</Label>
                <Input
                  id="lapor-date-created"
                  type="date"
                  max={today}
                  value={dateCreated}
                  onChange={(event) => setDateCreated(event.target.value)}
                  aria-invalid={errors.dateCreated ? true : undefined}
                  className="h-11"
                />
                {errors.dateCreated ? (
                  <p className="text-sm text-destructive">
                    {errors.dateCreated}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lapor-date-published">
                  Tanggal terbit (opsional)
                </Label>
                <Input
                  id="lapor-date-published"
                  type="date"
                  max={today}
                  value={publishedAt}
                  onChange={(event) => setPublishedAt(event.target.value)}
                  aria-invalid={errors.publishedAt ? true : undefined}
                  className="h-11"
                />
                {errors.publishedAt ? (
                  <p className="text-sm text-destructive">
                    {errors.publishedAt}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <dl className="grid gap-3 rounded-xl border border-border bg-surface-muted/60 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-muted">Organisasi</dt>
                <dd className="font-medium text-foreground">
                  {selectedStakeholder?.name ?? "—"}
                  {selectedStakeholder?.branchName ? (
                    <span className="block text-xs font-normal text-ink-muted">
                      {selectedStakeholder.branchName}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Jenis konten</dt>
                <dd className="font-medium text-foreground">
                  {contentType ? CONTENT_TYPE_LABELS[contentType] : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Tema</dt>
                <dd className="font-medium text-foreground">
                  {MAIN_THEME_LABELS[mainTheme]}
                  {subTheme ? ` · ${SUB_THEME_LABELS[subTheme]}` : ""}
                </dd>
                {mainTheme === "EDUFAST" && policySubThemes.length > 0 ? (
                  <dd className="text-xs text-ink-muted">
                    Kebijakan {periodLabel(period)} · {policySubThemes.length}{" "}
                    sub-tema
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Platform</dt>
                <dd className="font-medium text-foreground">
                  {PLATFORM_LABEL[platform] ?? platform}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Tanggal</dt>
                <dd className="font-medium text-foreground">
                  {dateCreated}
                  {publishedAt ? ` · terbit ${publishedAt}` : ""}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-muted">Tautan</dt>
                <dd className="truncate font-medium text-brand-blue-800">
                  {publishedUrl}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-muted">Lokasi</dt>
                <dd className="flex items-center gap-2 font-medium text-foreground">
                  <MapPin className="size-4 text-brand-blue-700" aria-hidden />
                  Mengikuti lokasi {selectedStakeholder?.name ?? "instansi"}
                </dd>
              </div>
            </dl>

            <div className="rounded-xl border border-border p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="lapor-privacy"
                  checked={privacyAttested}
                  onCheckedChange={(checked) =>
                    setPrivacyAttested(checked === true)
                  }
                  aria-invalid={errors.privacyAttested ? true : undefined}
                  className="mt-1"
                />
                <div>
                  <Label htmlFor="lapor-privacy" className="font-medium">
                    Saya memastikan konten ini tidak memuat data pribadi
                  </Label>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    Tidak ada NIK, nomor JKN, rekam medis, atau data pasien.
                  </p>
                  {errors.privacyAttested ? (
                    <p className="mt-1 text-sm text-destructive">
                      {errors.privacyAttested}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="flex items-start gap-2 text-sm text-ink-muted">
              <ClipboardCheck
                className="mt-0.5 size-4 shrink-0 text-brand-blue-700"
                aria-hidden
              />
              Setelah dikirim, konten tidak dapat diubah sampai reviewer cabang
              meminta revisi.
            </p>
          </div>
        ) : null}

        {lastSavedAt ? (
          <p className="text-xs text-ink-muted">
            Draf tersimpan pukul{" "}
            {new Intl.DateTimeFormat("id-ID", {
              timeZone: "Asia/Jakarta",
              hour: "2-digit",
              minute: "2-digit",
            }).format(lastSavedAt)}{" "}
            WIB.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() =>
              setStep((current) =>
                current > 1 ? ((current - 1) as StepNumber) : current,
              )
            }
            disabled={step === 1 || pending !== null}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Kembali
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => handleSave("DRAFT")}
            disabled={pending !== null}
          >
            {pending === "DRAFT" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Simpan draf
          </Button>

          {step < 3 ? (
            <Button
              type="button"
              className="h-11"
              onClick={() => goToStep((step + 1) as StepNumber)}
              disabled={pending !== null}
            >
              Lanjut
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              className="h-11"
              onClick={() => handleSave("SUBMIT")}
              disabled={pending !== null}
            >
              {pending === "SUBMIT" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              Kirim untuk validasi
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={duplicateInfo !== null}
        onOpenChange={(open) => !open && setDuplicateInfo(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle
                className="size-5 text-status-review"
                aria-hidden
              />
              Tautan sudah pernah dilaporkan
            </DialogTitle>
            <DialogDescription>
              {duplicateInfo?.referenceCode && duplicateInfo?.stakeholderName
                ? `Tautan ini cocok dengan konten ${duplicateInfo.referenceCode} milik ${duplicateInfo.stakeholderName}. Periksa daftar konten terlebih dahulu bila Anda tidak yakin.`
                : "Tautan ini sudah pernah dilaporkan pada organisasi lain. Periksa daftar konten Anda terlebih dahulu bila tidak yakin."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-status-review/30 bg-status-review/10 px-3 py-2 text-sm text-status-revision">
            Konten duplikat tetap dapat dikirim, tetapi admin dapat menolaknya
            saat validasi.
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button asChild variant="outline" className="h-11">
              <Link href="/client/konten">Periksa daftar konten</Link>
            </Button>
            <Button
              type="button"
              className="h-11"
              onClick={() => {
                const info = duplicateInfo;
                setDuplicateInfo(null);
                if (info)
                  void handleSave("SUBMIT", { acknowledgeDuplicate: true });
              }}
            >
              Tetap kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={conflict !== null}
        onOpenChange={(open) => !open && setConflict(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle
                className="size-5 text-status-revision"
                aria-hidden
              />
              Konten sudah berubah status
            </DialogTitle>
            <DialogDescription>
              {conflict?.message ??
                "Konten ini tidak lagi dapat diubah. Muat ulang untuk melihat status terbaru."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => {
                setConflict(null);
                router.refresh();
              }}
            >
              Muat ulang
            </Button>
            <Button
              type="button"
              className="h-11"
              onClick={() => {
                setConflict(null);
                resetWizard();
              }}
            >
              Mulai konten baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

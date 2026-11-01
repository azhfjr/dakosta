import { Image as ImageIcon, Video } from "lucide-react";

import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  type ContentType,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

function isContentTypeValue(
  value: string | null | undefined,
): value is ContentType {
  return (
    Boolean(value) && (CONTENT_TYPES as readonly string[]).includes(value!)
  );
}

export function ContentTypeBadge({
  contentType,
  size = "sm",
  className,
}: {
  contentType: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!isContentTypeValue(contentType)) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted whitespace-nowrap",
          className,
        )}
      >
        Belum ditentukan
      </span>
    );
  }

  const Icon = contentType === "VIDEO" ? Video : ImageIcon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-brand-teal-500/25 bg-brand-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-teal-700 whitespace-nowrap",
        size === "md" ? "px-3 py-1 text-sm" : "",
        className,
      )}
    >
      <Icon className={size === "md" ? "size-4" : "size-3.5"} aria-hidden />
      {CONTENT_TYPE_LABELS[contentType]}
    </span>
  );
}

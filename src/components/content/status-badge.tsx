import {
  STATUS_LABEL,
  STATUS_TONE,
  normalizeStatus,
} from "@/lib/content-status";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        STATUS_TONE[normalizeStatus(status)],
        className,
      )}
    >
      {STATUS_LABEL[normalizeStatus(status)]}
    </span>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { RotateCcw, SlidersHorizontal } from "lucide-react";

import { AutoSubmitForm } from "@/components/filters/auto-submit-form";
import { Button } from "@/components/ui/button";
import type { FilterOption } from "@/lib/filters/query";
import { cn } from "@/lib/utils";

export type { FilterOption };

export type FilterField =
  | {
      kind: "select";
      name: string;
      label: string;
      value: string;
      options: FilterOption[];
      allLabel: string;
      /** Set false for required selects that have no "all" state. */
      includeEmpty?: boolean;
    }
  | {
      kind: "search";
      name: string;
      label: string;
      value: string;
      placeholder?: string;
    }
  | {
      kind: "date";
      name: string;
      label: string;
      value: string;
    };

const controlClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const columnClass = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
} as const;

function FilterControl({
  field,
  idPrefix,
}: {
  field: FilterField;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${field.name}`;
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-ink-muted">
        {field.label}
      </label>
      {field.kind === "select" ? (
        <select
          id={id}
          name={field.name}
          defaultValue={field.value}
          className={controlClass}
        >
          {field.includeEmpty === false ? null : (
            <option value="">{field.allLabel}</option>
          )}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.kind === "date" ? "date" : "search"}
          name={field.name}
          defaultValue={field.value}
          placeholder={field.kind === "date" ? undefined : field.placeholder}
          className={controlClass}
        />
      )}
    </div>
  );
}

/**
 * One filter contract for every list and dashboard: every field sits in a
 * single responsive grid (no separate advanced panel), the URL always carries
 * the state, and actions stay grouped with the reset and submit controls.
 */
export function FilterBar({
  action,
  fields,
  hidden = {},
  resetHref,
  summary,
  actions,
  label = "Filter",
  columns = 4,
  idPrefix = "filter",
  className,
}: {
  action: string;
  fields: FilterField[];
  hidden?: Record<string, string>;
  resetHref: string;
  summary?: string;
  actions?: ReactNode;
  label?: string;
  columns?: 2 | 3 | 4;
  idPrefix?: string;
  className?: string;
}) {
  if (fields.length === 0) return null;

  // Uncontrolled inputs keep their DOM value across same-route client
  // navigations, so remount whenever the URL-derived filter state changes.
  const formKey = fields
    .map((field) => `${field.name}:${field.value}`)
    .join("|");

  return (
    <section
      aria-label={label}
      className={cn(
        "rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <AutoSubmitForm key={formKey} action={action} className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <SlidersHorizontal
              className="size-4 text-brand-green-700"
              aria-hidden
            />
            {label}
          </p>
          {summary ? (
            <p className="text-xs text-ink-muted sm:text-right">{summary}</p>
          ) : null}
        </div>
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className={cn("grid gap-3", columnClass[columns])}>
          {fields.map((field) => (
            <FilterControl key={field.name} field={field} idPrefix={idPrefix} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <Button type="submit" size="sm" className="h-9">
            Terapkan
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href={resetHref}>
              <RotateCcw className="size-4" aria-hidden />
              Atur ulang
            </Link>
          </Button>
          {actions ? (
            <div className="flex flex-wrap gap-2 sm:ml-auto">{actions}</div>
          ) : null}
        </div>
      </AutoSubmitForm>
    </section>
  );
}

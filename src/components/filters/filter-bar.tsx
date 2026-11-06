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
      kind: "number";
      name: string;
      label: string;
      value: string;
      min?: number;
      max?: number;
      step?: number;
      placeholder?: string;
    };

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const columnClass = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
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
          className={selectClass}
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
          type={field.kind === "number" ? "number" : "search"}
          name={field.name}
          defaultValue={field.value}
          placeholder={field.placeholder}
          min={field.kind === "number" ? field.min : undefined}
          max={field.kind === "number" ? field.max : undefined}
          step={field.kind === "number" ? field.step : undefined}
          className={selectClass}
        />
      )}
    </div>
  );
}

/**
 * One filter contract for every list and dashboard: categorical filters are
 * dropdowns, search stays a text field, and the URL always carries the state.
 */
export function FilterBar({
  action,
  fields,
  advancedFields = [],
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
  advancedFields?: FilterField[];
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

  return (
    <section
      aria-label={label}
      className={cn(
        "rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <AutoSubmitForm action={action} className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <SlidersHorizontal
            className="size-4 text-brand-green-700"
            aria-hidden
          />
          {label}
        </p>
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className={cn("grid gap-3", columnClass[columns])}>
          {fields.map((field) => (
            <FilterControl key={field.name} field={field} idPrefix={idPrefix} />
          ))}
        </div>
        {advancedFields.length > 0 ? (
          <details className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2">
            <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-muted select-none">
              <SlidersHorizontal className="size-3.5" aria-hidden />
              Filter lanjutan
            </summary>
            <div className={cn("mt-3 grid gap-3", columnClass[columns])}>
              {advancedFields.map((field) => (
                <FilterControl
                  key={field.name}
                  field={field}
                  idPrefix={idPrefix}
                />
              ))}
            </div>
          </details>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" className="h-9">
            Terapkan
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href={resetHref}>
              <RotateCcw className="size-4" aria-hidden />
              Atur ulang
            </Link>
          </Button>
          {actions}
          {summary ? <p className="text-xs text-ink-muted">{summary}</p> : null}
        </div>
      </AutoSubmitForm>
    </section>
  );
}

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
    }
  | {
      kind: "search";
      name: string;
      label: string;
      value: string;
      placeholder?: string;
    };

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const columnClass = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

/**
 * One filter contract for every list and dashboard: categorical filters are
 * dropdowns, search stays a text field, and the URL always carries the state.
 */
export function FilterBar({
  action,
  fields,
  hidden = {},
  resetHref,
  summary,
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
          {fields.map((field) => {
            const id = `${idPrefix}-${field.name}`;
            return (
              <div key={field.name} className="min-w-0 space-y-1.5">
                <label
                  htmlFor={id}
                  className="block text-xs font-medium text-ink-muted"
                >
                  {field.label}
                </label>
                {field.kind === "select" ? (
                  <select
                    id={id}
                    name={field.name}
                    defaultValue={field.value}
                    className={selectClass}
                  >
                    <option value="">{field.allLabel}</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type="search"
                    name={field.name}
                    defaultValue={field.value}
                    placeholder={field.placeholder}
                    className={selectClass}
                  />
                )}
              </div>
            );
          })}
        </div>
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
          {summary ? (
            <p className="text-xs text-ink-muted">{summary}</p>
          ) : null}
        </div>
      </AutoSubmitForm>
    </section>
  );
}

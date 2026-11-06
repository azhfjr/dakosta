"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition, type ReactNode } from "react";

/**
 * Native GET form that submits on dropdown change. The submit button remains
 * available for keyboard users and for the no-JS fallback.
 */
export function AutoSubmitForm({
  action,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  action: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const search = new URLSearchParams();
    for (const [key, raw] of data.entries()) {
      if (typeof raw !== "string") continue;
      const value = raw.trim();
      if (value) search.set(key, value);
    }
    const query = search.toString();
    const href = query ? `${action}?${query}` : action;
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <form
      ref={formRef}
      action={action}
      method="get"
      aria-label={ariaLabel}
      aria-busy={pending || undefined}
      className={className}
      onChange={(event) => {
        const tag = (event.target as HTMLElement).tagName;
        if (tag === "SELECT") submit();
      }}
    >
      {children}
    </form>
  );
}

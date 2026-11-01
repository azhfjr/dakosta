"use client";

import { useMemo, useSyncExternalStore } from "react";

export type StakeholderSelectOption = { id: string; name: string };

const DEFAULT_INITIAL_COUNT = 40;

function subscribeToHydration(): () => void {
  return () => {};
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Renders a bounded option set on the server and expands to the full list after
 * hydration. Global scopes can hold thousands of organizations; serializing all
 * of them as option elements delays first paint without adding usable value.
 */
export function StakeholderSelect({
  options,
  defaultValue = "",
  name = "stakeholderId",
  id,
  allLabel = "Semua stakeholder",
  className,
  initialCount = DEFAULT_INITIAL_COUNT,
}: {
  options: StakeholderSelectOption[];
  defaultValue?: string;
  name?: string;
  id?: string;
  allLabel?: string;
  className?: string;
  initialCount?: number;
}) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerSnapshot,
  );

  const visibleOptions = useMemo(() => {
    if (hydrated || options.length <= initialCount) return options;
    const initial = options.slice(0, initialCount);
    if (defaultValue && !initial.some((item) => item.id === defaultValue)) {
      const selected = options.find((item) => item.id === defaultValue);
      if (selected) return [selected, ...initial];
    }
    return initial;
  }, [defaultValue, hydrated, initialCount, options]);

  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className={className}
    >
      <option value="">{allLabel}</option>
      {visibleOptions.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}

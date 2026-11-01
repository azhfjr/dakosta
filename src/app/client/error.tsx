"use client";

import { WorkspaceError } from "@/components/shell/workspace-error";

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <WorkspaceError error={error} reset={reset} scope="Ruang stakeholder" />
  );
}

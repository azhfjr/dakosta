"use client";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      <Toaster position="top-right" richColors closeButton theme="light" />
    </>
  );
}

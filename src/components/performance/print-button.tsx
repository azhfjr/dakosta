"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton({
  label = "Cetak / simpan PDF",
}: {
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="mr-2 size-4" aria-hidden />
      {label}
    </Button>
  );
}

"use client";

import {
  ChevronDown,
  Download,
  FileImage,
  FileText,
  Loader2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { branchFilterValues } from "@/lib/filters/branch-selection";
import type { FilterParams } from "@/lib/filters/query";
import { renderPdfToPng } from "@/lib/reports/infographic";

type ExportFormat = "pdf" | "infographic";

function exportHref(params: FilterParams): string {
  const values = branchFilterValues(params);
  if (values.length === 0) return "/api/v1/reports/dashboard";
  return `/api/v1/reports/dashboard?cabang=${encodeURIComponent(values.join(","))}`;
}

function filenameFrom(header: string | null): string {
  if (!header) return "dashboard-dakosta.pdf";
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] ?? "dashboard-dakosta.pdf";
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in Firefox/Safari.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function DashboardExportButton({
  params,
  className,
}: {
  params: FilterParams;
  className?: string;
}) {
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(format: ExportFormat) {
    if (loading) return;
    setLoading(format);
    setError(null);
    try {
      const href = exportHref(params);
      const url =
        format === "infographic"
          ? `${href}${href.includes("?") ? "&" : "?"}format=infographic`
          : href;
      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        let message = "Unduhan gagal. Coba lagi sebentar.";
        try {
          const body = (await response.json()) as {
            error?: { message?: string };
          };
          if (body.error?.message) message = body.error.message;
        } catch {
          // Keep the default message for non-JSON failures.
        }
        setError(message);
        return;
      }

      if (format === "pdf") {
        const blob = await response.blob();
        saveBlob(
          new Blob([blob], { type: "application/pdf" }),
          filenameFrom(response.headers.get("Content-Disposition")),
        );
        return;
      }

      const bytes = await response.arrayBuffer();
      const png = await renderPdfToPng(bytes);
      saveBlob(
        png.blob,
        response.headers.get("X-Infographic-Filename") ??
          "infografis-dakosta.png",
      );
    } catch {
      setError(
        format === "infographic"
          ? "Gagal membuat infografis PNG. Coba lagi."
          : "Unduhan gagal. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div className="flex flex-col items-stretch gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={className}
            disabled={busy}
            aria-busy={busy}
            aria-label="Unduh dashboard"
            aria-haspopup="menu"
            data-dashboard-export-trigger
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            {busy ? "Menyiapkan..." : "Unduh"}
            <ChevronDown className="size-3.5 opacity-60" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Format unduhan</DropdownMenuLabel>
          <DropdownMenuItem
            data-dashboard-export-option="pdf"
            onSelect={() => handleDownload("pdf")}
          >
            <FileText aria-hidden />
            <span className="flex flex-col">
              <span className="text-sm font-medium">PDF — satu halaman A4</span>
              <span className="text-xs text-ink-muted">
                Seluruh chart kecuali peta
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            data-dashboard-export-option="infographic"
            onSelect={() => handleDownload("infographic")}
          >
            <FileImage aria-hidden />
            <span className="flex flex-col">
              <span className="text-sm font-medium">
                Infografis — PNG 300 DPI
              </span>
              <span className="text-xs text-ink-muted">
                3508 × 2481 piksel, isi sama dengan PDF
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div aria-live="polite" className="max-w-56">
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

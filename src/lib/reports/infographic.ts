import type { AppRole } from "@/lib/authz/types";
import { jakartaToday } from "@/lib/dates";

/**
 * The infographic is the one-page PDF rasterised at 300 DPI (4.167x the 72 DPI
 * page), so both exports always show identical content.
 */
export const INFOGRAPHIC_SCALE = 300 / 72;
export const INFOGRAPHIC_WORKER_SRC = "/vendor/pdf.worker.min.mjs";

export function infographicExportFilename(
  role: AppRole,
  date: Date = new Date(),
): string {
  return `infografis-dakosta-${role.toLowerCase()}-${jakartaToday(date)}.png`;
}

export type RasterizedPdf = {
  blob: Blob;
  width: number;
  height: number;
};

export async function renderPdfToPng(
  pdfBytes: ArrayBuffer,
): Promise<RasterizedPdf> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = INFOGRAPHIC_WORKER_SRC;

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    isEvalSupported: false,
  }).promise;
  try {
    if (doc.numPages !== 1) {
      throw new Error(
        `Infografis membutuhkan tepat 1 halaman, diterima ${doc.numPages}.`,
      );
    }
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: INFOGRAPHIC_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Kanvas tidak tersedia pada peramban ini.");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error("Canvas gagal membuat PNG."));
      }, "image/png");
    });
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    await doc.destroy();
  }
}

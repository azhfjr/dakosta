export function rankingShare(total: number, score: number): number {
  if (
    !Number.isFinite(total) ||
    !Number.isFinite(score) ||
    total <= 0 ||
    score <= 0
  ) {
    return 0;
  }
  return Math.min(100, Math.max(0, (total / score) * 100));
}

const shareFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
});

export function formatShareId(share: number): string {
  return `${shareFormatter.format(share)}%`;
}

import Link from "next/link";

import { BranchEditor } from "@/components/hierarchy/hierarchy-editors";
import { formatNumberId } from "@/lib/dates";
import type { BranchSummary } from "@/lib/hierarchy";

export function BranchTable({
  branches,
  organizationBase,
  showRegion = true,
  editorRegions,
  readOnly = false,
}: {
  branches: BranchSummary[];
  organizationBase?: string;
  showRegion?: boolean;
  editorRegions?: Array<{ id: string; name: string }>;
  readOnly?: boolean;
}) {
  if (branches.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          Belum ada cabang pada lingkup ini
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
          Tambahkan cabang lewat tombol “Tambah cabang” di kanan atas. Cabang
          menentukan reviewer yang memutuskan konten organisasi di bawahnya.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <caption className="sr-only">
          Daftar cabang beserta jumlah organisasi dan konten
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
            <th scope="col" className="px-4 py-3">
              Cabang
            </th>
            {showRegion ? (
              <th scope="col" className="px-4 py-3">
                Wilayah
              </th>
            ) : null}
            <th scope="col" className="px-4 py-3 text-right">
              Organisasi
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Faskes
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Konten
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Disetujui
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Menunggu
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Reviewer
            </th>
            {editorRegions && !readOnly ? (
              <th scope="col" className="px-4 py-3 text-right">
                Tindakan
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {branches.map((branch) => (
            <tr
              key={branch.id}
              className="border-b border-border/70 last:border-0"
            >
              <td className="px-4 py-3">
                {organizationBase ? (
                  <Link
                    href={`${organizationBase}?branchId=${branch.id}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {branch.name}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">
                    {branch.name}
                  </span>
                )}
                <p className="mt-0.5 text-xs text-ink-muted">{branch.code}</p>
              </td>
              {showRegion ? (
                <td className="px-4 py-3 text-ink-muted">
                  {branch.regionName}
                </td>
              ) : null}
              <td className="px-4 py-3 text-right tabular-nums">
                {formatNumberId(branch.organizationCount)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatNumberId(branch.faskesCount)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatNumberId(branch.contentCount)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatNumberId(branch.approvedCount)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatNumberId(branch.pendingCount)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatNumberId(branch.reviewerCount)}
              </td>
              {editorRegions && !readOnly ? (
                <td className="px-4 py-3 text-right">
                  <BranchEditor
                    branch={{
                      id: branch.id,
                      code: branch.code,
                      name: branch.name,
                      status: branch.status,
                      regionId: branch.regionId,
                    }}
                    regions={editorRegions}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

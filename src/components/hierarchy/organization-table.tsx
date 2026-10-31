import Link from "next/link";

import { OrganizationEditor } from "@/components/hierarchy/hierarchy-editors";
import { Badge } from "@/components/ui/badge";
import { formatNumberId } from "@/lib/dates";
import type { OrganizationSummary } from "@/lib/hierarchy";

const TYPE_LABEL: Record<string, string> = {
  FASKES: "Faskes",
  PEMDA: "Pemerintah Daerah",
  OTHER: "Lainnya",
};

const CLASS_LABEL: Record<string, string> = {
  FKTP: "FKTP",
  FKRTL: "FKRTL",
};

export function organizationTypeLabel(
  organization: Pick<OrganizationSummary, "organizationType" | "faskesClass" | "faskesCode">,
): string {
  if (organization.organizationType === "FASKES") {
    return `${CLASS_LABEL[organization.faskesClass ?? ""] ?? "Faskes"} · ${organization.faskesCode ?? "tanpa kode"}`;
  }
  return TYPE_LABEL[organization.organizationType] ?? organization.organizationType;
}

export function OrganizationTable({
  organizations,
  contentBase,
  emptyMessage = "Belum ada organisasi pada lingkup ini.",
  editorBranches,
  readOnly = false,
}: {
  organizations: OrganizationSummary[];
  contentBase?: string;
  emptyMessage?: string;
  editorBranches?: Array<{ id: string; name: string; regionName: string }>;
  readOnly?: boolean;
}) {
  if (organizations.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-12 text-center">
        <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
          Organisasi adalah pelapor konten. Tambahkan lewat tombol “Tambah
          organisasi” di kanan atas, lalu tautkan akun stakeholder ke organisasi
          tersebut pada halaman Akun.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <caption className="sr-only">
          Daftar organisasi beserta jenis, cabang, dan capaian konten
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
            <th scope="col" className="px-4 py-3">
              Organisasi
            </th>
            <th scope="col" className="px-4 py-3">
              Jenis
            </th>
            <th scope="col" className="px-4 py-3">
              Cabang / wilayah
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
              Akun
            </th>
            <th scope="col" className="px-4 py-3">
              Status
            </th>
            {editorBranches && !readOnly ? (
              <th scope="col" className="px-4 py-3 text-right">
                Tindakan
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {organizations.map((organization) => (
            <tr
              key={organization.id}
              className="border-b border-border/70 last:border-0 align-top"
            >
              <td className="px-4 py-3">
                {contentBase ? (
                  <Link
                    href={`${contentBase}?stakeholderId=${organization.id}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {organization.name}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{organization.name}</span>
                )}
                <p className="mt-0.5 text-xs text-ink-muted">{organization.serviceArea}</p>
              </td>
              <td className="px-4 py-3 text-ink-muted">
                {organizationTypeLabel(organization)}
              </td>
              <td className="px-4 py-3 text-ink-muted">
                <span className="block text-foreground">
                  {organization.branchName ?? "Belum ditempatkan"}
                </span>
                <span className="text-xs">{organization.regionName ?? "—"}</span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatNumberId(organization.contentCount)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatNumberId(organization.approvedCount)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatNumberId(organization.pendingCount)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatNumberId(organization.accountCount)}
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={
                    organization.status === "ACTIVE"
                      ? "border-status-approved/30 bg-status-approved/10 text-status-approved"
                      : "border-border bg-surface-muted text-ink-muted"
                  }
                >
                  {organization.status === "ACTIVE" ? "Aktif" : organization.status}
                </Badge>
              </td>
              {editorBranches && !readOnly ? (
                <td className="px-4 py-3 text-right">
                  <OrganizationEditor
                    organization={{
                      id: organization.id,
                      name: organization.name,
                      organizationType: organization.organizationType,
                      faskesClass: organization.faskesClass,
                      faskesCode: organization.faskesCode,
                      serviceArea: organization.serviceArea,
                      addressLabel: organization.addressLabel,
                      latitude: organization.latitude,
                      longitude: organization.longitude,
                      status: organization.status,
                      branchId: organization.branchId,
                    }}
                    branches={editorBranches}
                    impact={{
                      contents: organization.contentCount,
                      accounts: organization.accountCount,
                    }}
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

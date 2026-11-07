import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Info,
  Medal,
  Search,
} from "lucide-react";

import { ContentTypeBadge } from "@/components/content/content-type-badge";
import { StatusBadge } from "@/components/content/status-badge";
import {
  BranchAchievementChart,
  MonthlyTrendChart,
  ThemeSubthemeTrend,
  TypePlatformTrend,
} from "@/components/dashboard/approved-charts";
import { DashboardMapSection } from "@/components/dashboard/dashboard-map";
import { StatCard } from "@/components/dashboard/stat-card";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import type {
  ApprovedDashboard,
  ApprovedDashboardFilters,
} from "@/lib/analytics/dashboard";
import { approvedDashboardQuery } from "@/lib/analytics/dashboard";
import { PLATFORM_LABEL } from "@/lib/content-status";
import { formatDateId, formatDateTimeId, formatNumberId } from "@/lib/dates";
import { buildFilterHref, filterResetHref } from "@/lib/filters/query";
import type { FilterOptions } from "@/lib/filters/options";
import { MAP_STYLE_URL } from "@/lib/geo";
import {
  MAIN_THEME_LABELS,
  SUB_THEME_LABELS,
  type SubTheme,
} from "@/lib/taxonomy";
import type { AppRole } from "@/lib/session";

function formatPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
    >
      <header className="border-b border-border bg-surface-muted/40 px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold tracking-wide text-brand-blue-700 uppercase">
          {eyebrow}
        </p>
        <h2
          id={`${id}-heading`}
          className="mt-0.5 text-lg font-semibold text-foreground"
        >
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function RankingTable({
  data,
  basePath,
  detailBase,
  query,
  rankingSearch,
  rankingLimit,
  topOptions,
}: {
  data: ApprovedDashboard["ranking"];
  basePath: string;
  detailBase: string;
  query: Record<string, string>;
  rankingSearch: string;
  rankingLimit: number;
  topOptions: number[];
}) {
  const hidden = Object.fromEntries(
    Object.entries(query).filter(([key]) => key !== "page"),
  );
  const allHref = buildFilterHref(
    detailBase,
    { ...query, sort: "organization" },
    { page: null },
  );

  return (
    <Section
      id="peringkat"
      eyebrow="Peringkat"
      title="Pencapaian per Faskes, Pemda, dan Stakeholder"
      description="Peringkat konten dengan approval final, dari capaian tertinggi. Peringkat yang sama diberikan bila jumlah kontennya sama."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {data.categories.map((category) => (
          <span
            key={category.key}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted/60 px-3 py-1 text-xs text-ink-muted"
          >
            {category.label}
            <span className="font-semibold text-foreground tabular">
              {formatNumberId(category.approved)}
            </span>
            <span className="text-[11px]">
              · {formatNumberId(category.institutions)} instansi
            </span>
          </span>
        ))}
      </div>

      <form
        action={`${basePath}#peringkat`}
        method="get"
        className="mb-4 flex flex-wrap items-end gap-2"
      >
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <label
            htmlFor="rank-q"
            className="block text-xs font-medium text-ink-muted"
          >
            Cari nama instansi
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <input
              id="rank-q"
              type="search"
              name="rankQ"
              defaultValue={rankingSearch}
              placeholder="Nama Faskes, Pemda, atau stakeholder"
              className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="rank-limit"
            className="block text-xs font-medium text-ink-muted"
          >
            Tampilkan
          </label>
          <select
            id="rank-limit"
            name="rankLimit"
            defaultValue={String(rankingLimit)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {topOptions.map((value) => (
              <option key={value} value={value}>
                {value} teratas
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" className="h-10">
          Terapkan
        </Button>
        <Button asChild variant="outline" size="sm" className="h-10">
          <Link href={allHref}>Lihat semua di Detail Konten</Link>
        </Button>
      </form>

      {data.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-10 text-center">
          <Medal className="mx-auto size-8 text-ink-muted" aria-hidden />
          <p className="mt-3 text-sm font-medium text-foreground">
            Tidak ada instansi yang cocok
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Ubah kata kunci atau atur ulang filter peringkat.
          </p>
        </div>
      ) : (
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Tabel peringkat institusi, dapat digulir"
        >
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <caption className="sr-only">
              Peringkat instansi berdasarkan konten disetujui
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                <th scope="col" className="px-3 py-3 text-right">
                  Peringkat
                </th>
                <th scope="col" className="px-3 py-3">
                  Instansi
                </th>
                <th scope="col" className="px-3 py-3">
                  Kategori
                </th>
                <th scope="col" className="px-3 py-3">
                  Cabang
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Disetujui
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/70 last:border-0 hover:bg-surface-muted/60"
                >
                  <td className="px-3 py-3 text-right font-semibold text-foreground tabular">
                    {row.rank}
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground">
                    {row.name}
                  </td>
                  <td className="px-3 py-3 text-ink-muted">
                    {row.categoryLabel}
                  </td>
                  <td className="px-3 py-3 text-ink-muted">
                    {row.detail || "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-foreground tabular">
                    {formatNumberId(row.approved)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        Menampilkan {formatNumberId(data.shown)} dari{" "}
        {formatNumberId(data.total)} instansi dengan konten disetujui
        {data.hasMore
          ? ". Persempit pencarian atau naikkan jumlah baris untuk melihat peringkat berikutnya."
          : "."}
      </p>
    </Section>
  );
}

function ContentTableSection({
  data,
  filters,
  options,
  role,
  basePath,
  detailBase,
  query,
}: {
  data: ApprovedDashboard["table"];
  filters: ApprovedDashboardFilters;
  options: FilterOptions;
  role: AppRole;
  basePath: string;
  detailBase: string;
  query: Record<string, string>;
}) {
  const showStakeholderFilter =
    role !== "STAKEHOLDER" || options.stakeholders.length > 1;
  const showBranchFilter = role === "MASTER_ADMIN" || role === "REGIONAL_ADMIN";

  const fields: FilterField[] = [
    {
      kind: "search",
      name: "q",
      label: "Cari konten",
      value: filters.table.search,
      placeholder: "Judul, kode referensi, atau organisasi",
    },
    ...(showStakeholderFilter
      ? [
          {
            kind: "select" as const,
            name: "stakeholderId",
            label: "Instansi",
            value: filters.table.stakeholderId ?? "",
            options: options.stakeholders,
            allLabel:
              role === "STAKEHOLDER"
                ? "Semua organisasi saya"
                : "Semua instansi",
          },
        ]
      : []),
    ...(showBranchFilter
      ? [
          {
            kind: "select" as const,
            name: "branchId",
            label: "Cabang",
            value: filters.table.branchId ?? "",
            options: options.branches,
            allLabel: "Semua cabang",
          },
        ]
      : []),
    {
      kind: "select",
      name: "orgType",
      label: "Jenis organisasi",
      value: filters.table.orgType ?? "",
      options: options.orgTypes,
      allLabel: "Semua jenis organisasi",
    },
    {
      kind: "select",
      name: "mainTheme",
      label: "Tema utama",
      value: filters.table.mainTheme ?? "",
      options: options.mainThemes,
      allLabel: "Semua tema",
    },
    {
      kind: "select",
      name: "subTheme",
      label: "Sub-tema",
      value: filters.table.subTheme ?? "",
      options: options.subThemes,
      allLabel: "Semua sub-tema",
    },
    {
      kind: "select",
      name: "type",
      label: "Jenis konten",
      value: filters.table.contentType ?? "",
      options: options.contentTypes,
      allLabel: "Semua jenis konten",
    },
    {
      kind: "select",
      name: "platform",
      label: "Platform",
      value: filters.table.platform ?? "",
      options: options.platforms,
      allLabel: "Semua platform",
    },
  ];

  const advancedFields: FilterField[] = [
    {
      kind: "date",
      name: "from",
      label: "Disetujui mulai",
      value: filters.table.dateFrom ?? "",
    },
    {
      kind: "date",
      name: "to",
      label: "Disetujui sampai",
      value: filters.table.dateTo ?? "",
    },
    {
      kind: "select",
      name: "sort",
      label: "Urutkan",
      value: filters.table.sort === "approved_recent" ? "" : filters.table.sort,
      options: sortOptions(),
      allLabel: "Terbaru disetujui",
    },
  ];

  return (
    <Section
      id="tabel"
      eyebrow="Tabel detail"
      title="Detail Seluruh Konten Disetujui"
      description="Seluruh konten disetujui pada cakupan Anda, bukan hanya halaman ini. Filter berlaku pada tabel, total, dan unduhan."
    >
      <div className="space-y-4">
        <FilterBar
          action={`${basePath}#tabel`}
          fields={fields}
          advancedFields={advancedFields}
          resetHref={filterResetHref(basePath, "tabel")}
          label="Filter konten disetujui"
          idPrefix="dasbor-konten"
          summary="Semua filter tersimpan di URL sehingga dapat dibagikan."
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-muted">
            {formatNumberId(data.total)} konten disetujui cocok dengan filter ·{" "}
            {formatNumberId(data.rows.length)} pada halaman {data.page} dari{" "}
            {data.pageCount}.
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-approved/10 px-2.5 py-1 text-xs font-medium text-status-approved">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Hanya status Disetujui
          </span>
        </div>

        {data.rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-12 text-center">
            <FileText className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">
              Tidak ada konten disetujui yang cocok
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Ubah filter atau atur ulang untuk melihat seluruh konten
              tervalidasi.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 h-9">
              <Link href={filterResetHref(basePath, "tabel")}>
                Atur ulang filter
              </Link>
            </Button>
          </div>
        ) : (
          <div
            className="overflow-x-auto rounded-lg border border-border"
            tabIndex={0}
            role="region"
            aria-label="Tabel detail konten disetujui, dapat digulir"
          >
            <table className="w-full min-w-[72rem] border-collapse text-sm">
              <caption className="sr-only">
                Detail seluruh konten disetujui pada cakupan Anda
              </caption>
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-3 py-3">
                    Kode
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Judul
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Instansi
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Cabang
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Tema / sub-tema
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Jenis
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Platform
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Disetujui
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/70 align-top last:border-0 hover:bg-surface-muted/60"
                  >
                    <td className="px-3 py-3 font-mono text-xs text-ink-muted">
                      {row.referenceCode}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`${detailBase}/${row.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {row.title ?? "(tanpa judul)"}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-muted">
                      {row.organization}
                    </td>
                    <td className="px-3 py-3 text-ink-muted">
                      {row.branchName ?? "Tanpa cabang"}
                    </td>
                    <td className="px-3 py-3 text-ink-muted">
                      <p>
                        {row.mainTheme
                          ? (MAIN_THEME_LABELS[
                              row.mainTheme as keyof typeof MAIN_THEME_LABELS
                            ] ?? row.mainTheme)
                          : "Tanpa tema"}
                      </p>
                      <p className="text-xs">
                        {row.subTheme
                          ? (SUB_THEME_LABELS[row.subTheme as SubTheme] ??
                            row.subTheme)
                          : "Tanpa sub-tema"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <ContentTypeBadge contentType={row.contentType} />
                    </td>
                    <td className="px-3 py-3 text-ink-muted">
                      {row.platform
                        ? (PLATFORM_LABEL[row.platform] ?? row.platform)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-ink-muted">
                      {row.approvedAt ? formatDateId(row.approvedAt) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-xs text-ink-muted">
            Halaman {data.page} dari {data.pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              asChild={data.page > 1}
              size="sm"
              variant="outline"
              className="h-9"
              disabled={data.page <= 1}
            >
              {data.page > 1 ? (
                <Link
                  href={buildFilterHref(
                    basePath,
                    query,
                    { page: data.page - 1 },
                    { keepPage: true, hash: "tabel" },
                  )}
                >
                  Sebelumnya
                </Link>
              ) : (
                <span>Sebelumnya</span>
              )}
            </Button>
            <Button
              asChild={data.page < data.pageCount}
              size="sm"
              variant="outline"
              className="h-9"
              disabled={data.page >= data.pageCount}
            >
              {data.page < data.pageCount ? (
                <Link
                  href={buildFilterHref(
                    basePath,
                    query,
                    { page: data.page + 1 },
                    { keepPage: true, hash: "tabel" },
                  )}
                >
                  Berikutnya
                </Link>
              ) : (
                <span>Berikutnya</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function sortOptions() {
  return [
    { value: "approved_recent", label: "Terbaru disetujui" },
    { value: "approved_oldest", label: "Terlama disetujui" },
    { value: "title", label: "Judul A–Z" },
    { value: "organization", label: "Organisasi A–Z" },
  ];
}

export function ApprovedDashboardView({
  data,
  filters,
  role,
  options,
  basePath,
  detailBase,
  title,
  description,
  headerActions,
  notice,
  hideHeader = false,
}: {
  data: ApprovedDashboard;
  filters: ApprovedDashboardFilters;
  role: AppRole;
  options: FilterOptions;
  basePath: string;
  detailBase: string;
  title: string;
  description: string;
  headerActions?: ReactNode;
  notice?: ReactNode;
  hideHeader?: boolean;
}) {
  const query = approvedDashboardQuery(filters);

  return (
    <div className="space-y-6">
      {hideHeader ? null : (
        <PageHeader
          title={title}
          description={description}
          meta={`Diperbarui ${formatDateTimeId(data.generatedAt)} WIB`}
          actions={headerActions}
        />
      )}

      {notice}

      <section
        aria-label="Ringkasan capaian disetujui"
        className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold tracking-wide text-brand-blue-700 uppercase">
            Capaian seluruh periode
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal-100 px-2.5 py-1 text-xs font-medium text-brand-teal-700">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Hanya status Disetujui
          </span>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total konten disetujui"
            value={formatNumberId(data.totals.approved)}
            hint="Seluruh riwayat pada cakupan Anda"
            icon={CheckCircle2}
            tone="green"
          />
          <StatCard
            label="Disetujui bulan ini"
            value={formatNumberId(data.totals.thisMonth)}
            hint={`${formatPercent(data.totals.growth)} dibanding bulan lalu (${formatNumberId(data.totals.lastMonth)})`}
            icon={FileText}
            tone="blue"
          />
          <StatCard
            label="Instansi berkontribusi"
            value={formatNumberId(data.totals.organizations)}
            hint="Memiliki minimal satu konten disetujui"
            icon={Building2}
            tone="teal"
          />
          <StatCard
            label="Cabang tercakup"
            value={formatNumberId(data.totals.branches)}
            hint="Cabang dengan konten disetujui"
            icon={Medal}
            tone="amber"
          />
        </div>
        <p className="mt-4 flex items-start gap-1.5 text-xs text-ink-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Angka capaian memakai satu definisi: status Disetujui, memiliki
          tanggal approval final, tidak diarsipkan, dan berada dalam cakupan
          akses Anda. Tanggal mengikuti zona waktu Asia/Jakarta.
        </p>
      </section>

      <nav
        aria-label="Bagian dashboard"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        {[
          ...(data.branchAchievement
            ? [{ href: "#pencapaian-cabang", label: "Pencapaian cabang" }]
            : []),
          { href: "#peta", label: "Peta" },
          { href: "#peringkat", label: "Peringkat" },
          { href: "#tren-bulanan", label: "Tren bulanan" },
          { href: "#tren-tema", label: "Tema & sub-tema" },
          { href: "#tren-jenis-platform", label: "Jenis & platform" },
          { href: "#tabel", label: "Tabel detail" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-full border border-border bg-surface px-3 py-1.5 font-medium text-foreground transition hover:border-brand-blue-300 hover:text-brand-blue-700"
          >
            {item.label}
          </a>
        ))}
      </nav>

      {data.branchAchievement ? (
        <Section
          id="pencapaian-cabang"
          eyebrow="Blok 1"
          title="Pencapaian Konten per Kantor Cabang"
          description="Capaian konten disetujui di seluruh cabang pada wilayah Kedeputian Anda, diurutkan dari yang tertinggi."
        >
          <BranchAchievementChart data={data.branchAchievement} />
        </Section>
      ) : null}

      <Section
        id="peta"
        eyebrow={data.branchAchievement ? "Blok 2" : "Blok 1"}
        title="Peta Sebaran Capaian"
        description="Peta interaktif agregat konten disetujui pada cakupan Anda. Koordinat berasal dari profil organisasi; titik tanpa koordinat valid tidak ditampilkan."
      >
        <DashboardMapSection map={data.map} styleUrl={MAP_STYLE_URL} />
      </Section>

      <RankingTable
        data={data.ranking}
        basePath={basePath}
        detailBase={detailBase}
        query={query}
        rankingSearch={filters.rankingSearch}
        rankingLimit={filters.rankingLimit}
        topOptions={[10, 25, 50]}
      />

      <Section
        id="tren-bulanan"
        eyebrow="Blok 4"
        title="Tren Persetujuan per Bulan"
        description="Jumlah konten disetujui setiap bulan berdasarkan tanggal approval final, dengan bulan kosong ditampilkan sebagai nol."
      >
        <MonthlyTrendChart data={data.monthly} />
      </Section>

      <Section
        id="tren-tema"
        eyebrow="Blok 5"
        title="Tren per Tema dan Sub-tema"
        description="Perbandingan tema utama per bulan serta kontribusi sub-tema pada rentang yang dipilih. Sub-tema tanpa pemetaan sah dipisahkan agar tidak menyamarkan data."
      >
        <ThemeSubthemeTrend
          monthly={data.theme.monthly}
          subThemes={data.theme.subThemes}
        />
      </Section>

      <Section
        id="tren-jenis-platform"
        eyebrow="Blok 6"
        title="Tren per Jenis Konten dan Platform"
        description="Tren disetujui menurut jenis konten dan platform. Satu konten unik dihitung satu kali berdasarkan platform yang tercatat pada data."
      >
        <TypePlatformTrend data={data.typePlatform} />
      </Section>

      <ContentTableSection
        data={data.table}
        filters={filters}
        options={options}
        role={role}
        basePath={basePath}
        detailBase={detailBase}
        query={query}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-blue-100 bg-brand-blue-100/40 p-4 text-sm leading-relaxed text-brand-blue-800">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Dashboard hanya menampilkan konten dengan approval final.{" "}
          {role === "STAKEHOLDER"
            ? "Riwayat seluruh status konten Anda tersedia di Detail Konten."
            : "Antrean validasi dan analitik operasional tersedia di menu SLA."}
        </p>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link
            href={
              role === "MASTER_ADMIN"
                ? "/admin/validasi"
                : role === "BRANCH_ADMIN"
                  ? "/cabang"
                  : role === "REGIONAL_ADMIN"
                    ? "/wilayah"
                    : "/client/konten"
            }
          >
            {role === "STAKEHOLDER" ? "Buka Detail Konten" : "Buka SLA"}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

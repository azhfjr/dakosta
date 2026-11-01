import "server-only";

import { asc, count, eq, max, sql } from "drizzle-orm";

import { getDb, schema } from "@/db";

export const STAKEHOLDER_CATEGORY_LABEL: Record<string, string> = {
  FASKES: "Fasilitas kesehatan",
  INSTANSI: "Instansi",
  TOKOH: "Tokoh",
  MEDIA: "Media",
  INFLUENCER: "Influencer",
  ORGANISASI: "Organisasi",
};

export type StakeholderOverviewRow = {
  id: string;
  name: string;
  category: string;
  faskesType: string | null;
  serviceArea: string;
  addressLabel: string | null;
  latitude: number;
  longitude: number;
  locationPrecision: "exact" | "approximate";
  websiteUrl: string | null;
  socialHandle: string | null;
  status: string;
  joinedAt: string;
  submissionCount: number;
  approvedCount: number;
  lastActivityAt: Date | null;
  clientCount: number;
};

export type StakeholderOverview = {
  rows: StakeholderOverviewRow[];
  totals: {
    stakeholders: number;
    active: number;
    withApproved: number;
    approved: number;
  };
};

export async function getStakeholderOverview(): Promise<StakeholderOverview> {
  const db = getDb();

  const [stakeholderRows, submissionRows, memberRows] = await Promise.all([
    db
      .select({
        id: schema.stakeholders.id,
        name: schema.stakeholders.name,
        category: schema.stakeholders.category,
        faskesType: schema.stakeholders.faskesType,
        serviceArea: schema.stakeholders.serviceArea,
        addressLabel: schema.stakeholders.addressLabel,
        latitude: schema.stakeholders.latitude,
        longitude: schema.stakeholders.longitude,
        locationPrecision: schema.stakeholders.locationPrecision,
        websiteUrl: schema.stakeholders.websiteUrl,
        socialHandle: schema.stakeholders.socialHandle,
        status: schema.stakeholders.status,
        joinedAt: schema.stakeholders.joinedAt,
      })
      .from(schema.stakeholders)
      .orderBy(asc(schema.stakeholders.name)),
    db
      .select({
        stakeholderId: schema.contentSubmissions.stakeholderId,
        total: count(),
        approved: sql<number>`count(*) filter (where ${schema.contentSubmissions.status} = 'APPROVED')`,
        lastActivityAt: max(schema.contentSubmissions.updatedAt),
      })
      .from(schema.contentSubmissions)
      .groupBy(schema.contentSubmissions.stakeholderId),
    db
      .select({
        stakeholderId: schema.userStakeholderMemberships.stakeholderId,
        total: count(),
      })
      .from(schema.userStakeholderMemberships)
      .innerJoin(
        schema.userProfiles,
        eq(
          schema.userProfiles.userId,
          schema.userStakeholderMemberships.userId,
        ),
      )
      .where(eq(schema.userProfiles.active, true))
      .groupBy(schema.userStakeholderMemberships.stakeholderId),
  ]);

  const submissionMap = new Map(
    submissionRows.map((row) => [
      row.stakeholderId,
      {
        total: Number(row.total),
        approved: Number(row.approved),
        lastActivityAt: row.lastActivityAt,
      },
    ]),
  );
  const memberMap = new Map(
    memberRows.map((row) => [row.stakeholderId, Number(row.total)]),
  );

  const rows: StakeholderOverviewRow[] = stakeholderRows.map((row) => {
    const stats = submissionMap.get(row.id);
    return {
      ...row,
      locationPrecision:
        row.locationPrecision === "exact" ? "exact" : "approximate",
      submissionCount: stats?.total ?? 0,
      approvedCount: stats?.approved ?? 0,
      lastActivityAt: stats?.lastActivityAt ?? null,
      clientCount: memberMap.get(row.id) ?? 0,
    };
  });

  return {
    rows,
    totals: {
      stakeholders: rows.length,
      active: rows.filter((row) => row.status === "ACTIVE").length,
      withApproved: rows.filter((row) => row.approvedCount > 0).length,
      approved: rows.reduce((sum, row) => sum + row.approvedCount, 0),
    },
  };
}

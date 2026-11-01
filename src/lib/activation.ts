import "server-only";

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/types";
import { AppError, errors } from "@/lib/errors";

export const MAX_ACTIVATION_ACCURACY_METERS = 150;
export const DISTANCE_REVIEW_FLAG_METERS = 50_000;

export type ActivationInput = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

export type ActivationSummary = {
  status: AuthContext["locationStatus"];
  graceDeadline: Date | null;
  location: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    source: string;
    distanceMeters: number | null;
    reviewFlag: boolean;
    consentAt: Date;
  } | null;
};

function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

function assertCoordinate(
  value: number,
  min: number,
  max: number,
  label: string,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw errors.validation(`${label} tidak valid.`);
  }
}

export async function getActivationSummary(
  userId: string,
): Promise<ActivationSummary> {
  const db = getDb();
  const [profile] = await db
    .select({
      locationStatus: schema.userProfiles.locationStatus,
      locationGraceDeadline: schema.userProfiles.locationGraceDeadline,
    })
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId))
    .limit(1);

  const [location] = await db
    .select({
      latitude: schema.userActivationLocations.latitude,
      longitude: schema.userActivationLocations.longitude,
      accuracyMeters: schema.userActivationLocations.accuracyMeters,
      source: schema.userActivationLocations.source,
      distanceMeters: schema.userActivationLocations.distanceMeters,
      reviewFlag: schema.userActivationLocations.reviewFlag,
      consentAt: schema.userActivationLocations.consentAt,
    })
    .from(schema.userActivationLocations)
    .where(eq(schema.userActivationLocations.userId, userId))
    .limit(1);

  return {
    status:
      profile?.locationStatus === "VERIFIED"
        ? "VERIFIED"
        : profile?.locationStatus === "EXEMPT"
          ? "EXEMPT"
          : profile?.locationStatus === "GRACE"
            ? "GRACE"
            : "PENDING",
    graceDeadline: profile?.locationGraceDeadline ?? null,
    location: location ?? null,
  };
}

export async function saveActivationLocation(
  user: AuthContext,
  input: ActivationInput,
  requestId?: string,
): Promise<{
  status: "VERIFIED";
  distanceMeters: number | null;
  reviewFlag: boolean;
}> {
  assertCoordinate(input.latitude, -90, 90, "Lintang");
  assertCoordinate(input.longitude, -180, 180, "Bujur");
  if (
    !Number.isFinite(input.accuracyMeters) ||
    input.accuracyMeters < 0 ||
    input.accuracyMeters > MAX_ACTIVATION_ACCURACY_METERS
  ) {
    throw new AppError(
      "LOCATION_ACCURACY_REQUIRED",
      `Akurasi lokasi harus ≤${MAX_ACTIVATION_ACCURACY_METERS} m. Pindahkan perangkat ke area terbuka lalu coba lagi.`,
      422,
      { maxAccuracyMeters: MAX_ACTIVATION_ACCURACY_METERS },
    );
  }

  let distance: number | null = null;
  if (user.scope.kind === "ORG") {
    const [organization] = await getDb()
      .select({
        latitude: schema.stakeholders.latitude,
        longitude: schema.stakeholders.longitude,
      })
      .from(schema.stakeholders)
      .where(eq(schema.stakeholders.id, user.scope.organizationId))
      .limit(1);
    if (organization) {
      distance = distanceMeters(input, organization);
    }
  }
  const reviewFlag =
    distance !== null && distance > DISTANCE_REVIEW_FLAG_METERS;
  const consentAt = new Date();

  await getDb().transaction(async (tx) => {
    await tx
      .insert(schema.userActivationLocations)
      .values({
        userId: user.userId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters,
        source: "browser_geolocation",
        distanceMeters: distance,
        reviewFlag,
        consentAt,
      })
      .onConflictDoUpdate({
        target: schema.userActivationLocations.userId,
        set: {
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          source: "browser_geolocation",
          distanceMeters: distance,
          reviewFlag,
          consentAt,
          updatedAt: consentAt,
        },
      });

    await tx
      .update(schema.userProfiles)
      .set({
        locationStatus: "VERIFIED",
        locationGraceDeadline: null,
        updatedAt: consentAt,
      })
      .where(eq(schema.userProfiles.userId, user.userId));
  });

  await recordAudit({
    actorId: user.userId,
    actorRole: user.role,
    action: "LOCATION_ACTIVATED",
    recordType: "USER_PROFILE",
    recordId: user.userId,
    after: {
      source: "browser_geolocation",
      accuracyMeters: input.accuracyMeters,
      reviewFlag,
    },
    regionId:
      "regionId" in user.scope && typeof user.scope.regionId === "string"
        ? user.scope.regionId
        : null,
    branchId: "branchId" in user.scope ? user.scope.branchId : null,
    organizationId:
      user.scope.kind === "ORG" ? user.scope.organizationId : null,
    source: "API",
    requestId: requestId ?? null,
  });

  return { status: "VERIFIED", distanceMeters: distance, reviewFlag };
}

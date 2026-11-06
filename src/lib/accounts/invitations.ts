import "server-only";

import { hashPassword } from "better-auth/crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  buildActivationUrl,
  createInvitationToken,
  hashInvitationToken,
  invitationExpiry,
} from "@/lib/accounts/activation-link";
import type { AppRole } from "@/lib/authz/types";
import { getAppUrl } from "@/lib/env";
import { errors } from "@/lib/errors";

export type InvitationPurpose = "ACTIVATION" | "RESET";

const INVALID_LINK_MESSAGE =
  "Tautan aktivasi tidak valid atau sudah kedaluwarsa.";

export async function issueInvitation(input: {
  userId: string;
  purpose: InvitationPurpose;
  createdBy: string | null;
}): Promise<{ url: string; expiresAt: string }> {
  const token = createInvitationToken();
  const expiresAt = invitationExpiry();
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .update(schema.accountInvitations)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.accountInvitations.userId, input.userId),
          eq(schema.accountInvitations.purpose, input.purpose),
          isNull(schema.accountInvitations.usedAt),
        ),
      );

    await tx.insert(schema.accountInvitations).values({
      userId: input.userId,
      tokenHash: hashInvitationToken(token),
      purpose: input.purpose,
      expiresAt,
      createdBy: input.createdBy,
    });
  });

  return {
    url: buildActivationUrl(getAppUrl(), token),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function activateAccount(input: {
  token: string;
  password: string;
}): Promise<{ userId: string; role: AppRole }> {
  const db = getDb();
  const tokenHash = hashInvitationToken(input.token.trim());
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select({
        id: schema.accountInvitations.id,
        userId: schema.accountInvitations.userId,
      })
      .from(schema.accountInvitations)
      .where(
        and(
          eq(schema.accountInvitations.tokenHash, tokenHash),
          isNull(schema.accountInvitations.usedAt),
          gt(schema.accountInvitations.expiresAt, new Date()),
        ),
      )
      .limit(1)
      .for("update");

    if (!invitation) throw errors.validation(INVALID_LINK_MESSAGE);

    const updatedAccounts = await tx
      .update(schema.account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(
        and(
          eq(schema.account.userId, invitation.userId),
          eq(schema.account.providerId, "credential"),
        ),
      )
      .returning({ id: schema.account.id });

    if (updatedAccounts.length === 0) {
      throw errors.server("Akun kredensial tidak ditemukan.");
    }

    await tx
      .update(schema.accountInvitations)
      .set({ usedAt: new Date() })
      .where(eq(schema.accountInvitations.id, invitation.id));

    await tx
      .update(schema.userProfiles)
      .set({ mustChangePassword: false, updatedAt: new Date() })
      .where(eq(schema.userProfiles.userId, invitation.userId));

    await tx
      .delete(schema.session)
      .where(eq(schema.session.userId, invitation.userId));

    const [membership] = await tx
      .select({ role: schema.userMemberships.role })
      .from(schema.userMemberships)
      .where(
        and(
          eq(schema.userMemberships.userId, invitation.userId),
          isNull(schema.userMemberships.revokedAt),
        ),
      )
      .limit(1);

    return {
      userId: invitation.userId,
      role: (membership?.role ?? "STAKEHOLDER") as AppRole,
    };
  });
}

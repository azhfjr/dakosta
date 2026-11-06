import { z } from "zod";

import { activateAccount } from "@/lib/accounts/invitations";
import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/authz/guards";
import { guardRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  token: z.string().trim().min(20).max(256),
  password: z.string().min(12, "Kata sandi minimal 12 karakter.").max(128),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    await guardRateLimit(request, "activation", "account-activate");
    const input = inputSchema.parse(await readJson(request));
    const result = await activateAccount(input);

    await recordAudit({
      actorId: result.userId,
      actorRole: result.role,
      action: "ACCOUNT_ACTIVATED",
      recordType: "USER",
      recordId: result.userId,
      after: { mustChangePassword: false },
      requestId,
      source: "APP",
    });

    return jsonOk({ activated: true }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

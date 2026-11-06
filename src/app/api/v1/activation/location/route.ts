import { z } from "zod";

import { saveActivationLocation } from "@/lib/activation";
import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { assertSameOrigin, getApiAuth } from "@/lib/authz/guards";
import { guardRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(100_000),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const user = await getApiAuth({ allowPendingLocation: true });
    await guardRateLimit(request, "mutation", "activation-location");
    const input = inputSchema.parse(await readJson(request));
    const result = await saveActivationLocation(user, input, requestId);
    return jsonOk(result, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

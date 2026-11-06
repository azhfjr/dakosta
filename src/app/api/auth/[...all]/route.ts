import { toNextJsHandler } from "better-auth/next-js";

import { getRequestId, jsonError } from "@/lib/api";
import { getAuth } from "@/lib/auth";
import { guardRateLimit } from "@/lib/rate-limit";

type Handlers = ReturnType<typeof toNextJsHandler>;

let handlers: Handlers | undefined;

function getHandlers(): Handlers {
  if (!handlers) handlers = toNextJsHandler(getAuth());
  return handlers;
}

export async function GET(request: Request): Promise<Response> {
  return getHandlers().GET(request);
}

export async function POST(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  try {
    await guardRateLimit(request, "auth", "auth");
  } catch (error) {
    return jsonError(error, requestId);
  }
  return getHandlers().POST(request);
}

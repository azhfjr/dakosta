import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

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
  return getHandlers().POST(request);
}

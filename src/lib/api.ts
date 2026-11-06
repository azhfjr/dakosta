import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError, errors } from "@/lib/errors";

export type ApiMeta = {
  requestId: string;
  [key: string]: unknown;
};

export const MAX_JSON_BODY_BYTES = 1_048_576;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getRequestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && UUID_PATTERN.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

export function jsonOk<T>(
  data: T,
  options: {
    requestId?: string;
    meta?: Record<string, unknown>;
    status?: number;
    headers?: Record<string, string>;
  } = {},
): NextResponse {
  const {
    requestId = crypto.randomUUID(),
    meta,
    status = 200,
    headers,
  } = options;
  return NextResponse.json(
    {
      data,
      meta: { requestId, ...meta },
      error: null,
    },
    { status, headers },
  );
}

export function jsonError(
  error: unknown,
  requestId: string,
  headers?: Record<string, string>,
): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        data: null,
        meta: { requestId },
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status, headers },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        data: null,
        meta: { requestId },
        error: {
          code: "VALIDATION_ERROR",
          message: "Data yang dikirim belum lengkap atau tidak valid.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400, headers },
    );
  }

  const authLike = error as {
    status?: unknown;
    statusCode?: unknown;
    message?: unknown;
  };
  const rawStatus = authLike?.status ?? authLike?.statusCode;
  const authStatus = typeof rawStatus === "number" ? rawStatus : Number.NaN;
  if (Number.isInteger(authStatus) && authStatus >= 400 && authStatus < 500) {
    const code =
      authStatus === 400
        ? "VALIDATION_ERROR"
        : authStatus === 401
          ? "UNAUTHORIZED"
          : authStatus === 403
            ? "FORBIDDEN"
            : authStatus === 429
              ? "RATE_LIMITED"
              : "REQUEST_REJECTED";
    return NextResponse.json(
      {
        data: null,
        meta: { requestId },
        error: {
          code,
          message:
            typeof authLike.message === "string" && authLike.message.length > 0
              ? authLike.message
              : "Permintaan tidak dapat diproses.",
        },
      },
      { status: authStatus, headers },
    );
  }

  console.error(`[api] ${requestId}`, error);
  return NextResponse.json(
    {
      data: null,
      meta: { requestId },
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan pada server.",
      },
    },
    { status: 500, headers },
  );
}

export async function readJson<T>(request: Request): Promise<T> {
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw errors.payloadTooLarge();
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    throw new AppError(
      "INVALID_BODY",
      "Isi permintaan tidak dapat dibaca.",
      400,
    );
  }

  if (new TextEncoder().encode(body).byteLength > MAX_JSON_BODY_BYTES) {
    throw errors.payloadTooLarge();
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new AppError(
      "INVALID_JSON",
      "Isi permintaan bukan JSON yang valid.",
      400,
    );
  }
}

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/errors";

export type ApiMeta = {
  requestId: string;
  [key: string]: unknown;
};

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
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
  const authStatus = Number(authLike?.status ?? authLike?.statusCode);
  if (Number.isInteger(authStatus) && authStatus >= 400 && authStatus < 500) {
    return NextResponse.json(
      {
        data: null,
        meta: { requestId },
        error: {
          code: authStatus === 401 ? "UNAUTHORIZED" : "REQUEST_REJECTED",
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
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError(
      "INVALID_JSON",
      "Isi permintaan bukan JSON yang valid.",
      400,
    );
  }
}

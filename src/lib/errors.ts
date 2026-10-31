export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const errors = {
  unauthorized: () =>
    new AppError("UNAUTHORIZED", "Sesi tidak ditemukan. Silakan masuk.", 401),
  forbidden: (message = "Anda tidak memiliki akses ke sumber daya ini.") =>
    new AppError("FORBIDDEN", message, 403),
  notFound: (message = "Data tidak ditemukan.") =>
    new AppError("NOT_FOUND", message, 404),
  conflict: (message: string, details?: unknown) =>
    new AppError("CONFLICT", message, 409, details),
  validation: (message: string, details?: unknown) =>
    new AppError("VALIDATION_ERROR", message, 400, details),
  rateLimited: () =>
    new AppError("RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi.", 429),
  server: (message = "Terjadi kesalahan pada server.") =>
    new AppError("INTERNAL_ERROR", message, 500),
};

/** Normalised error surface for every adapter. */
export type HermesErrorCode =
  | "unsupported"
  | "unauthorized"
  | "not_found"
  | "validation"
  | "rate_limited"
  | "offline"
  | "unknown";

export class HermesServiceError extends Error {
  readonly code: HermesErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(code: HermesErrorCode, message: string, options?: { status?: number; details?: unknown }) {
    super(message);
    this.name = "HermesServiceError";
    this.code = code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

export function isUnsupported(error: unknown): boolean {
  return error instanceof HermesServiceError && error.code === "unsupported";
}

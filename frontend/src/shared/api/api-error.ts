export interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly endpoint: string;
  readonly details?: Record<string, string>;

  constructor(status: number, endpoint: string, shape?: Partial<ApiErrorShape>) {
    super(shape?.message ?? "Something went wrong. Please try again.");
    this.name = "ApiError";
    this.status = status;
    this.code = shape?.code ?? "UNKNOWN";
    this.endpoint = endpoint;
    this.details = shape?.details;
  }
}

/** Normalize any backend payload/transport failure into a typed ApiError. */
export function normalizeApiError(parsed: unknown, status: number, endpoint: string): ApiError {
  if (
    parsed &&
    typeof parsed === "object" &&
    "error" in parsed &&
    parsed.error &&
    typeof parsed.error === "object"
  ) {
    return new ApiError(status, endpoint, parsed.error as Partial<ApiErrorShape>);
  }
  return new ApiError(status, endpoint, {
    code: status === 0 ? "NETWORK" : "UNKNOWN",
    message: status === 0 ? "Cannot reach the server. Check your connection." : `Request failed (${status}).`,
  });
}

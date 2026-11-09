export type OrbiErrorCode =
  | "not_found"
  | "conflict"
  | "validation"
  | "confirmation_required"
  | "provider_unavailable"
  | "rate_limited"
  | "ai_output_invalid";

/** A domain error with a stable machine-readable code; the API maps codes to HTTP statuses. */
export class OrbiError extends Error {
  readonly code: OrbiErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: OrbiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "OrbiError";
    this.code = code;
    this.details = details;
  }
}

export const notFound = (entity: string, id: string) =>
  new OrbiError("not_found", `${entity} ${id} was not found`, { entity, id });

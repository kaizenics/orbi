import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { OrbiError, type OrbiErrorCode } from "@orbi/core";

/** RFC 9457 problem details. `code` is ORBI's stable machine-readable error code. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  code: OrbiErrorCode | "bad_request" | "unauthorized" | "internal";
  detail?: string;
  errors?: { path: string; message: string }[];
  [extra: string]: unknown;
}

const STATUS: Record<OrbiErrorCode, ContentfulStatusCode> = {
  not_found: 404,
  conflict: 409,
  confirmation_required: 409,
  validation: 422,
  rate_limited: 429,
  provider_unavailable: 503,
};

const TITLES: Record<Problem["code"], string> = {
  not_found: "Not found",
  conflict: "Conflict",
  confirmation_required: "Confirmation required",
  validation: "Invalid request",
  rate_limited: "Too many requests",
  provider_unavailable: "Service unavailable",
  bad_request: "Bad request",
  unauthorized: "Unauthorized",
  internal: "Internal server error",
};

export function problem(
  c: Context,
  status: ContentfulStatusCode,
  code: Problem["code"],
  fields: Partial<Problem> = {},
) {
  const body: Problem = { type: `urn:orbi:problem:${code}`, title: TITLES[code], status, code, ...fields };
  return c.json(body, status, { "Content-Type": "application/problem+json" });
}

export function problemFromError(c: Context, error: unknown) {
  if (error instanceof OrbiError) {
    return problem(c, STATUS[error.code], error.code, { detail: error.message, ...error.details });
  }
  console.error(error);
  return problem(c, 500, "internal", { detail: "Unexpected server error" });
}

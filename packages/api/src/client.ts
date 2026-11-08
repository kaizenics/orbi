import { hc } from "hono/client";
import type { AppType } from "./app.ts";

export interface OrbiClientOptions {
  /** Bearer token, required when the server runs with ORBI_API_TOKEN. */
  token?: string;
}

/** Typed API client for web and mobile. Imports server types only, never server code. */
export function createOrbiClient(baseUrl: string, options: OrbiClientOptions = {}) {
  return hc<AppType>(baseUrl, {
    headers: (): Record<string, string> =>
      options.token ? { Authorization: `Bearer ${options.token}` } : {},
  });
}

export type OrbiClient = ReturnType<typeof createOrbiClient>;

/** Problem details returned by the API (RFC 9457). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type JsonResponse = { ok: boolean; status: number; json(): Promise<unknown> };
/** Problem-details bodies (validation errors etc.) that a typed route may also return. */
type ProblemBody = { type: string; title: string; status: number; code: string };
/** Body type of a typed Hono client response, minus its problem-details branches. */
type SuccessBody<R> = R extends { json(): Promise<infer T> } ? Exclude<T, ProblemBody> : never;

/** Throws ApiError for non-2xx responses, otherwise returns the typed JSON body. */
export async function unwrap<R extends JsonResponse>(response: R): Promise<SuccessBody<R>> {
  if (response.ok) return (await response.json()) as SuccessBody<R>;
  let code = "http_error";
  let message = `Request failed (${response.status})`;
  try {
    const problem = (await response.json()) as { code?: string; detail?: string; title?: string };
    code = problem.code ?? code;
    message = problem.detail ?? problem.title ?? message;
  } catch {
    // non-JSON error body; keep the generic message
  }
  throw new ApiError(response.status, code, message);
}

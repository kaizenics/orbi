import { OrbiError } from "@orbi/core";

export interface HttpOptions {
  userAgent: string;
  timeoutMs?: number;
  retries?: number;
  /** Injected for tests. */
  fetch?: typeof fetch;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRetryable = (status: number) => status === 429 || status >= 500;

/** GET JSON with a timeout, an identifying User-Agent, and backoff retries on 429/5xx/network errors. */
export async function getJson<T>(url: string, options: HttpOptions): Promise<T> {
  const doFetch = options.fetch ?? fetch;
  const retries = options.retries ?? 2;
  let lastError: OrbiError = new OrbiError("provider_unavailable", "Provider request failed");

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));

    let res: Response;
    try {
      res = await doFetch(url, {
        headers: { "User-Agent": options.userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      });
    } catch (error) {
      lastError = new OrbiError("provider_unavailable", `Provider unreachable: ${String(error)}`);
      continue;
    }

    if (res.ok) return (await res.json()) as T;
    const error = new OrbiError(
      res.status === 429 ? "rate_limited" : "provider_unavailable",
      `Provider answered HTTP ${res.status}`,
      { status: res.status },
    );
    if (!isRetryable(res.status)) throw error;
    lastError = error;
  }
  throw lastError;
}

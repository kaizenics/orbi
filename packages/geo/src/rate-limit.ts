/**
 * Serialises calls so that consecutive calls start at least `minIntervalMs` apart — e.g. 1000 ms
 * for public Nominatim/OSRM, whose policies cap the whole application (all users) at ~1 req/s.
 */
export function createRateLimiter(minIntervalMs: number, now: () => number = Date.now) {
  let chain: Promise<unknown> = Promise.resolve();
  let lastStart = -Infinity;

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const wait = lastStart + minIntervalMs - now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastStart = now();
      return task();
    });
    chain = run.catch(() => undefined);
    return run;
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

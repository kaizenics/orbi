import { ApiError, createOrbiClient } from "@orbi/api/client";

export { ApiError, unwrap } from "@orbi/api/client";

let client: ReturnType<typeof createOrbiClient> | undefined;

/**
 * Reads still try the network (the service worker or the saved cache may answer). A write while the
 * browser is offline fails at once with a clear message; saved data is read-only.
 */
const offlineAwareFetch: typeof fetch = (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && typeof navigator !== "undefined" && !navigator.onLine) {
    return Promise.reject(new ApiError(0, "offline", "You're offline. Reconnect to make changes."));
  }
  return fetch(input, init);
};

/** Browser-side typed client; requests go through the same-origin /api proxy. */
export function api() {
  client ??= createOrbiClient(`${window.location.origin}/api`, { fetch: offlineAwareFetch });
  return client;
}

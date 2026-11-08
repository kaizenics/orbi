import { createOrbiClient } from "@orbi/api/client";

export { ApiError, unwrap } from "@orbi/api/client";

let client: ReturnType<typeof createOrbiClient> | undefined;

/** Browser-side typed client; requests go through the same-origin /api proxy. */
export function api() {
  client ??= createOrbiClient(`${window.location.origin}/api`);
  return client;
}

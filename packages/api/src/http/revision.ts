import type { Context } from "hono";
import { OrbiError } from "@orbi/core";

/**
 * Optional optimistic-concurrency precondition: `If-Match: <trip revision>`.
 * Clients send the revision they last saw; a mismatch yields 409.
 */
export function expectedRevision(c: Context): number | undefined {
  const header = c.req.header("If-Match");
  if (header === undefined) return undefined;
  const value = Number(header.replace(/^W\//, "").replaceAll('"', ""));
  if (!Number.isInteger(value) || value < 0) {
    throw new OrbiError("validation", "If-Match must be a trip revision number");
  }
  return value;
}

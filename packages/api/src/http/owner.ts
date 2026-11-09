import type { Context, MiddlewareHandler } from "hono";
import { tripOwnerOf, type Db, type OwnedKind } from "@orbi/db";
import { problem } from "./problem.ts";

/**
 * Header carrying the signed-in account. The web proxy removes any value the browser sent and sets
 * it from the verified Google session. Without sign-in (local development) everything belongs to
 * "local". shortcut: a caller holding ORBI_API_TOKEN (the Android app) may set it freely; the token
 * is an owner-level secret. Revisit if the token is ever given to other people.
 */
export const OWNER_HEADER = "x-orbi-user";

export const ownerOf = (c: Context) => c.req.header(OWNER_HEADER)?.trim().toLowerCase() || "local";

/**
 * Refuses records of another account's trips with 404, so other accounts' IDs are not revealed.
 * Unknown IDs pass through and the route reports its own 404.
 */
export const ownedBy =
  (db: Db, kind: OwnedKind, param: string): MiddlewareHandler =>
  async (c, next) => {
    const id = c.req.param(param);
    const owner = id ? await tripOwnerOf(db, kind, id) : null;
    if (owner !== null && owner !== ownerOf(c)) {
      return problem(c, 404, "not_found", { detail: "Not found" });
    }
    return next();
  };

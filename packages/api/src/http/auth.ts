import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { problem } from "./problem.ts";

/** Requires `Authorization: Bearer <token>` on every route except GET /health. */
export function bearerAuth(token: string): MiddlewareHandler {
  const expected = Buffer.from(`Bearer ${token}`);
  return async (c, next) => {
    if (c.req.method === "GET" && c.req.path === "/health") return next();
    const given = Buffer.from(c.req.header("Authorization") ?? "");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return problem(c, 401, "unauthorized", { detail: "Missing or invalid API token" });
    }
    return next();
  };
}

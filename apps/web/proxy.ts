import { NextResponse, type NextRequest } from "next/server";

const apiBase = new URL(process.env.ORBI_API_URL ?? "http://127.0.0.1:3100");
const apiToken = process.env.ORBI_API_TOKEN;

/**
 * Builds the upstream URL on the fixed API origin. Returns null for paths that could escape it:
 * a leading "//" would otherwise be parsed as a protocol-relative URL to another host (and the
 * bearer token would be sent there), and backslashes are treated as slashes by URL parsers.
 */
function upstreamUrl(pathname: string, search: string): URL | null {
  const path = pathname.slice("/api".length) || "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  const target = new URL(apiBase.origin);
  target.pathname = apiBase.pathname.replace(/\/$/, "") + path;
  target.search = search;
  return target.origin === apiBase.origin ? target : null;
}

/**
 * Same-origin API gateway: the browser calls /api/*, Next forwards to the ORBI server and adds the
 * bearer token server-side, so the token never reaches the browser.
 *
 * The web app itself has no login (single-user MVP), so it listens on 127.0.0.1 only (see the dev
 * and start scripts). Exposing it on a network publishes the API to anyone who can reach it.
 */
export function proxy(request: NextRequest) {
  const target = upstreamUrl(request.nextUrl.pathname, request.nextUrl.search);
  if (!target) {
    return NextResponse.json(
      { type: "urn:orbi:problem:bad_request", title: "Bad request", status: 400, code: "bad_request" },
      { status: 400 },
    );
  }
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  if (apiToken) headers.set("Authorization", `Bearer ${apiToken}`);
  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = {
  matcher: "/api/:path*",
};

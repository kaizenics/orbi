import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";

const apiBase = new URL(process.env.ORBI_API_URL ?? "http://127.0.0.1:3100");
const apiToken = process.env.ORBI_API_TOKEN;
const webPassword = process.env.ORBI_WEB_PASSWORD;

const problem = (status: number, code: string, detail: string) =>
  NextResponse.json({ type: `urn:orbi:problem:${code}`, title: detail, status, code, detail }, { status });

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
 * 1. Login gate (when ORBI_WEB_PASSWORD is set): every page and /api call needs a valid session.
 * 2. Same-origin API gateway: /api/* is forwarded to the ORBI server with the bearer token added
 *    server-side, so the token never reaches the browser.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname === "/api" || pathname.startsWith("/api/");

  // Fail closed: a token-protected API must never be published through an unauthenticated web app.
  if (apiToken && !webPassword) {
    return problem(503, "misconfigured", "Set ORBI_WEB_PASSWORD: the web app forwards the API token");
  }

  if (webPassword && !pathname.startsWith("/login") && !pathname.startsWith("/auth/")) {
    if (!(await isValidSession(request.cookies.get(SESSION_COOKIE)?.value, webPassword))) {
      if (isApi) return problem(401, "unauthorized", "Log in to ORBI first");
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname + search);
      return NextResponse.redirect(login);
    }
  }

  if (!isApi) return NextResponse.next();
  const target = upstreamUrl(pathname, search);
  if (!target) return problem(400, "bad_request", "Invalid API path");
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  if (apiToken) headers.set("Authorization", `Bearer ${apiToken}`);
  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = {
  // Everything except Next internals and public static files.
  matcher: ["/((?!_next/|favicon.ico|icon.png|manifest.webmanifest|vendor/).*)"],
};

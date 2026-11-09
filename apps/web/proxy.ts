import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authConfig, sessionEmail } from "@/lib/session";

/** Set to forward /api to a separate ORBI server (VM/Docker); unset = the API runs inside Next.js. */
const externalApi = process.env.ORBI_API_URL ? new URL(process.env.ORBI_API_URL) : null;
const apiToken = process.env.ORBI_API_TOKEN;
const auth = authConfig();
/** Reachable without signing in. */
const PUBLIC = (path: string) =>
  path === "/" || path.startsWith("/login") || path.startsWith("/auth/") || path.startsWith("/landing/");

const problem = (status: number, code: string, detail: string) =>
  NextResponse.json({ type: `urn:orbi:problem:${code}`, title: detail, status, code, detail }, { status });

/**
 * Builds the upstream URL on the fixed API origin. Returns null for paths that could escape it:
 * a leading "//" would otherwise be parsed as a protocol-relative URL to another host (and the
 * bearer token would be sent there), and backslashes are treated as slashes by URL parsers.
 */
function upstreamUrl(base: URL, pathname: string, search: string): URL | null {
  const path = pathname.slice("/api".length) || "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  const target = new URL(base.origin);
  target.pathname = base.pathname.replace(/\/$/, "") + path;
  target.search = search;
  return target.origin === base.origin ? target : null;
}

/**
 * 1. Sign-in gate (when Google sign-in is configured): non-public pages need a session for an
 *    allowed email. API calls need that session, or their own bearer token (the mobile app).
 * 2. For signed-in browser calls, the API token is added server-side and never reaches the browser.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname === "/api" || pathname.startsWith("/api/");

  // Fail closed: never publish the API or trips through an app without sign-in.
  if (!auth && (apiToken || process.env.VERCEL) && !PUBLIC(pathname)) {
    return problem(503, "misconfigured", "Configure Google sign-in before deploying ORBI");
  }

  // The token is only ever added for a verified session, never because sign-in is off.
  let signedIn = false;
  if (auth && !PUBLIC(pathname)) {
    signedIn =
      (await sessionEmail(request.cookies.get(SESSION_COOKIE)?.value, auth.secret, auth.allowed)) !== null;
    // A bearer request may skip the session only when the API itself verifies tokens.
    const bearer = Boolean(apiToken) && isApi && request.headers.get("authorization")?.startsWith("Bearer ");
    if (!signedIn && !bearer) {
      if (isApi) return problem(401, "unauthorized", "Sign in to ORBI first");
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname + search);
      return NextResponse.redirect(login);
    }
  }
  if (!isApi) return NextResponse.next();

  const headers = new Headers(request.headers);
  if (signedIn && apiToken) headers.set("Authorization", `Bearer ${apiToken}`);

  if (!externalApi) return NextResponse.next({ request: { headers } });
  const target = upstreamUrl(externalApi, pathname, search);
  if (!target) return problem(400, "bad_request", "Invalid API path");
  headers.delete("cookie");
  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = {
  // Everything except Next internals and public static files.
  matcher: ["/((?!_next/|favicon.ico|icon.png|manifest.webmanifest|vendor/).*)"],
};

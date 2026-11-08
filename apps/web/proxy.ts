import { NextResponse, type NextRequest } from "next/server";

const apiUrl = (process.env.ORBI_API_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const apiToken = process.env.ORBI_API_TOKEN;

/**
 * Same-origin API gateway: the browser calls /api/*, Next forwards to the ORBI server and adds the
 * bearer token server-side, so the token never reaches the browser.
 */
export function proxy(request: NextRequest) {
  const target = new URL(request.nextUrl.pathname.replace(/^\/api/, "") + request.nextUrl.search, apiUrl);
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  if (apiToken) headers.set("Authorization", `Bearer ${apiToken}`);
  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = {
  matcher: "/api/:path*",
};

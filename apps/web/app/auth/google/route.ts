import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, authConfig, pkceChallenge, randomToken, safeNextPath } from "@/lib/session";

/** Starts Google sign-in (authorization code flow with PKCE and a CSRF state). */
export async function GET(request: NextRequest) {
  const auth = authConfig();
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!auth) return NextResponse.redirect(new URL(next, request.url));

  const state = randomToken();
  const verifier = randomToken();
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: auth.clientId,
    redirect_uri: new URL("/auth/google/callback", request.url).toString(),
    response_type: "code",
    scope: "openid email",
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const response = NextResponse.redirect(google);
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/auth/google",
    maxAge: 600,
  });
  return response;
}

import { NextResponse, type NextRequest } from "next/server";
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  authConfig,
  createSession,
  safeNextPath,
} from "@/lib/session";

interface IdTokenClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
}

const fail = (request: NextRequest, reason: string) => {
  const login = new URL("/login", request.url);
  login.searchParams.set("error", reason);
  const response = NextResponse.redirect(login);
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/auth/google" });
  return response;
};

/** Finishes Google sign-in: checks state, exchanges the code, checks the email against the allow-list. */
export async function GET(request: NextRequest) {
  const auth = authConfig();
  if (!auth) return NextResponse.redirect(new URL("/trips", request.url));

  const params = request.nextUrl.searchParams;
  let saved: { state?: string; verifier?: string; next?: string } = {};
  try {
    saved = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "{}");
  } catch {
    // malformed cookie: treated as a missing state below
  }
  if (params.get("error")) return fail(request, "cancelled");
  const code = params.get("code");
  if (!code || !saved.state || !saved.verifier || params.get("state") !== saved.state)
    return fail(request, "state");

  // The ID token comes straight from Google's token endpoint over TLS (OpenID Connect §3.1.3.7 allows
  // trusting it without a signature check); we still validate audience, issuer and expiry.
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
      redirect_uri: new URL("/auth/google/callback", request.url).toString(),
      grant_type: "authorization_code",
      code_verifier: saved.verifier,
    }),
  });
  if (!tokenResponse.ok) return fail(request, "exchange");
  const { id_token: idToken } = (await tokenResponse.json()) as { id_token?: string };

  let claims: IdTokenClaims = {};
  try {
    claims = JSON.parse(Buffer.from(idToken?.split(".")[1] ?? "", "base64url").toString("utf8"));
  } catch {
    return fail(request, "exchange");
  }
  const email = claims.email?.toLowerCase();
  const valid =
    claims.aud === auth.clientId &&
    (claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com") &&
    (claims.exp ?? 0) * 1000 > Date.now() &&
    claims.email_verified === true &&
    email !== undefined;
  if (!valid) return fail(request, "exchange");
  if (auth.allowed.length > 0 && !auth.allowed.includes(email)) return fail(request, "denied");

  const response = NextResponse.redirect(new URL(safeNextPath(saved.next), request.url));
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/auth/google" });
  response.cookies.set(SESSION_COOKIE, await createSession(email, auth.secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return response;
}

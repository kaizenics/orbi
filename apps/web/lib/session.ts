/**
 * Web session after Google sign-in: "<expiry>.<base64url email>.<hmac>" in an HTTP-only cookie,
 * signed with a key derived from GOOGLE_CLIENT_SECRET (rotating that secret logs everyone out). Web Crypto only, so it works
 * in proxy.ts and route handlers alike.
 */
export const SESSION_COOKIE = "orbi_session";
/** Short-lived OAuth state + PKCE verifier during Google sign-in. */
export const OAUTH_COOKIE = "orbi_oauth";
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();
const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64url = (s: string) =>
  btoa(String.fromCharCode(...encoder.encode(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64url = (s: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
  );

/**
 * Google sign-in is on when the client ID and secret are set; without them the web app is open
 * (local development). Any Google account may sign in and gets its own private trips.
 */
export const authConfig = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // The session key is derived from the client secret (domain-separated in sign()), so no extra env var.
  return clientId && clientSecret ? { clientId, clientSecret, secret: clientSecret } : null;
};

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`orbi-session-v2:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

/** Constant-time comparison of equal-length hex digests. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The signed-in Google account as shown in the app. Name and picture come from the Google profile. */
export interface SessionUser {
  email: string;
  name: string | null;
  picture: string | null;
}

/** Only Google-hosted profile photos are kept, so the session can never point the page elsewhere. */
export function safePicture(url: unknown): string | null {
  if (typeof url !== "string" || url.length > 500) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".googleusercontent.com") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Cookie: "<expiry>.<email>.<name>.<picture>.<hmac>" (base64url parts; older cookies lack name/picture). */
export async function createSession(user: SessionUser, secret: string): Promise<string> {
  const payload = [
    Date.now() + SESSION_MAX_AGE_S * 1000,
    b64url(user.email),
    b64url(user.name?.slice(0, 100) ?? ""),
    b64url(user.picture ?? ""),
  ].join(".");
  return `${payload}.${await sign(payload, secret)}`;
}

/** The signed-in user, or null when the cookie is missing, expired or tampered with. */
export async function sessionUser(cookie: string | undefined, secret: string): Promise<SessionUser | null> {
  const parts = cookie?.split(".") ?? [];
  if (parts.length !== 3 && parts.length !== 5) return null;
  const mac = parts.pop()!;
  const [expires, email, name, picture] = parts;
  if (!expires || !email || !(Number(expires) > Date.now())) return null;
  if (!safeEqual(mac, await sign(parts.join("."), secret))) return null;
  try {
    return {
      email: fromB64url(email),
      name: name ? fromB64url(name) : null,
      picture: picture ? safePicture(fromB64url(picture)) : null,
    };
  } catch {
    return null;
  }
}

/** The signed-in email, or null. */
export async function sessionEmail(cookie: string | undefined, secret: string): Promise<string | null> {
  return (await sessionUser(cookie, secret))?.email ?? null;
}

/** The signed-in user for a server component or route, or null (also when sign-in is off). */
export async function currentUser(): Promise<SessionUser | null> {
  const auth = authConfig();
  if (!auth) return null;
  const { cookies } = await import("next/headers");
  return sessionUser((await cookies()).get(SESSION_COOKIE)?.value, auth.secret);
}

export async function currentEmail(): Promise<string | null> {
  return (await currentUser())?.email ?? null;
}

export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer);

/** PKCE S256 challenge for a verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier)));
  return btoa(String.fromCharCode(...digest))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Only same-origin paths are allowed as post-login redirects. Validates the parsed URL, not just the
 * string: URL parsers drop tabs/newlines, so "/\t/evil.example" would otherwise become "//evil.example".
 */
export function safeNextPath(next: unknown): string {
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (typeof next !== "string" || /[\u0000-\u001f\u007f\\]/.test(next) || !next.startsWith("/"))
    return "/trips";
  const base = "http://orbi.invalid";
  try {
    const url = new URL(next, base);
    return url.origin === base ? url.pathname + url.search + url.hash : "/trips";
  } catch {
    return "/trips";
  }
}

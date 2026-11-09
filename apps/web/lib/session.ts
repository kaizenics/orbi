/**
 * Single-user web session: a signed expiry timestamp in an HTTP-only cookie.
 * The signing key derives from ORBI_WEB_PASSWORD, so changing the password logs everyone out.
 * Uses Web Crypto so it works in proxy.ts and route handlers alike.
 */
export const SESSION_COOKIE = "orbi_session";
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();
const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sign(payload: string, password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`orbi-session-v1:${password}`),
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

export async function createSession(password: string): Promise<string> {
  const expires = String(Date.now() + SESSION_MAX_AGE_S * 1000);
  return `${expires}.${await sign(expires, password)}`;
}

export async function isValidSession(cookie: string | undefined, password: string): Promise<boolean> {
  const [expires, mac] = cookie?.split(".") ?? [];
  if (!expires || !mac || !(Number(expires) > Date.now())) return false;
  return safeEqual(mac, await sign(expires, password));
}

export async function passwordMatches(input: string, password: string): Promise<boolean> {
  const digest = async (s: string) => hex(await crypto.subtle.digest("SHA-256", encoder.encode(s)));
  return safeEqual(await digest(input), await digest(password));
}

/**
 * Only same-origin paths are allowed as post-login redirects. Validates the parsed URL, not just the
 * string: URL parsers drop tabs/newlines, so "/\t/evil.example" would otherwise become "//evil.example".
 */
export function safeNextPath(next: unknown): string {
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (typeof next !== "string" || /[\u0000-\u001f\u007f\\]/.test(next) || !next.startsWith("/")) return "/";
  const base = "http://orbi.invalid";
  try {
    const url = new URL(next, base);
    return url.origin === base ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

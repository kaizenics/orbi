import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  createSession,
  passwordMatches,
  safeNextPath,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const password = process.env.ORBI_WEB_PASSWORD;
  const form = await request.formData();
  const next = safeNextPath(form.get("next"));
  if (!password) return NextResponse.redirect(new URL(next, request.url), 303);

  if (!(await passwordMatches(String(form.get("password") ?? ""), password))) {
    await new Promise((r) => setTimeout(r, 1000)); // slows down password guessing
    const back = new URL("/login", request.url);
    back.searchParams.set("error", "1");
    back.searchParams.set("next", next);
    return NextResponse.redirect(back, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(SESSION_COOKIE, await createSession(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return response;
}

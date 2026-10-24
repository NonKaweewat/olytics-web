import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import type { LoginResult } from "@/lib/login";
import { homeFor, ROLES } from "@/lib/roles";

/** Turn a sign-in result into the JSON response (+ session cookie when it succeeded). */
export async function loginResponse(result: LoginResult): Promise<NextResponse> {
  if (result.kind === "error") return NextResponse.json({ error: result.message }, { status: result.status });
  // temporary password: the page asks for a new one and posts it to /api/login/new-password
  if (result.kind === "new-password") return NextResponse.json({ challenge: "NEW_PASSWORD_REQUIRED", session: result.session });

  const { value, maxAge } = await createSession({ user: result.user, role: result.role });
  const res = NextResponse.json({ ok: true, role: result.role, roleLabel: ROLES[result.role].label, home: homeFor(result.role) });
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge,
  });
  return res;
}

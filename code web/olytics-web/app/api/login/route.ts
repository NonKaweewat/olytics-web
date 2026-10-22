import { NextResponse } from "next/server";
import { SESSION_COOKIE, checkCredentials, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { username = "", password = "" } = await req.json().catch(() => ({}));
  if (!checkCredentials(String(username), String(password))) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  const { value, maxAge } = await createSession(String(username));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge,
  });
  return res;
}

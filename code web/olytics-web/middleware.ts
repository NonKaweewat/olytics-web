import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { canAccess, homeFor, pageForPath } from "@/lib/roles";

export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Role check: pages and their data APIs. Paths that are not a page
  // (e.g. "/", /api/filters, /api/me) only need a valid session.
  const page = pageForPath(pathname);
  if (page && !canAccess(session.role, page)) {
    if (isApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = homeFor(session.role);
    return NextResponse.redirect(url);
  }
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = homeFor(session.role);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Node runtime (not Edge) so it shares the generated session key with the
  // route handlers — see lib/auth.ts.
  runtime: "nodejs",
  // Everything except login, its API, health check and static assets.
  matcher: ["/((?!login|api/login|api/health|_next/static|_next/image|favicon.ico).*)"],
};

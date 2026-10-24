import { NextResponse, type NextRequest } from "next/server";
import { parseFilters } from "@/lib/metrics/filters";
import { isDashboardPage, LOADERS } from "@/lib/metrics";

export const dynamic = "force-dynamic";

// GET /api/data/<page>?year=2018&state=SP — the middleware has already checked the role.
export async function GET(req: NextRequest, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!isDashboardPage(page)) return NextResponse.json({ error: "Unknown page" }, { status: 404 });
  try {
    const f = parseFilters(Object.fromEntries(req.nextUrl.searchParams));
    return NextResponse.json(await LOADERS[page](f));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

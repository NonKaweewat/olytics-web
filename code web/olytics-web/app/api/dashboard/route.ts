import { NextResponse, type NextRequest } from "next/server";
import { getDashboard, parseFilters } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const f = parseFilters(Object.fromEntries(req.nextUrl.searchParams));
    return NextResponse.json(await getDashboard(f));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

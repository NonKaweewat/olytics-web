import { NextResponse } from "next/server";
import { filterOptions } from "@/lib/metrics/filters";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await filterOptions());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

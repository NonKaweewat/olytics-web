import { NextResponse } from "next/server";
import { getFilterOptions } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getFilterOptions());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

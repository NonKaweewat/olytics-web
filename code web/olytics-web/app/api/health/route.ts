import { NextResponse } from "next/server";
import { dataSource, ping } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public on purpose: used by EC2 / load-balancer health checks. Exposes no data.
export async function GET() {
  try {
    await ping();
    return NextResponse.json({ ok: true, source: dataSource() });
  } catch {
    return NextResponse.json({ ok: false, source: dataSource() }, { status: 503 });
  }
}

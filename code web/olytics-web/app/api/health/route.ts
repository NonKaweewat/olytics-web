import { NextResponse } from "next/server";
import { health } from "@/lib/data";

export const dynamic = "force-dynamic";

// Public on purpose: used by EC2 / load-balancer health checks. Exposes no data.
export async function GET() {
  const h = await health();
  return NextResponse.json({ ok: h.ok, source: h.source }, { status: h.ok ? 200 : 503 });
}

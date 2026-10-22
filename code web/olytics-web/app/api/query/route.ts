import { NextResponse } from "next/server";
import { runBoth, validateSql } from "@/lib/querylab";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { sql = "" } = await req.json().catch(() => ({}));
  const err = validateSql(String(sql));
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  return NextResponse.json({ results: await runBoth(String(sql)) });
}

import "server-only";
import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  StartQueryExecutionCommand,
} from "@aws-sdk/client-athena";
import { dataSource, query, schema } from "./db";
import type { QueryRunResult } from "./types";

// UC-03: run the same SQL on Athena (reads S3 Curated Zone via Glue Data Catalog)
// and on Redshift, then compare elapsed time / data scanned.
// Write `{db}.table` in SQL — it is replaced with ATHENA_DATABASE or REDSHIFT_SCHEMA.

// Presets read the data team's KPI views (KPI.txt), so both engines answer the
// same business question; Athena needs the same views in the Glue Data Catalog.
export const PRESETS: { id: string; label: string; sql: string }[] = [
  {
    id: "br01",
    label: "BR01 Monthly sales",
    sql: `SELECT year_number, month_number, total_sales, total_orders, mom_growth_pct
FROM {db}.v_br01_monthly_sales
ORDER BY year_number, month_number`,
  },
  {
    id: "br04",
    label: "BR04 Categories",
    sql: `SELECT category_name, total_sales, total_items, total_orders, avg_item_price
FROM {db}.v_br04_category_performance
ORDER BY total_sales DESC
LIMIT 10`,
  },
  {
    id: "br08",
    label: "BR08 Late delivery by state",
    sql: `SELECT customer_state, SUM(total_delivered_orders) AS delivered, SUM(late_orders) AS late,
       ROUND(100.0 * SUM(late_orders) / NULLIF(SUM(total_delivered_orders), 0), 2) AS late_rate_pct
FROM {db}.v_br08_late_delivery
GROUP BY customer_state
ORDER BY delivered DESC`,
  },
  {
    id: "br03",
    label: "BR03 Payments",
    sql: `SELECT payment_type, payment_records, total_payment, payment_percentage
FROM {db}.v_br03_payment_distribution
ORDER BY total_payment DESC`,
  },
];

const MAX_ROWS = 50;

export function validateSql(sql: string): string | null {
  const s = sql.trim().replace(/;\s*$/, "");
  if (!/^(select|with)\b/i.test(s)) return "Only SELECT / WITH queries are allowed.";
  if (s.includes(";")) return "Only a single statement is allowed.";
  if (/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|unload)\b/i.test(s)) {
    return "Write / DDL statements are not allowed.";
  }
  return null;
}

async function runRedshift(sql: string): Promise<QueryRunResult> {
  const q = sql.replaceAll("{db}", schema());
  const start = performance.now();
  try {
    const rows = await query(q);
    const columns = rows[0] ? Object.keys(rows[0]) : [];
    // PGlite returns int8 as BigInt, which JSON cannot serialise
    const cell = (v: unknown) => (typeof v === "bigint" ? Number(v) : v);
    return {
      engine: "redshift",
      ok: true,
      elapsedMs: performance.now() - start,
      rowCount: rows.length,
      columns,
      rows: rows.slice(0, MAX_ROWS).map((r) => columns.map((c) => cell(r[c]))),
    };
  } catch (e) {
    return { engine: "redshift", ok: false, elapsedMs: performance.now() - start, error: (e as Error).message };
  }
}

async function runAthena(sql: string): Promise<QueryRunResult> {
  const db = process.env.ATHENA_DATABASE ?? "olytics_curated";
  // Athena uses DOUBLE, not DOUBLE PRECISION.
  const q = sql.replaceAll("{db}", db).replace(/DOUBLE PRECISION/gi, "DOUBLE");
  // Credentials: EC2 instance profile (LabRole) or AWS_* env vars from Learner Lab.
  const client = new AthenaClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  const start = performance.now();
  try {
    const { QueryExecutionId } = await client.send(
      new StartQueryExecutionCommand({
        QueryString: q,
        QueryExecutionContext: { Database: db },
        WorkGroup: process.env.ATHENA_WORKGROUP ?? "primary",
        ResultConfiguration: process.env.ATHENA_OUTPUT_LOCATION
          ? { OutputLocation: process.env.ATHENA_OUTPUT_LOCATION }
          : undefined,
      }),
    );
    let state = "QUEUED";
    let stats: { EngineExecutionTimeInMillis?: number; DataScannedInBytes?: number } | undefined;
    let reason: string | undefined;
    while (state === "QUEUED" || state === "RUNNING") {
      await new Promise((r) => setTimeout(r, 400));
      const ex = await client.send(new GetQueryExecutionCommand({ QueryExecutionId }));
      state = ex.QueryExecution?.Status?.State ?? "FAILED";
      stats = ex.QueryExecution?.Statistics;
      reason = ex.QueryExecution?.Status?.StateChangeReason;
      if (performance.now() - start > 60_000) throw new Error("Athena query timed out (60s)");
    }
    if (state !== "SUCCEEDED") throw new Error(reason ?? `Athena query ${state}`);
    const res = await client.send(new GetQueryResultsCommand({ QueryExecutionId, MaxResults: MAX_ROWS + 1 }));
    const all = res.ResultSet?.Rows ?? [];
    const columns = (all[0]?.Data ?? []).map((d) => d.VarCharValue ?? "");
    const rows = all.slice(1).map((r) => (r.Data ?? []).map((d) => d.VarCharValue ?? null));
    return {
      engine: "athena",
      ok: true,
      // Engine time excludes polling overhead — closer to a fair comparison.
      elapsedMs: stats?.EngineExecutionTimeInMillis ?? performance.now() - start,
      dataScannedBytes: stats?.DataScannedInBytes,
      rowCount: rows.length,
      columns,
      rows,
    };
  } catch (e) {
    return { engine: "athena", ok: false, elapsedMs: performance.now() - start, error: (e as Error).message };
  }
}

/**
 * Mock mode: the SQL really runs on the in-memory mock warehouse (so it is
 * checked), but there is no Athena — its timing and data scanned are simulated.
 */
async function mockRun(sql: string): Promise<QueryRunResult[]> {
  const real = await runRedshift(sql);
  const athena: QueryRunResult = {
    ...real,
    engine: "athena",
    simulated: true,
    elapsedMs: real.ok ? 800 + real.elapsedMs * 4 : real.elapsedMs,
    dataScannedBytes: real.ok ? 3_500_000 + sql.length * 900 : undefined,
  };
  return [athena, { ...real, simulated: true }];
}

export async function runBoth(sql: string): Promise<QueryRunResult[]> {
  if (dataSource() === "mock") return mockRun(sql);
  // Sequential, so the two engines do not compete for the network/CPU on EC2.
  const athena = await runAthena(sql);
  const redshift = await runRedshift(sql);
  return [athena, redshift];
}

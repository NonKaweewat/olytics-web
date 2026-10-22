import "server-only";
import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  StartQueryExecutionCommand,
} from "@aws-sdk/client-athena";
import { dataSource } from "./data";
import { rsQuery, schema } from "./redshift";
import type { QueryRunResult } from "./types";

// UC-03: run the same SQL on Athena (reads S3 Curated Zone via Glue Data Catalog)
// and on Redshift, then compare elapsed time / data scanned.
// Write `{db}.table` in SQL — it is replaced with ATHENA_DATABASE or REDSHIFT_SCHEMA.

export const PRESETS: { id: string; label: string; sql: string }[] = [
  {
    id: "monthly",
    label: "Monthly revenue",
    sql: `SELECT d.year_number, d.month_number, SUM(i.price) AS revenue, COUNT(DISTINCT i.order_id) AS orders
FROM {db}.fact_order_item i
JOIN {db}.dim_date d ON i.purchase_date_key = d.date_key
GROUP BY d.year_number, d.month_number
ORDER BY d.year_number, d.month_number`,
  },
  {
    id: "categories",
    label: "Top categories",
    sql: `SELECT p.category_english, SUM(i.price) AS revenue, SUM(i.item_count) AS items
FROM {db}.fact_order_item i
JOIN {db}.dim_product p ON i.product_key = p.product_key
GROUP BY p.category_english
ORDER BY revenue DESC
LIMIT 10`,
  },
  {
    id: "delivery",
    label: "Delivery days vs review",
    sql: `SELECT ROUND(o.delivery_days) AS delivery_days, AVG(CAST(rs.review_score AS DOUBLE PRECISION)) AS avg_review, COUNT(*) AS n
FROM {db}.fact_order o
JOIN {db}.fact_review r ON r.order_id = o.order_id
JOIN {db}.dim_review_score rs ON r.review_score_key = rs.review_score_key
WHERE o.delivery_days IS NOT NULL
GROUP BY ROUND(o.delivery_days)
ORDER BY 1`,
  },
  {
    id: "payments",
    label: "Payment methods",
    sql: `SELECT pm.payment_type, COUNT(*) AS payments, SUM(fp.payment_value) AS total_value
FROM {db}.fact_payment fp
JOIN {db}.dim_payment_method pm ON fp.payment_method_key = pm.payment_method_key
GROUP BY pm.payment_type
ORDER BY total_value DESC`,
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
    const rows = await rsQuery(q);
    const columns = rows[0] ? Object.keys(rows[0]) : [];
    return {
      engine: "redshift",
      ok: true,
      elapsedMs: performance.now() - start,
      rowCount: rows.length,
      columns,
      rows: rows.slice(0, MAX_ROWS).map((r) => columns.map((c) => r[c])),
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

function mockRun(engine: "athena" | "redshift", sql: string): QueryRunResult {
  const base = sql.length;
  return {
    engine,
    ok: true,
    elapsedMs: engine === "athena" ? 900 + (base % 700) : 120 + (base % 180),
    dataScannedBytes: engine === "athena" ? 4_200_000 + base * 1000 : undefined,
    rowCount: 3,
    columns: ["note"],
    rows: [["mock mode — set DATA_SOURCE=redshift"], ["to run real queries"], [engine]],
  };
}

export async function runBoth(sql: string): Promise<QueryRunResult[]> {
  if (dataSource() === "mock") return [mockRun("athena", sql), mockRun("redshift", sql)];
  // Sequential, so the two engines do not compete for the network/CPU on EC2.
  const athena = await runAthena(sql);
  const redshift = await runRedshift(sql);
  return [athena, redshift];
}

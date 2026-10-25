import "server-only";
import { dataSource, query, schema } from "./db";
import type { QueryRunResult } from "./types";

// UC-03: run read-only SQL against the dashboard warehouse.
// Write `{db}.table` in SQL — it is replaced with REDSHIFT_SCHEMA.

// Presets read the data team's KPI views (KPI.txt).
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

/** Mock mode runs the same query against the in-memory warehouse. */
async function mockRun(sql: string): Promise<QueryRunResult[]> {
  const real = await runRedshift(sql);
  return [{ ...real, simulated: true }];
}

export async function runQuery(sql: string): Promise<QueryRunResult[]> {
  if (dataSource() === "mock") return mockRun(sql);
  return [await runRedshift(sql)];
}

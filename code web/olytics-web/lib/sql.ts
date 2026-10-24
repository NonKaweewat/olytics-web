import "server-only";
import { columnsOf, schema } from "./db";
import { REGIONS } from "./regions";

// The dashboards read only the data team's KPI views (dw.v_br01 … v_br14, see
// KPI.txt). Rates and averages that combine several view rows are recomputed
// from the view's counts/sums (weighted), never by averaging averages.

/** Collects $1..$n parameters while a query is being built. */
export class Params {
  readonly values: unknown[] = [];
  add(v: unknown): string {
    this.values.push(v);
    return `$${this.values.length}`;
  }
}

export type ViewName =
  | "v_br01_monthly_sales"
  | "v_br02_top_states"
  | "v_br02_top_categories"
  | "v_br03_payment_distribution"
  | "v_br04_category_performance"
  | "v_br05_seller_performance"
  | "v_br06_seller_on_time"
  | "v_br07_sellers_without_revenue"
  | "v_br08_late_delivery"
  | "v_br09_delivery_days"
  | "v_br10_review_satisfaction"
  | "v_br11_repeat_customers"
  | "v_br12_order_failure_rate"
  | "v_br13_customer_geography"
  | "v_br14_monthly_category_sales";

/** Fully qualified view name, e.g. dw.v_br01_monthly_sales. */
export function view(name: ViewName): string {
  return `${schema()}.${name}`;
}

/** SQL expression mapping a state column to its region id (see lib/regions.ts). */
export function regionCase(col: string): string {
  const whens = Object.entries(REGIONS)
    .map(([id, r]) => `WHEN ${col} IN (${r.states.map((s) => `'${s}'`).join(", ")}) THEN '${id}'`)
    .join(" ");
  return `CASE ${whens} ELSE 'unknown' END`;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jan 18" */
export function monthLabel(year: unknown, month: unknown): string {
  return `${SHORT_MONTHS[Number(month) - 1]} ${String(year).slice(2)}`;
}

// Which optional columns each view has. The data team may add columns later
// (e.g. customer_state on v_br01); pages switch the matching filter on by
// themselves. Cached for 5 minutes so a changed view is picked up without a restart.
const columnCache = new Map<ViewName, { at: number; cols: Promise<Set<string>> }>();

export function viewColumns(name: ViewName): Promise<Set<string>> {
  const hit = columnCache.get(name);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.cols;
  const cols = columnsOf(`SELECT * FROM ${view(name)} LIMIT 0`).then((c) => new Set(c));
  cols.catch(() => columnCache.delete(name));
  columnCache.set(name, { at: Date.now(), cols });
  return cols;
}

import "server-only";
import { query } from "./db";
import { REGIONS } from "./regions";
import { Params, view, viewColumns, type ViewName } from "./sql";
import type { FilterField, Filters } from "./types";

// Every dashboard card reads one KPI view. scope() turns the page filters into
// a WHERE clause using only the columns that view really has, and reports the
// active filters it had to skip (`ignored`) so the card can say so. When the
// data team adds a column (see VIEW_REQUESTS.md) the filter starts working
// with no code change — columns are re-checked every 5 minutes.

export type Scope = {
  from: string;
  where: string;
  params: unknown[];
  /** Active filters this view cannot apply. */
  ignored: FilterField[];
  has: Set<string>;
};

type Opts = {
  /** State column of this view, e.g. seller_state (default customer_state). */
  state?: string;
  /** Filters this card takes part in (default: all). Trend charts leave out "month". */
  use?: FilterField[];
  /**
   * Views of distinct counts (customers, sellers) can't be added up across
   * months / states. They carry total rows instead, where the column is NULL
   * (GROUPING SETS); with no filter on that dimension we read the total row.
   */
  totals?: ("year" | "month" | "state")[];
};

const ALL: FilterField[] = ["year", "month", "category", "region", "state"];

export async function scope(name: ViewName, f: Filters, opts: Opts = {}): Promise<Scope> {
  const has = await viewColumns(name);
  const stateCol = opts.state ?? "customer_state";
  const use = new Set(opts.use ?? ALL);
  const totals = new Set(opts.totals ?? []);
  const P = new Params();
  const parts: string[] = [];
  const ignored: FilterField[] = [];

  const dim = (field: FilterField, col: string, value: unknown, total: boolean, cond: () => string) => {
    if (!use.has(field)) return;
    const active = value !== null && value !== undefined;
    if (!has.has(col)) {
      if (active) ignored.push(field);
      return;
    }
    if (active) parts.push(cond());
    else if (total) parts.push(`${col} IS NULL`);
  };

  dim("year", "year_number", f.year, totals.has("year"), () => `year_number = ${P.add(f.year)}`);
  dim("month", "month_number", f.month, totals.has("month"), () => `month_number = ${P.add(f.month)}`);
  dim("category", "category_name", f.category, false, () => `category_name = ${P.add(f.category)}`);
  // region = the list of its states; the state's total row is only used when neither is set
  const areaTotal = totals.has("state") && !f.region && !f.state;
  dim("region", stateCol, f.region, false, () => `${stateCol} IN (${REGIONS[f.region!].states.map((s) => P.add(s)).join(", ")})`);
  dim("state", stateCol, f.state, areaTotal, () => `${stateCol} = ${P.add(f.state)}`);

  return { from: view(name), where: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params: P.values, ignored, has };
}

/**
 * Run a query over a scope that asked for total rows; if the view has no
 * total rows (column never NULL), fall back to adding up the detail rows.
 * Returns whether the fallback (approximate for distinct counts) was used.
 */
export async function queryTotals<T = Record<string, unknown>>(
  name: ViewName,
  f: Filters,
  opts: Opts,
  sql: (s: Scope) => string,
): Promise<{ rows: T[]; approximate: boolean; scope: Scope }> {
  const exact = await scope(name, f, opts);
  const rows = await query<T>(sql(exact), exact.params);
  const empty = rows.length === 0 || rows.every((r) => Object.values(r as object).every((v) => v === null));
  if (!empty || !exact.where.includes("IS NULL")) return { rows, approximate: false, scope: exact };
  const loose = await scope(name, f, { ...opts, totals: [] });
  return { rows: await query<T>(sql(loose), loose.params), approximate: true, scope: loose };
}

export { union } from "./notes";

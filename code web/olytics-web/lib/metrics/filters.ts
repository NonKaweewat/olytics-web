import "server-only";
import { num, query } from "../db";
import { view } from "../sql";
import { isRegion } from "../regions";
import type { FilterOptions, Filters } from "../types";

/** Filter choices, read from the KPI views (the web only needs SELECT on dw views). */
export async function filterOptions(): Promise<FilterOptions> {
  const [years, cats, states] = await Promise.all([
    query(`SELECT DISTINCT year_number AS y FROM ${view("v_br01_monthly_sales")} ORDER BY 1 DESC`),
    query(
      `SELECT DISTINCT category_name AS c FROM ${view("v_br14_monthly_category_sales")}
       WHERE category_name IS NOT NULL AND TRIM(category_name) <> '' ORDER BY 1`,
    ),
    // customer states and seller states (the sellers page filters by seller state)
    query(
      `SELECT s FROM (
         SELECT customer_state AS s FROM ${view("v_br08_late_delivery")} WHERE customer_state IS NOT NULL
         UNION
         SELECT seller_state AS s FROM ${view("v_br07_sellers_without_revenue")} WHERE seller_state IS NOT NULL
       ) AS states ORDER BY 1`,
    ),
  ]);
  return {
    years: years.map((r) => num(r.y)),
    categories: cats.map((r) => String(r.c)),
    states: states.map((r) => String(r.s)),
  };
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const year = Number(one(sp.year));
  const month = Number(one(sp.month));
  const category = one(sp.category);
  const region = one(sp.region);
  const state = one(sp.state);
  const validYear = Number.isInteger(year) && year > 2000 ? year : null;
  return {
    year: validYear,
    // a month only makes sense inside a selected year
    month: validYear && Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
    category: category && category !== "all" ? category : null,
    region: isRegion(region) ? region : null,
    state: state && state !== "all" ? state : null,
  };
}

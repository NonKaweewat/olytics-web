import "server-only";
import { num, numOrNull, query } from "../db";
import { regionShort, type RegionId } from "../regions";
import { queryTotals, scope, union } from "../scope";
import { monthLabel, regionCase } from "../sql";
import type { Filters, OverviewData } from "../types";

/**
 * Executive — BR01 BR02. Filters: year, month, region, state — each card applies
 * the ones its view has columns for (lib/scope.ts) and reports the rest.
 * KPIs follow the month; the monthly trend shows the whole selected year.
 */
export async function overview(f: Filters): Promise<OverviewData> {
  // Monthly series without the year filter: month-over-month growth of the
  // first selected month needs the month before it.
  const [sm, si, sg13] = await Promise.all([
    scope("v_br01_monthly_sales", f, { use: ["region", "state"] }),
    scope("v_br14_monthly_category_sales", f, { use: ["year", "month", "region", "state"] }),
    scope("v_br13_customer_geography", f, { use: ["year", "month", "region", "state"] }),
  ]);
  // With customer_state the view has one row per state and month, so growth is
  // recomputed from the summed sales; otherwise the view's own mom_growth_pct is used.
  const perState = sm.has.has("customer_state");

  // Revenue by state: v_br13 (the geography view) unless v_br01 has states and
  // can apply more of the filters (e.g. year/month while v_br13 has no date).
  const sg01 = perState ? await scope("v_br01_monthly_sales", f, { use: ["year", "month", "region", "state"] }) : null;
  const geo = sg01 && sg01.ignored.length < sg13.ignored.length ? sg01 : sg13;
  const geoCustomers = geo === sg13 ? "SUM(total_customers)" : "0"; // v_br01 has no customer count

  const [monthly, [items], cats, states, regions, cust] = await Promise.all([
    query(
      `SELECT year_number, month_number, SUM(total_sales) AS total_sales, SUM(total_orders) AS total_orders,
              ${perState ? "NULL" : "MAX(mom_growth_pct)"} AS mom_growth_pct
       FROM ${sm.from} ${sm.where} GROUP BY year_number, month_number ORDER BY 1, 2`,
      sm.params,
    ),
    // v_br01 has no item count — v_br14 holds the same sales at item level
    query(`SELECT SUM(total_items) AS items FROM ${si.from} ${si.where}`, si.params),
    query(
      `SELECT category_name, SUM(total_sales) AS total_sales FROM ${si.from} ${si.where}
       GROUP BY category_name ORDER BY 2 DESC NULLS LAST LIMIT 5`,
      si.params,
    ),
    query(`SELECT customer_state, SUM(total_sales) AS sales FROM ${geo.from} ${geo.where} GROUP BY 1 ORDER BY 2 DESC NULLS LAST`, geo.params),
    query(
      `SELECT ${regionCase("customer_state")} AS region, ${geoCustomers} AS customers, SUM(total_sales) AS sales
       FROM ${geo.from} ${geo.where} GROUP BY 1 ORDER BY 3 DESC NULLS LAST`,
      geo.params,
    ),
    // customers are a distinct count: the view's total rows (year / state NULL)
    queryTotals("v_br11_repeat_customers", f, { use: ["year", "region", "state"], totals: ["year", "state"] }, (s) =>
      `SELECT SUM(total_customers) AS customers, SUM(repeat_customers) AS repeat_customers FROM ${s.from} ${s.where}`),
  ]);

  let series = monthly.map((r) => ({
    year: num(r.year_number),
    month: num(r.month_number),
    label: monthLabel(r.year_number, r.month_number),
    revenue: num(r.total_sales),
    orders: num(r.total_orders),
    growth: numOrNull(r.mom_growth_pct),
  }));
  if (perState) {
    // M17 from sums: (this month - previous calendar month) / previous month
    const byKey = new Map(series.map((r) => [r.year * 12 + r.month, r.revenue]));
    series = series.map((r) => {
      const prev = byKey.get(r.year * 12 + r.month - 1) ?? 0;
      return { ...r, growth: prev ? Math.round(((r.revenue - prev) / prev) * 10000) / 100 : null };
    });
  }
  series = series.filter((r) => !f.year || r.year === f.year);

  const inScope = f.month ? series.filter((r) => r.month === f.month) : series;
  const revenue = inScope.reduce((a, r) => a + r.revenue, 0);
  const itemCount = num(items?.items);
  const last = inScope.at(-1);
  const orders = inScope.reduce((a, r) => a + r.orders, 0); // an order belongs to one month, so monthly counts add up
  const customers = num(cust.rows[0]?.customers);
  // v_br11 is yearly at most: a month filter can't reach the customer count
  const customersIgnored = union(cust.scope.ignored, f.month ? ["month"] : []);
  return {
    revenue,
    orders,
    items: itemCount,
    customers,
    repeatPct: customers ? (num(cust.rows[0]?.repeat_customers) / customers) * 100 : null,
    avgPrice: itemCount ? revenue / itemCount : null,
    avgOrderValue: orders ? revenue / orders : null,
    latest: last ? { label: last.label, growth: last.growth } : null,
    monthly: series.map(({ label, revenue: rv, orders, growth }) => ({ label, revenue: rv, orders, growth })),
    topCategories: cats.map((r) => ({ label: String(r.category_name), value: numOrNull(r.total_sales) })),
    byState: states.map((r) => ({ label: String(r.customer_state), value: num(r.sales) })),
    byRegion: regions
      .filter((r) => r.region !== "unknown")
      .map((r) => ({ region: r.region as RegionId, label: regionShort(r.region as RegionId), customers: num(r.customers), revenue: num(r.sales) })),
    areaFilter: perState,
    categoriesFollowArea: si.has.has("customer_state"),
    ignored: {
      kpis: union(sm.ignored, si.ignored),
      customers: customersIgnored,
      monthly: sm.ignored,
      categories: si.ignored,
      geo: geo.ignored,
    },
  };
}

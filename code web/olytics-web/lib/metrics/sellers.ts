import "server-only";
import { num, numOrNull, query } from "../db";
import { regionOf, regionShort, type RegionId } from "../regions";
import { queryTotals, scope, union } from "../scope";
import { regionCase } from "../sql";
import type { FilterField, Filters, SellersData } from "../types";

// On-time rate across several v_br06 rows = on_time / (on_time + late); orders
// with an unknown carrier date are left out, as in on_time_rate_pct.
const ON_TIME = "100.0 * SUM(on_time_orders) / NULLIF(SUM(on_time_orders) + SUM(late_orders), 0)";
const SELLER: { state: string; use: FilterField[] } = { state: "seller_state", use: ["year", "month", "region", "state"] };

/** Seller management — BR05 BR06 BR07. Filters: year, month, region, seller state. */
export async function sellers(f: Filters): Promise<SellersData> {
  const [s5, s6] = await Promise.all([scope("v_br05_seller_performance", f, SELLER), scope("v_br06_seller_on_time", f, SELLER)]);

  const [[kpi], [ot], byState, rows, otRegion, revRegion, noRev] = await Promise.all([
    query(`SELECT COUNT(DISTINCT seller_id) AS sellers, SUM(total_sales) AS sales FROM ${s5.from} ${s5.where}`, s5.params),
    query(`SELECT ${ON_TIME} AS pct, SUM(unknown_orders) AS unknown FROM ${s6.from} ${s6.where}`, s6.params),
    query(
      `SELECT seller_state, ${ON_TIME} AS pct FROM ${s6.from} ${s6.where}
       GROUP BY seller_state HAVING SUM(on_time_orders) + SUM(late_orders) >= 30
       ORDER BY SUM(on_time_orders) + SUM(late_orders) DESC LIMIT 10`,
      s6.params,
    ),
    query(
      `SELECT seller_id, seller_state, SUM(total_sales) AS sales, SUM(total_items) AS items, SUM(total_orders) AS orders,
              -- monthly averages weighted by the number of reviewed orders
              SUM(avg_review_score * reviewed_orders) / NULLIF(SUM(reviewed_orders), 0) AS review
       FROM ${s5.from} ${s5.where}
       GROUP BY seller_id, seller_state ORDER BY sales DESC NULLS LAST LIMIT 10`,
      s5.params,
    ),
    query(`SELECT ${regionCase("seller_state")} AS region, ${ON_TIME} AS pct FROM ${s6.from} ${s6.where} GROUP BY 1`, s6.params),
    query(`SELECT ${regionCase("seller_state")} AS region, SUM(total_sales) AS sales FROM ${s5.from} ${s5.where} GROUP BY 1`, s5.params),
    // distinct sellers can't be added up across years: use the view's total rows (year NULL)
    queryTotals("v_br07_sellers_without_revenue", f, { ...SELLER, totals: ["year", "month"] }, (s) =>
      `SELECT seller_state, SUM(total_sellers) AS total_sellers, SUM(sellers_without_revenue) AS sellers_without_revenue
       FROM ${s.from} ${s.where} GROUP BY seller_state ORDER BY 3 DESC`),
  ]);
  const noRevenue = noRev.rows;

  // on-time rate of the top sellers (separate query: v_br06 may support other filters than v_br05)
  const ids = rows.map((r) => String(r.seller_id));
  const p6 = [...s6.params, ...ids];
  const idList = ids.map((_, i) => `$${s6.params.length + i + 1}`).join(", ");
  const topOnTime = ids.length
    ? await query(
        `SELECT seller_id, ${ON_TIME} AS on_time FROM ${s6.from}
         ${s6.where ? `${s6.where} AND` : "WHERE"} seller_id IN (${idList}) GROUP BY seller_id`,
        p6,
      )
    : [];
  const onTimeById = new Map(topOnTime.map((r) => [String(r.seller_id), numOrNull(r.on_time)]));

  const regions = new Map<RegionId, { onTimePct: number | null; noRevenue: number; revenue: number }>();
  const at = (id: RegionId) => regions.get(id) ?? regions.set(id, { onTimePct: null, noRevenue: 0, revenue: 0 }).get(id)!;
  for (const r of otRegion) if (r.region !== "unknown") at(r.region as RegionId).onTimePct = numOrNull(r.pct);
  for (const r of revRegion) if (r.region !== "unknown") at(r.region as RegionId).revenue = num(r.sales);
  for (const r of noRevenue) {
    const id = regionOf(String(r.seller_state));
    if (id) at(id).noRevenue += num(r.sellers_without_revenue);
  }

  return {
    activeSellers: num(kpi?.sellers),
    revenue: num(kpi?.sales),
    onTimePct: numOrNull(ot?.pct),
    unknownOrders: num(ot?.unknown),
    noRevenueSellers: noRevenue.reduce((a, r) => a + num(r.sellers_without_revenue), 0),
    totalSellers: noRevenue.reduce((a, r) => a + num(r.total_sellers), 0),
    rows: rows.map((r) => ({
      sellerId: String(r.seller_id),
      state: String(r.seller_state ?? ""),
      revenue: num(r.sales),
      items: num(r.items),
      orders: num(r.orders),
      onTimePct: onTimeById.get(String(r.seller_id)) ?? null,
      avgReview: numOrNull(r.review),
    })),
    onTimeByState: byState.map((r) => ({ label: String(r.seller_state), value: numOrNull(r.pct) })),
    noRevenueByState: noRevenue.map((r) => ({ label: String(r.seller_state), value: num(r.sellers_without_revenue) })),
    byRegion: [...regions.entries()]
      .map(([region, v]) => ({ region, label: regionShort(region), ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    ignored: {
      performance: s5.ignored,
      onTime: s6.ignored,
      noRevenue: noRev.scope.ignored,
      regions: union(s5.ignored, s6.ignored, noRev.scope.ignored),
    },
  };
}

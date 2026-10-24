import "server-only";
import { num, query } from "../db";
import { scope } from "../scope";
import { monthLabel } from "../sql";
import type { CategoriesData, Filters } from "../types";

/**
 * Category management — BR04 BR14 from v_br14 (BR04 = v_br14 summed over months).
 * Filters: year, month, category, region, state. The monthly trend shows the whole selected year.
 */
export async function categories(f: Filters): Promise<CategoriesData> {
  const [sr, sm, so] = await Promise.all([
    scope("v_br14_monthly_category_sales", f),
    scope("v_br14_monthly_category_sales", f, { use: ["year", "category", "region", "state"] }),
    scope("v_br01_monthly_sales", f, { use: ["year", "region", "state"] }),
  ]);
  // Summing v_br14 orders across categories double-counts orders with several
  // categories, so the all-category monthly order count comes from v_br01 —
  // but only if v_br01 can apply the same filters as the sales series.
  const exactOrdersOk = !f.category && so.ignored.length === sm.ignored.length;

  const [rows, monthly, orders] = await Promise.all([
    query(
      `SELECT category_name, SUM(total_sales) AS sales, SUM(total_items) AS items, SUM(total_orders) AS orders
       FROM ${sr.from} ${sr.where} GROUP BY category_name ORDER BY 2 DESC NULLS LAST`,
      sr.params,
    ),
    query(
      `SELECT year_number, month_number, SUM(total_sales) AS sales, SUM(total_orders) AS orders
       FROM ${sm.from} ${sm.where} GROUP BY year_number, month_number ORDER BY 1, 2`,
      sm.params,
    ),
    exactOrdersOk
      ? query(`SELECT year_number, month_number, SUM(total_orders) AS total_orders FROM ${so.from} ${so.where} GROUP BY 1, 2`, so.params)
      : Promise.resolve(null),
  ]);

  const exactOrders = new Map(orders?.map((x) => [`${x.year_number}-${x.month_number}`, num(x.total_orders)]) ?? []);
  const list = rows.map((x) => ({
    category: String(x.category_name ?? "unknown"),
    revenue: num(x.sales),
    items: num(x.items),
    orders: num(x.orders),
    avgPrice: num(x.items) ? num(x.sales) / num(x.items) : null,
  }));
  const revenue = list.reduce((a, x) => a + x.revenue, 0);
  const items = list.reduce((a, x) => a + x.items, 0);
  return {
    revenue,
    items,
    avgPrice: items ? revenue / items : null,
    categories: list.filter((x) => x.revenue > 0).length,
    rows: list.slice(0, 15),
    monthly: monthly.map((x) => ({
      label: monthLabel(x.year_number, x.month_number),
      revenue: num(x.sales),
      orders: exactOrders.get(`${x.year_number}-${x.month_number}`) ?? num(x.orders),
    })),
    ignored: { rows: sr.ignored, monthly: sm.ignored },
  };
}

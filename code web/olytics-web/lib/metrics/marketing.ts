import "server-only";
import { num, numOrNull, query } from "../db";
import { regionShort, type RegionId } from "../regions";
import { queryTotals, scope } from "../scope";
import { monthLabel, regionCase } from "../sql";
import type { Filters, MarketingData } from "../types";

/**
 * Marketing — BR13 BR14. Filters: year, month, category, region, customer state.
 * v_br13 (geography) and v_br14 (categories) each apply the filters they have
 * columns for. Customers per city/month are distinct per row, so adding rows up
 * can count a customer more than once (M15 note in the design document).
 */
export async function marketing(f: Filters): Promise<MarketingData> {
  const [g, c, ct, customerStates] = await Promise.all([
    scope("v_br13_customer_geography", f),
    scope("v_br14_monthly_category_sales", f),
    scope("v_br14_monthly_category_sales", f, { use: ["year", "category", "region", "state"] }),
    // BR11 holds distinct customer_unique_id counts. BR13 is city/month grain
    // and summing it would count the same customer more than once.
    scope("v_br11_repeat_customers", f, { use: ["year", "region", "state"], totals: ["year"] }),
  ]);

  const [customerTotal, [kpi], states, stateSales, cities, regions, regionCustomers, monthly, cats, [categoryKpi]] = await Promise.all([
    queryTotals("v_br11_repeat_customers", f, { use: ["year", "region", "state"], totals: ["year", "state"] }, (s) =>
      `SELECT SUM(total_customers) AS customers FROM ${s.from} ${s.where}`),
    query(
      `SELECT SUM(total_orders) AS orders,
              COUNT(DISTINCT customer_state || '|' || customer_city) AS cities
       FROM ${g.from} ${g.where}`,
      g.params,
    ),
    query(
      `SELECT customer_state, SUM(total_customers) AS customers
       FROM ${customerStates.from} ${customerStates.where} AND customer_state IS NOT NULL
       GROUP BY customer_state ORDER BY customers DESC NULLS LAST`,
      customerStates.params,
    ),
    // Sales come from BR14 so the category selector affects every revenue view
    // on this page. Customer geography (BR13) has no category dimension.
    query(
      `SELECT customer_state, SUM(total_sales) AS sales
       FROM ${c.from} ${c.where} GROUP BY customer_state`,
      c.params,
    ),
    query(
      `SELECT customer_city, customer_state, SUM(total_customers) AS customers, SUM(total_orders) AS orders, SUM(total_sales) AS sales
       FROM ${g.from} ${g.where} GROUP BY customer_city, customer_state ORDER BY sales DESC NULLS LAST LIMIT 10`,
      g.params,
    ),
    query(
      `SELECT ${regionCase("customer_state")} AS region, SUM(total_sales) AS sales
       FROM ${c.from} ${c.where} GROUP BY 1 ORDER BY 2 DESC NULLS LAST`,
      c.params,
    ),
    query(
      `SELECT ${regionCase("customer_state")} AS region, SUM(total_customers) AS customers
       FROM ${g.from} ${g.where} GROUP BY 1`,
      g.params,
    ),
    query(`SELECT year_number, month_number, SUM(total_sales) AS sales FROM ${ct.from} ${ct.where} GROUP BY 1, 2 ORDER BY 1, 2`, ct.params),
    query(
      `SELECT category_name, SUM(total_sales) AS sales FROM ${c.from}
       ${c.where ? `${c.where} AND` : "WHERE"} category_name IS NOT NULL AND TRIM(category_name) <> ''
       GROUP BY category_name ORDER BY 2 DESC NULLS LAST LIMIT 5`,
      c.params,
    ),
    query(`SELECT SUM(total_sales) AS sales, SUM(total_orders) AS orders FROM ${c.from} ${c.where}`, c.params),
  ]);

  const salesByState = new Map(stateSales.map((x) => [String(x.customer_state), num(x.sales)]));
  const customersByRegion = new Map(regionCustomers.map((x) => [String(x.region), num(x.customers)]));

  return {
    customers: num(customerTotal.rows[0]?.customers),
    revenue: num(categoryKpi?.sales),
    // BR14 is the category-grain source. With no category selected, use BR13
    // so orders spanning multiple categories are not counted more than once.
    orders: f.category ? num(categoryKpi?.orders) : num(kpi?.orders),
    cities: num(kpi?.cities),
    byState: states.map((x) => ({
      state: String(x.customer_state),
      customers: num(x.customers),
      revenue: salesByState.get(String(x.customer_state)) ?? 0,
    })),
    byRegion: regions
      .filter((x) => x.region !== "unknown")
      .map((x) => ({
        region: x.region as RegionId,
        label: regionShort(x.region as RegionId),
        customers: customersByRegion.get(String(x.region)) ?? 0,
        revenue: num(x.sales),
      })),
    topCities: cities.map((x) => ({
      city: String(x.customer_city),
      state: String(x.customer_state),
      customers: num(x.customers),
      orders: num(x.orders),
      revenue: num(x.sales),
      aov: num(x.orders) ? num(x.sales) / num(x.orders) : null,
    })),
    monthly: monthly.map((x) => ({ label: monthLabel(x.year_number, x.month_number), value: num(x.sales) })),
    topCategories: cats.map((x) => ({ label: String(x.category_name), value: numOrNull(x.sales) })),
    ignored: { geo: g.ignored, categories: c.ignored, trend: ct.ignored },
  };
}

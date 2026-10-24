import "server-only";
import { num, numOrNull, query } from "../db";
import { regionShort, type RegionId } from "../regions";
import { scope } from "../scope";
import { monthLabel, regionCase } from "../sql";
import type { Filters, MarketingData } from "../types";

/**
 * Marketing — BR13 BR14. Filters: year, month, category, region, customer state.
 * v_br13 (geography) and v_br14 (categories) each apply the filters they have
 * columns for. Customers per city/month are distinct per row, so adding rows up
 * can count a customer more than once (M15 note in the design document).
 */
export async function marketing(f: Filters): Promise<MarketingData> {
  const [g, c, ct] = await Promise.all([
    scope("v_br13_customer_geography", f),
    scope("v_br14_monthly_category_sales", f),
    scope("v_br14_monthly_category_sales", f, { use: ["year", "category", "region", "state"] }),
  ]);

  const [[kpi], states, cities, regions, monthly, cats] = await Promise.all([
    query(
      `SELECT SUM(total_customers) AS customers, SUM(total_orders) AS orders, SUM(total_sales) AS sales,
              COUNT(DISTINCT customer_state || '|' || customer_city) AS cities
       FROM ${g.from} ${g.where}`,
      g.params,
    ),
    query(
      `SELECT customer_state, SUM(total_customers) AS customers, SUM(total_sales) AS sales
       FROM ${g.from} ${g.where} GROUP BY customer_state ORDER BY sales DESC NULLS LAST`,
      g.params,
    ),
    query(
      `SELECT customer_city, customer_state, SUM(total_customers) AS customers, SUM(total_orders) AS orders, SUM(total_sales) AS sales
       FROM ${g.from} ${g.where} GROUP BY customer_city, customer_state ORDER BY sales DESC NULLS LAST LIMIT 10`,
      g.params,
    ),
    query(
      `SELECT ${regionCase("customer_state")} AS region, SUM(total_customers) AS customers, SUM(total_sales) AS sales
       FROM ${g.from} ${g.where} GROUP BY 1 ORDER BY 3 DESC NULLS LAST`,
      g.params,
    ),
    query(`SELECT year_number, month_number, SUM(total_sales) AS sales FROM ${ct.from} ${ct.where} GROUP BY 1, 2 ORDER BY 1, 2`, ct.params),
    query(
      `SELECT category_name, SUM(total_sales) AS sales FROM ${c.from} ${c.where} GROUP BY category_name ORDER BY 2 DESC NULLS LAST LIMIT 5`,
      c.params,
    ),
  ]);

  return {
    customers: num(kpi?.customers),
    revenue: num(kpi?.sales),
    orders: num(kpi?.orders),
    cities: num(kpi?.cities),
    byState: states.map((x) => ({ state: String(x.customer_state), customers: num(x.customers), revenue: num(x.sales) })),
    byRegion: regions
      .filter((x) => x.region !== "unknown")
      .map((x) => ({
        region: x.region as RegionId,
        label: regionShort(x.region as RegionId),
        customers: num(x.customers),
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

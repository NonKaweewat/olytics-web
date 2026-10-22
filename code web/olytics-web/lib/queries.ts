import "server-only";
import { rsQuery, schema } from "./redshift";
import type { DashboardData, FilterOptions, Filters, Kpis } from "./types";

// All SQL against the warehouse lives here. If the data team renames a table or
// column, this is the only file to change.
//
// Schema (ER diagram from the data team):
//   fact_order       one row per order  — total_sales, total_freight, delivery_days, late_flag
//   fact_order_item  one row per item   — price, freight_value, product_key, seller_key
//   fact_review      one row per review — review_score_key -> dim_review_score
//   fact_payment     one row per payment (not used by the dashboard yet)
//   dim_date, dim_customer, dim_product, dim_seller, dim_order_status, dim_payment_method
//
// Revenue / items / categories come from fact_order_item (so the category filter
// is exact). Delivery and late metrics come from fact_order; with a category
// filter, only orders containing an item of that category are counted.

/** Category label: English translation when available. */
const CAT = "COALESCE(p.category_english, p.category_name)";

type Mode = "item" | "order";

function where(f: Filters, mode: Mode): { sql: string; params: unknown[] } {
  const s = schema();
  const parts: string[] = [];
  const params: unknown[] = [];
  if (f.year) {
    params.push(f.year);
    parts.push(`d.year_number = $${params.length}`);
  }
  if (f.state) {
    params.push(f.state);
    parts.push(`c.state = $${params.length}`);
  }
  if (f.category) {
    params.push(f.category);
    parts.push(
      mode === "item"
        ? `${CAT} = $${params.length}`
        : `o.order_id IN (SELECT i.order_id FROM ${s}.fact_order_item i
             JOIN ${s}.dim_product p ON i.product_key = p.product_key
             WHERE ${CAT} = $${params.length})`,
    );
  }
  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
}

function itemsFrom(): string {
  const s = schema();
  return `FROM ${s}.fact_order_item i
    JOIN ${s}.dim_date d ON i.purchase_date_key = d.date_key
    JOIN ${s}.dim_customer c ON i.customer_key = c.customer_key
    JOIN ${s}.dim_product p ON i.product_key = p.product_key`;
}

function ordersFrom(): string {
  const s = schema();
  return `FROM ${s}.fact_order o
    JOIN ${s}.dim_date d ON o.purchase_date_key = d.date_key
    JOIN ${s}.dim_customer c ON o.customer_key = c.customer_key`;
}

/** CTE `fo`: filtered orders. Append review joins after it. */
function ordersCte(f: Filters): { sql: string; params: unknown[] } {
  const w = where(f, "order");
  return {
    sql: `WITH fo AS (SELECT o.order_id, o.delivery_days, o.late_flag ${ordersFrom()} ${w.sql})`,
    params: w.params,
  };
}

function reviewsJoin(): string {
  const s = schema();
  return `JOIN ${s}.fact_review r ON r.order_id = fo.order_id
    JOIN ${s}.dim_review_score rs ON r.review_score_key = rs.review_score_key`;
}

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

async function kpis(f: Filters): Promise<Kpis> {
  const wi = where(f, "item");
  const oc = ordersCte(f);
  const [[sales], [delivery], [review]] = await Promise.all([
    rsQuery(
      `SELECT SUM(i.price) AS revenue,
              SUM(i.freight_value) AS freight,
              COUNT(DISTINCT i.order_id) AS orders
       ${itemsFrom()} ${wi.sql}`,
      wi.params,
    ),
    rsQuery(
      `${oc.sql}
       SELECT AVG(delivery_days::float) AS avg_delivery,
              100.0 * SUM(CASE WHEN late_flag = 1 THEN 1 ELSE 0 END)
                / NULLIF(SUM(CASE WHEN delivery_days IS NOT NULL THEN 1 ELSE 0 END), 0) AS late_pct
       FROM fo WHERE delivery_days IS NOT NULL`,
      oc.params,
    ),
    rsQuery(`${oc.sql} SELECT AVG(rs.review_score::float) AS avg_review FROM fo ${reviewsJoin()}`, oc.params),
  ]);
  const revenue = num(sales?.revenue);
  const orders = num(sales?.orders);
  const latePct = num(delivery?.late_pct);
  return {
    revenue,
    orders,
    avgOrderValue: orders ? revenue / orders : 0,
    avgFreight: orders ? num(sales?.freight) / orders : 0,
    avgReview: num(review?.avg_review),
    avgDeliveryDays: num(delivery?.avg_delivery),
    onTimePct: 100 - latePct,
    latePct,
  };
}

export async function rsDashboard(f: Filters): Promise<DashboardData> {
  const wi = where(f, "item");
  const wo = where(f, "order");
  const oc = ordersCte(f);
  const items = itemsFrom();

  const [k, prevKpis, monthly, cats, states, scatter, dist] = await Promise.all([
    kpis(f),
    f.year ? kpis({ ...f, year: f.year - 1 }) : Promise.resolve(null),
    rsQuery(
      `SELECT d.month_number AS month, SUM(i.price) AS revenue, COUNT(DISTINCT i.order_id) AS orders
       ${items} ${wi.sql} GROUP BY d.month_number ORDER BY d.month_number`,
      wi.params,
    ),
    rsQuery(
      `SELECT ${CAT} AS category, SUM(i.price) AS revenue, SUM(i.item_count) AS items
       ${items} ${wi.sql} GROUP BY 1 ORDER BY revenue DESC LIMIT 10`,
      wi.params,
    ),
    rsQuery(
      `SELECT c.state AS state, COUNT(*) AS orders
       ${ordersFrom()} ${wo.sql} GROUP BY c.state ORDER BY orders DESC`,
      wo.params,
    ),
    rsQuery(
      `${oc.sql}
       SELECT ROUND(fo.delivery_days) AS days, AVG(rs.review_score::float) AS score, COUNT(*) AS orders
       FROM fo ${reviewsJoin()}
       WHERE fo.delivery_days BETWEEN 0 AND 90
       GROUP BY 1 ORDER BY 1`,
      oc.params,
    ),
    rsQuery(
      `${oc.sql}
       SELECT rs.review_score AS score, 100.0 * COUNT(*) / SUM(COUNT(*)) OVER () AS pct
       FROM fo ${reviewsJoin()}
       GROUP BY rs.review_score ORDER BY rs.review_score`,
      oc.params,
    ),
  ]);

  const totalStateOrders = states.reduce((a, s) => a + num(s.orders), 0) || 1;

  return {
    kpis: k,
    prevKpis,
    monthly: monthly.map((m) => ({ month: num(m.month), revenue: num(m.revenue), orders: num(m.orders) })),
    topCategories: cats.map((c) => ({
      category: String(c.category ?? "unknown"),
      revenue: num(c.revenue),
      items: num(c.items),
    })),
    ordersByState: states.slice(0, 5).map((s) => ({
      state: String(s.state),
      orders: num(s.orders),
      share: (num(s.orders) / totalStateOrders) * 100,
    })),
    deliveryVsReview: scatter.map((p) => ({ days: num(p.days), score: num(p.score), orders: num(p.orders) })),
    reviewDistribution: dist.map((d) => ({ score: num(d.score), pct: num(d.pct) })),
    deliveryStatus: { onTime: k.onTimePct, late: k.latePct },
  };
}

export async function rsFilterOptions(): Promise<FilterOptions> {
  const s = schema();
  const [years, cats, states] = await Promise.all([
    rsQuery(
      `SELECT DISTINCT d.year_number AS year FROM ${s}.fact_order o
       JOIN ${s}.dim_date d ON o.purchase_date_key = d.date_key ORDER BY 1 DESC`,
    ),
    rsQuery(`SELECT DISTINCT ${CAT} AS c FROM ${s}.dim_product p WHERE ${CAT} IS NOT NULL ORDER BY 1`),
    rsQuery(`SELECT DISTINCT state AS s FROM ${s}.dim_customer WHERE state IS NOT NULL ORDER BY 1`),
  ]);
  return {
    years: years.map((y) => num(y.year)),
    categories: cats.map((c) => String(c.c)),
    states: states.map((x) => String(x.s)),
  };
}

export async function rsPing(): Promise<void> {
  await rsQuery("SELECT 1");
}

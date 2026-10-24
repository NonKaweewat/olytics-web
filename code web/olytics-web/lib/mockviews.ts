// Mock copies of the data team's KPI views (dw.v_br01 … v_br14, see KPI.txt).
// Names and columns match the real views exactly; the formulas here are our
// reading of design/olist_dw_design_document.md — on Redshift the team's own
// definitions are used. Everything is materialized: the mock data never changes,
// and PGlite would otherwise recompute the nested helpers (v_br05 took ~35 s).

const BASE = `
CREATE MATERIALIZED VIEW mock_items AS
  SELECT i.order_id, i.price, i.on_time_flag, os.order_status, d.year_number, d.month_number,
         c.state AS customer_state, c.city AS customer_city, c.customer_unique_id,
         COALESCE(p.category_english, p.category_name) AS category_name,
         se.seller_id, se.state AS seller_state
  FROM fact_order_item i
  JOIN dim_date d ON i.purchase_date_key = d.date_key
  JOIN dim_customer c ON i.customer_key = c.customer_key
  JOIN dim_product p ON i.product_key = p.product_key
  JOIN dim_seller se ON i.seller_key = se.seller_key
  JOIN dim_order_status os ON i.order_status_key = os.order_status_key;

-- "คำสั่งซื้อที่นับเป็นยอดขาย"
CREATE VIEW mock_sale_items AS
  SELECT * FROM mock_items WHERE order_status NOT IN ('canceled', 'unavailable');

-- M08: one review per order, the latest; dated by the review
CREATE MATERIALIZED VIEW mock_latest_review AS
  SELECT order_id, review_score, year_number, month_number FROM (
    SELECT r.order_id, rs.review_score, d.year_number, d.month_number,
           ROW_NUMBER() OVER (PARTITION BY r.order_id ORDER BY d.full_date DESC, r.review_key DESC) AS rn
    FROM fact_review r
    JOIN dim_review_score rs ON r.review_score_key = rs.review_score_key
    JOIN dim_date d ON r.review_date_key = d.date_key
  ) x WHERE rn = 1;

CREATE MATERIALIZED VIEW mock_orders AS
  SELECT o.order_id, o.delivery_days, o.late_flag, os.order_status, d.year_number, d.month_number,
         c.state AS customer_state, c.customer_unique_id
  FROM fact_order o
  JOIN dim_date d ON o.purchase_date_key = d.date_key
  JOIN dim_customer c ON o.customer_key = c.customer_key
  JOIN dim_order_status os ON o.order_status_key = os.order_status_key;

CREATE INDEX ON mock_latest_review (order_id);
ANALYZE mock_items;
ANALYZE mock_latest_review;
ANALYZE mock_orders;
`;

// Mock views come in two shapes:
//   MOCK_VIEWS=target  (default) — every column requested in VIEW_REQUESTS.md, so
//                       every chart follows every filter in the demo
//   MOCK_VIEWS=current — exactly the team's views today (KPI.txt), to see which
//                       cards still warn "ยังไม่ขึ้นกับตัวกรอง …"
const FUTURE = process.env.MOCK_VIEWS !== "current";

const VIEWS: Record<string, string> = {
  v_br01_monthly_sales: FUTURE
    ? `
    WITH m AS (
      SELECT year_number, month_number, customer_state, SUM(price) AS total_sales, COUNT(DISTINCT order_id) AS total_orders
      FROM mock_sale_items GROUP BY year_number, month_number, customer_state
    )
    SELECT year_number, month_number, customer_state, total_sales, total_orders,
           ROUND(100.0 * (total_sales - LAG(total_sales) OVER w) / NULLIF(LAG(total_sales) OVER w, 0), 2) AS mom_growth_pct
    FROM m WINDOW w AS (PARTITION BY customer_state ORDER BY year_number, month_number)`
    : `
    WITH m AS (
      SELECT year_number, month_number, SUM(price) AS total_sales, COUNT(DISTINCT order_id) AS total_orders
      FROM mock_sale_items GROUP BY year_number, month_number
    )
    SELECT year_number, month_number, total_sales, total_orders,
           ROUND(100.0 * (total_sales - LAG(total_sales) OVER w) / NULLIF(LAG(total_sales) OVER w, 0), 2) AS mom_growth_pct
    FROM m WINDOW w AS (ORDER BY year_number, month_number)`,

  v_br02_top_states: `
    SELECT customer_state AS state, SUM(price) AS total_sales, COUNT(*) AS total_order_items, COUNT(DISTINCT order_id) AS total_orders
    FROM mock_sale_items GROUP BY customer_state ORDER BY total_sales DESC LIMIT 5`,

  v_br02_top_categories: `
    SELECT category_name, SUM(price) AS total_sales, COUNT(*) AS total_order_items, COUNT(DISTINCT order_id) AS total_orders
    FROM mock_sale_items GROUP BY category_name ORDER BY total_sales DESC LIMIT 5`,

  v_br03_payment_distribution: `
    SELECT pm.payment_type, COUNT(*) AS payment_records, SUM(fp.payment_value) AS total_payment,
           ROUND(100.0 * SUM(fp.payment_value) / SUM(SUM(fp.payment_value)) OVER (), 2) AS payment_percentage
    FROM fact_payment fp JOIN dim_payment_method pm ON fp.payment_method_key = pm.payment_method_key
    GROUP BY pm.payment_type`,

  v_br04_category_performance: `
    SELECT category_name, SUM(price) AS total_sales, COUNT(*) AS total_items, COUNT(DISTINCT order_id) AS total_orders,
           ROUND(SUM(price) / NULLIF(COUNT(*), 0), 2) AS avg_item_price
    FROM mock_sale_items GROUP BY category_name`,

  // One row per (month, seller, order) first, so each order's review counts once per seller
  v_br05_seller_performance: `
    WITH so AS (
      SELECT year_number, month_number, seller_id, seller_state, order_id, SUM(price) AS sales, COUNT(*) AS items
      FROM mock_sale_items GROUP BY year_number, month_number, seller_id, seller_state, order_id
    )
    SELECT so.year_number, so.month_number, so.seller_id, so.seller_state, SUM(so.sales) AS total_sales,
           SUM(so.items) AS total_items, COUNT(*) AS total_orders,
           ROUND(AVG(r.review_score::float)::numeric, 2) AS avg_review_score, COUNT(r.order_id) AS reviewed_orders
    FROM so LEFT JOIN mock_latest_review r ON r.order_id = so.order_id
    GROUP BY so.year_number, so.month_number, so.seller_id, so.seller_state`,

  // Per (order, seller): on time when every item with a carrier date was handed over in time
  v_br06_seller_on_time: `
    WITH os AS (
      SELECT year_number, month_number, seller_id, seller_state, order_id, MIN(on_time_flag) AS f, COUNT(on_time_flag) AS n
      FROM mock_items GROUP BY year_number, month_number, seller_id, seller_state, order_id
    )
    SELECT year_number, month_number, seller_id, seller_state, COUNT(*) AS total_seller_orders,
           SUM(CASE WHEN n > 0 AND f = 1 THEN 1 ELSE 0 END) AS on_time_orders,
           SUM(CASE WHEN n > 0 AND f = 0 THEN 1 ELSE 0 END) AS late_orders,
           SUM(CASE WHEN n = 0 THEN 1 ELSE 0 END) AS unknown_orders,
           ROUND(100.0 * SUM(CASE WHEN n > 0 AND f = 1 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN n > 0 THEN 1 ELSE 0 END), 0), 2) AS on_time_rate_pct
    FROM os GROUP BY year_number, month_number, seller_id, seller_state`,

  v_br07_sellers_without_revenue: `
    SELECT se.state AS seller_state, COUNT(*) AS total_sellers,
           SUM(CASE WHEN s.seller_id IS NULL THEN 1 ELSE 0 END) AS sellers_without_revenue,
           SUM(CASE WHEN s.seller_id IS NOT NULL THEN 1 ELSE 0 END) AS sellers_with_revenue,
           ROUND(100.0 * SUM(CASE WHEN s.seller_id IS NULL THEN 1 ELSE 0 END) / COUNT(*), 2) AS no_revenue_rate_pct
    FROM dim_seller se LEFT JOIN (SELECT DISTINCT seller_id FROM mock_sale_items) s ON s.seller_id = se.seller_id
    GROUP BY se.state`,

  v_br08_late_delivery: `
    SELECT year_number, month_number, customer_state, COUNT(*) AS total_delivered_orders,
           SUM(CASE WHEN late_flag = 1 THEN 1 ELSE 0 END) AS late_orders,
           SUM(CASE WHEN late_flag = 0 THEN 1 ELSE 0 END) AS on_time_orders,
           ROUND(100.0 * SUM(CASE WHEN late_flag = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) AS late_delivery_rate_pct
    FROM mock_orders WHERE delivery_days IS NOT NULL
    GROUP BY year_number, month_number, customer_state`,

  v_br09_delivery_days: `
    SELECT year_number, month_number, customer_state, COUNT(*) AS total_delivered_orders,
           ROUND(AVG(delivery_days), 2) AS avg_delivery_days, MIN(delivery_days) AS min_delivery_days,
           MAX(delivery_days) AS max_delivery_days, SUM(delivery_days) AS sum_delivery_days
    FROM mock_orders WHERE delivery_days IS NOT NULL
    GROUP BY year_number, month_number, customer_state`,

  v_br10_review_satisfaction: `
    SELECT year_number, month_number, review_score, COUNT(*) AS review_count,
           SUM(COUNT(*)) OVER m AS monthly_total_reviews,
           ROUND(SUM(review_score * COUNT(*)) OVER m * 1.0 / SUM(COUNT(*)) OVER m, 2) AS monthly_avg_review_score
    FROM mock_latest_review GROUP BY year_number, month_number, review_score
    WINDOW m AS (PARTITION BY year_number, month_number)`,

  v_br11_repeat_customers: `
    WITH co AS (
      SELECT customer_unique_id, COUNT(DISTINCT order_id) AS n FROM mock_orders
      WHERE order_status NOT IN ('canceled', 'unavailable') GROUP BY customer_unique_id
    )
    SELECT COUNT(*) AS total_customers, SUM(CASE WHEN n >= 2 THEN 1 ELSE 0 END) AS repeat_customers,
           SUM(CASE WHEN n = 1 THEN 1 ELSE 0 END) AS one_time_customers,
           ROUND(100.0 * SUM(CASE WHEN n >= 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS repeat_customer_rate_pct
    FROM co`,

  v_br12_order_failure_rate: `
    SELECT year_number, month_number, COUNT(*) AS total_orders,
           SUM(CASE WHEN order_status = 'canceled' THEN 1 ELSE 0 END) AS canceled_orders,
           SUM(CASE WHEN order_status = 'unavailable' THEN 1 ELSE 0 END) AS unavailable_orders,
           SUM(CASE WHEN order_status IN ('canceled', 'unavailable') THEN 1 ELSE 0 END) AS failed_orders,
           ROUND(100.0 * SUM(CASE WHEN order_status = 'canceled' THEN 1 ELSE 0 END) / COUNT(*), 2) AS cancellation_rate_pct,
           ROUND(100.0 * SUM(CASE WHEN order_status = 'unavailable' THEN 1 ELSE 0 END) / COUNT(*), 2) AS unavailable_rate_pct,
           ROUND(100.0 * SUM(CASE WHEN order_status IN ('canceled', 'unavailable') THEN 1 ELSE 0 END) / COUNT(*), 2) AS failure_rate_pct
    FROM mock_orders GROUP BY year_number, month_number`,

  v_br13_customer_geography: `
    SELECT customer_state, customer_city, COUNT(DISTINCT customer_unique_id) AS total_customers,
           COUNT(DISTINCT order_id) AS total_orders, SUM(price) AS total_sales,
           ROUND(SUM(price) / NULLIF(COUNT(DISTINCT order_id), 0), 2) AS avg_order_value
    FROM mock_sale_items GROUP BY customer_state, customer_city`,

  v_br14_monthly_category_sales: `
    SELECT year_number, month_number, category_name, ${FUTURE ? "customer_state, " : ""}SUM(price) AS total_sales, COUNT(*) AS total_items,
           COUNT(DISTINCT order_id) AS total_orders
    FROM mock_sale_items GROUP BY year_number, month_number, category_name${FUTURE ? ", customer_state" : ""}`,
};

// Target shape of the remaining views (VIEW_REQUESTS.md), used unless MOCK_VIEWS=current.
// Distinct counts (sellers, customers) carry total rows where the dimension is NULL.
const REPEAT_SETS: [string[], string][] = [
  [[], "NULL::smallint AS year_number, NULL::char(2) AS customer_state"],
  [["year_number"], "year_number, NULL::char(2) AS customer_state"],
  [["customer_state"], "NULL::smallint AS year_number, customer_state"],
  [["year_number", "customer_state"], "year_number, customer_state"],
];

const TARGET: Record<string, string> = {
  v_br03_payment_distribution: `
    SELECT d.year_number, d.month_number, c.state AS customer_state, pm.payment_type,
           COUNT(*) AS payment_records, SUM(fp.payment_value) AS total_payment,
           ROUND(100.0 * SUM(fp.payment_value) / SUM(SUM(fp.payment_value)) OVER (PARTITION BY d.year_number, d.month_number, c.state), 2) AS payment_percentage
    FROM fact_payment fp
    JOIN dim_payment_method pm ON fp.payment_method_key = pm.payment_method_key
    JOIN dim_date d ON fp.purchase_date_key = d.date_key
    JOIN dim_customer c ON fp.customer_key = c.customer_key
    GROUP BY d.year_number, d.month_number, c.state, pm.payment_type`,

  // one row per seller state and year, plus all-time rows (year_number NULL)
  v_br07_sellers_without_revenue: `
    WITH yrs AS (SELECT DISTINCT year_number FROM mock_sale_items),
    sold_year AS (SELECT DISTINCT seller_id, year_number FROM mock_sale_items),
    sold_all AS (SELECT DISTINCT seller_id FROM mock_sale_items),
    per_year AS (
      SELECT se.state AS seller_state, y.year_number, COUNT(*) AS total_sellers,
             SUM(CASE WHEN s.seller_id IS NULL THEN 1 ELSE 0 END) AS sellers_without_revenue
      FROM dim_seller se CROSS JOIN yrs y
      LEFT JOIN sold_year s ON s.seller_id = se.seller_id AND s.year_number = y.year_number
      GROUP BY se.state, y.year_number
    ),
    all_time AS (
      SELECT se.state AS seller_state, NULL::smallint AS year_number, COUNT(*) AS total_sellers,
             SUM(CASE WHEN s.seller_id IS NULL THEN 1 ELSE 0 END) AS sellers_without_revenue
      FROM dim_seller se LEFT JOIN sold_all s ON s.seller_id = se.seller_id GROUP BY se.state
    )
    SELECT seller_state, year_number, total_sellers, sellers_without_revenue,
           total_sellers - sellers_without_revenue AS sellers_with_revenue,
           ROUND(100.0 * sellers_without_revenue / total_sellers, 2) AS no_revenue_rate_pct
    FROM (SELECT * FROM per_year UNION ALL SELECT * FROM all_time) x`,

  v_br10_review_satisfaction: `
    SELECT r.year_number, r.month_number, o.customer_state, r.review_score, COUNT(*) AS review_count,
           SUM(COUNT(*)) OVER m AS monthly_total_reviews,
           ROUND(SUM(r.review_score * COUNT(*)) OVER m * 1.0 / SUM(COUNT(*)) OVER m, 2) AS monthly_avg_review_score
    FROM mock_latest_review r JOIN mock_orders o ON o.order_id = r.order_id
    GROUP BY r.year_number, r.month_number, o.customer_state, r.review_score
    WINDOW m AS (PARTITION BY r.year_number, r.month_number, o.customer_state)`,

  // repeat = 2+ counted orders inside the group; totals where year / state are NULL
  v_br11_repeat_customers: REPEAT_SETS.map(([dims, cols]) => {
    const by = ["customer_unique_id", ...dims].join(", ");
    const outer = dims.length ? `GROUP BY ${dims.join(", ")}` : "";
    return `SELECT ${cols}, COUNT(*) AS total_customers, SUM(CASE WHEN n >= 2 THEN 1 ELSE 0 END) AS repeat_customers,
              SUM(CASE WHEN n = 1 THEN 1 ELSE 0 END) AS one_time_customers,
              ROUND(100.0 * SUM(CASE WHEN n >= 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS repeat_customer_rate_pct
            FROM (SELECT ${by}, COUNT(DISTINCT order_id) AS n FROM mock_orders
                  WHERE order_status NOT IN ('canceled', 'unavailable') GROUP BY ${by}) co ${outer}`;
  }).join("\n    UNION ALL\n    "),

  v_br12_order_failure_rate: `
    SELECT year_number, month_number, customer_state, COUNT(*) AS total_orders,
           SUM(CASE WHEN order_status = 'canceled' THEN 1 ELSE 0 END) AS canceled_orders,
           SUM(CASE WHEN order_status = 'unavailable' THEN 1 ELSE 0 END) AS unavailable_orders,
           SUM(CASE WHEN order_status IN ('canceled', 'unavailable') THEN 1 ELSE 0 END) AS failed_orders,
           ROUND(100.0 * SUM(CASE WHEN order_status = 'canceled' THEN 1 ELSE 0 END) / COUNT(*), 2) AS cancellation_rate_pct,
           ROUND(100.0 * SUM(CASE WHEN order_status = 'unavailable' THEN 1 ELSE 0 END) / COUNT(*), 2) AS unavailable_rate_pct,
           ROUND(100.0 * SUM(CASE WHEN order_status IN ('canceled', 'unavailable') THEN 1 ELSE 0 END) / COUNT(*), 2) AS failure_rate_pct
    FROM mock_orders GROUP BY year_number, month_number, customer_state`,

  v_br13_customer_geography: `
    SELECT year_number, month_number, customer_state, customer_city, COUNT(DISTINCT customer_unique_id) AS total_customers,
           COUNT(DISTINCT order_id) AS total_orders, SUM(price) AS total_sales,
           ROUND(SUM(price) / NULLIF(COUNT(DISTINCT order_id), 0), 2) AS avg_order_value
    FROM mock_sale_items GROUP BY year_number, month_number, customer_state, customer_city`,
};

export const MOCK_BASE_SQL = BASE;
export const MOCK_VIEWS = Object.entries({ ...VIEWS, ...(FUTURE ? TARGET : {}) }).map(([name, sql]) => ({
  name,
  sql: `CREATE MATERIALIZED VIEW ${name} AS ${sql};`,
}));

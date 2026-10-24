import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { MOCK_BASE_SQL, MOCK_VIEWS } from "./mockviews";

// DATA_SOURCE=mock: an in-memory Postgres (PGlite) with the same tables as the
// Redshift ER diagram, filled with synthetic Olist-like data, plus copies of the
// data team's KPI views (lib/mockviews.ts). The dashboards run the exact same
// SQL against it as against Redshift. Numbers are fake — never use them in the report.

const ORDERS = 25_000;

const DDL = `
CREATE TABLE dim_date (date_key int PRIMARY KEY, full_date date NOT NULL, day_of_month smallint NOT NULL,
  month_number smallint NOT NULL, month_name varchar(15) NOT NULL, quarter_number smallint NOT NULL, year_number smallint NOT NULL);
CREATE TABLE dim_customer (customer_key bigint PRIMARY KEY, customer_id varchar(32) NOT NULL, customer_unique_id varchar(32) NOT NULL,
  zip_code_prefix varchar(5), city varchar(100), state char(2));
CREATE TABLE dim_seller (seller_key bigint PRIMARY KEY, seller_id varchar(32) NOT NULL, zip_code_prefix varchar(5), city varchar(100), state char(2));
CREATE TABLE dim_product (product_key bigint PRIMARY KEY, product_id varchar(32) NOT NULL, category_name varchar(100), category_english varchar(100));
CREATE TABLE dim_order_status (order_status_key smallint PRIMARY KEY, order_status varchar(20) NOT NULL);
CREATE TABLE dim_payment_method (payment_method_key smallint PRIMARY KEY, payment_type varchar(20) NOT NULL);
CREATE TABLE dim_review_score (review_score_key smallint PRIMARY KEY, review_score smallint NOT NULL);
CREATE TABLE fact_order (order_key bigint PRIMARY KEY, order_id varchar(32) NOT NULL, purchase_date_key int NOT NULL, customer_key bigint NOT NULL,
  order_status_key smallint NOT NULL, total_sales decimal(14,2), total_freight decimal(14,2), total_payment decimal(14,2),
  order_count smallint NOT NULL, delivery_days decimal(10,2), late_flag smallint);
CREATE TABLE fact_order_item (order_item_key bigint PRIMARY KEY, order_id varchar(32) NOT NULL, order_item_id int NOT NULL, purchase_date_key int NOT NULL,
  customer_key bigint NOT NULL, seller_key bigint NOT NULL, product_key bigint NOT NULL, order_status_key smallint NOT NULL,
  price decimal(12,2) NOT NULL, freight_value decimal(12,2) NOT NULL, item_count smallint NOT NULL, on_time_flag smallint);
CREATE TABLE fact_review (review_key bigint PRIMARY KEY, review_id varchar(32) NOT NULL, order_id varchar(32) NOT NULL, review_date_key int NOT NULL,
  customer_key bigint NOT NULL, review_score_key smallint NOT NULL, review_count smallint NOT NULL);
CREATE TABLE fact_payment (payment_key bigint PRIMARY KEY, order_id varchar(32) NOT NULL, purchase_date_key int NOT NULL, customer_key bigint NOT NULL,
  payment_method_key smallint NOT NULL, payment_sequential smallint NOT NULL, payment_installments smallint NOT NULL, payment_value decimal(12,2) NOT NULL);
`;

// [state, weight, cities]
const STATES: [string, number, string[]][] = [
  ["SP", 0.42, ["sao paulo", "campinas", "guarulhos", "santo andre", "sorocaba"]],
  ["RJ", 0.13, ["rio de janeiro", "niteroi", "duque de caxias"]],
  ["MG", 0.117, ["belo horizonte", "uberlandia", "juiz de fora"]],
  ["RS", 0.055, ["porto alegre", "caxias do sul"]],
  ["PR", 0.05, ["curitiba", "londrina", "maringa"]],
  ["SC", 0.036, ["florianopolis", "joinville"]],
  ["BA", 0.034, ["salvador", "feira de santana"]],
  ["DF", 0.021, ["brasilia"]],
  ["ES", 0.02, ["vitoria", "vila velha"]],
  ["GO", 0.02, ["goiania"]],
  ["PE", 0.017, ["recife"]],
  ["CE", 0.013, ["fortaleza"]],
  ["PA", 0.01, ["belem"]],
  ["MT", 0.009, ["cuiaba"]],
  ["MA", 0.0075, ["sao luis"]],
  ["MS", 0.007, ["campo grande"]],
  ["PB", 0.0054, ["joao pessoa"]],
  ["PI", 0.005, ["teresina"]],
  ["RN", 0.0049, ["natal"]],
  ["AL", 0.004, ["maceio"]],
  ["SE", 0.0034, ["aracaju"]],
  ["TO", 0.0028, ["palmas"]],
  ["RO", 0.0025, ["porto velho"]],
  ["AM", 0.0015, ["manaus"]],
  ["AC", 0.0008, ["rio branco"]],
  ["AP", 0.0007, ["macapa"]],
  ["RR", 0.0005, ["boa vista"]],
];
const SELLER_STATES: [string, number][] = [
  ["SP", 0.6], ["PR", 0.11], ["MG", 0.08], ["SC", 0.06], ["RJ", 0.05], ["RS", 0.04], ["GO", 0.015], ["DF", 0.01], ["BA", 0.01], ["ES", 0.008],
];

// [portuguese, english (null = no translation), weight, mean price]
const CATEGORIES: [string, string | null, number, number][] = [
  ["cama_mesa_banho", "bed_bath_table", 0.1, 90],
  ["beleza_saude", "health_beauty", 0.09, 130],
  ["esporte_lazer", "sports_leisure", 0.08, 115],
  ["moveis_decoracao", "furniture_decor", 0.075, 87],
  ["informatica_acessorios", "computers_accessories", 0.07, 116],
  ["utilidades_domesticas", "housewares", 0.062, 90],
  ["relogios_presentes", "watches_gifts", 0.053, 200],
  ["telefonia", "telephony", 0.04, 71],
  ["ferramentas_jardim", "garden_tools", 0.04, 111],
  ["automotivo", "auto", 0.038, 139],
  ["brinquedos", "toys", 0.036, 117],
  ["cool_stuff", "cool_stuff", 0.033, 167],
  ["perfumaria", "perfumery", 0.03, 120],
  ["bebes", "baby", 0.027, 131],
  ["eletronicos", "electronics", 0.025, 57],
  ["pc_gamer", null, 0.004, 170],
];

// Real Olist order counts per month (2016-09 .. 2018-10), scaled to ORDERS.
const MONTHS: [number, number, number][] = [
  [2016, 9, 4], [2016, 10, 324], [2016, 12, 1],
  [2017, 1, 800], [2017, 2, 1780], [2017, 3, 2682], [2017, 4, 2404], [2017, 5, 3700], [2017, 6, 3245],
  [2017, 7, 4026], [2017, 8, 4331], [2017, 9, 4285], [2017, 10, 4631], [2017, 11, 7544], [2017, 12, 5673],
  [2018, 1, 7269], [2018, 2, 6728], [2018, 3, 7211], [2018, 4, 6939], [2018, 5, 6873], [2018, 6, 6167],
  [2018, 7, 6292], [2018, 8, 6512], [2018, 9, 16], [2018, 10, 4],
];

const STATUSES = ["delivered", "shipped", "canceled", "unavailable", "invoiced", "processing"];
const STATUS_W = [0.97, 0.011, 0.0063, 0.0061, 0.0032, 0.0034];
const PAYMENT_TYPES = ["credit_card", "boleto", "voucher", "debit_card"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate() {
  const r = mulberry32(20260424);
  const pick = <T,>(items: T[], weights: number[]): T => {
    const total = weights.reduce((a, b) => a + b, 0);
    let x = r() * total;
    for (let i = 0; i < items.length; i++) if ((x -= weights[i]) <= 0) return items[i];
    return items[items.length - 1];
  };
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const hex = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");
  const exp = (mean: number) => -Math.log(1 - r()) * mean;
  const normal = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const money = (n: number) => Math.round(n * 100) / 100;

  // dim_date: 2016-01-01 .. 2018-12-31
  const dates: unknown[][] = [];
  for (let d = new Date(Date.UTC(2016, 0, 1)); d.getUTCFullYear() < 2019; d.setUTCDate(d.getUTCDate() + 1)) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    dates.push([y * 10000 + m * 100 + day, d.toISOString().slice(0, 10), day, m, MONTH_NAMES[m - 1], Math.ceil(m / 3), y]);
  }
  const dateKey = (d: Date) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();

  // sellers — ~8% never sell (for M13)
  const sellers: unknown[][] = [];
  const activeSellers: number[] = [];
  for (let k = 1; k <= 1500; k++) {
    const st = pick(SELLER_STATES.map((s) => s[0]), SELLER_STATES.map((s) => s[1]));
    const cities = STATES.find((s) => s[0] === st)![2];
    sellers.push([k, hex(), String(int(10000, 99999)), cities[int(0, cities.length - 1)], st]);
    if (r() > 0.08) activeSellers.push(k);
  }

  // products
  const products: unknown[][] = [];
  const productCat: number[] = [];
  for (let k = 1; k <= 3000; k++) {
    const c = pick(CATEGORIES.map((_, i) => i), CATEGORIES.map((c) => c[2]));
    products.push([k, hex(), CATEGORIES[c][0], CATEGORIES[c][1]]);
    productCat[k] = c;
  }

  const customers: unknown[][] = [];
  const orders: unknown[][] = [];
  const items: unknown[][] = [];
  const reviews: unknown[][] = [];
  const payments: unknown[][] = [];
  const repeatPool: { uid: string; state: string; city: string }[] = [];
  const scale = ORDERS / MONTHS.reduce((a, m) => a + m[2], 0);
  let orderKey = 0, itemKey = 0, reviewKey = 0, paymentKey = 0;

  for (const [y, m, count] of MONTHS) {
    const n = Math.max(1, Math.round(count * scale));
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let j = 0; j < n; j++) {
      orderKey++;
      const purchase = new Date(Date.UTC(y, m - 1, int(1, daysInMonth)));
      const pKey = dateKey(purchase);
      const orderId = hex();

      // customer: a new customer_id per order (like Olist); ~3% are repeat buyers
      let uid: string, state: string, city: string;
      if (repeatPool.length > 50 && r() < 0.03) {
        ({ uid, state, city } = repeatPool[int(0, repeatPool.length - 1)]);
      } else {
        const s = STATES[STATES.indexOf(pick(STATES, STATES.map((x) => x[1])))];
        uid = hex(); state = s[0]; city = s[2][int(0, s[2].length - 1)];
        if (r() < 0.2) repeatPool.push({ uid, state, city });
      }
      customers.push([orderKey, hex(), uid, String(int(10000, 99999)), city, state]);

      const statusIdx = STATUSES.indexOf(pick(STATUSES, STATUS_W));
      const status = STATUSES[statusIdx];
      const statusKey = statusIdx + 1;

      // items (unavailable orders have none; half of canceled have none)
      const nItems = status === "unavailable" || (status === "canceled" && r() < 0.5) ? 0 : r() < 0.9 ? 1 : r() < 0.75 ? 2 : int(3, 5);
      const seller = activeSellers[int(0, activeSellers.length - 1)];
      const shipped = status === "delivered" || status === "shipped";
      let sales = 0, freight = 0;
      for (let i = 1; i <= nItems; i++) {
        itemKey++;
        const product = int(1, 3000);
        const price = money(Math.max(5, CATEGORIES[productCat[product]][3] * Math.exp(normal() * 0.55 - 0.15)));
        const fr = money(Math.max(3, 12 + exp(9)));
        sales += price; freight += fr;
        const onTime = shipped ? (r() < 0.9 ? 1 : 0) : null;
        items.push([itemKey, orderId, i, pKey, orderKey, i > 1 && r() < 0.3 ? activeSellers[int(0, activeSellers.length - 1)] : seller,
          product, statusKey, price, fr, 1, onTime]);
      }

      // delivery
      let deliveryDays: number | null = null, late: number | null = null;
      if (status === "delivered") {
        deliveryDays = money(1.5 + exp(3.4) + exp(3.4) + exp(3.4) + (state === "SP" ? 0 : 3));
        const estimate = int(15, 32);
        late = deliveryDays > estimate ? 1 : 0;
      }
      const total = money(sales + freight);
      orders.push([orderKey, orderId, pKey, orderKey, statusKey, money(sales), money(freight), total, 1, deliveryDays, late]);

      // payments (all statuses)
      if (total > 0 || status === "canceled") {
        const amount = total > 0 ? total : money(50 + exp(80));
        const type = pick([1, 2, 3, 4], [0.74, 0.19, 0.055, 0.015]);
        if (type === 3 && r() < 0.4) {
          const v = money(amount * 0.3);
          payments.push([++paymentKey, orderId, pKey, orderKey, 3, 1, 1, v]);
          payments.push([++paymentKey, orderId, pKey, orderKey, 1, 2, int(1, 6), money(amount - v)]);
        } else {
          payments.push([++paymentKey, orderId, pKey, orderKey, type, 1, type === 1 ? pick([1, 2, 3, 4, 5, 6, 8, 10], [0.5, 0.12, 0.1, 0.07, 0.06, 0.05, 0.05, 0.05]) : 1, amount]);
        }
      }

      // reviews (~99%); score falls with delivery time and lateness
      if (r() < 0.99) {
        let s: number;
        if (deliveryDays === null) s = r() < 0.7 ? 1 : int(2, 3);
        else s = 4.55 - 0.035 * Math.max(0, deliveryDays - 8) - (late ? 2.1 : 0) + normal() * 1.0;
        const score = Math.min(5, Math.max(1, Math.round(s)));
        const rd = new Date(purchase);
        rd.setUTCDate(rd.getUTCDate() + Math.ceil(deliveryDays ?? 14) + 1);
        const rKey = Math.min(dateKey(rd), 20181231);
        // ~1%: an older, superseded review of the same order (M08 must keep the latest)
        if (r() < 0.01) {
          const old = new Date(purchase);
          old.setUTCDate(old.getUTCDate() + 2);
          reviews.push([++reviewKey, hex(), orderId, dateKey(old), orderKey, int(1, 5), 1]);
        }
        reviews.push([++reviewKey, hex(), orderId, rKey, orderKey, score, 1]);
      }
    }
  }

  return {
    dim_date: dates,
    dim_customer: customers,
    dim_seller: sellers,
    dim_product: products,
    dim_order_status: STATUSES.map((s, i) => [i + 1, s]),
    dim_payment_method: PAYMENT_TYPES.map((p, i) => [i + 1, p]),
    dim_review_score: [1, 2, 3, 4, 5].map((s) => [s, s]),
    fact_order: orders,
    fact_order_item: items,
    fact_review: reviews,
    fact_payment: payments,
  };
}

function literal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function build(): Promise<PGlite> {
  const started = Date.now();
  const db = new PGlite();
  await db.exec(DDL);
  for (const [table, rows] of Object.entries(generate())) {
    for (let i = 0; i < rows.length; i += 2000) {
      const chunk = rows.slice(i, i + 2000);
      await db.exec(`INSERT INTO ${table} VALUES ${chunk.map((row) => `(${row.map(literal).join(",")})`).join(",")};`);
    }
  }
  await db.exec("ANALYZE;");
  await db.exec(MOCK_BASE_SQL);
  for (const v of MOCK_VIEWS) await db.exec(v.sql);
  console.log(`[olytics] mock warehouse ready (${ORDERS} orders, ${process.env.MOCK_VIEWS === "current" ? "current" : "target"} views) in ${Date.now() - started} ms`);
  return db;
}

// One instance per server process, shared across hot reloads.
const g = globalThis as { __olyticsMockDb?: Promise<PGlite> };

export function mockDb(): Promise<PGlite> {
  if (!g.__olyticsMockDb) {
    g.__olyticsMockDb = build().catch((e) => {
      g.__olyticsMockDb = undefined;
      throw e;
    });
  }
  return g.__olyticsMockDb;
}

import type { RegionId } from "./regions";

export type Filters = {
  year: number | null; // null = all years
  month: number | null; // 1–12, only together with a year
  category: string | null;
  region: RegionId | null; // derived from states (lib/regions.ts)
  state: string | null;
};

/** Which filters a page offers — only what its KPI views can be filtered by. */
export type FilterField = "year" | "month" | "category" | "region" | "state";

/** Per card: active filters its view can't apply yet (shown as a warning). */
export type Ignored = Record<string, FilterField[]>;

/** Totals per region, aggregated from per-state view rows. */
export type RegionRow = { region: RegionId; label: string };

export type FilterOptions = { years: number[]; categories: string[]; states: string[] };

/** How a number is displayed. Passed to client charts as a key (functions can't cross the server boundary). */
export type Fmt = "brl" | "int" | "pct" | "days" | "score" | "num";

/** Generic labelled value; null = undefined metric (e.g. divisor was zero). */
export type Point = { label: string; value: number | null };

// ---- one type per role dashboard (sources: dw.v_br01 … v_br14) ----

/** Executive — BR01 (v_br01), BR02 (v_br02_top_states), items/categories from v_br14. */
export type OverviewData = {
  ignored: Ignored;
  revenue: number;
  orders: number;
  items: number;
  customers: number; // v_br11 (year / state; not by month)
  repeatPct: number | null; // v_br11
  avgPrice: number | null;
  avgOrderValue: number | null;
  latest: { label: string; growth: number | null } | null;
  monthly: { label: string; revenue: number; orders: number; growth: number | null }[];
  topCategories: Point[]; // follows the year/month filter (v_br14)
  byState: Point[]; // revenue per customer state — v_br13 (all time), or v_br01 by period once it has customer_state
  byRegion: (RegionRow & { customers: number; revenue: number })[];
  /** v_br01 has customer_state → region/state filters, and state charts follow year/month. */
  areaFilter: boolean;
  /** v_br14 has customer_state too → items and top categories follow region/state. */
  categoriesFollowArea: boolean;
};

/** Finance — BR03 (v_br03, no date / state). */
export type PaymentsData = {
  ignored: Ignored;
  totalPayments: number;
  paymentRecords: number;
  byType: { type: string; count: number; value: number; share: number | null }[];
  salesAllTime: number; // v_br01, for the reconciliation note
};

/** Category management — BR04 / BR14 (v_br14). */
export type CategoriesData = {
  ignored: Ignored;
  revenue: number;
  items: number;
  avgPrice: number | null;
  categories: number;
  rows: { category: string; revenue: number; items: number; orders: number; avgPrice: number | null }[];
  monthly: { label: string; revenue: number; orders: number }[];
};

/** Seller management — BR05 (v_br05), BR06 (v_br06), BR07 (v_br07, no date). State = seller state. */
export type SellersData = {
  ignored: Ignored;
  activeSellers: number;
  revenue: number;
  onTimePct: number | null;
  unknownOrders: number;
  noRevenueSellers: number;
  totalSellers: number;
  rows: { sellerId: string; state: string; revenue: number; items: number; orders: number; onTimePct: number | null; avgReview: number | null }[];
  onTimeByState: Point[];
  noRevenueByState: Point[];
  byRegion: (RegionRow & { onTimePct: number | null; noRevenue: number; revenue: number })[];
};

/** Logistics — BR08 (v_br08), BR09 (v_br09). State = customer state. */
export type DeliveryData = {
  ignored: Ignored;
  avgDays: number | null;
  latePct: number | null;
  delivered: number;
  lateOrders: number;
  maxDays: number | null;
  monthly: { label: string; avgDays: number | null; latePct: number | null }[];
  byState: { state: string; delivered: number; avgDays: number | null; latePct: number | null }[];
  byRegion: (RegionRow & { delivered: number; avgDays: number | null; latePct: number | null })[];
};

/** Customer experience — BR10 (v_br10), BR11 (v_br11, all time), BR12 (v_br12). */
export type CustomersData = {
  ignored: Ignored;
  avgReview: number | null;
  reviews: number;
  repeatPct: number | null;
  customers: number;
  repeatCustomers: number;
  failurePct: number | null;
  cancelPct: number | null;
  unavailablePct: number | null;
  reviewDist: { score: number; count: number; pct: number | null }[];
  monthlyReview: Point[];
  monthlyFailure: Point[];
};

/** Marketing — BR13 (v_br13, no date; state filter), BR14 (v_br14; year + category). */
export type MarketingData = {
  ignored: Ignored;
  customers: number;
  revenue: number;
  orders: number;
  cities: number;
  byState: { state: string; customers: number; revenue: number }[];
  byRegion: (RegionRow & { customers: number; revenue: number })[];
  topCities: { city: string; state: string; customers: number; orders: number; revenue: number; aov: number | null }[];
  monthly: Point[];
  topCategories: Point[];
};

export type QueryRunResult = {
  engine: "athena" | "redshift";
  ok: boolean;
  elapsedMs: number;
  dataScannedBytes?: number;
  rowCount?: number;
  columns?: string[];
  rows?: unknown[][];
  error?: string;
  simulated?: boolean;
};

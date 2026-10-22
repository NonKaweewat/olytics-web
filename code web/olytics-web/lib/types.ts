export type Filters = {
  year: number | null; // null = all years
  category: string | null;
  state: string | null;
};

export type MonthPoint = { month: number; revenue: number; orders: number };
export type CategoryRow = { category: string; revenue: number; items: number };
export type StateRow = { state: string; orders: number; share: number };
export type DeliveryReviewPoint = { days: number; score: number; orders: number };

export type Kpis = {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  avgFreight: number;
  avgReview: number;
  avgDeliveryDays: number;
  onTimePct: number;
  latePct: number;
};

export type DashboardData = {
  kpis: Kpis;
  prevKpis: Kpis | null; // previous year, only when a year is selected
  monthly: MonthPoint[];
  topCategories: CategoryRow[];
  ordersByState: StateRow[];
  deliveryVsReview: DeliveryReviewPoint[];
  reviewDistribution: { score: number; pct: number }[];
  // Schema has late_flag only (no estimated date), so no "early" bucket.
  deliveryStatus: { onTime: number; late: number };
};

export type FilterOptions = { years: number[]; categories: string[]; states: string[] };

export type QueryRunResult = {
  engine: "athena" | "redshift";
  ok: boolean;
  elapsedMs: number;
  dataScannedBytes?: number;
  rowCount?: number;
  columns?: string[];
  rows?: unknown[][];
  error?: string;
};

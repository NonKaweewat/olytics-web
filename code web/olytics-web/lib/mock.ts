// Mock data used while the real data is not yet in Redshift (DATA_SOURCE=mock).
// Numbers are shaped to look like the UI prototype; they are NOT real Olist results.
import type { DashboardData, FilterOptions, Filters, Kpis } from "./types";

const CATEGORIES: [string, number][] = [
  ["health_beauty", 0.192],
  ["watches_gifts", 0.157],
  ["bed_bath_table", 0.133],
  ["sports_leisure", 0.109],
  ["computers_accessories", 0.085],
  ["furniture_decor", 0.072],
  ["housewares", 0.061],
  ["cool_stuff", 0.054],
  ["auto", 0.049],
  ["toys", 0.044],
  ["garden_tools", 0.044],
];

const STATES: [string, number][] = [
  ["SP", 0.451], ["RJ", 0.19], ["MG", 0.16], ["RS", 0.111], ["PR", 0.088],
];

// [revenue, orders] for a full year with no other filters
const YEAR_BASE: Record<number, [number, number]> = {
  2016: [49_785, 329],
  2017: [12_990_000, 85_830],
  2018: [15_420_000, 96_478],
};

const MONTH_SHAPE = [0.62, 0.7, 0.8, 0.74, 0.86, 0.95, 0.82, 0.9, 1.04, 0.92, 0.98, 1.12];

function rng(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scale(f: Filters): number {
  const cat = f.category ? CATEGORIES.find(([c]) => c === f.category)?.[1] ?? 0.03 : 1;
  const st = f.state ? STATES.find(([s]) => s === f.state)?.[1] ?? 0.02 : 1;
  return cat * st;
}

function kpisFor(f: Filters): Kpis {
  const years = f.year ? [f.year] : Object.keys(YEAR_BASE).map(Number);
  let revenue = 0;
  let orders = 0;
  for (const y of years) {
    const base = YEAR_BASE[y];
    if (!base) continue;
    revenue += base[0];
    orders += base[1];
  }
  const s = scale(f);
  const r = rng(JSON.stringify(f));
  revenue *= s;
  orders = Math.round(orders * s);
  return {
    revenue,
    orders,
    avgOrderValue: orders ? revenue / orders : 0,
    avgFreight: 21.5 + r() * 2.5,
    avgReview: 4.0 + r() * 0.15,
    avgDeliveryDays: 11.5 + r() * 2,
    onTimePct: 90 + r() * 3,
    latePct: 0, // filled below
  };
}

export function mockDashboard(f: Filters): DashboardData {
  const kpis = kpisFor(f);
  kpis.latePct = 100 - kpis.onTimePct;
  const prevKpis = f.year && YEAR_BASE[f.year - 1] ? kpisFor({ ...f, year: f.year - 1 }) : null;
  if (prevKpis) prevKpis.latePct = 100 - prevKpis.onTimePct;

  const r = rng("m" + JSON.stringify(f));
  const shapeSum = MONTH_SHAPE.reduce((a, b) => a + b, 0);
  const monthly = MONTH_SHAPE.map((m, i) => {
    const w = (m * (0.92 + r() * 0.16)) / shapeSum;
    return { month: i + 1, revenue: kpis.revenue * w, orders: Math.round(kpis.orders * w) };
  });

  const cats = f.category ? CATEGORIES.filter(([c]) => c === f.category) : CATEGORIES;
  const catTotal = cats.reduce((a, [, w]) => a + w, 0);
  const topCategories = cats
    .map(([category, w]) => ({
      category,
      revenue: (kpis.revenue * w) / catTotal,
      items: Math.round(((kpis.orders * 1.14 * w) / catTotal) * (0.9 + r() * 0.2)),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const sts = f.state ? STATES.filter(([s]) => s === f.state) : STATES;
  const ordersByState = sts.map(([state, w]) => ({
    state,
    orders: Math.round(kpis.orders * w),
    share: f.state ? 100 : w * 100,
  }));

  const deliveryVsReview = Array.from({ length: 220 }, () => {
    const days = Math.round(r() * 90);
    const score = Math.max(1, Math.min(5, 4.7 - days * 0.022 + (r() - 0.5) * 1.3));
    return { days, score: Math.round(score * 100) / 100, orders: 1 };
  });

  return {
    kpis,
    prevKpis,
    monthly,
    topCategories,
    ordersByState,
    deliveryVsReview,
    reviewDistribution: [
      { score: 1, pct: 3.8 },
      { score: 2, pct: 7.2 },
      { score: 3, pct: 16.1 },
      { score: 4, pct: 32.9 },
      { score: 5, pct: 39.9 },
    ],
    deliveryStatus: { onTime: kpis.onTimePct, late: kpis.latePct },
  };
}

export function mockFilterOptions(): FilterOptions {
  return {
    years: [2018, 2017, 2016],
    categories: CATEGORIES.map(([c]) => c),
    states: STATES.map(([s]) => s),
  };
}

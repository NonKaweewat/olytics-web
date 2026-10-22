import "server-only";
import { mockDashboard, mockFilterOptions } from "./mock";
import { rsDashboard, rsFilterOptions, rsPing } from "./queries";
import type { DashboardData, FilterOptions, Filters } from "./types";

export function dataSource(): "mock" | "redshift" {
  return process.env.DATA_SOURCE === "redshift" ? "redshift" : "mock";
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const year = Number(one(sp.year));
  const category = one(sp.category);
  const state = one(sp.state);
  return {
    year: Number.isInteger(year) && year > 2000 ? year : null,
    category: category && category !== "all" ? category : null,
    state: state && state !== "all" ? state : null,
  };
}

export async function getDashboard(f: Filters): Promise<DashboardData> {
  return dataSource() === "redshift" ? rsDashboard(f) : mockDashboard(f);
}

export async function getFilterOptions(): Promise<FilterOptions> {
  return dataSource() === "redshift" ? rsFilterOptions() : mockFilterOptions();
}

export async function health(): Promise<{ source: string; ok: boolean; error?: string; latencyMs: number }> {
  const start = Date.now();
  if (dataSource() === "mock") return { source: "mock", ok: true, latencyMs: 0 };
  try {
    await rsPing();
    return { source: "redshift", ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { source: "redshift", ok: false, error: (e as Error).message, latencyMs: Date.now() - start };
  }
}

import "server-only";
import { getDashboard, getFilterOptions, parseFilters } from "./data";
import type { DashboardData, FilterOptions } from "./types";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const EMPTY_OPTIONS: FilterOptions = { years: [], categories: [], states: [] };

/** Load everything a dashboard page needs; never throws so the page can show ErrorState. */
export async function loadPage(searchParams: SearchParams): Promise<{
  data: DashboardData | null;
  options: FilterOptions;
  error: string | null;
}> {
  const f = parseFilters(await searchParams);
  try {
    const [data, options] = await Promise.all([getDashboard(f), getFilterOptions()]);
    return { data, options, error: null };
  } catch (e) {
    console.error("[olytics] data load failed:", e);
    return { data: null, options: EMPTY_OPTIONS, error: (e as Error).message };
  }
}

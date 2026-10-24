import "server-only";
import { filterOptions, parseFilters } from "./metrics/filters";
import type { FilterOptions, Filters } from "./types";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const EMPTY_OPTIONS: FilterOptions = { years: [], categories: [], states: [] };

/** Load a dashboard's data and the filter options; never throws so the page can show ErrorState. */
export async function loadPage<T>(
  searchParams: SearchParams,
  loader: (f: Filters) => Promise<T>,
): Promise<{ data: T | null; options: FilterOptions; filters: Filters; error: string | null }> {
  const filters = parseFilters(await searchParams);
  try {
    const [data, options] = await Promise.all([loader(filters), filterOptions()]);
    return { data, options, filters, error: null };
  } catch (e) {
    console.error("[olytics] data load failed:", e);
    return { data: null, options: EMPTY_OPTIONS, filters, error: (e as Error).message };
  }
}

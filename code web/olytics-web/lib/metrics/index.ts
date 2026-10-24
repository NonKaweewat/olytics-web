import "server-only";
import type { PageId } from "../roles";
import type { Filters } from "../types";
import { categories } from "./categories";
import { customers } from "./customers";
import { delivery } from "./delivery";
import { marketing } from "./marketing";
import { overview } from "./overview";
import { payments } from "./payments";
import { sellers } from "./sellers";

/** Data loader per dashboard page (used by the pages and by /api/data/[page]). */
export const LOADERS = {
  overview,
  payments,
  categories,
  sellers,
  delivery,
  customers,
  marketing,
} satisfies Partial<Record<PageId, (f: Filters) => Promise<unknown>>>;

export type DashboardPage = keyof typeof LOADERS;

export function isDashboardPage(v: string): v is DashboardPage {
  return Object.hasOwn(LOADERS, v);
}

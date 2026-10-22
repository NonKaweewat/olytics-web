export function brl(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`;
  return `R$ ${n.toFixed(2)}`;
}

export function int(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

/** Percent change vs previous value, e.g. "+18.7% vs previous year". */
export function delta(curr: number, prev: number | undefined): string | null {
  if (prev === undefined || prev === 0) return null;
  const d = ((curr - prev) / prev) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}% vs previous year`;
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Olist categories are snake_case (often Portuguese) — make them readable. */
export function prettyCategory(c: string): string {
  return c
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

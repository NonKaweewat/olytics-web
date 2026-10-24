import type { Fmt } from "./types";

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

/** Display a metric value; null (undefined metric, e.g. divisor 0) shows as "—". */
export function fmtValue(v: number | null | undefined, f: Fmt): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  switch (f) {
    case "brl":
      return brl(v);
    case "int":
      return int(v);
    case "pct":
      return pct(v);
    case "days":
      return `${v.toFixed(1)} days`; // M11: 1 decimal
    case "score":
      return v.toFixed(2);
    default:
      return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
}

/** Short axis labels: R$1.2M, 12K, 35%. */
export function fmtAxis(v: number, f: Fmt): string {
  const compact = (n: number) =>
    Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : Math.abs(n) >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : `${Math.round(n * 10) / 10}`;
  if (f === "brl") return `R$${compact(v)}`;
  if (f === "pct") return `${Math.round(v)}%`;
  return compact(v);
}

/** Signed percent, e.g. "+12.4%". */
export function signedPct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

/** Olist categories are snake_case (often Portuguese) — make them readable. */
export function prettyCategory(c: string): string {
  return c.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

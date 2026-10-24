"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { prettyCategory } from "@/lib/format";
import { isRegion, REGIONS } from "@/lib/regions";
import type { FilterField, FilterOptions } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Only the filters a page's KPI views support are shown (`fields`). */
export default function FilterBar({
  options,
  fields,
  stateLabel = "All States",
}: {
  options: FilterOptions;
  fields: FilterField[];
  stateLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const year = sp.get("year");
  const region = sp.get("region");
  const regionStates: readonly string[] | null = isRegion(region) ? REGIONS[region].states : null;
  const states = regionStates ? options.states.filter((s) => regionStates.includes(s)) : options.states;

  function set(changes: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "all") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function setRegion(value: string) {
    const st = sp.get("state");
    // keep the state only if it is inside the new region
    const keep = value === "all" || (isRegion(value) && st !== null && (REGIONS[value].states as readonly string[]).includes(st));
    set({ region: value, state: keep ? st : null });
  }

  return (
    <div className="filters" style={{ opacity: pending ? 0.6 : 1 }}>
      {fields.includes("year") && (
        // a month only makes sense inside a year, so clearing the year clears the month
        <select aria-label="Year" value={year ?? "all"} onChange={(e) => set({ year: e.target.value, ...(e.target.value === "all" ? { month: null } : {}) })}>
          <option value="all">All Years</option>
          {options.years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      )}
      {fields.includes("month") && (
        <select
          aria-label="Month"
          value={year ? (sp.get("month") ?? "all") : "all"}
          disabled={!year}
          title={year ? undefined : "เลือกปีก่อน"}
          onChange={(e) => set({ month: e.target.value })}
        >
          <option value="all">{year ? "All Months" : "Month (เลือกปีก่อน)"}</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      )}
      {fields.includes("category") && (
        <select aria-label="Category" value={sp.get("category") ?? "all"} onChange={(e) => set({ category: e.target.value })}>
          <option value="all">All Categories</option>
          {options.categories.map((c) => (
            <option key={c} value={c}>{prettyCategory(c)}</option>
          ))}
        </select>
      )}
      {fields.includes("region") && (
        <select aria-label="Region" value={isRegion(region) ? region : "all"} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">All Regions</option>
          {Object.entries(REGIONS).map(([id, r]) => (
            <option key={id} value={id}>{r.label}</option>
          ))}
        </select>
      )}
      {fields.includes("state") && (
        <select aria-label="State" value={sp.get("state") ?? "all"} onChange={(e) => set({ state: e.target.value })}>
          <option value="all">{stateLabel}</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
    </div>
  );
}

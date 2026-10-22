"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { prettyCategory } from "@/lib/format";
import type { FilterOptions } from "@/lib/types";

export default function FilterBar({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div className="filters" style={{ opacity: pending ? 0.6 : 1 }}>
      <select aria-label="Year" value={sp.get("year") ?? "all"} onChange={(e) => set("year", e.target.value)}>
        <option value="all">All Years</option>
        {options.years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <select aria-label="Category" value={sp.get("category") ?? "all"} onChange={(e) => set("category", e.target.value)}>
        <option value="all">All Categories</option>
        {options.categories.map((c) => (
          <option key={c} value={c}>{prettyCategory(c)}</option>
        ))}
      </select>
      <select aria-label="State" value={sp.get("state") ?? "all"} onChange={(e) => set("state", e.target.value)}>
        <option value="all">All States</option>
        {options.states.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}

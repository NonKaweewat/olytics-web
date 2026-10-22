import { Suspense } from "react";
import FilterBar from "./FilterBar";
import type { FilterOptions } from "@/lib/types";

export default function PageHeader({
  title,
  subtitle,
  options,
}: {
  title: string;
  subtitle: string;
  options?: FilterOptions;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {options && (
        <Suspense>
          <FilterBar options={options} />
        </Suspense>
      )}
    </div>
  );
}

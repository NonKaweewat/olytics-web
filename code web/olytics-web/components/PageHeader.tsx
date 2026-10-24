import { Suspense } from "react";
import FilterBar from "./FilterBar";
import type { FilterField, FilterOptions } from "@/lib/types";

export default function PageHeader({
  title,
  subtitle,
  options,
  fields = [],
  stateLabel,
}: {
  title: string;
  subtitle: string;
  options?: FilterOptions;
  /** Filters this page's KPI views support. */
  fields?: FilterField[];
  stateLabel?: string;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {options && fields.length > 0 && (
        <Suspense>
          <FilterBar options={options} fields={fields} stateLabel={stateLabel} />
        </Suspense>
      )}
    </div>
  );
}

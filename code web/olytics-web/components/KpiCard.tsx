import type { ReactNode } from "react";

export default function KpiCard({
  label,
  value,
  delta,
  icon,
  tone = "lime",
  invertDelta = false,
}: {
  label: string;
  value: string;
  delta?: string | null;
  icon: ReactNode;
  tone?: "lime" | "purple";
  /** For metrics where going down is good, e.g. freight cost. */
  invertDelta?: boolean;
}) {
  const bad = delta ? delta.startsWith("-") !== invertDelta : false;
  return (
    <div className="card kpi">
      <div>
        <div className="label">{label}</div>
        <div className="value">{value}</div>
        {delta && <div className={`delta${bad ? " neg" : ""}`}>{delta}</div>}
      </div>
      <div className={`icon ${tone}`}>{icon}</div>
    </div>
  );
}

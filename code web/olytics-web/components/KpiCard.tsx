import type { ReactNode } from "react";

export default function KpiCard({
  label,
  value,
  metric,
  sub,
  subTone = "muted",
  icon,
  tone = "lime",
}: {
  label: string;
  value: string;
  /** Metric id from the design document, e.g. "M01". */
  metric?: string;
  sub?: string | null;
  subTone?: "good" | "bad" | "muted";
  icon: ReactNode;
  tone?: "lime" | "purple";
}) {
  return (
    <div className="card kpi">
      <div>
        <div className="label">
          {label} {metric && <span className="metric">{metric}</span>}
        </div>
        <div className="value">{value}</div>
        {sub && <div className={`delta ${subTone}`}>{sub}</div>}
      </div>
      <div className={`icon ${tone}`}>{icon}</div>
    </div>
  );
}

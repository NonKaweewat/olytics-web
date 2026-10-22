"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { MONTHS, brl, int, prettyCategory } from "@/lib/format";
import type { CategoryRow, DeliveryReviewPoint, MonthPoint, StateRow } from "@/lib/types";

const LIME = "#c6f46b";
const PURPLE = "#6d3fe0";
const PURPLE_2 = "#8b5cf6";
const GRID = "#1b2740";
const AXIS = { fill: "#8a97ad", fontSize: 11 };
const TOOLTIP = {
  contentStyle: { background: "#0f1a2e", border: "1px solid #1b2740", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#f3f6fb" },
  itemStyle: { color: "#f3f6fb" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

function compactBrl(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}K`;
  return `R$${v}`;
}

function Empty() {
  return <div className="muted" style={{ padding: 30, textAlign: "center" }}>No data for this filter</div>;
}

export function RevenueArea({ data }: { data: MonthPoint[] }) {
  if (!data.length) return <Empty />;
  const rows = data.map((d) => ({ ...d, name: MONTHS[d.month - 1] }));
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PURPLE_2} stopOpacity={0.75} />
              <stop offset="100%" stopColor={PURPLE} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compactBrl} width={58} />
          <Tooltip {...TOOLTIP} formatter={(v: number) => [brl(v), "Revenue"]} />
          <Area isAnimationActive={false}
            type="linear" dataKey="revenue" stroke={PURPLE_2} strokeWidth={2} fill="url(#revFill)"
            dot={{ r: 3.5, fill: "#d9ccff", stroke: PURPLE_2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersBar({ data }: { data: MonthPoint[] }) {
  if (!data.length) return <Empty />;
  const rows = data.map((d) => ({ ...d, name: MONTHS[d.month - 1] }));
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis
            tick={AXIS} axisLine={false} tickLine={false} width={44}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
          />
          <Tooltip {...TOOLTIP} formatter={(v: number) => [int(v), "Orders"]} />
          <Bar isAnimationActive={false} dataKey="orders" fill={LIME} radius={[3, 3, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBar({ data }: { data: CategoryRow[] }) {
  if (!data.length) return <Empty />;
  const rows = data.slice(0, 5).map((d) => ({ ...d, name: prettyCategory(d.category) }));
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 70, left: 10, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compactBrl} />
          <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={130} />
          <Tooltip {...TOOLTIP} formatter={(v: number) => [brl(v), "Revenue"]} />
          <Bar isAnimationActive={false} dataKey="revenue" fill={LIME} barSize={14}>
            <LabelList dataKey="revenue" position="right" formatter={(v: number) => brl(v)} fill="#f3f6fb" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Weighted least-squares fit: review score vs delivery days. */
function trend(points: DeliveryReviewPoint[]) {
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of points) {
    const w = p.orders || 1;
    sw += w; sx += w * p.days; sy += w * p.score; sxx += w * p.days * p.days; sxy += w * p.days * p.score;
  }
  const den = sw * sxx - sx * sx;
  if (!sw || !den) return null;
  const slope = (sw * sxy - sx * sy) / den;
  const intercept = (sy - slope * sx) / sw;
  return { slope, intercept };
}

export function DeliveryScatter({ data, tall = false }: { data: DeliveryReviewPoint[]; tall?: boolean }) {
  if (!data.length) return <Empty />;
  const t = trend(data);
  const maxX = Math.max(...data.map((d) => d.days));
  const line = t ? [0, maxX].map((x) => ({ days: x, score: t.intercept + t.slope * x })) : [];
  return (
    <div className={`chart-box${tall ? " tall" : ""}`}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 14 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number" dataKey="days" name="Delivery days" tick={AXIS} axisLine={false} tickLine={false}
            label={{ value: "Delivery days", position: "insideBottom", offset: -8, fill: "#8a97ad", fontSize: 11 }}
          />
          <YAxis
            type="number" dataKey="score" name="Review score" domain={[1, 5]} tick={AXIS} axisLine={false}
            tickLine={false} width={40}
            label={{ value: "Review score", angle: -90, position: "insideLeft", offset: 12, fill: "#8a97ad", fontSize: 11 }}
          />
          <ZAxis range={[22, 22]} />
          <Tooltip {...TOOLTIP} formatter={(v: number, n: string) => [n === "Review score" ? v.toFixed(2) : v, n]} />
          <Scatter data={data} fill={PURPLE_2} fillOpacity={0.85} shape="circle" isAnimationActive={false} />
          {t && (
            <Scatter data={line} line={{ stroke: LIME, strokeWidth: 2.5 }} shape={() => <g />} legendType="none" isAnimationActive={false} />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReviewDistBar({ data }: { data: { score: number; pct: number }[] }) {
  if (!data.length) return <Empty />;
  const rows = data.map((d) => ({ ...d, name: `${d.score} Star${d.score > 1 ? "s" : ""}` }));
  return (
    <div className="chart-box" style={{ height: 190 }}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 18, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PURPLE_2} />
              <stop offset="100%" stopColor={PURPLE} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip {...TOOLTIP} formatter={(v: number) => [`${v.toFixed(1)}%`, "Share of reviews"]} />
          <Bar isAnimationActive={false} dataKey="pct" fill="url(#revBar)" maxBarSize={34}>
            <LabelList dataKey="pct" position="top" formatter={(v: number) => `${v.toFixed(1)}%`} fill="#f3f6fb" fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DeliveryDonut({ data }: { data: { onTime: number; late: number } }) {
  const rows = [
    { name: "On time", value: data.onTime, color: LIME },
    { name: "Late", value: data.late, color: PURPLE },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <div style={{ width: 150, height: 150 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie isAnimationActive={false} data={rows} dataKey="value" innerRadius={44} outerRadius={70} startAngle={90} endAngle={-270} stroke="none">
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
            </Pie>
            <Tooltip {...TOOLTIP} formatter={(v: number) => `${v.toFixed(1)}%`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend" style={{ flex: 1, minWidth: 150 }}>
        {rows.map((r) => (
          <li key={r.name} style={{ gridTemplateColumns: "14px 1fr auto" }}>
            <span className="dot" style={{ background: r.color }} />
            <span>{r.name}</span>
            <span>{r.value.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Approximate centroids (lon, lat) of Brazilian states for the bubble map.
const STATE_POS: Record<string, [number, number]> = {
  AC: [-70.5, -9.0], AL: [-36.6, -9.6], AP: [-51.8, 1.4], AM: [-64.6, -4.2], BA: [-41.7, -12.5],
  CE: [-39.5, -5.2], DF: [-47.9, -15.8], ES: [-40.3, -19.6], GO: [-49.6, -16.0], MA: [-45.3, -5.0],
  MT: [-55.9, -12.6], MS: [-54.5, -20.5], MG: [-44.6, -18.5], PA: [-52.3, -4.0], PB: [-36.8, -7.1],
  PR: [-51.6, -24.6], PE: [-37.9, -8.3], PI: [-42.7, -7.7], RJ: [-42.7, -22.2], RN: [-36.5, -5.8],
  RS: [-53.3, -29.7], RO: [-62.8, -10.9], RR: [-61.4, 2.1], SC: [-50.5, -27.2], SP: [-48.6, -22.2],
  SE: [-37.4, -10.6], TO: [-48.3, -10.2],
};

export function StateMap({ data }: { data: StateRow[] }) {
  const W = 200, H = 190;
  const px = ([lon, lat]: [number, number]) => [((lon + 74) / 40) * W, ((5 - lat) / 39) * H];
  const max = Math.max(1, ...data.map((d) => d.orders));
  const byState = new Map(data.map((d) => [d.state, d]));
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="200" height="190" role="img" aria-label="Orders by state map">
        {Object.entries(STATE_POS).map(([s, pos]) => {
          const [x, y] = px(pos);
          const d = byState.get(s);
          return d ? null : <circle key={s} cx={x} cy={y} r={4} fill="#22304a" />;
        })}
        {data.map((d) => {
          const pos = STATE_POS[d.state];
          if (!pos) return null;
          const [x, y] = px(pos);
          return (
            <circle key={d.state} cx={x} cy={y} r={5 + 9 * Math.sqrt(d.orders / max)} fill={LIME} stroke="#060b16" strokeWidth={1.5}>
              <title>{`${d.state}: ${int(d.orders)} orders`}</title>
            </circle>
          );
        })}
      </svg>
      <ul className="legend" style={{ flex: 1, minWidth: 170 }}>
        {data.map((d) => (
          <li key={d.state}>
            <span className="dot" style={{ background: LIME }} />
            <span>{d.state}</span>
            <span>{int(d.orders)}</span>
            <span className="pct">{d.share.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

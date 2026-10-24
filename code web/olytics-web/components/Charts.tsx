"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtAxis, fmtValue, int, prettyCategory } from "@/lib/format";
import type { Fmt, Point } from "@/lib/types";

// Charts take data plus a format key (Fmt) — formatter functions cannot be
// passed from server components.

const LIME = "#c6f46b";
const PURPLE = "#6d3fe0";
const PURPLE_2 = "#8b5cf6";
const ORANGE = "#ffb36b";
const PALETTE = [LIME, PURPLE_2, "#4f8de0", ORANGE, "#5ad1c1", "#e879a6"];
const GRID = "#1b2740";
const AXIS = { fill: "#8a97ad", fontSize: 11 };
const TOOLTIP = {
  contentStyle: { background: "#0f1a2e", border: "1px solid #1b2740", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#f3f6fb" },
  itemStyle: { color: "#f3f6fb" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

function Empty() {
  return <div className="muted" style={{ padding: 30, textAlign: "center" }}>No data for this filter</div>;
}

type SeriesProps = { data: Point[]; fmt: Fmt; name: string; height?: number };

/** Monthly trend as a filled area (purple, like the prototype). */
export function TrendArea({ data, fmt, name, height }: SeriesProps) {
  if (!data.length) return <Empty />;
  return (
    <div className="chart-box" style={height ? { height } : undefined}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PURPLE_2} stopOpacity={0.75} />
              <stop offset="100%" stopColor={PURPLE} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={14} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtAxis(v, fmt)} width={58} />
          <Tooltip {...TOOLTIP} formatter={(v: number) => [fmtValue(v, fmt), name]} />
          <Area
            isAnimationActive={false} type="linear" dataKey="value" stroke={PURPLE_2} strokeWidth={2}
            fill="url(#areaFill)" dot={data.length <= 14 ? { r: 3.5, fill: "#d9ccff", stroke: PURPLE_2 } : false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Monthly bars. `signed` colours negative values orange (e.g. M17 growth);
 * `clip` caps the axis so a few extreme months don't flatten the rest
 * (the tooltip still shows the real value).
 */
export function TrendBar({ data, fmt, name, height, signed = false, clip }: SeriesProps & { signed?: boolean; clip?: [number, number] }) {
  if (!data.length) return <Empty />;
  return (
    <div className="chart-box" style={height ? { height } : undefined}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={14} />
          <YAxis
            tick={AXIS} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => fmtAxis(v, fmt)}
            domain={clip ?? [0, "auto"]} allowDataOverflow={Boolean(clip)}
          />
          <Tooltip {...TOOLTIP} formatter={(v: number) => [fmtValue(v, fmt), name]} />
          {signed && <ReferenceLine y={0} stroke="#3a4a66" />}
          <Bar isAnimationActive={false} dataKey="value" fill={LIME} radius={[3, 3, 0, 0]} maxBarSize={22}>
            {signed && data.map((d) => <Cell key={d.label} fill={(d.value ?? 0) < 0 ? ORANGE : LIME} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Monthly line (rates and averages). */
export function TrendLine({ data, fmt, name, height, domain }: SeriesProps & { domain?: [number, number] }) {
  if (!data.length) return <Empty />;
  return (
    <div className="chart-box" style={height ? { height } : undefined}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={14} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} domain={domain ?? ["auto", "auto"]} tickFormatter={(v: number) => fmtAxis(v, fmt)} />
          <Tooltip {...TOOLTIP} formatter={(v: number) => [fmtValue(v, fmt), name]} />
          <Line isAnimationActive={false} type="linear" dataKey="value" stroke={LIME} strokeWidth={2} dot={data.length <= 14} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal ranking bars with value labels. */
export function HBar({ data, fmt, name, height, categories = false }: SeriesProps & { categories?: boolean }) {
  if (!data.length) return <Empty />;
  const rows = data.map((d) => ({ ...d, label: categories ? prettyCategory(d.label) : d.label }));
  return (
    <div className="chart-box" style={{ height: height ?? Math.max(160, rows.length * 34 + 30) }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 78, left: 6, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtAxis(v, fmt)} />
          <YAxis type="category" dataKey="label" tick={AXIS} axisLine={false} tickLine={false} width={categories ? 140 : 44} />
          <Tooltip {...TOOLTIP} formatter={(v: number) => [fmtValue(v, fmt), name]} />
          <Bar isAnimationActive={false} dataKey="value" fill={LIME} barSize={14}>
            <LabelList dataKey="value" position="right" formatter={(v: number) => fmtValue(v, fmt)} fill="#f3f6fb" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut with a legend; `fmt` formats the legend values. */
export function Donut({ data, fmt }: { data: Point[]; fmt: Fmt }) {
  if (!data.length) return <Empty />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <div style={{ width: 160, height: 160 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="label" innerRadius={46} outerRadius={74} startAngle={90} endAngle={-270} stroke="none">
              {data.map((d, i) => <Cell key={d.label} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip {...TOOLTIP} formatter={(v: number) => fmtValue(v, fmt)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend" style={{ flex: 1, minWidth: 160 }}>
        {data.map((d, i) => (
          <li key={d.label} style={{ gridTemplateColumns: "14px 1fr auto" }}>
            <span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span>{d.label}</span>
            <span>{fmtValue(d.value, fmt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Share of reviews per score (BR10). */
export function ReviewDistBar({ data }: { data: { score: number; count: number; pct: number | null }[] }) {
  if (!data.length) return <Empty />;
  const rows = data.map((d) => ({ ...d, name: `${d.score} ★` }));
  return (
    <div className="chart-box" style={{ height: 210 }}>
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
          <Tooltip {...TOOLTIP} formatter={(v: number, n: string) => (n === "pct" ? [`${v.toFixed(1)}%`, "Share"] : [int(v), "Reviews"])} />
          <Bar isAnimationActive={false} dataKey="pct" fill="url(#revBar)" maxBarSize={36}>
            <LabelList dataKey="pct" position="top" formatter={(v: number) => `${v.toFixed(1)}%`} fill="#f3f6fb" fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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

/** Bubble map of Brazil; legend lists the top 5 with their share of the total. */
export function StateMap({ data, fmt, name }: { data: Point[]; fmt: Fmt; name: string }) {
  if (!data.length) return <Empty />;
  const W = 200, H = 190;
  const px = ([lon, lat]: [number, number]) => [((lon + 74) / 40) * W, ((5 - lat) / 39) * H];
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  const total = data.reduce((a, d) => a + (d.value ?? 0), 0) || 1;
  const has = new Set(data.map((d) => d.label));
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="200" height="190" role="img" aria-label={`${name} by state`}>
        {Object.entries(STATE_POS).map(([s, pos]) => {
          const [x, y] = px(pos);
          return has.has(s) ? null : <circle key={s} cx={x} cy={y} r={4} fill="#22304a" />;
        })}
        {data.map((d) => {
          const pos = STATE_POS[d.label];
          if (!pos) return null;
          const [x, y] = px(pos);
          return (
            <circle key={d.label} cx={x} cy={y} r={3 + 10 * Math.sqrt((d.value ?? 0) / max)} fill={LIME} fillOpacity={0.9} stroke="#060b16" strokeWidth={1.2}>
              <title>{`${d.label}: ${fmtValue(d.value, fmt)}`}</title>
            </circle>
          );
        })}
      </svg>
      <ul className="legend" style={{ flex: 1, minWidth: 190 }}>
        {data.slice(0, 5).map((d) => (
          <li key={d.label}>
            <span className="dot" style={{ background: LIME }} />
            <span>{d.label}</span>
            <span>{fmtValue(d.value, fmt)}</span>
            <span className="pct">{(((d.value ?? 0) / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

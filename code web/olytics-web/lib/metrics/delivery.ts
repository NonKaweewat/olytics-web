import "server-only";
import { num, numOrNull, query } from "../db";
import { regionShort, type RegionId } from "../regions";
import { scope, union } from "../scope";
import { monthLabel, regionCase } from "../sql";
import type { DeliveryData, FilterField, Filters } from "../types";

// Combining rows: late % = SUM(late_orders) / SUM(total_delivered_orders),
// avg days = SUM(sum_delivery_days) / SUM(total_delivered_orders).
const LATE = "100.0 * SUM(late_orders) / NULLIF(SUM(total_delivered_orders), 0)";
const DAYS = "SUM(sum_delivery_days) / NULLIF(SUM(total_delivered_orders), 0)";
const ALL: FilterField[] = ["year", "month", "region", "state"];
const TREND: FilterField[] = ["year", "region", "state"];

/**
 * Logistics — BR08 BR09. Filters: year, month, region, customer state.
 * The monthly trend shows the whole selected year.
 */
export async function delivery(f: Filters): Promise<DeliveryData> {
  const [l, d, lt, dt] = await Promise.all([
    scope("v_br08_late_delivery", f, { use: ALL }),
    scope("v_br09_delivery_days", f, { use: ALL }),
    scope("v_br08_late_delivery", f, { use: TREND }),
    scope("v_br09_delivery_days", f, { use: TREND }),
  ]);
  const region = regionCase("customer_state");

  const [[lateK], [daysK], lateM, daysM, lateS, daysS, lateR, daysR] = await Promise.all([
    query(`SELECT SUM(total_delivered_orders) AS n, SUM(late_orders) AS late, ${LATE} AS pct FROM ${l.from} ${l.where}`, l.params),
    query(`SELECT ${DAYS} AS days, MAX(max_delivery_days) AS max_days FROM ${d.from} ${d.where}`, d.params),
    query(`SELECT year_number, month_number, ${LATE} AS pct FROM ${lt.from} ${lt.where} GROUP BY 1, 2 ORDER BY 1, 2`, lt.params),
    query(`SELECT year_number, month_number, ${DAYS} AS days FROM ${dt.from} ${dt.where} GROUP BY 1, 2 ORDER BY 1, 2`, dt.params),
    query(`SELECT customer_state, SUM(total_delivered_orders) AS n, ${LATE} AS pct FROM ${l.from} ${l.where} GROUP BY 1`, l.params),
    query(`SELECT customer_state, ${DAYS} AS days FROM ${d.from} ${d.where} GROUP BY 1`, d.params),
    query(`SELECT ${region} AS region, SUM(total_delivered_orders) AS n, ${LATE} AS pct FROM ${l.from} ${l.where} GROUP BY 1`, l.params),
    query(`SELECT ${region} AS region, ${DAYS} AS days FROM ${d.from} ${d.where} GROUP BY 1`, d.params),
  ]);

  const daysByMonth = new Map(daysM.map((r) => [`${r.year_number}-${r.month_number}`, numOrNull(r.days)]));
  const daysByState = new Map(daysS.map((r) => [String(r.customer_state), numOrNull(r.days)]));
  const daysByRegion = new Map(daysR.map((r) => [String(r.region), numOrNull(r.days)]));
  return {
    avgDays: numOrNull(daysK?.days),
    latePct: numOrNull(lateK?.pct),
    delivered: num(lateK?.n),
    lateOrders: num(lateK?.late),
    maxDays: numOrNull(daysK?.max_days),
    monthly: lateM.map((r) => ({
      label: monthLabel(r.year_number, r.month_number),
      latePct: numOrNull(r.pct),
      avgDays: daysByMonth.get(`${r.year_number}-${r.month_number}`) ?? null,
    })),
    byState: lateS
      .map((r) => ({
        state: String(r.customer_state),
        delivered: num(r.n),
        latePct: numOrNull(r.pct),
        avgDays: daysByState.get(String(r.customer_state)) ?? null,
      }))
      .sort((x, y) => y.delivered - x.delivered),
    byRegion: lateR
      .filter((r) => r.region !== "unknown")
      .map((r) => ({
        region: r.region as RegionId,
        label: regionShort(r.region as RegionId),
        delivered: num(r.n),
        latePct: numOrNull(r.pct),
        avgDays: daysByRegion.get(String(r.region)) ?? null,
      }))
      .sort((x, y) => y.delivered - x.delivered),
    ignored: { late: l.ignored, days: d.ignored, all: union(l.ignored, d.ignored), trend: union(lt.ignored, dt.ignored) },
  };
}

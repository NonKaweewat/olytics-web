import "server-only";
import { num, numOrNull, query } from "../db";
import { queryTotals, scope } from "../scope";
import { monthLabel } from "../sql";
import type { CustomersData, FilterField, Filters } from "../types";

const ALL: FilterField[] = ["year", "month", "region", "state"];
const TREND: FilterField[] = ["year", "region", "state"];

/**
 * Customer experience — BR10 BR11 BR12. Filters: year, month, region, customer state.
 * The monthly trends show the whole selected year.
 */
export async function customers(f: Filters): Promise<CustomersData> {
  const [r, rt, x, xt] = await Promise.all([
    scope("v_br10_review_satisfaction", f, { use: ALL }),
    scope("v_br10_review_satisfaction", f, { use: TREND }),
    scope("v_br12_order_failure_rate", f, { use: ALL }),
    scope("v_br12_order_failure_rate", f, { use: TREND }),
  ]);
  const AVG = "SUM(review_score * review_count) * 1.0 / NULLIF(SUM(review_count), 0)";

  const [[rev], dist, monthlyReview, repeat, [fail], monthlyFail] = await Promise.all([
    query(`SELECT ${AVG} AS avg, SUM(review_count) AS n FROM ${r.from} ${r.where}`, r.params),
    query(
      `SELECT review_score, SUM(review_count) AS n, 100.0 * SUM(review_count) / SUM(SUM(review_count)) OVER () AS pct
       FROM ${r.from} ${r.where} GROUP BY review_score ORDER BY review_score`,
      r.params,
    ),
    query(`SELECT year_number, month_number, ${AVG} AS avg FROM ${rt.from} ${rt.where} GROUP BY 1, 2 ORDER BY 1, 2`, rt.params),
    // repeat customers are a distinct count: read the view's total rows (year / state NULL)
    queryTotals("v_br11_repeat_customers", f, { use: ["year", "region", "state"], totals: ["year", "state"] }, (s) =>
      `SELECT SUM(total_customers) AS total_customers, SUM(repeat_customers) AS repeat_customers FROM ${s.from} ${s.where}`),
    query(
      `SELECT 100.0 * SUM(failed_orders) / NULLIF(SUM(total_orders), 0) AS failed,
              100.0 * SUM(canceled_orders) / NULLIF(SUM(total_orders), 0) AS canceled,
              100.0 * SUM(unavailable_orders) / NULLIF(SUM(total_orders), 0) AS unavailable
       FROM ${x.from} ${x.where}`,
      x.params,
    ),
    query(
      `SELECT year_number, month_number, 100.0 * SUM(failed_orders) / NULLIF(SUM(total_orders), 0) AS pct
       FROM ${xt.from} ${xt.where} GROUP BY 1, 2 ORDER BY 1, 2`,
      xt.params,
    ),
  ]);

  const rep = repeat.rows[0];
  const total = num(rep?.total_customers);
  const repeatCount = num(rep?.repeat_customers);
  // v_br11 is yearly at most: a month filter can't apply to it
  const repeatIgnored = [...repeat.scope.ignored, ...(f.month ? (["month"] as FilterField[]) : [])];
  return {
    avgReview: numOrNull(rev?.avg),
    reviews: num(rev?.n),
    repeatPct: total ? (repeatCount / total) * 100 : null,
    customers: total,
    repeatCustomers: repeatCount,
    failurePct: numOrNull(fail?.failed),
    cancelPct: numOrNull(fail?.canceled),
    unavailablePct: numOrNull(fail?.unavailable),
    reviewDist: dist.map((d) => ({ score: num(d.review_score), count: num(d.n), pct: numOrNull(d.pct) })),
    monthlyReview: monthlyReview.map((d) => ({ label: monthLabel(d.year_number, d.month_number), value: numOrNull(d.avg) })),
    monthlyFailure: monthlyFail.map((d) => ({ label: monthLabel(d.year_number, d.month_number), value: numOrNull(d.pct) })),
    ignored: {
      reviews: r.ignored,
      reviewTrend: rt.ignored,
      repeat: repeatIgnored,
      failure: x.ignored,
      failureTrend: xt.ignored,
    },
  };
}

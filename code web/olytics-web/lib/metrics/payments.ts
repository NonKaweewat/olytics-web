import "server-only";
import { num, query } from "../db";
import { scope } from "../scope";
import type { Filters, PaymentsData } from "../types";

/**
 * Finance — BR03. Filters: year, month, region, state — applied as soon as
 * v_br03 has the columns (today it has none, so the page shows all time).
 * The share per type is recomputed from the filtered sums (= payment_percentage unfiltered).
 */
export async function payments(f: Filters): Promise<PaymentsData> {
  const [sp, ss] = await Promise.all([
    scope("v_br03_payment_distribution", f, { use: ["year", "month", "region", "state"] }),
    scope("v_br01_monthly_sales", f, { use: ["year", "month", "region", "state"] }),
  ]);
  const [types, [sales]] = await Promise.all([
    query(
      `SELECT payment_type, SUM(payment_records) AS records, SUM(total_payment) AS total
       FROM ${sp.from} ${sp.where} GROUP BY payment_type ORDER BY 3 DESC`,
      sp.params,
    ),
    query(`SELECT SUM(total_sales) AS total FROM ${ss.from} ${ss.where}`, ss.params),
  ]);
  const total = types.reduce((a, r) => a + num(r.total), 0);
  return {
    totalPayments: total,
    paymentRecords: types.reduce((a, r) => a + num(r.records), 0),
    byType: types.map((r) => ({
      type: String(r.payment_type),
      count: num(r.records),
      value: num(r.total),
      share: total ? (num(r.total) / total) * 100 : null,
    })),
    salesAllTime: num(sales?.total),
    ignored: { payments: sp.ignored, sales: ss.ignored },
  };
}

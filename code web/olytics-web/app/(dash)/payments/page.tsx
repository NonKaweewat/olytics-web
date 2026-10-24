import Card from "@/components/Card";
import { Donut, HBar } from "@/components/Charts";
import DataTable from "@/components/DataTable";
import ErrorState from "@/components/ErrorState";
import { IconCard, IconDollar, IconPercent, IconStar } from "@/components/Icons";
import KpiCard from "@/components/KpiCard";
import KpiNotice from "@/components/KpiNotice";
import PageHeader from "@/components/PageHeader";
import { brl, int, pct, prettyCategory } from "@/lib/format";
import { payments } from "@/lib/metrics/payments";
import { ignoredNote, union } from "@/lib/notes";
import { loadPage, type SearchParams } from "@/lib/page-data";

export const dynamic = "force-dynamic";

/** Finance — BR03. */
export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, options, error } = await loadPage(searchParams, payments);
  const header = (
    <PageHeader
      title="Payments"
      subtitle="มูลค่าการชำระและสัดส่วนแต่ละวิธีชำระเงิน"
      options={options}
      fields={["year", "month", "region", "state"]}
      stateLabel="All Customer States"
    />
  );
  if (!data) return <>{header}<ErrorState message={error ?? "Unknown error"} /></>;

  const top = data.byType[0];
  const types = data.byType.map((t) => ({ ...t, type: prettyCategory(t.type) }));
  const warn = ignoredNote(data.ignored.payments);
  return (
    <>
      {header}
      <KpiNotice ignored={union(data.ignored.payments, data.ignored.sales)} />
      <section className="grid kpis">
        <KpiCard label="Total Payments" value={brl(data.totalPayments)} icon={<IconCard />} />
        <KpiCard label="Payment Records" value={int(data.paymentRecords)} icon={<IconPercent />} tone="purple" />
        <KpiCard
          label="Top Method"
          value={top ? prettyCategory(top.type) : "—"}
          sub={top?.share != null ? `${pct(top.share)} of payment value` : null}
          icon={<IconStar />}
        />
        <KpiCard label="Product Revenue" value={brl(data.salesAllTime)} sub="ไม่รวมค่าขนส่ง" icon={<IconDollar />} tone="purple" />
      </section>
      <section className="grid row-2">
        <Card title="Payment Share by Type" warn={warn}>
          <Donut data={types.map((t) => ({ label: t.type, value: t.share }))} fmt="pct" />
        </Card>
        <Card title="Payment Value by Type" warn={warn}>
          <HBar data={types.map((t) => ({ label: t.type, value: t.value }))} fmt="brl" name="Total payment" categories />
        </Card>
      </section>
      <Card
        title="Payments by Type"
        note="ยอดชำระรวมการชำระของทุกสถานะคำสั่งซื้อ (รวมที่ยกเลิก) และรวมค่าขนส่ง จึงสูงกว่ายอดขายสินค้า และไม่ใช้แทนรายได้"
        warn={warn}
      >
        <DataTable
          columns={[
            { key: "type", label: "Payment type" },
            { key: "count", label: "Records", fmt: "int" },
            { key: "value", label: "Total payment", fmt: "brl", highlight: true },
            { key: "share", label: "Share", fmt: "pct" },
          ]}
          rows={types}
        />
      </Card>
    </>
  );
}

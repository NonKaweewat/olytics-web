import Card from "@/components/Card";
import { HBar, TrendBar, TrendLine } from "@/components/Charts";
import DataTable from "@/components/DataTable";
import ErrorState from "@/components/ErrorState";
import { IconCheck, IconClock, IconTruck } from "@/components/Icons";
import KpiCard from "@/components/KpiCard";
import KpiNotice from "@/components/KpiNotice";
import PageHeader from "@/components/PageHeader";
import { int, pct } from "@/lib/format";
import { delivery } from "@/lib/metrics/delivery";
import { ignoredNote, trendNote } from "@/lib/notes";
import { loadPage, type SearchParams } from "@/lib/page-data";

export const dynamic = "force-dynamic";

/** Logistics — BR08 BR09. */
export default async function DeliveryPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, options, filters, error } = await loadPage(searchParams, delivery);
  const header = (
    <PageHeader
      title="Delivery"
      subtitle="อัตราจัดส่งถึงลูกค้าล่าช้า และระยะเวลาจัดส่งเฉลี่ย (นับเฉพาะคำสั่งซื้อที่ส่งถึงแล้ว)"
      options={options}
      fields={["year", "month", "region", "state"]}
      stateLabel="All Customer States"
    />
  );
  if (!data) return <>{header}<ErrorState message={error ?? "Unknown error"} /></>;

  const ig = data.ignored;
  return (
    <>
      {header}
      <KpiNotice ignored={ig.all} />
      <section className="grid kpis">
        <KpiCard label="Avg Delivery Time" value={data.avgDays === null ? "—" : `${data.avgDays.toFixed(1)} days`} sub="จากวันสั่งซื้อถึงวันลูกค้าได้รับ" icon={<IconClock />} />
        <KpiCard label="Late Delivery Rate" value={data.latePct === null ? "—" : pct(data.latePct)} sub={`${int(data.lateOrders)} late orders`} icon={<IconTruck />} tone="purple" />
        <KpiCard label="Delivered Orders" value={int(data.delivered)} icon={<IconCheck />} />
        <KpiCard label="Longest Delivery" value={data.maxDays === null ? "—" : `${data.maxDays.toFixed(1)} days`} icon={<IconClock />} tone="purple" />
      </section>
      <section className="grid row-2">
        <Card title="Monthly Late Delivery Rate" note={trendNote(filters)} warn={ignoredNote(ig.trend)}>
          <TrendBar data={data.monthly.map((m) => ({ label: m.label, value: m.latePct }))} fmt="pct" name="Late" />
        </Card>
        <Card title="Monthly Avg Delivery Time" note={trendNote(filters)} warn={ignoredNote(ig.trend)}>
          <TrendLine data={data.monthly.map((m) => ({ label: m.label, value: m.avgDays }))} fmt="days" name="Avg days" />
        </Card>
      </section>
      <section className="grid row-2">
        <Card
          title="Avg Delivery Time by Customer State"
          note="10 รัฐที่มีคำสั่งซื้อที่ส่งถึงแล้วมากที่สุด · ค่าเฉลี่ยรวมหลายเดือน = วันจัดส่งรวม / จำนวนคำสั่งซื้อที่ส่งถึง"
          warn={ignoredNote(ig.days)}
        >
          <HBar data={data.byState.slice(0, 10).map((s) => ({ label: s.state, value: s.avgDays }))} fmt="days" name="Avg days" />
        </Card>
        <Card title="Late Rate by Customer State" note="10 รัฐที่มีคำสั่งซื้อที่ส่งถึงแล้วมากที่สุด" warn={ignoredNote(ig.late)}>
          <HBar data={data.byState.slice(0, 10).map((s) => ({ label: s.state, value: s.latePct }))} fmt="pct" name="Late" />
        </Card>
      </section>
      <section className="grid row-2">
        <Card title="Late Rate by Region" note="ภาคจับกลุ่มจากรัฐของลูกค้า" warn={ignoredNote(ig.late)}>
          <HBar data={data.byRegion.map((r) => ({ label: r.label, value: r.latePct }))} fmt="pct" name="Late" categories />
        </Card>
        <Card title="Avg Delivery Time by Region" note="ภาคจับกลุ่มจากรัฐของลูกค้า" warn={ignoredNote(ig.days)}>
          <HBar data={data.byRegion.map((r) => ({ label: r.label, value: r.avgDays }))} fmt="days" name="Avg days" categories />
        </Card>
      </section>
      <Card title="By Customer State" warn={ignoredNote(ig.all)}>
        <DataTable
          columns={[
            { key: "state", label: "State" },
            { key: "delivered", label: "Delivered orders", fmt: "int" },
            { key: "avgDays", label: "Avg days", fmt: "days" },
            { key: "latePct", label: "Late", fmt: "pct", highlight: true },
          ]}
          rows={data.byState}
        />
      </Card>
    </>
  );
}

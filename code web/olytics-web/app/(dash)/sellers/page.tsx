import Card from "@/components/Card";
import { HBar } from "@/components/Charts";
import DataTable from "@/components/DataTable";
import ErrorState from "@/components/ErrorState";
import { IconCheck, IconDollar, IconTruck, IconUsers } from "@/components/Icons";
import KpiCard from "@/components/KpiCard";
import KpiNotice from "@/components/KpiNotice";
import PageHeader from "@/components/PageHeader";
import { brl, int, pct } from "@/lib/format";
import { sellers } from "@/lib/metrics/sellers";
import { ignoredNote, union } from "@/lib/notes";
import { loadPage, type SearchParams } from "@/lib/page-data";

export const dynamic = "force-dynamic";

/** Seller management — BR05 BR06 BR07. */
export default async function SellersPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, options, error } = await loadPage(searchParams, sellers);
  const header = (
    <PageHeader
      title="Sellers"
      subtitle="ยอดขายและรีวิวของผู้ขาย การส่งให้ขนส่งทันกำหนด และผู้ขายที่ไม่มีรายได้"
      options={options}
      fields={["year", "month", "region", "state"]}
      stateLabel="All Seller States"
    />
  );
  if (!data) return <>{header}<ErrorState message={error ?? "Unknown error"} /></>;

  const ig = data.ignored;
  return (
    <>
      {header}
      <KpiNotice ignored={union(ig.performance, ig.onTime, ig.noRevenue)} />
      <section className="grid kpis">
        <KpiCard label="Active Sellers" value={int(data.activeSellers)} sub={`${brl(data.revenue)} revenue`} icon={<IconUsers />} />
        <KpiCard
          label="On-Time Shipping"
          value={data.onTimePct === null ? "—" : pct(data.onTimePct)}
          sub={`${int(data.unknownOrders)} orders ไม่ทราบวันส่งให้ขนส่ง (ไม่นับ)`}
          icon={<IconCheck />}
          tone="purple"
        />
        <KpiCard label="Sellers without Revenue" value={int(data.noRevenueSellers)} sub={`จากผู้ขายทั้งหมด ${int(data.totalSellers)} ราย`} icon={<IconDollar />} />
        <KpiCard label="Top Seller Revenue" value={data.rows[0] ? brl(data.rows[0].revenue) : "—"} sub={data.rows[0]?.state ?? null} icon={<IconTruck />} tone="purple" />
      </section>
      <Card
        title="Top 10 Sellers"
        note="คะแนนรีวิวรวมหลายเดือนถ่วงน้ำหนักด้วยจำนวนคำสั่งซื้อที่มีรีวิว · On time = on time / (on time + late)"
        warn={ignoredNote(union(ig.performance, ig.onTime))}
      >
        <DataTable
          rank
          columns={[
            { key: "sellerId", label: "Seller" },
            { key: "state", label: "State" },
            { key: "orders", label: "Orders", fmt: "int" },
            { key: "items", label: "Items", fmt: "int" },
            { key: "onTimePct", label: "On time", fmt: "pct" },
            { key: "avgReview", label: "Avg review", fmt: "score" },
            { key: "revenue", label: "Revenue", fmt: "brl", highlight: true },
          ]}
          rows={data.rows.map((r) => ({ ...r, sellerId: `${r.sellerId.slice(0, 8)}…` }))}
        />
      </Card>
      <section className="grid row-2" style={{ marginTop: 14 }}>
        <Card title="On-Time Shipping by Seller State" note="เฉพาะรัฐที่มีคำสั่งซื้อที่ทราบผลอย่างน้อย 30 รายการ" warn={ignoredNote(ig.onTime)}>
          <HBar data={data.onTimeByState} fmt="pct" name="On time" />
        </Card>
        <Card title="Sellers without Revenue by State" warn={ignoredNote(ig.noRevenue)}>
          <HBar data={data.noRevenueByState.slice(0, 10)} fmt="int" name="Sellers" />
        </Card>
      </section>
      <Card title="By Region (seller state)" note="ภาคจับกลุ่มจากรัฐของผู้ขาย" warn={ignoredNote(ig.regions)}>
        <DataTable
          columns={[
            { key: "label", label: "Region" },
            { key: "onTimePct", label: "On time", fmt: "pct" },
            { key: "noRevenue", label: "Sellers without revenue", fmt: "int" },
            { key: "revenue", label: "Revenue", fmt: "brl", highlight: true },
          ]}
          rows={data.byRegion}
        />
      </Card>
    </>
  );
}

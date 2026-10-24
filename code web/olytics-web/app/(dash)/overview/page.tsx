import Card from "@/components/Card";
import { HBar, TrendArea, TrendBar } from "@/components/Charts";
import ErrorState from "@/components/ErrorState";
import { IconBag, IconCard, IconChart, IconDollar, IconGrid, IconStar, IconUsers } from "@/components/Icons";
import KpiCard from "@/components/KpiCard";
import KpiNotice from "@/components/KpiNotice";
import PageHeader from "@/components/PageHeader";
import { brl, int, signedPct } from "@/lib/format";
import { overview } from "@/lib/metrics/overview";
import { ignoredNote, trendNote, union } from "@/lib/notes";
import { loadPage, type SearchParams } from "@/lib/page-data";

export const dynamic = "force-dynamic";

/** Executive — BR01 BR02. */
export default async function OverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, options, filters, error } = await loadPage(searchParams, overview);
  const header = (
    <PageHeader
      title="Executive Overview"
      subtitle="ยอดขาย จำนวนคำสั่งซื้อ และแนวโน้มรายเดือน"
      options={options}
      fields={["year", "month", "region", "state"]}
      stateLabel="All Customer States"
    />
  );
  if (!data) return <>{header}<ErrorState message={error ?? "Unknown error"} /></>;

  const g = data.latest?.growth ?? null;
  const ig = data.ignored;
  return (
    <>
      {header}
      <KpiNotice ignored={union(ig.kpis, ig.customers)} />
      <section className="grid kpis">
        <KpiCard label="Total Revenue" value={brl(data.revenue)} sub="ยอดขายสินค้า ไม่รวมค่าขนส่ง" icon={<IconDollar />} />
        <KpiCard label="Total Orders" value={int(data.orders)} icon={<IconBag />} tone="purple" />
        <KpiCard label="Total Customers" value={int(data.customers)} sub="นับจาก customer_unique_id" icon={<IconUsers />} />
        <KpiCard label="Total Items" value={int(data.items)} sub="จำนวนรายการสินค้าที่ขาย" icon={<IconGrid />} tone="purple" />
      </section>
      <section className="grid kpis">
        <KpiCard
          label="Monthly Growth"
          value={signedPct(g)}
          sub={data.latest ? `${data.latest.label} vs previous month` : null}
          subTone={g === null ? "muted" : g >= 0 ? "good" : "bad"}
          icon={<IconChart />}
        />
        <KpiCard label="Avg Order Value" value={data.avgOrderValue === null ? "—" : brl(data.avgOrderValue)} icon={<IconCard />} tone="purple" />
        <KpiCard label="Avg Price / Item" value={data.avgPrice === null ? "—" : brl(data.avgPrice)} icon={<IconStar />} />
        <KpiCard label="Repeat Customers" value={data.repeatPct === null ? "—" : `${data.repeatPct.toFixed(1)}%`} sub="ลูกค้าที่ซื้อตั้งแต่ 2 ครั้ง" icon={<IconUsers />} tone="purple" />
      </section>
      <section className="grid row-2">
        <Card title="Monthly Revenue" note={trendNote(filters)} warn={ignoredNote(ig.monthly)}>
          <TrendArea data={data.monthly.map((m) => ({ label: m.label, value: m.revenue }))} fmt="brl" name="Revenue" />
        </Card>
        <Card
          title="Month-over-Month Growth"
          note={trendNote(filters, "เดือนแรกและเดือนสุดท้ายของข้อมูลอาจไม่ครบเดือน · แกนตัดที่ −100% ถึง +150% (ชี้ที่แท่งเพื่อดูค่าจริง)")}
          warn={ignoredNote(ig.monthly)}
        >
          <TrendBar data={data.monthly.map((m) => ({ label: m.label, value: m.growth }))} fmt="pct" name="Growth" signed clip={[-100, 150]} />
        </Card>
      </section>
      <section className="grid row-3">
        <Card title="Revenue by Region" note="ภาคจับกลุ่มจากรัฐของลูกค้า" warn={ignoredNote(ig.geo)}>
          <HBar data={data.byRegion.map((r) => ({ label: r.label, value: r.revenue }))} fmt="brl" name="Revenue" categories />
        </Card>
        <Card title="Top 5 States by Revenue" warn={ignoredNote(ig.geo)}>
          <HBar data={data.byState.slice(0, 5)} fmt="brl" name="Revenue" />
        </Card>
        <Card title="Top 5 Categories by Revenue" warn={ignoredNote(ig.categories)}>
          <HBar data={data.topCategories} fmt="brl" name="Revenue" categories />
        </Card>
      </section>
    </>
  );
}

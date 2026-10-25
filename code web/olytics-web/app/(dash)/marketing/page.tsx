import Card from "@/components/Card";
import { HBar, StateMap, TrendArea } from "@/components/Charts";
import DataTable from "@/components/DataTable";
import ErrorState from "@/components/ErrorState";
import { IconBag, IconDollar, IconPin, IconUsers } from "@/components/Icons";
import KpiCard from "@/components/KpiCard";
import PageHeader from "@/components/PageHeader";
import { brl, int } from "@/lib/format";
import { marketing } from "@/lib/metrics/marketing";
import { ignoredNote, trendNote } from "@/lib/notes";
import { loadPage, type SearchParams } from "@/lib/page-data";

export const dynamic = "force-dynamic";

const CUSTOMERS_NOTE = "ลูกค้านับตามที่อยู่ในแต่ละคำสั่งซื้อ รวมหลายเมือง/รัฐ/เดือนอาจนับคนเดิมซ้ำ";

/** Marketing — BR13 BR14. */
export default async function MarketingPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, options, filters, error } = await loadPage(searchParams, marketing);
  const header = (
    <PageHeader
      title="Marketing"
      subtitle="ลูกค้าและยอดขายตามรัฐและเมือง และแนวโน้มยอดขายของแต่ละหมวดสินค้า"
      options={options}
      fields={["year", "month", "category", "region", "state"]}
      stateLabel="All Customer States"
    />
  );
  if (!data) return <>{header}<ErrorState message={error ?? "Unknown error"} /></>;

  const geo = ignoredNote(data.ignored.geo);
  return (
    <>
      {header}
      <section className="grid kpis">
        <KpiCard label="Customers" value={int(data.customers)} sub="รวมรายเมือง อาจนับลูกค้าที่ย้ายเมืองซ้ำ" icon={<IconUsers />} />
        <KpiCard label="Product Revenue" value={brl(data.revenue)} icon={<IconDollar />} tone="purple" />
        <KpiCard label="Orders" value={int(data.orders)} icon={<IconBag />} />
        <KpiCard label="Cities Reached" value={int(data.cities)} icon={<IconPin />} tone="purple" />
      </section>
      <section className="grid row-2">
        <Card title="Revenue by Customer State" warn={geo}>
          <StateMap data={data.byState.map((s) => ({ label: s.state, value: s.revenue }))} fmt="brl" name="Revenue" />
        </Card>
        <Card title="Customers by State" note={CUSTOMERS_NOTE} warn={geo}>
          <HBar data={data.byState.slice(0, 8).map((s) => ({ label: s.state, value: s.customers }))} fmt="int" name="Customers" />
        </Card>
      </section>
      <section className="grid row-2">
        <Card title="Monthly Revenue" note={trendNote(filters)} warn={ignoredNote(data.ignored.trend)}>
          <TrendArea data={data.monthly} fmt="brl" name="Revenue" />
        </Card>
        <Card title="Top 5 Categories" warn={ignoredNote(data.ignored.categories)}>
          <HBar data={data.topCategories} fmt="brl" name="Revenue" categories />
        </Card>
      </section>
      <Card title="By Region" note="ภาคจับกลุ่มจากรัฐของลูกค้า" warn={geo}>
        <HBar data={data.byRegion.map((r) => ({ label: r.label, value: r.revenue }))} fmt="brl" name="Revenue" categories />
      </Card>
      <div style={{ height: 14 }} />
      <Card title="Top 10 Cities" note={CUSTOMERS_NOTE} warn={geo}>
        <DataTable
          rank
          columns={[
            { key: "city", label: "City", category: true },
            { key: "state", label: "State" },
            { key: "customers", label: "Customers", fmt: "int" },
            { key: "orders", label: "Orders", fmt: "int" },
            { key: "aov", label: "Avg order value", fmt: "brl" },
            { key: "revenue", label: "Revenue", fmt: "brl", highlight: true },
          ]}
          rows={data.topCities}
        />
      </Card>
    </>
  );
}

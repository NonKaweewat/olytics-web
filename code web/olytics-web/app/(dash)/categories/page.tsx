import Card from "@/components/Card";
import { HBar, TrendArea, TrendBar } from "@/components/Charts";
import DataTable from "@/components/DataTable";
import ErrorState from "@/components/ErrorState";
import { IconBag, IconCard, IconDollar, IconGrid } from "@/components/Icons";
import KpiCard from "@/components/KpiCard";
import KpiNotice from "@/components/KpiNotice";
import PageHeader from "@/components/PageHeader";
import { brl, int } from "@/lib/format";
import { categories } from "@/lib/metrics/categories";
import { ignoredNote, trendNote } from "@/lib/notes";
import { loadPage, type SearchParams } from "@/lib/page-data";

export const dynamic = "force-dynamic";

/** Category management — BR04 BR14. */
export default async function CategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, options, filters, error } = await loadPage(searchParams, categories);
  const header = (
    <PageHeader
      title="Categories"
      subtitle="ยอดขาย จำนวนรายการ และราคาเฉลี่ยของแต่ละหมวดสินค้า"
      options={options}
      fields={["year", "month", "category", "region", "state"]}
      stateLabel="All Customer States"
    />
  );
  if (!data) return <>{header}<ErrorState message={error ?? "Unknown error"} /></>;

  const warnRows = ignoredNote(data.ignored.rows);
  const warnTrend = ignoredNote(data.ignored.monthly);
  return (
    <>
      {header}
      <KpiNotice ignored={data.ignored.rows} />
      <section className="grid kpis">
        <KpiCard label="Product Revenue" value={brl(data.revenue)} icon={<IconDollar />} />
        <KpiCard label="Items Sold" value={int(data.items)} sub="จำนวนแถวรายการสินค้า ไม่ใช่จำนวนหน่วย" icon={<IconBag />} tone="purple" />
        <KpiCard label="Avg Price / Item" value={data.avgPrice === null ? "—" : brl(data.avgPrice)} icon={<IconCard />} />
        <KpiCard label="Categories with Sales" value={int(data.categories)} icon={<IconGrid />} tone="purple" />
      </section>
      <section className="grid row-2">
        <Card title="Top 10 Categories by Revenue" warn={warnRows}>
          <HBar data={data.rows.slice(0, 10).map((r) => ({ label: r.category, value: r.revenue }))} fmt="brl" name="Revenue" categories />
        </Card>
        <div className="stack">
          <Card title="Monthly Revenue" note={trendNote(filters, "เลือกหมวดสินค้าที่ตัวกรองด้านบนเพื่อดูแนวโน้มของหมวดนั้น")} warn={warnTrend}>
            <TrendArea data={data.monthly.map((m) => ({ label: m.label, value: m.revenue }))} fmt="brl" name="Revenue" height={170} />
          </Card>
          <Card title="Monthly Orders" note={trendNote(filters)} warn={warnTrend}>
            <TrendBar data={data.monthly.map((m) => ({ label: m.label, value: m.orders }))} fmt="int" name="Orders" height={150} />
          </Card>
        </div>
      </section>
      <Card title="Category Performance" warn={warnRows}>
        <DataTable
          rank
          columns={[
            { key: "category", label: "Category", category: true },
            { key: "orders", label: "Orders", fmt: "int" },
            { key: "items", label: "Items", fmt: "int" },
            { key: "avgPrice", label: "Avg price", fmt: "brl" },
            { key: "revenue", label: "Revenue", fmt: "brl", highlight: true },
          ]}
          rows={data.rows}
        />
      </Card>
    </>
  );
}

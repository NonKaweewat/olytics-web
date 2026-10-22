import { OrdersBar, RevenueArea } from "@/components/Charts";
import ErrorState from "@/components/ErrorState";
import { IconBag, IconCard, IconDollar, IconTruck } from "@/components/Icons";
import KpiCard from "@/components/KpiCard";
import PageHeader from "@/components/PageHeader";
import { brl, delta, int, prettyCategory } from "@/lib/format";
import { loadPage, type SearchParams } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, options, error } = await loadPage(searchParams);
  const header = (
    <PageHeader title="Sales Overview" subtitle="Monthly sales performance and best-selling products" options={options} />
  );
  if (!data) return <>{header}<ErrorState message={error ?? "Unknown error"} /></>;

  const { kpis: k, prevKpis: p } = data;
  return (
    <>
      {header}
      <section className="grid kpis">
        <KpiCard label="Total Revenue" value={brl(k.revenue)} delta={delta(k.revenue, p?.revenue)} icon={<IconDollar />} />
        <KpiCard label="Total Orders" value={int(k.orders)} delta={delta(k.orders, p?.orders)} icon={<IconBag />} tone="purple" />
        <KpiCard label="Avg. Order Value" value={brl(k.avgOrderValue)} delta={delta(k.avgOrderValue, p?.avgOrderValue)} icon={<IconCard />} />
        <KpiCard label="Avg. Freight" value={brl(k.avgFreight)} delta={delta(k.avgFreight, p?.avgFreight)} icon={<IconTruck />} tone="purple" invertDelta />
      </section>
      <section className="grid row-2">
        <div className="card">
          <h3>Monthly Revenue</h3>
          <RevenueArea data={data.monthly} />
        </div>
        <div className="card">
          <h3>Orders by Month</h3>
          <OrdersBar data={data.monthly} />
        </div>
      </section>
      <section className="card">
        <h3>Best-Selling Categories</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Category</th>
                <th className="num">Items Sold</th>
                <th className="num">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.topCategories.slice(0, 10).map((c, i) => (
                <tr key={c.category}>
                  <td><span className="rank">{i + 1}</span></td>
                  <td>{prettyCategory(c.category)}</td>
                  <td className="num">{int(c.items)}</td>
                  <td className="money">{brl(c.revenue)}</td>
                </tr>
              ))}
              {!data.topCategories.length && (
                <tr><td colSpan={4} className="muted">No data for this filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

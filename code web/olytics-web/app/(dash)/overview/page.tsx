import { CategoryBar, DeliveryScatter, RevenueArea, StateMap } from "@/components/Charts";
import ErrorState from "@/components/ErrorState";
import { IconBag, IconDollar, IconStar, IconTruck } from "@/components/Icons";
import KpiCard from "@/components/KpiCard";
import PageHeader from "@/components/PageHeader";
import { brl, delta, int } from "@/lib/format";
import { loadPage, type SearchParams } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, options, error } = await loadPage(searchParams);
  const header = (
    <PageHeader title="E-Commerce Analytics Overview" subtitle="Sales, customers, delivery and review insights" options={options} />
  );
  if (!data) return <>{header}<ErrorState message={error ?? "Unknown error"} /></>;

  const { kpis: k, prevKpis: p } = data;
  return (
    <>
      {header}
      <section className="grid kpis">
        <KpiCard label="Total Revenue" value={brl(k.revenue)} delta={delta(k.revenue, p?.revenue)} icon={<IconDollar />} />
        <KpiCard label="Total Orders" value={int(k.orders)} delta={delta(k.orders, p?.orders)} icon={<IconBag />} tone="purple" />
        <KpiCard label="Avg. Freight" value={brl(k.avgFreight)} delta={delta(k.avgFreight, p?.avgFreight)} icon={<IconTruck />} invertDelta />
        <KpiCard
          label="Avg. Review Score"
          value={`${k.avgReview.toFixed(2)} / 5`}
          delta={p ? `${k.avgReview - p.avgReview >= 0 ? "+" : ""}${(k.avgReview - p.avgReview).toFixed(2)} vs previous year` : null}
          icon={<IconStar />}
          tone="purple"
        />
      </section>
      <section className="grid row-3-2">
        <div className="card">
          <h3>Monthly Revenue</h3>
          <RevenueArea data={data.monthly} />
        </div>
        <div className="card">
          <h3>Top Product Categories</h3>
          <CategoryBar data={data.topCategories} />
        </div>
      </section>
      <section className="grid row-2-3">
        <div className="card">
          <h3>Orders by Customer State</h3>
          <StateMap data={data.ordersByState} />
        </div>
        <div className="card">
          <h3>Delivery Time vs Review Score</h3>
          <DeliveryScatter data={data.deliveryVsReview} />
        </div>
      </section>
    </>
  );
}

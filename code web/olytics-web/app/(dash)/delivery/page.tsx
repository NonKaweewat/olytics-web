import { DeliveryDonut, DeliveryScatter, ReviewDistBar } from "@/components/Charts";
import ErrorState from "@/components/ErrorState";
import { IconBulb, IconCheck, IconClock, IconStar, IconTruck } from "@/components/Icons";
import KpiCard from "@/components/KpiCard";
import PageHeader from "@/components/PageHeader";
import { pct } from "@/lib/format";
import { loadPage, type SearchParams } from "@/lib/page-data";
import type { DeliveryReviewPoint } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Compare avg review of fast (<=10 days) vs slow (>20 days) deliveries. */
function insight(points: DeliveryReviewPoint[]): string {
  const avg = (ps: DeliveryReviewPoint[]) => {
    const n = ps.reduce((a, p) => a + (p.orders || 1), 0);
    return n ? ps.reduce((a, p) => a + p.score * (p.orders || 1), 0) / n : NaN;
  };
  const fast = avg(points.filter((p) => p.days <= 10));
  const slow = avg(points.filter((p) => p.days > 20));
  if (Number.isNaN(fast) || Number.isNaN(slow)) return "Not enough data to compare delivery speed and reviews.";
  if (fast - slow > 0.1) {
    return `Longer delivery times are associated with lower review scores — orders delivered within 10 days average ${fast.toFixed(2)}★ vs ${slow.toFixed(2)}★ for orders taking over 20 days.`;
  }
  return `Delivery time shows little effect on reviews for this selection (${fast.toFixed(2)}★ fast vs ${slow.toFixed(2)}★ slow).`;
}

export default async function DeliveryPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, options, error } = await loadPage(searchParams);
  const header = (
    <PageHeader title="Delivery & Review Analysis" subtitle="Relationship between delivery time and customer review scores" options={options} />
  );
  if (!data) return <>{header}<ErrorState message={error ?? "Unknown error"} /></>;

  const k = data.kpis;
  return (
    <>
      {header}
      <section className="grid kpis">
        <KpiCard label="Avg. Delivery Time" value={`${k.avgDeliveryDays.toFixed(1)} days`} icon={<IconClock />} />
        <KpiCard label="Avg. Review Score" value={`${k.avgReview.toFixed(2)} / 5`} icon={<IconStar />} tone="purple" />
        <KpiCard label="On-Time Delivery" value={pct(k.onTimePct)} icon={<IconCheck />} />
        <KpiCard label="Late Deliveries" value={pct(k.latePct)} icon={<IconTruck />} tone="purple" />
      </section>
      <section className="grid row-3-2">
        <div className="card">
          <h3>Delivery Time vs Review Score</h3>
          <DeliveryScatter data={data.deliveryVsReview} tall />
        </div>
        <div className="stack">
          <div className="card">
            <h3>Review Score Distribution</h3>
            <ReviewDistBar data={data.reviewDistribution} />
          </div>
          <div className="card">
            <h3>Delivery Status</h3>
            <DeliveryDonut data={data.deliveryStatus} />
          </div>
        </div>
      </section>
      <section className="card insight">
        <div className="icon lime"><IconBulb /></div>
        <div>
          <strong>Key Insight</strong>
          <span>{insight(data.deliveryVsReview)}</span>
        </div>
      </section>
    </>
  );
}

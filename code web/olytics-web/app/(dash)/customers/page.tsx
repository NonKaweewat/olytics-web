import Card from "@/components/Card";
import { ReviewDistBar, TrendBar, TrendLine } from "@/components/Charts";
import ErrorState from "@/components/ErrorState";
import { IconBag, IconPercent, IconStar, IconUsers } from "@/components/Icons";
import KpiCard from "@/components/KpiCard";
import KpiNotice from "@/components/KpiNotice";
import PageHeader from "@/components/PageHeader";
import { int, pct } from "@/lib/format";
import { customers } from "@/lib/metrics/customers";
import { ignoredNote, trendNote, union } from "@/lib/notes";
import { loadPage, type SearchParams } from "@/lib/page-data";

export const dynamic = "force-dynamic";

/** Customer experience — BR10 BR11 BR12. */
export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const { data, options, filters, error } = await loadPage(searchParams, customers);
  const header = (
    <PageHeader
      title="Customers & Reviews"
      subtitle="คะแนนรีวิว การซื้อซ้ำ และคำสั่งซื้อที่ยกเลิก / ไม่พร้อมจัดส่ง"
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
      <KpiNotice ignored={union(ig.reviews, ig.repeat, ig.failure)} />
      <section className="grid kpis">
        <KpiCard label="Avg Review Score" value={data.avgReview === null ? "—" : `${data.avgReview.toFixed(2)} / 5`} sub={`${int(data.reviews)} reviews`} icon={<IconStar />} />
        <KpiCard
          label="Repeat Customers"
          value={data.repeatPct === null ? "—" : pct(data.repeatPct)}
          sub={`${int(data.repeatCustomers)} คน`}
          icon={<IconUsers />}
          tone="purple"
        />
        <KpiCard label="Customers" value={int(data.customers)} sub="นับจาก customer_unique_id" icon={<IconBag />} />
        <KpiCard
          label="Failed Orders"
          value={data.failurePct === null ? "—" : pct(data.failurePct, 2)}
          sub={`canceled ${data.cancelPct === null ? "—" : pct(data.cancelPct, 2)} · unavailable ${data.unavailablePct === null ? "—" : pct(data.unavailablePct, 2)}`}
          icon={<IconPercent />}
          tone="purple"
        />
      </section>
      <section className="grid row-2">
        <Card title="Review Score Distribution" warn={ignoredNote(ig.reviews)}>
          <ReviewDistBar data={data.reviewDist} />
        </Card>
        <Card title="Monthly Avg Review" note={trendNote(filters, "ค่าเฉลี่ยรวมหลายเดือนถ่วงน้ำหนักด้วยจำนวนรีวิว")} warn={ignoredNote(ig.reviewTrend)}>
          <TrendLine data={data.monthlyReview} fmt="score" name="Avg review" domain={[1, 5]} height={210} />
        </Card>
      </section>
      <Card
        title="Monthly Failure Rate (Canceled + Unavailable)"
        note={trendNote(filters, "ตัวหารคือคำสั่งซื้อทุกสถานะ")}
        warn={ignoredNote(ig.failureTrend)}
      >
        <TrendBar data={data.monthlyFailure} fmt="pct" name="Failure rate" height={200} />
      </Card>
    </>
  );
}

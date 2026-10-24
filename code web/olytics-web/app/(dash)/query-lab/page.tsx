import PageHeader from "@/components/PageHeader";
import { dataSource } from "@/lib/db";
import { PRESETS } from "@/lib/querylab";
import QueryLab from "./QueryLab";

export const dynamic = "force-dynamic";

export default function QueryLabPage() {
  return (
    <>
      <PageHeader
        title="Query Lab"
        subtitle="Run the same SQL on Amazon Athena (S3 Curated Zone) and Amazon Redshift, then compare speed and cost model"
      />
      <QueryLab presets={PRESETS} mock={dataSource() === "mock"} />
    </>
  );
}

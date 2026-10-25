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
      />
      <QueryLab presets={PRESETS} mock={dataSource() === "mock"} />
    </>
  );
}

import { ignoredNote } from "@/lib/notes";
import type { FilterField } from "@/lib/types";

/** Shown above a KPI row when some active filters don't reach those numbers yet. */
export default function KpiNotice({ ignored }: { ignored: FilterField[] }) {
  const text = ignoredNote(ignored);
  return text ? <p className="notice">ตัวเลขสรุปด้านล่าง{text}</p> : null;
}

import type { FilterField, Filters } from "./types";

/** Footnote for month-by-month trend charts, which always show the whole selected year. */
export function trendNote(f: Filters, extra?: string): string | undefined {
  const month = f.month ? "แสดงทุกเดือนของปีที่เลือก (กราฟแนวโน้มไม่ขึ้นกับตัวกรองเดือน)" : undefined;
  return [extra, month].filter(Boolean).join(" · ") || undefined;
}

const LABEL: Record<FilterField, string> = { year: "ปี", month: "เดือน", category: "หมวดสินค้า", region: "ภาค", state: "รัฐ" };

/** Warning for a card whose view can't apply some of the active filters yet. */
export function ignoredNote(ignored: FilterField[] | undefined): string | undefined {
  if (!ignored?.length) return undefined;
  return `ยังไม่ขึ้นกับตัวกรอง ${ignored.map((x) => LABEL[x]).join(", ")} — ข้อมูลส่วนนี้ยังไม่มีคอลัมน์นี้ (รอทีม data เพิ่ม)`;
}

/** Union of several ignored-filter lists. */
export function union(...lists: FilterField[][]): FilterField[] {
  return [...new Set(lists.flat())];
}

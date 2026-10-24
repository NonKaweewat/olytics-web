// Who sees which dashboard. Roles and their questions come from
// design/olist_dw_design_document.md (ตารางที่ 2 และ 3). Change access here only.

export type PageId =
  | "overview"
  | "payments"
  | "categories"
  | "sellers"
  | "delivery"
  | "customers"
  | "marketing"
  | "query-lab"
  | "settings";

export const PAGES: Record<PageId, { href: string; label: string; br: string }> = {
  overview: { href: "/overview", label: "Overview", br: "BR01 BR02" },
  payments: { href: "/payments", label: "Payments", br: "BR03" },
  categories: { href: "/categories", label: "Categories", br: "BR04 BR14" },
  sellers: { href: "/sellers", label: "Sellers", br: "BR05 BR06 BR07" },
  delivery: { href: "/delivery", label: "Delivery", br: "BR08 BR09" },
  customers: { href: "/customers", label: "Customers & Reviews", br: "BR10 BR11 BR12" },
  marketing: { href: "/marketing", label: "Marketing", br: "BR13 BR14" },
  "query-lab": { href: "/query-lab", label: "Query Lab", br: "UC-03" },
  settings: { href: "/settings", label: "Settings", br: "" },
};

const DASHBOARDS: PageId[] = ["overview", "payments", "categories", "sellers", "delivery", "customers", "marketing"];

// Every role sees the Overview; `home` is where the role lands after login.
export const ROLES = {
  executive: { label: "ผู้บริหาร", home: "overview", pages: ["overview"] },
  finance: { label: "การเงินและการชำระเงิน", home: "payments", pages: ["overview", "payments"] },
  category: { label: "บริหารหมวดสินค้า", home: "categories", pages: ["overview", "categories"] },
  seller: { label: "ฝ่ายดูแลผู้ขาย", home: "sellers", pages: ["overview", "sellers"] },
  logistics: { label: "โลจิสติกส์และการจัดส่ง", home: "delivery", pages: ["overview", "delivery"] },
  cx: { label: "ลูกค้าและประสบการณ์ลูกค้า", home: "customers", pages: ["overview", "customers"] },
  marketing: { label: "การตลาด", home: "marketing", pages: ["overview", "marketing"] },
  analyst: { label: "นักวิเคราะห์ / BI", home: "overview", pages: [...DASHBOARDS, "query-lab"] },
  admin: { label: "ผู้ดูแลระบบ", home: "overview", pages: [...DASHBOARDS, "query-lab", "settings"] },
} satisfies Record<string, { label: string; home: PageId; pages: PageId[] }>;

export type Role = keyof typeof ROLES;

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && Object.hasOwn(ROLES, v);
}

export function pagesFor(role: Role): PageId[] {
  return ROLES[role].pages as PageId[];
}

export function canAccess(role: Role, page: PageId): boolean {
  return pagesFor(role).includes(page);
}

/** Where a role lands after login, or when it opens a page it may not see. */
export function homeFor(role: Role): string {
  return PAGES[ROLES[role].home as PageId].href;
}

/** Page for a URL path such as "/sellers" or "/api/data/sellers". */
export function pageForPath(pathname: string): PageId | null {
  const seg = pathname.replace(/^\/api\/data\//, "/").split("/")[1] ?? "";
  if (pathname === "/api/query") return "query-lab";
  return Object.hasOwn(PAGES, seg) ? (seg as PageId) : null;
}

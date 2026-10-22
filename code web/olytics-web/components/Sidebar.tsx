"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconChart, IconGear, IconGrid, IconLogout, IconTerminal, IconTruck, Logo } from "./Icons";

const NAV = [
  { href: "/overview", label: "Overview", Icon: IconGrid },
  { href: "/sales", label: "Sales", Icon: IconChart },
  { href: "/delivery", label: "Delivery & Reviews", Icon: IconTruck },
  { href: "/query-lab", label: "Query Lab", Icon: IconTerminal },
];

export default function Sidebar() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  // Keep the selected filters when switching pages.
  const qs = sp.toString() ? `?${sp.toString()}` : "";

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <Logo size={36} />
        <span>Olytics</span>
      </div>
      {NAV.map(({ href, label, Icon }) => (
        <Link key={href} href={href + qs} className={`nav-item${pathname === href ? " active" : ""}`}>
          <Icon /> <span>{label}</span>
        </Link>
      ))}
      <div className="spacer" />
      <Link href="/settings" className={`nav-item${pathname === "/settings" ? " active" : ""}`}>
        <IconGear /> <span>Settings</span>
      </Link>
      <button className="nav-item logout" onClick={logout}>
        <IconLogout /> <span>Logout</span>
      </button>
    </aside>
  );
}

"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { PAGES, type PageId } from "@/lib/roles";
import {
  IconBag, IconCard, IconChart, IconGear, IconGrid, IconLogout, IconStar, IconTerminal, IconTruck, IconUsers, Logo,
} from "./Icons";

const ICONS: Record<PageId, ComponentType<SVGProps<SVGSVGElement>>> = {
  overview: IconGrid,
  payments: IconCard,
  categories: IconBag,
  sellers: IconUsers,
  delivery: IconTruck,
  customers: IconStar,
  marketing: IconChart,
  "query-lab": IconTerminal,
  settings: IconGear,
};

export default function Sidebar({ pages, user, roleLabel }: { pages: PageId[]; user: string; roleLabel: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  // Keep the selected filters when switching pages.
  const qs = sp.toString() ? `?${sp.toString()}` : "";
  const main = pages.filter((p) => p !== "settings");

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
      {main.map((id) => {
        const Icon = ICONS[id];
        const { href, label } = PAGES[id];
        return (
          <Link key={id} href={href + qs} className={`nav-item${pathname === href ? " active" : ""}`}>
            <Icon /> <span>{label}</span>
          </Link>
        );
      })}
      <div className="spacer" />
      <div className="who" title={`${user} · ${roleLabel}`}>
        <strong>{user}</strong>
        <span>{roleLabel}</span>
      </div>
      {pages.includes("settings") && (
        <Link href="/settings" className={`nav-item${pathname === "/settings" ? " active" : ""}`}>
          <IconGear /> <span>Settings</span>
        </Link>
      )}
      <button className="nav-item logout" onClick={logout}>
        <IconLogout /> <span>Logout</span>
      </button>
    </aside>
  );
}

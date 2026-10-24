import { redirect } from "next/navigation";
import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import { pagesFor, ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="shell">
      <Suspense>
        <Sidebar pages={pagesFor(session.role)} user={session.user} roleLabel={ROLES[session.role].label} />
      </Suspense>
      <main className="main">{children}</main>
    </div>
  );
}

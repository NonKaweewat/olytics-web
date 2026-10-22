import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Suspense>
        <Sidebar />
      </Suspense>
      <main className="main">{children}</main>
    </div>
  );
}

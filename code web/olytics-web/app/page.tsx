import { redirect } from "next/navigation";
import { homeFor } from "@/lib/roles";
import { getSession } from "@/lib/session";

// The middleware already redirects "/" to the role's home; this is the fallback.
export default async function Home() {
  const session = await getSession();
  redirect(session ? homeFor(session.role) : "/login");
}

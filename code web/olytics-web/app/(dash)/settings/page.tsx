import PageHeader from "@/components/PageHeader";
import { dataSource, ping } from "@/lib/db";
import { authProvider } from "@/lib/login";
import { PAGES, ROLES, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const source = dataSource();
  const start = Date.now();
  let error: string | null = null;
  try {
    await ping();
  } catch (e) {
    error = (e as Error).message;
  }
  const latency = Date.now() - start;

  const auth = authProvider();
  const rows: [string, string][] = [
    ["Login", auth === "cognito" ? `Amazon Cognito (${process.env.COGNITO_USER_POOL_ID ?? "pool not set"})` : "local accounts (DASHBOARD_USERS)"],
    ["Data source", source === "mock" ? "mock (in-memory warehouse, synthetic data)" : "redshift"],
    ["Redshift host", process.env.REDSHIFT_HOST ?? "—"],
    ["Redshift port", process.env.REDSHIFT_PORT ?? "5439"],
    ["Redshift database", process.env.REDSHIFT_DATABASE ?? "dev"],
    ["Redshift schema", process.env.REDSHIFT_SCHEMA ?? "public"],
    ["AWS region", process.env.AWS_REGION ?? "us-east-1"],
    ["Athena database", process.env.ATHENA_DATABASE ?? "olytics_curated"],
    ["Athena workgroup", process.env.ATHENA_WORKGROUP ?? "primary"],
  ];

  return (
    <>
      <PageHeader title="Settings" subtitle="สถานะการเชื่อมต่อ และสิทธิ์ของแต่ละ role (ตั้งค่าผ่าน environment variables บน EC2)" />
      <section className="grid row-2">
        <div className="card">
          <h3>
            Warehouse connection{" "}
            {error ? <span className="badge bad">UNREACHABLE</span> : <span className="badge ok">CONNECTED</span>}
            {source === "mock" && <> <span className="badge info">MOCK DATA</span></>}
          </h3>
          {error && <p><code style={{ color: "#ffb3b3", fontSize: 12 }}>{error}</code></p>}
          {!error && <p className="muted">Round-trip latency: {latency} ms</p>}
          <table className="data">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td className="muted" style={{ width: 170 }}>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Role access</h3>
          <p className="note" style={{ marginTop: 0 }}>
            แก้สิทธิ์ได้ที่ไฟล์ lib/roles.ts ·{" "}
            {auth === "cognito" ? "role ของแต่ละอีเมล = group ใน Cognito (ชื่อ group = ชื่อ role ด้านล่าง)" : "บัญชีผู้ใช้ตั้งใน DASHBOARD_USERS"}
          </p>
          <table className="data">
            <thead>
              <tr><th>Role</th><th>Pages</th></tr>
            </thead>
            <tbody>
              {(Object.keys(ROLES) as Role[]).map((r) => (
                <tr key={r}>
                  <td><strong>{r}</strong><div className="muted" style={{ fontSize: 11 }}>{ROLES[r].label}</div></td>
                  <td>{ROLES[r].pages.map((p) => PAGES[p].label).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

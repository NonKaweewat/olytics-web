import PageHeader from "@/components/PageHeader";
import { health } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const h = await health();
  const rows: [string, string][] = [
    ["Data source", h.source],
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
      <PageHeader title="Settings" subtitle="Connection status (configured through environment variables on the EC2 instance)" />
      <section className="card" style={{ maxWidth: 720 }}>
        <h3>
          Warehouse connection{" "}
          {h.ok ? <span className="badge ok">CONNECTED</span> : <span className="badge bad">UNREACHABLE</span>}
          {h.source === "mock" && <> <span className="badge info">MOCK DATA</span></>}
        </h3>
        {h.error && (
          <p>
            <code style={{ color: "#ffb3b3", fontSize: 12 }}>{h.error}</code>
          </p>
        )}
        {h.source === "redshift" && h.ok && <p className="muted">Round-trip latency: {h.latencyMs} ms</p>}
        <table className="data">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="muted" style={{ width: 200 }}>{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

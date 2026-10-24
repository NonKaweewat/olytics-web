"use client";
import { useState } from "react";
import type { QueryRunResult } from "@/lib/types";

// Athena on-demand pricing: USD 5 per TB scanned, 10 MB minimum per query.
const ATHENA_USD_PER_TB = 5;

function bytes(n?: number) {
  if (n === undefined) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${n} B`;
}

function athenaCost(n?: number) {
  if (n === undefined) return "—";
  const billed = Math.max(n, 10 * 1024 * 1024);
  return `$${((billed / 1024 ** 4) * ATHENA_USD_PER_TB).toFixed(6)}`;
}

export default function QueryLab({ presets, mock }: { presets: { id: string; label: string; sql: string }[]; mock: boolean }) {
  const [sql, setSql] = useState(presets[0]?.sql ?? "");
  const [results, setResults] = useState<QueryRunResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Query failed");
      setResults(body.results);
    } catch (e) {
      setError((e as Error).message);
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  const ok = results?.filter((r) => r.ok) ?? [];
  const fastest = ok.length === 2 ? ok.reduce((a, b) => (a.elapsedMs <= b.elapsedMs ? a : b)) : null;

  return (
    <div className="stack">
      {mock && (
        <div className="card">
          <span className="badge info">MOCK MODE</span>{" "}
          <span className="muted">SQL runs for real on the in-memory mock warehouse (same tables as the ER diagram). Athena timing and data scanned are simulated. Set DATA_SOURCE=redshift to query AWS.</span>
        </div>
      )}
      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {presets.map((p) => (
            <button key={p.id} className="btn ghost" onClick={() => setSql(p.sql)}>
              {p.label}
            </button>
          ))}
        </div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          spellCheck={false}
          rows={9}
          aria-label="SQL query"
          style={{
            width: "100%", background: "#050913", border: "1px solid var(--border)", borderRadius: 9,
            padding: 12, fontFamily: "ui-monospace, Consolas, monospace", fontSize: 13, resize: "vertical",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={run} disabled={busy || !sql.trim()}>
            {busy ? "Running…" : "Run on both"}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            Use <code>{"{db}"}</code> as the schema/database prefix. Read-only SELECT queries only.
          </span>
        </div>
        {error && <div className="alert" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
      </div>

      {results && (
        <div className="grid row-2">
          {results.map((r) => (
            <div className="card" key={r.engine}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>{r.engine === "athena" ? "Amazon Athena" : "Amazon Redshift"}</h3>
                {r.ok ? (
                  fastest?.engine === r.engine ? <span className="badge ok">FASTEST</span> : <span className="badge info">OK</span>
                ) : (
                  <span className="badge bad">ERROR</span>
                )}
              </div>
              <table className="data" style={{ margin: "10px 0" }}>
                <tbody>
                  <tr><td>Elapsed time</td><td className="num">{r.elapsedMs.toFixed(0)} ms</td></tr>
                  <tr><td>Data scanned</td><td className="num">{r.engine === "athena" ? bytes(r.dataScannedBytes) : "n/a"}</td></tr>
                  <tr>
                    <td>Cost model</td>
                    <td className="num">
                      {r.engine === "athena" ? `${athenaCost(r.dataScannedBytes)} / query` : "per-hour cluster (ra3.large)"}
                    </td>
                  </tr>
                  <tr><td>Rows</td><td className="num">{r.rowCount ?? "—"}</td></tr>
                </tbody>
              </table>
              {r.error && <code style={{ color: "#ffb3b3", fontSize: 12, wordBreak: "break-all" }}>{r.error}</code>}
              {r.ok && r.columns && r.rows && (
                <div style={{ overflowX: "auto", maxHeight: 280 }}>
                  <table className="data">
                    <thead>
                      <tr>{r.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {r.rows.map((row, i) => (
                        <tr key={i}>{row.map((v, j) => <td key={j}>{v === null ? "∅" : String(v)}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

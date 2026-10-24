import { fmtValue, prettyCategory } from "@/lib/format";
import type { Fmt } from "@/lib/types";

export type Column<T> = {
  key: keyof T & string;
  label: string;
  fmt?: Fmt;
  /** Render snake_case categories nicely. */
  category?: boolean;
  /** Highlight money columns in lime. */
  highlight?: boolean;
};

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rank = false,
}: {
  columns: Column<T>[];
  rows: T[];
  rank?: boolean;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data">
        <thead>
          <tr>
            {rank && <th style={{ width: 40 }}>#</th>}
            {columns.map((c) => (
              <th key={c.key} className={c.fmt ? "num" : undefined}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {rank && <td><span className="rank">{i + 1}</span></td>}
              {columns.map((c) => {
                const v = r[c.key];
                const text = c.fmt
                  ? fmtValue(v as number | null, c.fmt)
                  : c.category
                    ? prettyCategory(String(v))
                    : String(v ?? "");
                return (
                  <td key={c.key} className={c.highlight ? "money" : c.fmt ? "num" : undefined}>{text}</td>
                );
              })}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length + (rank ? 1 : 0)} className="muted">No data for this filter</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

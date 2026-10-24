import "server-only";
import { mockDb } from "./mockdb";
import { rsColumns, rsQuery } from "./redshift";

export function dataSource(): "mock" | "redshift" {
  return process.env.DATA_SOURCE === "redshift" ? "redshift" : "mock";
}

/** Schema prefix for table names. The mock DB uses Postgres' default schema. */
export function schema(): string {
  if (dataSource() === "mock") return "public";
  const s = process.env.REDSHIFT_SCHEMA ?? "public";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) throw new Error("Invalid REDSHIFT_SCHEMA");
  return s;
}

type Row = Record<string, unknown>;

/** Run SQL with $1..$n params on Redshift or on the in-memory mock warehouse. */
export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (dataSource() === "redshift") return rsQuery<T>(sql, params);
  const db = await mockDb();
  const res = await db.query<T>(sql, params);
  return res.rows;
}

/** Column names a query returns (works for an empty result, e.g. `SELECT * FROM v LIMIT 0`). */
export async function columnsOf(sql: string): Promise<string[]> {
  if (dataSource() === "redshift") return rsColumns(sql);
  const db = await mockDb();
  const res = await db.query(sql);
  return res.fields.map((f) => f.name);
}

/** Numbers come back as number, string (numeric/bigint over pg) or bigint (PGlite). */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return Number(v);
}

/** Like num() but keeps NULL — for metrics whose divisor can be zero. */
export function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

export async function ping(): Promise<void> {
  await query("SELECT 1");
}

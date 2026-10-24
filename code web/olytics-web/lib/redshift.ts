import "server-only";
import { Pool } from "pg";

// Redshift speaks the PostgreSQL wire protocol, so `pg` works over port 5439.
// The EC2 instance (public subnet) reaches the cluster in the private subnet;
// the Redshift security group must allow 5439 from the EC2 security group only.
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const host = process.env.REDSHIFT_HOST;
    if (!host) throw new Error("REDSHIFT_HOST is not set");
    pool = new Pool({
      host,
      port: Number(process.env.REDSHIFT_PORT ?? 5439),
      database: process.env.REDSHIFT_DATABASE ?? "dev",
      user: process.env.REDSHIFT_USER,
      password: process.env.REDSHIFT_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function rsQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query(sql, params);
  return res.rows as T[];
}

export async function rsColumns(sql: string): Promise<string[]> {
  const res = await getPool().query(sql);
  return res.fields.map((f) => f.name);
}

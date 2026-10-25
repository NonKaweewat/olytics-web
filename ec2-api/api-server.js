'use strict';
const { Pool } = require('pg');
const { createApp } = require('./app');

async function start() {
  if (!process.env.OLIST_DB_SECRET || !process.env.REDSHIFT_HOST || !process.env.REDSHIFT_DATABASE) throw new Error('Missing runtime configuration');
  const secret = JSON.parse(process.env.OLIST_DB_SECRET);
  delete process.env.OLIST_DB_SECRET;
  if (!secret.username || !secret.password) throw new Error('Incomplete database configuration');
  const pool = new Pool({
    host: process.env.REDSHIFT_HOST,
    port: Number(process.env.REDSHIFT_PORT || 5439),
    database: process.env.REDSHIFT_DATABASE,
    user: secret.username, password: secret.password,
    ssl: { rejectUnauthorized: true }, max: 5,
    connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000,
    statement_timeout: 20000, query_timeout: 25000,
    application_name: 'olist-internal-api',
  });
  pool.on('error', () => console.error('Idle database connection failed'));
  const app = createApp(pool);
  const server = app.listen(3001, '127.0.0.1', () => console.log('Olist internal API listening on 127.0.0.1:3001'));
  server.on('error', () => process.exit(1));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
    const timer = setTimeout(() => process.exit(1), 30000);
    timer.unref();
    server.close(async () => { await pool.end(); clearTimeout(timer); process.exit(0); });
    server.closeIdleConnections?.();
  });
}
start().catch(() => { console.error('API startup failed; check runtime configuration'); process.exitCode = 1; });

'use strict';
const assert = require('node:assert/strict');
const base = process.env.API_TEST_BASE || 'http://127.0.0.1:3001';
async function get(path, status = 200) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, status, path);
  return response.json();
}
(async () => {
  await get('/api/health');
  await get('/api/ready');
  const { data } = await get('/api/kpis');
  assert.equal(data.length, 15);
  for (const kpi of data) {
    const schema = await get(kpi.endpoint + '/schema');
    const result = await get(kpi.endpoint + '?limit=2');
    assert.ok(Array.isArray(result.data));
    assert.ok(result.data.length <= 2);
    if (result.data.length) assert.deepEqual(Object.keys(result.data[0]), schema.columns);
    console.log(`${kpi.id}: OK (${result.data.length} rows, ${schema.columns.length} columns)`);
  }
  assert.ok(Array.isArray(await get('/api/sales?limit=1')));
  const filtered = await get('/api/kpis/br01-monthly-sales?year=2018&month=1');
  assert.ok(filtered.data.length > 0, 'Expected January 2018 sales in the Olist dataset');
  assert.ok(filtered.data.every(r => r.year_number === 2018 && r.month_number === 1));
  await get('/api/kpis/br01-monthly-sales?year=2018%20OR%201=1', 400);
  await get('/api/kpis/br01-monthly-sales?state=SP', 400);
  await get('/api/kpis/br01-monthly-sales?limit=501', 400);
  await get('/api/kpis/br01-monthly-sales?sort=invalid', 400);
  await get('/api/kpis/br01-monthly-sales?limit=1&limit=2', 400);
  await get('/api/kpis/pg_user', 404);
  console.log('Live Redshift and input validation checks passed.');
})().catch(e => { console.error(e.message); process.exitCode = 1; });

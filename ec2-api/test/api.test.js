'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { catalog, endpoints, buildQuery } = require('../catalog');
const { createApp } = require('../app');

const cols = ['year_number', 'month_number', 'category_name', 'total_sales'];
test('values are bound, identifiers come from known views and columns', () => {
  const attack = "x'; DROP TABLE dw.fact_order; --";
  const q = buildQuery('v_br14_monthly_category_sales', cols, { category: attack, year: '2018', limit: '5' });
  assert.ok(!q.text.includes(attack));
  assert.ok(q.text.includes('"year_number" = $1'));
  assert.deepEqual(q.values, [2018, attack, 6, 0]);
});
for (const query of [
  { month: '13' }, { year: '2018 OR 1=1' }, { limit: '501' }, { limit: '-1' },
  { offset: '100001' }, { limit: ['1', '2'] }, { sql: 'DELETE FROM x' },
  { sort: 'total_sales; DROP TABLE x' }, { direction: 'desc' },
  { sort: 'total_sales', direction: 'desc;--' }, { state: 'SP' },
  { page: '0' }, { page: '2', offset: '1' }, { page: '100001', limit: '500' },
  { page: '1.5' }, { page: ['1', '2'] },
]) {
  test('rejects invalid/unsupported query ' + JSON.stringify(query), () => {
    assert.throws(() => buildQuery('v_br14_monthly_category_sales', cols, query), { status: 400 });
  });
}
test('denies arbitrary table names', () => assert.throws(() => buildQuery('pg_user', cols, {})));
test('page is 1-based and remains bounded', () => {
  const spec = buildQuery('v_br14_monthly_category_sales', cols, { page: '2', limit: '20' });
  assert.equal(spec.offset, 20);
  assert.equal(spec.page, 2);
  assert.deepEqual(spec.values, [21, 20]);
});

test('HTTP contract: catalogue, all views, pagination, validation, failures', async () => {
  let fail = false;
  const db = { query: async (sql, values) => {
    if (fail) throw Object.assign(new Error('sensitive failure details'), { code: '08006' });
    if (sql.endsWith('LIMIT 0')) return { fields: cols.map(name => ({ name })), rows: [] };
    return { rows: [{ total_sales: '9007199254740993.01' }, { total_sales: '2.00' }] };
  } };
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const get = p => fetch(base + p);
    assert.equal((await get('/api/health')).status, 200);
    assert.equal((await (await get('/api/kpis')).json()).data.length, 15);
    for (const id of Object.keys(catalog)) {
      const r = await get(`/api/kpis/${id}?limit=1`);
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.equal(body.data.length, 1);
      assert.equal(body.pagination.hasMore, true);
      assert.equal(body.pagination.nextOffset, 1);
      assert.equal(body.data[0].total_sales, '9007199254740993.01');
    }
    assert.ok(Array.isArray(await (await get('/api/sales')).json()));
    for (const [path, id] of Object.entries(endpoints)) {
      const response = await get(path + '?page=2&limit=1');
      assert.equal(response.status, 200);
      const body = await response.json();
      if (path === '/api/sales') {
        assert.ok(Array.isArray(body));
        assert.equal(response.headers.get('X-Page'), '2');
      } else {
        assert.equal(body.id, id);
        assert.equal(body.pagination.page, 2);
        assert.equal(body.pagination.offset, 1);
      }
    }
    assert.equal((await get('/api/kpis/toString')).status, 404);
    assert.equal((await get('/api/kpis/br01-monthly-sales?limit=0')).status, 400);
    assert.equal((await get('/api/kpis/br01-monthly-sales?limit=1&limit=2')).status, 400);
    assert.equal((await fetch(base + '/api/sales', { method: 'POST' })).status, 404);
    fail = true;
    const unavailable = await get('/api/ready');
    assert.equal(unavailable.status, 503);
    assert.ok(!(await unavailable.text()).includes('sensitive failure'));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

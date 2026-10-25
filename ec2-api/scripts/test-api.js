'use strict';
const assert = require('node:assert/strict');
const { endpoints } = require('../catalog');
const base = process.env.API_TEST_BASE || 'http://127.0.0.1:3001';
const summary = [];
function noSensitiveFields(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!/^(password|secret|stringsecret|secretstring|secretbinary|accesskeyid|secretaccesskey|sessiontoken|authorization|aws_access_key_id|aws_secret_access_key|aws_session_token)$/i.test(key), 'Sensitive field in response');
    noSensitiveFields(item);
  }
}
async function check(path, expected = 200, validate = () => {}) {
  let status = 'network-error';
  try {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
    status = response.status;
    assert.equal(status, expected, 'Unexpected HTTP status');
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    const body = await response.json();
    noSensitiveFields(body);
    if (expected >= 400) assert.equal(typeof body.error, 'string');
    await validate(body, response);
    console.log(`PASS HTTP ${status} ${path}`);
    summary.push(true);
    return body;
  } catch (e) {
    // Do not echo response bodies, connection strings or secret values.
    console.log(`FAIL HTTP ${status} ${path} (${e.name})`);
    summary.push(false);
    return null;
  }
}
(async () => {
  await check('/api/health');
  await check('/api/ready');
  for (const [route, id] of Object.entries(endpoints)) {
    const schema = await check(`/api/kpis/${id}/schema`, 200, b => assert.ok(Array.isArray(b.columns)));
    await check(route + '?page=1&limit=20', 200, body => {
      const rows = route === '/api/sales' ? body : body.data;
      assert.ok(Array.isArray(rows));
      assert.ok(rows.length <= 20);
      assert.ok(schema, 'Schema unavailable');
      for (const row of rows) assert.deepEqual(Object.keys(row), schema.columns);
      if (route !== '/api/sales') { assert.equal(body.id, id); assert.equal(body.pagination.page, 1); }
    });
  }
  for (const route of ['/api/sellers', '/api/customer-geography']) {
    const first = await check(route + '?page=1&limit=2');
    const second = await check(route + '?page=2&limit=2', 200, body => {
      assert.equal(body.pagination.offset, 2);
      assert.equal(body.pagination.page, 2);
      assert.ok(first);
      if (first.pagination.hasMore) assert.notDeepEqual(first.data, body.data);
    });
    await check(route + '?offset=2&limit=2', 200, body => { assert.ok(second); assert.deepEqual(body.data, second.data); });
  }
  await check('/api/sellers?page=0', 400);
  await check('/api/sellers?page=2&offset=20', 400);
  await check('/api/customer-geography?limit=501', 400);
  await check('/api/sales?year=2018%20OR%201=1', 400);
  await check('/api/sales?state=SP', 200, body => {
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.ok(body.every(row => row.customer_state === 'SP'));
  });
  await check('/api/payments?table=pg_user', 400);
  await check('/api/kpis/pg_user', 404);
  await check('/api/health'); // Invalid inputs must not crash the backend.
  const passed = summary.filter(Boolean).length;
  console.log(`API availability/contract: ${passed} PASS, ${summary.length - passed} FAIL`);
  console.log('Business KPI correctness: NOT AUDITED (source views and formulas unchanged).');
  console.log('Secret checks: response field scan plus synthetic error-redaction unit test; no secret values fetched for testing.');
  process.exitCode = passed === summary.length ? 0 : 1;
})().catch(() => { console.error('FAIL test runner'); process.exitCode = 1; });

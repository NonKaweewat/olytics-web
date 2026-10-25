'use strict';
const express = require('express');
const { randomUUID } = require('node:crypto');
const { catalog, endpoints, filters, buildQuery } = require('./catalog');

function createApp(db, { authorizeKpi = (req, res, next) => next() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  // Do not trust X-Forwarded-* or enable CORS. This service is internal only.
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    const peer = req.socket.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)) return res.status(403).json({ error: 'Internal API only' });
    next();
  });
  const metadata = new Map();
  async function columnsFor(view) {
    let hit = metadata.get(view);
    if (!hit || Date.now() - hit.at > 300000) {
      const promise = db.query(`SELECT * FROM "dw"."${view}" LIMIT 0`).then(r => r.fields.map(f => f.name));
      hit = { at: Date.now(), promise };
      metadata.set(view, hit);
      promise.catch(() => metadata.delete(view));
    }
    return hit.promise;
  }
  app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'olist-api', access: 'internal-only' }));
  app.get('/api/ready', async (req, res, next) => {
    try { await db.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); } catch (e) { next(e); }
  });
  app.get('/api/kpis', (req, res) => res.json({ data: Object.entries(catalog).map(([id, view]) => ({ id, view, endpoint: `/api/kpis/${id}` })) }));
  app.get('/api/kpis/:id/schema', async (req, res, next) => {
    const view = Object.hasOwn(catalog, req.params.id) ? catalog[req.params.id] : null;
    if (!view) return res.status(404).json({ error: 'Unknown KPI' });
    try {
      const columns = await columnsFor(view);
      res.json({ id: req.params.id, columns, filters: Object.keys(filters).filter(k => filters[k].some(c => columns.includes(c))) });
    } catch (e) { next(e); }
  });
  function dataHandler(fixedId, legacy = false) {
    return async (req, res, next) => {
      const id = fixedId || req.params.id;
      const view = Object.hasOwn(catalog, id) ? catalog[id] : null;
      if (!view) return res.status(404).json({ error: 'Unknown KPI' });
      try {
        const spec = buildQuery(view, await columnsFor(view), req.query);
        const result = await db.query(spec.text, spec.values);
        const hasMore = result.rows.length > spec.limit;
        const rows = result.rows.slice(0, spec.limit);
        // Preserve PostgreSQL numeric/bigint strings to avoid precision loss.
        if (legacy) {
          res.set('X-Has-More', String(hasMore));
          res.set('X-Limit', String(spec.limit));
          res.set('X-Offset', String(spec.offset));
          if (spec.page !== null) res.set('X-Page', String(spec.page));
          return res.json(rows);
        }
        res.json({ id, data: rows, pagination: { limit: spec.limit, offset: spec.offset, page: spec.page, count: rows.length, hasMore, nextOffset: hasMore ? spec.offset + spec.limit : null, nextPage: hasMore && spec.page !== null ? spec.page + 1 : null } });
      } catch (e) { next(e); }
    };
  }
  // A single middleware hook lets a future verified Cognito identity/RBAC gate
  // both route families. The default is only suitable for loopback-only testing.
  for (const [route, id] of Object.entries(endpoints)) {
    app.get(route, (req, res, next) => { req.kpiId = id; next(); }, authorizeKpi, dataHandler(id, route === '/api/sales'));
  }
  app.get('/api/kpis/:id', (req, res, next) => { req.kpiId = req.params.id; next(); }, authorizeKpi, dataHandler());
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, req, res, next) => {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    const requestId = randomUUID();
    console.error(JSON.stringify({ requestId, code: /^[A-Z0-9_]{1,40}$/.test(err.code || '') ? err.code : 'DATABASE_ERROR' }));
    res.status(503).json({ error: 'Database temporarily unavailable', requestId });
  });
  return app;
}
module.exports = { createApp };

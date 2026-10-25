'use strict';

// These names were verified against the existing Redshift dw schema.
const names = [
  'v_br01_monthly_sales', 'v_br02_top_states', 'v_br02_top_categories',
  'v_br03_payment_distribution', 'v_br04_category_performance',
  'v_br05_seller_performance', 'v_br06_seller_on_time',
  'v_br07_sellers_without_revenue', 'v_br08_late_delivery',
  'v_br09_delivery_days', 'v_br10_review_satisfaction',
  'v_br11_repeat_customers', 'v_br12_order_failure_rate',
  'v_br13_customer_geography', 'v_br14_monthly_category_sales',
];
const catalog = Object.fromEntries(names.map(view => [view.slice(2).replaceAll('_', '-'), view]));
const endpoints = Object.fromEntries([
  'sales', 'top-states', 'top-categories', 'payments', 'category-performance',
  'sellers', 'seller-shipping', 'inactive-sellers', 'late-delivery',
  'delivery-days', 'reviews', 'repeat-customers', 'order-failures',
  'customer-geography', 'monthly-categories',
].map((route, index) => ['/api/' + route, Object.keys(catalog)[index]]));
const filters = {
  year: ['year_number'], month: ['month_number'],
  state: ['customer_state', 'state'], seller_state: ['seller_state'],
  category: ['category_name'], seller_id: ['seller_id'],
  payment_type: ['payment_type'], review_score: ['review_score'],
};
class InputError extends Error { constructor(message) { super(message); this.status = 400; } }
function integer(value, fallback, min, max, name) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new InputError(`${name} must be an integer`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new InputError(`${name} must be between ${min} and ${max}`);
  return n;
}
const quote = name => '"' + name.replaceAll('"', '""') + '"';
function buildQuery(view, columns, query) {
  if (!names.includes(view)) throw new InputError('Unknown KPI view');
  const allowed = new Set([...Object.keys(filters), 'limit', 'offset', 'page', 'sort', 'direction']);
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key)) throw new InputError(`Unknown parameter: ${key}`);
    if (typeof value !== 'string') throw new InputError(`Provide ${key} once`);
  }
  const limit = integer(query.limit, 100, 1, 500, 'limit');
  if (query.page !== undefined && query.offset !== undefined) throw new InputError('Use page or offset, not both');
  const page = integer(query.page, 1, 1, 100001, 'page');
  const offset = query.page === undefined ? integer(query.offset, 0, 0, 100000, 'offset') : (page - 1) * limit;
  if (offset > 100000) throw new InputError('Requested page exceeds maximum offset of 100000');
  const values = [], where = [];
  for (const [key, candidates] of Object.entries(filters)) {
    if (query[key] === undefined) continue;
    const column = candidates.find(c => columns.includes(c));
    if (!column) throw new InputError(`${key} is not supported by this KPI`);
    let value = query[key];
    if (key === 'year') value = integer(value, null, 1900, 2100, key);
    else if (key === 'month') value = integer(value, null, 1, 12, key);
    else if (key === 'review_score') value = integer(value, null, 1, 5, key);
    else if (!value.trim() || value.length > 200) throw new InputError(`${key} must have 1 to 200 characters`);
    if ((key === 'state' || key === 'seller_state') && !/^[A-Z]{2}$/.test(value)) throw new InputError(`${key} must be a two-letter uppercase state code`);
    values.push(value);
    where.push(`${quote(column)} = $${values.length}`);
  }
  if (query.sort && !columns.includes(query.sort)) throw new InputError('Unknown sort column');
  const direction = query.direction || 'asc';
  if (!['asc', 'desc'].includes(direction)) throw new InputError('direction must be asc or desc');
  if (query.direction && !query.sort) throw new InputError('direction requires sort');
  // Include tie-breakers so pagination is stable for the aggregate views.
  const ordering = query.sort ? [query.sort, ...columns.filter(c => c !== query.sort)] : columns;
  const order = ordering.map((c, i) => `${quote(c)} ${i === 0 ? direction : 'asc'} NULLS LAST`).join(', ');
  values.push(limit + 1, offset);
  return {
    text: `SELECT * FROM "dw".${quote(view)}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values, limit, offset, page: offset % limit === 0 ? offset / limit + 1 : null,
  };
}
module.exports = { catalog, endpoints, filters, buildQuery, InputError };

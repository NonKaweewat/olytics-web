# Olytics pre-launch audit

Status: **PARTIALLY READY** — the dashboard is ready for controlled testing, but it is publicly served over HTTP and should receive HTTPS before handling production credentials or sensitive data.

## Verified on EC2

- EC2 `olist-dashboard-ec2` is running.
- Redshift `olist-redshift-cluster` is `available`, private, and reachable from EC2 on port 5439.
- `nginx`, `olytics-web`, and `olist-api` are active.
- Nginx listens on port 80. The two application services listen only on `127.0.0.1:3002` and `127.0.0.1:3001`.
- The public `/overview` route redirects to the instance `/login` URL; it does not expose `localhost:3002`.
- Public `/kpi-api/health` returns `403`; direct public access to port 3001 is unavailable.
- Production build exists and the latest build completed successfully.

## Application and API results

- Login, signed session validation, unauthenticated redirect (`307`), and unauthenticated data API rejection (`401`) passed.
- Session cookie has `HttpOnly` and `SameSite=Lax` attributes.
- Admin session passed `/overview`, `/marketing`, `/sellers`, `/delivery`, `/customers`, `/payments`, `/categories`, `/settings`, and `/query-lab`.
- Express contract test passed **46/46** checks. It covers health/readiness, all 15 KPI endpoints, schemas, pagination, invalid input, SQL-injection-shaped input, and response secret-field scans.
- `lib/metrics/filters.ts` was fixed for Redshift: its state list now orders an enclosing subquery instead of using unsupported `UNION ... ORDER BY`.
- `dw.v_br07_sellers_without_revenue` was fixed so its all-years rows count each seller once. The previous result counted sellers once per year and overstated the chart.

## KPI quality checks

| Check | Result |
| --- | --- |
| BR01 calendar MoM calculation | PASS — 0 mismatches |
| BR03 payment percentages by year/month/state | PASS — 0 groups outside 100% ±0.05 |
| BR08 delivery counts and rate range | PASS |
| BR09 delivery days non-negative | PASS |
| BR10 review scores 1–5 | PASS |
| BR11 distinct-count totals and rate range | PASS |
| BR12 failure rates 0–100% | PASS |
| BR13 `total_sales` NULL values | 119 rows; retained as source data |
| BR14 category order overlap | Expected; orders can occur in multiple categories |

## Reusable test

Run this on EC2 through SSM or a local EC2 session:

```bash
cd /home/ec2-user/olist-dashboard/internal-api
bash ./scripts/prelaunch-smoke.sh
```

The source copies are [prelaunch-smoke.sh](ec2-api/scripts/prelaunch-smoke.sh) and [test-api.js](ec2-api/scripts/test-api.js).

## Required environment variable names

Server-only variables include `DASHBOARD_USERS`, `SESSION_SECRET`, `REDSHIFT_HOST`, `REDSHIFT_PORT`, `REDSHIFT_DATABASE`, `REDSHIFT_SCHEMA`, and the Redshift secret reference. None is exposed through `NEXT_PUBLIC_*` variables.

## Remaining risks and follow-up

- **High:** the public site uses HTTP. The session cookie therefore cannot use the `Secure` flag and credentials can be exposed in transit. Put HTTPS in front of Nginx before production use, then set `COOKIE_SECURE=true`.
- **Medium:** non-admin roles were code-reviewed but not exercised live, because the deployed local account list currently has only the admin account.
- **Blocked:** live `npm audit` was not run. The approval system rejected it because it would send dependency metadata to the npm registry. No dependencies were changed.

## Recovery

```bash
sudo systemctl restart olytics-web
sudo systemctl restart olist-api
sudo nginx -t && sudo systemctl reload nginx
```

The frontend and API files changed during deployment have timestamped backups on EC2. Redshift view changes were validated after deployment; restore the previous saved DDL only if a data-team-approved rollback is needed.

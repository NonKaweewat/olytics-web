# Verified deployment

- Instance: `i-0554cf1a2c662c788` / `olist-dashboard-ec2`
- Application: `/home/ec2-user/olist-dashboard/internal-api`
- Service: `olist-api` active and enabled
- Listener: `127.0.0.1:3001`
- Backup: `/home/ec2-user/olist-dashboard/backups/api-20261024T180942Z`
- Previous root `api-server.js`, `server.js`, `.env`, dependency files and Redshift views preserved.

Validation completed on the EC2 Linux host:

- 20 Node unit tests passed (binding, validation, page pagination, HTTP contracts and database failure handling).
- `scripts/test-api.sh` completed 46 checks with `0 FAIL`: health, readiness, schema and all 15 named KPI routes queried the real Redshift views successfully.
- Named routes accept `page=1&limit=20`; page and offset behavior was verified for sellers and customer geography.
- Invalid filters, unsupported filters, duplicate pagination parameters and excessive limits returned 400; unknown KPI returned 404.
- `/api/sales` retained its array response and includes pagination headers.
- `/api/health` and database readiness returned 200 locally; Nginx forwarded localhost `/api/health` successfully.
- An external request to `http://18.215.232.201/api/health` returned 403.
- Redshift cluster `olist-redshift-cluster` reported `available` / `Available` after deployment.

To roll back this deployment from EC2:

```bash
sudo bash /home/ec2-user/olist-dashboard/backups/api-20261024T180942Z/rollback.sh
```

Rollback restores the previous Nginx and service configuration. Before this deployment no backend was listening on port 3001, so that rollback will return the API to an unavailable state.

Authentication and frontend integration remain outside this internal-test deployment, as requested.

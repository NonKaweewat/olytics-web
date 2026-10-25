#!/usr/bin/env bash
set -Eeuo pipefail
project=/home/ec2-user/olist-dashboard
release="$project/.api-next/release"
backup="$project/backups/api-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup"
chmod 700 "$project/backups" "$backup"
cp -a /etc/nginx/conf.d/olist-dashboard.conf "$backup/nginx.conf"
if [ -f /etc/systemd/system/olist-api.service ]; then cp -a /etc/systemd/system/olist-api.service "$backup/olist-api.service"; fi
if [ -d "$project/internal-api" ]; then cp -a "$project/internal-api" "$backup/internal-api"; fi
if systemctl is-active --quiet olist-api; then touch "$backup/was-active"; fi
if systemctl is-enabled --quiet olist-api 2>/dev/null; then touch "$backup/was-enabled"; fi
cat > "$backup/rollback.sh" <<'ROLLBACK'
#!/usr/bin/env bash
set -eu
backup=$(cd "$(dirname "$0")" && pwd)
project=/home/ec2-user/olist-dashboard
systemctl stop olist-api || true
systemctl disable olist-api || true
if [ -d "$project/internal-api" ]; then mv "$project/internal-api" "$backup/failed-release-$(date +%s)"; fi
if [ -d "$backup/internal-api" ]; then cp -a "$backup/internal-api" "$project/internal-api"; fi
if [ -f "$backup/olist-api.service" ]; then
  cp -a "$backup/olist-api.service" /etc/systemd/system/olist-api.service
else
  rm -f /etc/systemd/system/olist-api.service
fi
systemctl daemon-reload
if [ -f "$backup/was-enabled" ]; then systemctl enable olist-api; fi
if [ -f "$backup/was-active" ]; then systemctl start olist-api; fi
cp -a "$backup/nginx.conf" /etc/nginx/conf.d/olist-dashboard.conf
nginx -t
systemctl reload nginx
echo 'Previous service and Nginx configuration restored.'
ROLLBACK
chmod 700 "$backup/rollback.sh"
trap 'echo "Deployment failed; rolling back"; bash "$backup/rollback.sh"' ERR

# Restrict the existing public proxy BEFORE starting the internal API.
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/nginx/conf.d/olist-dashboard.conf')
text=p.read_text()
marker='# Olist internal API access'
if marker not in text:
    needle='location /api/ {'
    if text.count(needle)!=1: raise RuntimeError('Expected exactly one /api/ location')
    text=text.replace(needle, needle+'\n        '+marker+'\n        allow 127.0.0.1;\n        allow ::1;\n        deny all;',1)
    p.write_text(text)
PY
nginx -t
systemctl reload nginx
systemctl stop olist-api 2>/dev/null || true
if [ -d "$project/internal-api" ]; then mv "$project/internal-api" "$backup/previous-release"; fi
cp -a "$release" "$project/internal-api"
chown -R ec2-user:ec2-user "$project/internal-api"
install -m 644 "$release/olist-api.service" /etc/systemd/system/olist-api.service
systemctl daemon-reload
systemctl enable --now olist-api
ready=0
for attempt in $(seq 1 90); do
  if curl -fsS --max-time 2 http://127.0.0.1:3001/api/health >/dev/null; then ready=1; break; fi
  sleep 2
done
test "$ready" = 1
cd "$project/internal-api"
bash scripts/test-api.sh
curl -fsS --max-time 10 http://127.0.0.1/api/health
systemctl is-active olist-api
systemctl is-enabled olist-api
ss -ltnp | grep ':3001 '
echo "BACKUP=$backup"
trap - ERR

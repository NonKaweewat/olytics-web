#!/usr/bin/env bash
# Runs only on the EC2 instance. It keeps the Express API private and never
# prints credentials: the dashboard account is read from its protected env file.
set -euo pipefail

api_root="$(cd "$(dirname "$0")/.." && pwd)"
web_root="/home/ec2-user/olist-frontend/code web/olytics-web"

for service in olist-api olytics-web nginx; do
  systemctl is-active --quiet "$service"
  echo "PASS service=$service"
done

ss -ltnH '( sport = :80 or sport = :3001 or sport = :3002 )' | grep -q '127.0.0.1:3001'
ss -ltnH '( sport = :80 or sport = :3001 or sport = :3002 )' | grep -q '127.0.0.1:3002'
test -f "$web_root/.next/BUILD_ID"
echo "PASS listeners-and-build"

cd "$api_root"
bash ./scripts/test-api.sh

base="http://127.0.0.1:3002"
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/overview")" = 307
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/api/data/overview")" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1/overview')" = 307

users="$(sed -n 's/^DASHBOARD_USERS=//p' "$web_root/.env.local" | head -1)"
user="$(printf '%s' "$users" | cut -d: -f1)"
password="$(printf '%s' "$users" | cut -d: -f2)"
payload="$(printf '{\"username\":\"%s\",\"password\":\"%s\"}' "$user" "$password")"
jar="$(mktemp)"
headers="$(mktemp)"
trap 'rm -f "$jar" "$headers"' EXIT

test "$(curl -sS -o /dev/null -c "$jar" -D "$headers" -w '%{http_code}' -X POST "$base/api/login" -H 'Content-Type: application/json' --data "$payload")" = 200
grep -qi '^set-cookie: olytics_session=' "$headers"
grep -qi 'httponly' "$headers"
grep -qi 'samesite=lax' "$headers"

for page in overview marketing sellers delivery customers payments categories settings query-lab; do
  test "$(curl -sS -o /dev/null -b "$jar" -w '%{http_code}' "$base/$page")" = 200
  echo "PASS page=$page"
done

test "$(curl -sS -o /dev/null -b "$jar" -w '%{http_code}' "$base/api/data/overview?year=2017&month=1&state=SP")" = 200
echo "PASS prelaunch-smoke"

#!/usr/bin/env bash
# Olytics web — EC2 setup (Amazon Linux 2023, t3.small/t3.medium is enough).
# Run on the EC2 instance from the project folder:
#   bash deploy/ec2-setup.sh
# Before running: create .env.local (copy from .env.example) with real values.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js 22"
  sudo dnf install -y nodejs22 || {
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
    sudo dnf install -y nodejs
  }
fi
node -v

if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found. cp .env.example .env.local and fill it in." >&2
  exit 1
fi

echo "==> Installing dependencies and building"
npm ci
npm run build

echo "==> Starting with pm2 on port 3000"
sudo npm install -g pm2
pm2 delete olytics >/dev/null 2>&1 || true
PORT=3000 pm2 start npm --name olytics -- start
pm2 save
# Restart automatically after reboot
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | sudo bash || true

echo "==> Forwarding port 80 -> 3000 (so the Security Group only needs HTTP 80)"
sudo iptables -t nat -C PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000 2>/dev/null \
  || sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000

echo "==> Health check"
sleep 3
curl -s http://localhost:3000/api/health && echo
echo "Done. Open http://<EC2 public IP>/"

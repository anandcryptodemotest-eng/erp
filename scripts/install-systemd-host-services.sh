#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

required_services=(customer gateway platform sales inventory accounting hr procurement delivery)
for service in "${required_services[@]}"; do
  if [[ ! -f "/etc/erp/$service.env" ]]; then
    echo "Missing /etc/erp/$service.env. Copy ops/systemd/env/$service.env.example and set production values first." >&2
    exit 1
  fi
done

install -d -m 0755 /etc/systemd/system
install -m 0644 "$repo_root/ops/systemd/erp-app@.service" /etc/systemd/system/erp-app@.service
install -m 0644 "$repo_root/ops/systemd/erp-app.target" /etc/systemd/system/erp-app.target

systemctl daemon-reload
systemctl enable erp-app.target
systemctl restart erp-app.target

echo "ERP systemd services installed. Check: systemctl status erp-app.target"
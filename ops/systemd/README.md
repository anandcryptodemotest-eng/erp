# Production host deployment

Day-to-day ops on this host: **`erp`** (`ops/ERP-CLI.md`). Compose runs
Postgres + gateway + domain APIs. systemd is only for **customer**,
**platform**, **nginx**, and the **erp watchdog**.

Do **not** enable `erp-app.target` on the mixed Compose stack — it would start
host gateway/sales/inventory next to Docker and cause port/secret drift.

The public nginx configuration proxies to host ports `3007`, `3010`, and
`3011`. Customer (`:3007`) and platform (`:3011`) may run under
`erp-app@.service`. Gateway and domain APIs (`:3001`–`:3010`) stay in Compose.
Do not run `pnpm dev` on the server.

## First installation

Create a dedicated deployment account, make it own the release directory, and
copy the environment files outside the repository:

```bash
sudo useradd --system --home /home/erp --shell /usr/sbin/nologin erp
sudo install -d -o erp -g erp -m 0750 /etc/erp
sudo cp ops/systemd/env/*.env.example /etc/erp/
sudo mv /etc/erp/customer.env.example /etc/erp/customer.env
sudo mv /etc/erp/platform.env.example /etc/erp/platform.env
sudo mv /etc/erp/gateway.env.example /etc/erp/gateway.env
sudo chmod 0600 /etc/erp/*.env
sudoedit /etc/erp/gateway.env
```

Set real production secrets and database credentials before starting the
services. Add equivalent files for `sales`, `inventory`, `accounting`, `hr`,
`procurement`, and `delivery`, using the same `ERP_PACKAGE` and a health URL
for each service.

Build and install the supervisor:

```bash
pnpm install --frozen-lockfile
pnpm build
sudo cp ops/systemd/erp-app@.service /etc/systemd/system/
sudo cp ops/systemd/erp-app.target /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now erp-app.target
sudo systemctl enable --now nginx
```

## Operations

```bash
systemctl status erp-app.target
systemctl status erp-customer erp-gateway erp-platform
journalctl -u erp-customer -u erp-gateway -f
systemctl restart erp-customer
nginx -t && systemctl reload nginx
```

Each app must pass its readiness URL after startup. A crashed process is
restarted automatically, and systemd limits repeated restart storms.
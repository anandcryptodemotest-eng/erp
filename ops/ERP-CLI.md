# ERP operator CLI and self-recovery

This host is a **mixed** stack. Keep that boundary:

```
                    Internet
                       │
                    Nginx :443
                       │
          ┌────────────┴────────────┐
          │                         │
   Customer :3007             Platform :3011
     host/systemd                 host/systemd
          │                         │
          └────────────┬────────────┘
                       │
                 Gateway :3010
                   Compose
                       │
       ┌───────────────┼────────────────┐
       │               │                │
    Sales :3001    Inventory :3002   Other APIs
                       │
                   Postgres
```

- **Compose:** postgres, gateway, sales, inventory, accounting, hr, procurement, delivery
- **Host/systemd only:** customer (`:3007`), platform (`:3011`), nginx, and the `erp` watchdog
- **Never** run host systemd units for gateway / sales / inventory / other APIs alongside Compose

Do not introduce Kubernetes. Do not move domain APIs onto systemd.

## Why it felt “down”

| Layer | What it handles |
|-------|-----------------|
| `restart: unless-stopped` | Process crash / exit **inside** the container |
| Docker healthcheck | Unhealthy application process |
| `erp status` | Visibility (container + HTTP) |
| `erp doctor` | Config / secret / infra diagnosis |
| `erp heal` | Active recovery, including explicit `docker stop` / `compose stop` |
| systemd timer | Periodic `erp heal` (every 2 min) |

`docker kill` / `docker stop` are explicit Docker API stops and do **not** trigger `unless-stopped`. Heal and the watchdog bring those back. A crash of the app process (for example SIGTERM to Node) does.

Systemd supervises the **recovery command**, not the Compose apps.

Recent outages were mostly config/crash landmines: mismatched `JWT_SECRET` / `SERVICE_SECRET` after a partial recreate, placeholder secrets in production, OTEL left enabled with the collector stopped, and host UIs not in Compose.

## Commands

Install once (as root):

```bash
chmod +x /home/erp/scripts/erp
sudo /home/erp/scripts/erp install-watchdog
```

That installs `/usr/local/bin/erp` → `scripts/erp` and enables `erp-watchdog.timer`.

```bash
erp up                 # compose up -d (core only) + host customer/platform/nginx if units exist
erp down               # stop Compose core only
erp restart            # restart all Compose core services
erp restart gateway    # one Compose service
erp restart customer   # host UI unit
erp status             # docker health + HTTP live + nginx + customer/platform
erp logs               # follow Compose core logs
erp logs gateway
erp logs customer
erp doctor             # secrets, OTEL, nginx, host-boundary (never prints secrets)
erp heal               # recover crashed / unhealthy / secret mismatch
erp install-watchdog   # systemd timer → erp heal every 2 min
```

`pnpm erp -- status` is the same CLI via root `package.json`.

### `erp up` must not start host APIs

`erp up` starts only:

- Compose: postgres, gateway, sales, inventory, accounting, hr, procurement, delivery
- Host: `erp-app@customer`, `erp-app@platform`, `nginx` — **only if those units exist**

It never starts host gateway / sales / inventory / …. If those units are enabled, `erp heal` / `install-watchdog` stop and disable them.

### Secrets

`erp doctor` compares **SHA-256 fingerprints in memory**. It never prints secret values.

```
JWT_SECRET       MATCH   fingerprint: 8a31...e92c
SERVICE_SECRET   MATCH   fingerprint: 4f21...91ab
```

Placeholders (`dev-service-secret`, `change-me-in-production`, …) fail doctor.

If fingerprints differ across running app containers:

```
secret mismatch
      │
      ▼
recreate ALL API apps together
      │
      ├── gateway
      ├── sales
      ├── inventory
      ├── accounting
      ├── hr
      ├── procurement
      └── delivery
```

Never recreate only Gateway when shared secrets are inconsistent. That caused the 401-after-login outage.

### OTEL

Compose defaults `OTEL_SDK_DISABLED=true`. Leave the observation profile stopped unless you explicitly run:

```bash
docker compose --profile obs up -d
```

and set `OTEL_SDK_DISABLED=false`. Doctor fails if the collector is down while OTEL is still enabled.

## Watchdog

| Unit | Role |
|------|------|
| `erp-watchdog.service` | oneshot → `/usr/local/bin/erp heal` |
| `erp-watchdog.timer` | `OnBootSec=1min`, `OnUnitActiveSec=2min` (`Persistent=false`) |

Heal is a no-op when everything is already healthy (lock file + status checks). Overlapping runs skip.

```bash
systemctl list-timers erp-watchdog.timer
journalctl -u erp-watchdog.service -n 50
```

## Acceptance checks

- `docker compose ps` shows core services healthy
- `erp up` is idempotent
- `erp down` stops only the Compose core
- `erp status` detects container + HTTP failures
- Killing Gateway → Docker `unless-stopped` restarts it
- Unhealthy Gateway → `erp heal` recovers it
- Customer / platform process failure is recovered when the systemd unit exists
- Nginx failure is detected
- Placeholder `JWT_SECRET` / `SERVICE_SECRET` is detected
- Different secrets across containers are detected (fingerprints, no values)
- Secret mismatch recreates the **API group**, not Gateway alone
- `OTEL_SDK_DISABLED=true` works with the observation stack stopped
- `erp doctor` never prints secret values
- Watchdog runs every 2 minutes and is safe when healthy
- `erp up` never starts host Gateway / Sales

#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requiredMigrationDirs = [
  "apps/gateway/prisma/migrations",
  "apps/accounting/prisma/migrations",
  "apps/sales/prisma/migrations",
  "apps/inventory/prisma/migrations",
];
const nginxPath = process.env.NGINX_CONFIG
  ? path.resolve(process.env.NGINX_CONFIG)
  : path.join(root, "ops/nginx/platform.conf.example");

const failures = [];
for (const relative of requiredMigrationDirs) {
  const absolute = path.join(root, relative);
  const entries = fs.existsSync(absolute)
    ? fs.readdirSync(absolute, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];
  if (entries.length === 0) failures.push(`${relative}: no migration directories found`);
}

if (!fs.existsSync(nginxPath)) {
  failures.push(`nginx config not found: ${nginxPath}`);
} else {
  const config = fs.readFileSync(nginxPath, "utf8");
  for (const required of ["proxy_pass", "proxy_set_header Host", "proxy_set_header X-Forwarded-For"]) {
    if (!config.includes(required)) failures.push(`${nginxPath}: missing ${required}`);
  }
  if (config.includes("proxy_pass http://127.0.0.1:3001") || config.includes("proxy_pass http://127.0.0.1:3002")) {
    failures.push(`${nginxPath}: browser edge must proxy through Gateway, not directly to Sales or Inventory`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `FAIL ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Deployment artifact validation passed: ${requiredMigrationDirs.length} migration roots and nginx config ${nginxPath}`);

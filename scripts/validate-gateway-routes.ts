import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Rewrite = {
  source: string;
  destination: string;
  basePath?: boolean;
  regex?: string;
};

type RoutesManifest = {
  basePath: string;
  rewrites: Record<string, Rewrite[]>;
};

type RouteRecord = {
  phase: string;
  source: string;
  destination: string;
  service: string;
  targetPath: string;
  status: "verified" | "catch-all" | "missing";
};

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repositoryRoot, "apps/gateway/.next/routes-manifest.json");
const outputPath = path.join(repositoryRoot, "docs/generated/gateway-route-manifest.json");

const services = {
  gateway: { url: process.env.GATEWAY_SERVICE_URL ?? "http://localhost:3010", appRoot: "apps/gateway" },
  sales: { url: process.env.SALES_SERVICE_URL ?? "http://localhost:3001", appRoot: "apps/sales" },
  inventory: { url: process.env.INVENTORY_SERVICE_URL ?? "http://localhost:3002", appRoot: "apps/inventory" },
  accounting: { url: process.env.ACCOUNTING_SERVICE_URL ?? "http://localhost:3003", appRoot: "apps/accounting" },
  hr: { url: process.env.HR_SERVICE_URL ?? "http://localhost:3004", appRoot: "apps/hr" },
  procurement: { url: process.env.PROCUREMENT_SERVICE_URL ?? "http://localhost:3005", appRoot: "apps/procurement" },
  delivery: { url: process.env.DELIVERY_SERVICE_URL ?? "http://localhost:3006", appRoot: "apps/delivery" },
} as const;

type ServiceName = keyof typeof services;

function normalizeOrigin(value: string) {
  return new URL(value).origin;
}

function targetPath(destination: string, service: ServiceName) {
  const url = new URL(destination, services.gateway.url);
  const pathWithoutParams = url.pathname.replace(/\/:(?:path|param|id|docId|tenantId|uid|addrId|groupCode|code|slug)\*?$/, "");
  const wildcardIndex = pathWithoutParams.indexOf("/:");
  const routePath = wildcardIndex >= 0 ? pathWithoutParams.slice(0, wildcardIndex) : pathWithoutParams;
  if (service === "gateway" && routePath.startsWith("/admin/")) {
    return routePath.slice("/admin".length);
  }
  return routePath || "/";
}

function serviceForDestination(destination: string): ServiceName | null {
  const origin = normalizeOrigin(new URL(destination, services.gateway.url).origin);
  return (Object.keys(services) as ServiceName[]).find((service) => normalizeOrigin(services[service].url) === origin) ?? null;
}

async function routeExists(service: ServiceName, route: string) {
  const routeRoot = path.join(repositoryRoot, services[service].appRoot, "src/app", route.replace(/^\//, ""));
  try {
    const entries = await readdir(routeRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name === "route.ts") return true;
      if (entry.isDirectory() && (await routeExistsInDirectory(path.join(routeRoot, entry.name)))) return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function routeExistsInDirectory(directory: string): Promise<boolean> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name === "route.ts") return true;
      if (entry.isDirectory() && (await routeExistsInDirectory(path.join(directory, entry.name)))) return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function main() {
  let manifest: RoutesManifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8")) as RoutesManifest;
  } catch {
    throw new Error(`Gateway build manifest not found at ${manifestPath}. Run the Gateway build first.`);
  }

  const records: RouteRecord[] = [];
  for (const [phase, rewrites] of Object.entries(manifest.rewrites)) {
    for (const rewrite of rewrites ?? []) {
      const service = serviceForDestination(rewrite.destination);
      if (!service) {
        records.push({ phase, source: rewrite.source, destination: rewrite.destination, service: "unknown", targetPath: "", status: "missing" });
        continue;
      }
      const route = targetPath(rewrite.destination, service);
      const catchAll = rewrite.destination.includes(":path*") && route === "/api";
      records.push({
        phase,
        source: rewrite.source,
        destination: rewrite.destination,
        service,
        targetPath: route,
        status: catchAll ? "catch-all" : (await routeExists(service, route) ? "verified" : "missing"),
      });
    }
  }

  const missing = records.filter((record) => record.status === "missing");
  const output = {
    version: 1,
    basePath: manifest.basePath,
    generatedFrom: "apps/gateway/.next/routes-manifest.json",
    services: Object.fromEntries(Object.entries(services).map(([name, config]) => [name, config.url])),
    summary: {
      total: records.length,
      verified: records.filter((record) => record.status === "verified").length,
      catchAll: records.filter((record) => record.status === "catch-all").length,
      missing: missing.length,
    },
    routes: records,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  if (missing.length > 0) {
    for (const record of missing) {
      console.error(`${record.service}: ${record.source} -> ${record.targetPath}`);
    }
    throw new Error(`Gateway route validation failed for ${missing.length} rewrite(s).`);
  }

  console.log(`Gateway route validation passed: ${output.summary.verified} verified, ${output.summary.catchAll} catch-all, ${output.summary.total} total.`);
}

await main();

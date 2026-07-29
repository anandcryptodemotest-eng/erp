#!/usr/bin/env node
/**
 * Architecture fitness checks (Platform Architecture v1.0).
 * Exit 1 if forbidden patterns are found.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");

function rg(pattern, dir, { fixed = false } = {}) {
  const args = ["-n", ...(fixed ? ["-F"] : []), pattern, dir, "-g", "!**/node_modules/**", "-g", "!**/dist/**", "-g", "!**/.next/**"];
  const r = spawnSync("rg", args, { cwd: root, encoding: "utf8" });
  if (r.status === 1) return ""; // no matches
  if (r.status !== 0 && r.status !== 1) return "";
  return r.stdout || "";
}

const failures = [];

{
  const hits = rg("apps/sales|@erp/sales", "packages/workflow/src");
  const bad = hits
    .split("\n")
    .filter((l) => l && !l.includes("fitness") && !l.includes("* ") && /from ['"]|require\(|import\(/.test(l));
  if (bad.length) failures.push("workflow→sales:\n" + bad.join("\n"));
}

{
  const hits = rg("apps/(sales|inventory|gateway)|@erp/sales|@erp/inventory", "packages/ui-runtime/src");
  const bad = hits.split("\n").filter(Boolean);
  if (bad.length) failures.push("ui-runtime→apps:\n" + bad.join("\n"));
}

{
  const oms = path.join(root, "apps/gateway/src/app/(admin)/oms/page.tsx");
  if (fs.existsSync(oms)) {
    const src = fs.readFileSync(oms, "utf8");
    if (/const\s+STEP_UI_REGISTRY\s*=/.test(src)) {
      failures.push("OMS still defines live STEP_UI_REGISTRY — use snapshot Form UI only");
    }
  }
}

{
  const hits = rg("STEP_UI_REGISTRY", "apps/gateway/src/lib/ui-runtime", { fixed: true });
  const bad = hits.split("\n").filter(Boolean);
  if (bad.length) failures.push("gateway ui-runtime legacy:\n" + bad.join("\n"));
}

{
  const ordersRoute = path.join(root, "apps/sales/src/app/api/orders/route.ts");
  if (fs.existsSync(ordersRoute)) {
    const src = fs.readFileSync(ordersRoute, "utf8");
    if (!src.includes("startSalesOrderWorkflowV5")) {
      failures.push("POST /api/orders must start v5 snapshot workflow (startSalesOrderWorkflowV5)");
    }
  }
}

{
  const convert = path.join(root, "apps/sales/src/app/api/sales-requests/[id]/convert/route.ts");
  if (fs.existsSync(convert)) {
    const src = fs.readFileSync(convert, "utf8");
    if (src.includes("ensureWorkflowRuntimeForOrder")) {
      failures.push("SREQ convert must not fall back to hybrid ensureWorkflowRuntimeForOrder");
    }
  }
}

{
  const hybrid = require("path").join(root, "apps/sales/src/lib/workflow-runtime.ts");
  if (require("fs").existsSync(hybrid)) {
    failures.push("Hybrid workflow-runtime.ts must be deleted (greenfield v5 only)");
  }
}

const BACKENDS = ["gateway", "sales", "inventory", "accounting", "hr", "procurement", "delivery"];

{
  for (const app of BACKENDS) {
    const instr = path.join(root, `apps/${app}/src/instrumentation.ts`);
    if (!fs.existsSync(instr)) {
      failures.push(`${app}: missing src/instrumentation.ts with bootstrapTelemetry`);
      continue;
    }
    const src = fs.readFileSync(instr, "utf8");
    if (!src.includes("bootstrapTelemetry")) {
      failures.push(`${app}: instrumentation.ts must call bootstrapTelemetry`);
    }
    const live = path.join(root, `apps/${app}/src/app/health/live/route.ts`);
    const ready = path.join(root, `apps/${app}/src/app/health/ready/route.ts`);
    if (!fs.existsSync(live)) failures.push(`${app}: missing /health/live`);
    if (!fs.existsSync(ready)) failures.push(`${app}: missing /health/ready`);
    const pkg = path.join(root, `apps/${app}/package.json`);
    if (fs.existsSync(pkg)) {
      const j = JSON.parse(fs.readFileSync(pkg, "utf8"));
      if (!j.dependencies?.["@erp/logger"]) failures.push(`${app}: must depend on @erp/logger`);
      if (!j.dependencies?.["@erp/telemetry"]) failures.push(`${app}: must depend on @erp/telemetry`);
    }
  }
}

{
  // Forbidden: raw OTel in apps (except packages/telemetry)
  const hits = rg(
    "from [\"']@opentelemetry/",
    "apps"
  );
  const bad = hits
    .split("\n")
    .filter((l) => l && !l.includes("node_modules"));
  if (bad.length) failures.push("apps must not import raw @opentelemetry/*:\n" + bad.join("\n"));
}

{
  const hits = rg("traceparent", "apps");
  const bad = hits
    .split("\n")
    .filter(
      (l) =>
        l &&
        !l.includes("node_modules") &&
        /headers?\.(set|append)\([\"']traceparent/i.test(l)
    );
  if (bad.length) {
    failures.push("manual traceparent set outside telemetry/config:\n" + bad.join("\n"));
  }
}

{
  // console.log/error in backend production paths (api + lib)
  for (const app of BACKENDS) {
    for (const sub of ["app/api", "lib"]) {
      const dir = path.join(root, `apps/${app}/src/${sub}`);
      if (!fs.existsSync(dir)) continue;
      const hits = rg("console\\.(log|error|warn|debug)\\(", dir);
      const bad = hits.split("\n").filter(Boolean);
      if (bad.length) {
        failures.push(`${app}/src/${sub} uses console.* — use @erp/logger:\n` + bad.join("\n"));
      }
    }
  }
}

{
  const formsDesigner = path.join(root, "apps/gateway/src/app/(admin)/configuration/forms/[id]/page.tsx");
  if (fs.existsSync(formsDesigner)) {
    const src = fs.readFileSync(formsDesigner, "utf8");
    if (/widget:\s*[\"']SalesReview[\"']|component:\s*[\"']SalesReview[\"']|SalesReview bridge/.test(src)) {
      failures.push("Form designer must not synthesize SalesReview — use ProductList/CatalogSearch/FormFields");
    }
  }
}

{
  const contract = path.join(root, "docs/guides/deployment-contract.md");
  if (!fs.existsSync(contract)) {
    failures.push("Missing docs/guides/deployment-contract.md (Deployment Contract)");
  }
  for (const app of BACKENDS) {
    const df = path.join(root, `apps/${app}/Dockerfile`);
    if (!fs.existsSync(df)) failures.push(`${app}: missing Dockerfile (Deployment Contract)`);
  }
  const shared = path.join(root, "docker/Dockerfile.next");
  if (!fs.existsSync(shared)) failures.push("Missing docker/Dockerfile.next");
}

if (failures.length) {
  console.error("Architecture fitness FAILED:\n" + failures.join("\n\n"));
  process.exit(1);
}
console.log("Architecture fitness OK");

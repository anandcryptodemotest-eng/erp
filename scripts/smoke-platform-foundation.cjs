#!/usr/bin/env node
/**
 * Hybrid platform smoke — health + Deployment Contract surface for backends.
 * Usage: node scripts/smoke-platform-foundation.cjs
 */
const backends = [
  { name: "gateway", live: "http://127.0.0.1:3010/admin/health/live", ready: "http://127.0.0.1:3010/admin/health/ready" },
  { name: "sales", live: "http://127.0.0.1:3001/health/live", ready: "http://127.0.0.1:3001/health/ready" },
  { name: "inventory", live: "http://127.0.0.1:3002/health/live", ready: "http://127.0.0.1:3002/health/ready" },
  { name: "accounting", live: "http://127.0.0.1:3003/health/live", ready: "http://127.0.0.1:3003/health/ready" },
  { name: "hr", live: "http://127.0.0.1:3004/health/live", ready: "http://127.0.0.1:3004/health/ready" },
  { name: "procurement", live: "http://127.0.0.1:3005/health/live", ready: "http://127.0.0.1:3005/health/ready" },
  { name: "delivery", live: "http://127.0.0.1:3006/health/live", ready: "http://127.0.0.1:3006/health/ready" },
];

async function check(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

(async () => {
  let failed = 0;
  for (const b of backends) {
    const live = await check(b.live);
    const ready = await check(b.ready);
    const liveOk = live.ok && live.body?.status === "UP" && live.body?.service;
    const readyOk = ready.ok && ready.body?.checks;
    console.log(
      `${b.name}: live=${liveOk ? "OK" : "FAIL"} ready=${readyOk ? "OK" : "FAIL"}${live.error || ready.error ? ` (${live.error || ready.error})` : ""}`
    );
    if (!liveOk || !readyOk) failed++;
  }
  const obs = [
    ["grafana", "http://127.0.0.1:3000/api/health"],
    ["prometheus", "http://127.0.0.1:9090/-/ready"],
    ["tempo", "http://127.0.0.1:3200/ready"],
    ["loki", "http://127.0.0.1:3100/ready"],
  ];
  for (const [name, url] of obs) {
    const r = await check(url);
    const ok = r.ok || r.status === 200;
    console.log(`obs/${name}: ${ok ? "OK" : "FAIL"}`);
    if (!ok) failed++;
  }
  if (failed) {
    console.error(`smoke-platform-foundation: ${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("smoke-platform-foundation: OK");
})();

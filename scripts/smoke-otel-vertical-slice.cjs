#!/usr/bin/env node
/**
 * Emit a Platform v1.0 vertical-slice span chain to the OTLP collector.
 * Proves Grafana/Tempo can receive Domain.Action spans without a full browser flow.
 *
 * Usage:
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 node scripts/smoke-otel-vertical-slice.cjs
 */
const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://127.0.0.1:4318").replace(/\/$/, "");

const spans = [
  "SalesOrder.Convert",
  "Workflow.Start",
  "Inventory.Reserve",
  "Workflow.CompleteTask",
];

function hex(n) {
  return Buffer.from(Array.from({ length: n }, () => Math.floor(Math.random() * 256))).toString("hex");
}

const traceId = hex(16);
const now = BigInt(Date.now()) * 1000000n;

const otlpSpans = spans.map((name, i) => {
  const start = now + BigInt(i) * 5_000_000n;
  const end = start + 4_000_000n;
  return {
    traceId,
    spanId: hex(8),
    parentSpanId: i === 0 ? undefined : undefined,
    name,
    kind: 1,
    startTimeUnixNano: start.toString(),
    endTimeUnixNano: end.toString(),
    attributes: [
      { key: "service.namespace", value: { stringValue: "erp" } },
      { key: "smoke", value: { boolValue: true } },
      { key: "slice", value: { stringValue: "oms-vertical" } },
    ],
    events: [
      {
        timeUnixNano: start.toString(),
        name:
          name === "Workflow.Start"
            ? "WorkflowStarted"
            : name === "Workflow.CompleteTask"
              ? "TaskCompleted"
              : name === "SalesOrder.Convert"
                ? "SnapshotCreated"
                : "InventoryReserved",
      },
    ],
    status: { code: 1 },
  };
});

// Parent chain
for (let i = 1; i < otlpSpans.length; i++) {
  otlpSpans[i].parentSpanId = otlpSpans[i - 1].spanId;
}

const body = {
  resourceSpans: [
    {
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: "smoke-vertical-slice" } },
          { key: "service.namespace", value: { stringValue: "erp" } },
          { key: "deployment.environment", value: { stringValue: "development" } },
        ],
      },
      scopeSpans: [{ scope: { name: "erp.smoke" }, spans: otlpSpans }],
    },
  ],
};

(async () => {
  const url = `${endpoint}/v1/traces`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    console.error(`OTLP export failed ${res.status}: ${text.slice(0, 400)}`);
    process.exit(1);
  }
  console.log(`Exported ${spans.length} spans on traceId=${traceId}`);
  console.log(`Tempo search: { name =~ "SalesOrder\\\\..*|Workflow\\\\..*|Inventory\\\\..*" }`);
  console.log(`Grafana: http://localhost:3000 → Explore → Tempo → trace id ${traceId}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

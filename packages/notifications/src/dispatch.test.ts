import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_NOTIFICATION_POLICY, MAX_DELIVERY_ATTEMPTS } from "./constants";
import { parseSendCommand } from "./command";
import { dispatchSendCommand, retryDelivery } from "./dispatch";
import type { AdapterResult, DeliveryRecord, NotificationPolicy, SendContext } from "./types";

function memoryStore() {
  const rows = new Map<string, DeliveryRecord>();
  let n = 0;
  return {
    rows,
    async persist(input: Omit<DeliveryRecord, "id"> & { id?: string }): Promise<DeliveryRecord> {
      const id = input.id ?? `d${++n}`;
      const row = { ...input, id } as DeliveryRecord;
      rows.set(id, row);
      return row;
    },
    async update(id: string, patch: Partial<DeliveryRecord>) {
      const cur = rows.get(id);
      if (!cur) throw new Error("missing");
      rows.set(id, { ...cur, ...patch });
    },
    async findByIdempotency(key: string) {
      const hit = [...rows.values()].filter((r) => r.idempotencyKey === key);
      return hit.length ? hit : null;
    },
  };
}

describe("dispatchSendCommand", () => {
  it("DEMO-sends requested channels and records deliveries", async () => {
    const store = memoryStore();
    const sent: SendContext[] = [];
    const result = await dispatchSendCommand(
      parseSendCommand({
        type: "ORDER_CONFIRMED",
        title: "Order {{n}}",
        body: "Ready",
        channels: ["EMAIL", "WHATSAPP", "TELEGRAM"],
        recipients: [{ email: "a@b.co", phone: "9999999999", telegramChatId: "111" }],
        variables: { n: "SO-9" },
      }),
      {
        tenantId: "t1",
        loadPolicy: async () => DEFAULT_NOTIFICATION_POLICY,
        findByIdempotency: store.findByIdempotency,
        persist: store.persist,
        update: store.update,
        send: async (ctx) => {
          sent.push(ctx);
          return { status: "SENT", provider: "DEMO", providerMessageId: `demo-${ctx.channel}` };
        },
      }
    );
    assert.equal(result.idempotent, false);
    assert.equal(result.mode, "DEMO");
    assert.equal(result.deliveries.length, 3);
    assert.ok(result.deliveries.every((d) => d.status === "SENT"));
    assert.equal(sent[0]?.title, "Order SO-9");
    assert.deepEqual(
      result.deliveries.map((d) => d.channel).sort(),
      ["EMAIL", "TELEGRAM", "WHATSAPP"]
    );
  });

  it("replays the same idempotency key without a second send", async () => {
    const store = memoryStore();
    let sends = 0;
    const deps = {
      tenantId: "t1",
      loadPolicy: async () => DEFAULT_NOTIFICATION_POLICY,
      findByIdempotency: store.findByIdempotency,
      persist: store.persist,
      update: store.update,
      send: async (): Promise<AdapterResult> => {
        sends += 1;
        return { status: "SENT", provider: "DEMO" };
      },
    };
    const cmd = parseSendCommand({
      type: "X",
      title: "t",
      body: "b",
      recipients: [{ userId: "u1" }],
      idempotencyKey: "once",
    });
    await dispatchSendCommand(cmd, deps);
    const second = await dispatchSendCommand(cmd, deps);
    assert.equal(sends, 1);
    assert.equal(second.idempotent, true);
    assert.equal(second.deliveries.length, 1);
  });

  it("fails when the channel has no address", async () => {
    const store = memoryStore();
    const result = await dispatchSendCommand(
      parseSendCommand({
        type: "X",
        title: "t",
        body: "b",
        channels: ["EMAIL"],
        recipients: [{ userId: "u1" }],
      }),
      {
        tenantId: "t1",
        loadPolicy: async () => DEFAULT_NOTIFICATION_POLICY,
        findByIdempotency: store.findByIdempotency,
        persist: store.persist,
        update: store.update,
        send: async () => ({ status: "SENT", provider: "DEMO" }),
      }
    );
    assert.equal(result.deliveries[0]?.status, "FAILED");
    assert.match(result.deliveries[0]?.error ?? "", /Missing recipient address/);
  });

  it("marks exhausted retries DEAD", async () => {
    const store = memoryStore();
    const row = await store.persist({
      tenantId: "t1",
      channel: "SMS",
      status: "FAILED",
      type: "X",
      title: "t",
      body: "b",
      toAddress: "999",
      userId: null,
      provider: "FAST2SMS",
      providerMessageId: null,
      error: "timeout",
      attemptCount: MAX_DELIVERY_ATTEMPTS,
      maxAttempts: MAX_DELIVERY_ATTEMPTS,
      idempotencyKey: null,
      commandVersion: 1,
      metadata: null,
    });
    const retried = await retryDelivery(
      row,
      {
        update: store.update,
        send: async () => ({ status: "SENT", provider: "FAST2SMS" }),
      },
      "LIVE"
    );
    assert.equal(retried.status, "DEAD");
  });

  it("retries a FAILED delivery", async () => {
    const store = memoryStore();
    const row = await store.persist({
      tenantId: "t1",
      channel: "TELEGRAM",
      status: "FAILED",
      type: "X",
      title: "t",
      body: "b",
      toAddress: "111",
      userId: null,
      provider: "TELEGRAM",
      providerMessageId: null,
      error: "timeout",
      attemptCount: 1,
      maxAttempts: MAX_DELIVERY_ATTEMPTS,
      idempotencyKey: null,
      commandVersion: 1,
      metadata: null,
    });
    const retried = await retryDelivery(
      row,
      {
        update: store.update,
        send: async () => ({ status: "SENT", provider: "TELEGRAM", providerMessageId: "m1" }),
      },
      "LIVE"
    );
    assert.equal(retried.status, "SENT");
    assert.equal(retried.providerMessageId, "m1");
  });

  it("honours disabled channels", async () => {
    const store = memoryStore();
    const policy: NotificationPolicy = {
      ...DEFAULT_NOTIFICATION_POLICY,
      channels: {
        ...DEFAULT_NOTIFICATION_POLICY.channels,
        SMS: { enabled: false },
      },
    };
    const result = await dispatchSendCommand(
      parseSendCommand({
        type: "X",
        title: "t",
        body: "b",
        channels: ["SMS", "IN_APP"],
        recipients: [{ userId: "u1" }],
      }),
      {
        tenantId: "t1",
        loadPolicy: async () => policy,
        findByIdempotency: store.findByIdempotency,
        persist: store.persist,
        update: store.update,
        send: async () => ({ status: "SENT", provider: "DEMO" }),
      }
    );
    assert.deepEqual(result.deliveries.map((d) => d.channel), ["IN_APP"]);
  });
});

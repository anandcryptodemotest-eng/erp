import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NotificationCommandError,
  parseSendCommand,
  recipientAddress,
  resolveChannels,
} from "./command";
import { DEFAULT_NOTIFICATION_POLICY } from "./constants";
import { renderTemplate } from "./render";

describe("notification command v1", () => {
  it("parses a valid send command", () => {
    const cmd = parseSendCommand({
      version: 1,
      type: "ORDER_CONFIRMED",
      title: "Order {{number}}",
      body: "Thanks {{name}}",
      channels: ["EMAIL", "SMS"],
      recipients: [{ email: "a@b.co", phone: "9999999999" }],
      variables: { number: "SO-1", name: "Ravi" },
      idempotencyKey: "k1",
    });
    assert.equal(cmd.version, 1);
    assert.deepEqual(cmd.channels, ["EMAIL", "SMS"]);
    assert.equal(cmd.recipients[0].email, "a@b.co");
    assert.equal(cmd.idempotencyKey, "k1");
  });

  it("rejects unknown command version", () => {
    assert.throws(
      () => parseSendCommand({ version: 2, type: "X", title: "t", body: "b", recipients: [{ userId: "u" }] }),
      NotificationCommandError
    );
  });

  it("rejects empty recipients", () => {
    assert.throws(
      () => parseSendCommand({ type: "X", title: "t", body: "b", recipients: [] }),
      /recipients must be a non-empty array/
    );
  });

  it("rejects unknown channels", () => {
    assert.throws(
      () =>
        parseSendCommand({
          type: "X",
          title: "t",
          body: "b",
          channels: ["PIGEON"],
          recipients: [{ userId: "u" }],
        }),
      /Unknown channel/
    );
  });

  it("maps recipient addresses per channel", () => {
    const r = { userId: "u1", email: "a@b.co", phone: "91", telegramChatId: "c1" };
    assert.equal(recipientAddress("IN_APP", r), "u1");
    assert.equal(recipientAddress("FCM", r), "u1");
    assert.equal(recipientAddress("EMAIL", r), "a@b.co");
    assert.equal(recipientAddress("SMS", r), "91");
    assert.equal(recipientAddress("WHATSAPP", r), "91");
    assert.equal(recipientAddress("TELEGRAM", r), "c1");
  });

  it("filters disabled channels and defaults to IN_APP", () => {
    const policy = DEFAULT_NOTIFICATION_POLICY;
    assert.deepEqual(resolveChannels(undefined, policy.defaultChannels, policy.channels), ["IN_APP"]);
    const disabled = {
      ...policy.channels,
      EMAIL: { enabled: false },
    };
    assert.deepEqual(resolveChannels(["EMAIL", "SMS"], policy.defaultChannels, disabled), ["SMS"]);
  });
});

describe("template render", () => {
  it("substitutes known variables and leaves unknown tokens", () => {
    assert.equal(renderTemplate("Hi {{name}}, order {{id}}", { name: "Ravi" }), "Hi Ravi, order {{id}}");
  });
});

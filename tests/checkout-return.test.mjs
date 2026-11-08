import assert from "node:assert/strict";
import { test } from "node:test";

import { finishCheckout, readPaidReceipt, watchCheckout } from "../lib/checkout-return.ts";

const id = "rcpt_6ee09dc4ef0996cbef375500";
const other = "rcpt_68bf79004ca5cdd170749995";
const captured = { mandate_id: id, status: "CAPTURED", paypal_order_id: "ORDER1", cart: { total: "85.95" }, constraints: { currency: "USD" } };

function browser() {
  const channels = [];
  const timers = new Map();
  const actions = [];
  let sequence = 0;
  class Channel {
    onmessage = null;
    messages = [];
    closed = false;
    constructor() { channels.push(this); }
    postMessage(data) { this.messages.push(data); }
    close() { this.closed = true; }
  }
  return {
    BroadcastChannel: Channel, channels, timers, actions,
    setTimeout(fn, ms) { const key = ++sequence; timers.set(key, { fn, ms }); return key; },
    clearTimeout(key) { timers.delete(key); },
    close() { actions.push("close"); },
    focus() { actions.push("focus"); },
    location: { replace(path) { actions.push(path); } },
    async tick(ms) {
      for (const [key, timer] of [...timers]) if (timer.ms === ms) { timers.delete(key); await timer.fn(); }
    },
  };
}

test("only a matching captured backend receipt is considered paid", async () => {
  for (const record of [{ ...captured, status: "ORDERED" }, { ...captured, paypal_order_id: null }, { ...captured, mandate_id: other }]) {
    assert.equal(await readPaidReceipt(id, async () => record), null);
  }
  assert.equal(await readPaidReceipt("//evil.example", async () => { throw Error("must not fetch"); }), null);
  assert.equal((await readPaidReceipt(id, async () => captured)).total, "85.95");
});

test("shopping tab checks payment with backend before acknowledging and ignores other receipts", async () => {
  const b = browser();
  let record = { ...captured, status: "ORDERED" };
  const paid = [];
  const cleanup = watchCheckout(id, async () => record, (receipt) => paid.push(receipt), b);
  const channel = b.channels[0];
  await channel.onmessage({ data: { type: "paid", mandate_id: other } });
  await channel.onmessage({ data: { type: "paid", mandate_id: id } });
  assert.deepEqual(paid, []);
  assert.deepEqual(channel.messages, []);
  record = captured;
  await channel.onmessage({ data: { type: "paid", mandate_id: id } });
  await channel.onmessage({ data: { type: "paid", mandate_id: id } });
  assert.equal(paid.length, 1);
  assert.deepEqual(channel.messages.at(-1), { type: "paid-received", mandate_id: id });
  cleanup();
  assert.equal(channel.closed, true);
});

test("checkout closes after acknowledgement, with a fixed redirect if closing is blocked", async () => {
  const b = browser();
  const cleanup = finishCheckout(id, b);
  const channel = b.channels[0];
  assert.deepEqual(channel.messages, [{ type: "paid", mandate_id: id }]);
  await channel.onmessage({ data: { type: "paid-received", mandate_id: other } });
  assert.deepEqual(b.actions, []);
  await channel.onmessage({ data: { type: "paid-received", mandate_id: id } });
  await b.tick(1200);
  assert.deepEqual(b.actions, ["close"]);
  await b.tick(200);
  assert.deepEqual(b.actions, ["close", `/shop?paid=${id}`]);
  cleanup();
  assert.equal(b.timers.size, 0);
});

test("checkout redirects without closing if the shopping tab is absent or channels are unavailable", async () => {
  for (const available of [true, false]) {
    const b = browser();
    if (!available) b.BroadcastChannel = undefined;
    const cleanup = finishCheckout(id, b);
    await b.tick(2500);
    assert.deepEqual(b.actions, [`/shop?paid=${id}`]);
    cleanup();
  }
});

test("effect cleanup cancels return timers and invalid receipt IDs never navigate", async () => {
  const b = browser();
  finishCheckout(id, b)();
  await b.tick(2500);
  assert.deepEqual(b.actions, []);
  assert.throws(() => finishCheckout("https://evil.example", b));
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { api, getToken, subscribeSellerSession } from "../lib/api.ts";

function sellerSession(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let token = "seller-test-token";
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => token, removeItem: () => { token = null; } },
  });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete globalThis.localStorage; });
}

test("shopping uses its visitor cookie without sending a seller token", async (t) => {
  sellerSession(t);
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(init.credentials, "include");
    assert.equal(init.headers.get("Authorization"), null);
    return new Response("{}", { status: 200 });
  });
  await api("/api/demo/shopping/status");
});

test("merchant requests retain seller authorization", async (t) => {
  sellerSession(t);
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(init.headers.get("Authorization"), "Bearer seller-test-token");
    return new Response("[]", { status: 200 });
  });
  await api("/api/orders");
});

test("buyer failures preserve the seller session and a rejected seller token expires it", async (t) => {
  sellerSession(t);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
  let notifications = 0;
  const unsubscribe = subscribeSellerSession(() => { notifications++; });
  t.after(() => {
    unsubscribe();
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  });
  t.mock.method(globalThis, "fetch", async () => new Response('{"detail":"Unauthorized"}', { status: 401 }));

  await assert.rejects(api("/api/demo/shopping/status"), { status: 401 });
  await assert.rejects(api("/api/mandates/example", { auth: false }), { status: 401 });
  assert.equal(getToken(), "seller-test-token");
  assert.equal(notifications, 0);

  await assert.rejects(api("/api/orders"), { status: 401 });
  assert.equal(getToken(), null);
  assert.equal(notifications, 1);
});

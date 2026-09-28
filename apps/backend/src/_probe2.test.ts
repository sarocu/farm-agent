import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app.js";

test("health endpoint", async () => {
  const { app, close } = createApp();
  // override config to use a temp db dir
  const server = app.listen(0, "127.0.0.1");
  const port = (server.address() as { port: number }).port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
  } finally {
    server.close();
    close();
  }
});

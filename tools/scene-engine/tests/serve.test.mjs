import test from "node:test";
import assert from "node:assert/strict";
import { serve } from "../serve.mjs";

test("standalone server binds loopback and serves only allowed source files", async () => {
  const { server, url } = await serve();
  try {
    assert.equal(server.address().address, "127.0.0.1");
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /viewer\.mjs/);
    for (const path of [
      "/.git/config",
      "/tools/scene-engine/package.json",
      "/tools/scene-engine/output/report.json",
      "/tools/scene-engine/%2e%2e/%2e%2e/.git/config",
    ]) {
      assert.equal((await fetch(new URL(path, url))).status, 404);
    }
    assert.equal(
      (await fetch(url, { method: "POST", body: "not writable" })).status,
      404,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

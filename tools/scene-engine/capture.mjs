import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { serve } from "./serve.mjs";
import assert from "node:assert/strict";
const output = new URL("./output/", import.meta.url);
await mkdir(output, { recursive: true });
const { server, url } = await serve();
let browser;
const report = {
  fixture:
    "production cantina geometry + original ship atlas; sample placements only",
  logicalSize: [320, 180],
  samples: [],
  checks: [],
};
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 800 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(url);
  await page.waitForFunction(
    () => window.sceneExperiment?.metrics?.gpu?.triangles > 0,
  );
  report.browser = browser.version();
  report.cold = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(window.sceneExperiment.backends).map(([k, b]) => [
        k,
        {
          initializationMs: b.initializationMs,
          firstRenderCpuMs: b.firstRenderMs,
        },
      ]),
    ),
  );
  report.renderer = await page.evaluate(() => {
    const gl = window.sceneExperiment.backends.gpu.gl,
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
  });
  for (const [name, yaw, advance] of [
    ["entrance", 0, -0.4],
    ["bar", -25, 2],
    ["side", 35, 1],
  ]) {
    await page.locator("#yaw").fill(String(yaw));
    await page.locator("#advance").fill(String(advance));
    await page.evaluate(() => window.sceneExperiment.render());
    await page.screenshot({
      path: new URL(`${name}-ab.png`, output).pathname,
      fullPage: true,
    });
    for (const key of ["gpu", "software"])
      await page
        .locator(`#${key}-surface`)
        .screenshot({ path: new URL(`${name}-${key}.png`, output).pathname });
    const measurement = await page.evaluate(async () => {
      const e = window.sceneExperiment,
        result = {};
      for (const [key, b] of Object.entries(e.backends)) {
        for (let i = 0; i < 8; i++) {
          b.render(e.camera);
          await new Promise(requestAnimationFrame);
        }
        const samples = [];
        let last;
        for (let i = 0; i < 40; i++) {
          last = b.render(e.camera);
          samples.push(last.cpuMs);
          await new Promise(requestAnimationFrame);
        }
        samples.sort((a, b) => a - b);
        result[key] = {
          cpuMedianMs: samples[20],
          cpuP95Ms: samples[37],
          cpuMaxMs: samples.at(-1),
          ...last,
        };
      }
      return result;
    });
    report.samples.push({ name, yaw, advance, ...measurement });
  }
  // Resize never stretches a logical pixel; small viewports explicitly crop.
  await page.setViewportSize({ width: 280, height: 800 });
  await page.waitForFunction(() => window.sceneExperiment.layouts.gpu.cropped);
  assert.equal(
    await page.evaluate(() => window.sceneExperiment.layouts.gpu.scale),
    1,
  );
  await page.screenshot({
    path: new URL("compact-ab.png", output).pathname,
    fullPage: true,
  });
  report.checks.push("compact integer-or-crop");
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.locator("#close").click();
  assert.equal(await page.locator("canvas").count(), 0);
  await page.locator("#open").click();
  await page.waitForFunction(
    () => window.sceneExperiment.metrics.gpu.triangles > 0,
  );
  report.checks.push("close -> reopen");
  // Force real WebGL loss/restoration. No fabricated event-only recovery test.
  await page.evaluate(() => {
    window.sceneExperiment.render();
    window.beforeLoss = window.sceneExperiment.backends.gpu.canvas.toDataURL();
    window.lossExtension =
      window.sceneExperiment.backends.gpu.gl.getExtension("WEBGL_lose_context");
    window.lossExtension.loseContext();
  });
  await page.waitForFunction(() => window.sceneExperiment.backends.gpu.lost);
  await page.evaluate(() => window.lossExtension.restoreContext());
  await page.waitForFunction(() => !window.sceneExperiment.backends.gpu.lost);
  await page.evaluate(() => window.sceneExperiment.render());
  for (const [name, data] of Object.entries(
    await page.evaluate(() => ({
      before: window.beforeLoss,
      after: window.sceneExperiment.backends.gpu.canvas.toDataURL(),
    })),
  )) {
    await writeFile(
      new URL(`context-${name}.png`, output),
      Buffer.from(data.split(",")[1], "base64"),
    );
  }
  assert.equal(
    await page.evaluate(
      () =>
        window.beforeLoss ===
        window.sceneExperiment.backends.gpu.canvas.toDataURL(),
    ),
    true,
  );
  report.checks.push("WebGL context lost -> restored -> identical image");
  report.checks.push(
    ...(await page.evaluate(async () => {
      const { rasterChecks } = await import("./raster-checks.mjs");
      return rasterChecks();
    })),
  );
  assert.deepEqual(errors, []);
  report.checks.push("no browser errors");
  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === "webgl2" ? null : original.call(this, type, ...args);
    };
  });
  await fallback.goto(url);
  await fallback.waitForFunction(
    () => window.sceneExperiment?.metrics.software?.polygons > 0,
  );
  assert.equal(await fallback.locator("#gpu-surface canvas").count(), 0);
  report.checks.push("WebGL unavailable: software consumer remains runnable");
  await fallback.close();
  await writeFile(
    new URL("report.json", output),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

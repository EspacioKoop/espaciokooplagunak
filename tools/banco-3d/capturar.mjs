#!/usr/bin/env node
// Guion de captura del banco de pruebas (#976): sirve `index.html` de verdad,
// lo abre con el Playwright que YA está instalado en `tools/e2e-visual`
// (#929) —reutilizado por `createRequire`, sin declarar una segunda copia de
// la dependencia—, mueve los controles por DOM como lo haría una persona, y
// guarda un PNG por ángulo capturando el propio `<canvas>`.
//
// Uso:
//   node tools/banco-3d/capturar.mjs [--malla=figura-espada] [--epoca=psx]
//     [--fase=0] [--angulos=-1.2,-0.4,0.4,1.2] [--out=/tmp/banco-3d]
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { servirEstatico } from "./servidor.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = join(AQUI, "..", "..");

function parsearArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

const args = parsearArgs(process.argv.slice(2));
const malla = args.malla ?? "figura-espada";
const epoca = args.epoca ?? "psx";
const fase = args.fase ?? "0";
const angulos = (args.angulos ?? "-1.2,-0.4,0.4,1.2").split(",").map(Number);
const salida = args.out ?? join(RAIZ_REPO, "tools", "banco-3d", "capturas");

// Reutiliza la instalación de Playwright que ya vive en `tools/e2e-visual`
// (`package.json` de ese paquete declara `playwright`): no se añade una
// dependencia nueva en ningún sitio, solo se resuelve desde otro directorio.
const requireDesdeE2E = createRequire(join(RAIZ_REPO, "tools", "e2e-visual", "package.json"));
const { chromium } = requireDesdeE2E("playwright");

async function fijarSelect(page, id, valor) {
  await page.selectOption(`#${id}`, valor);
}

async function fijarRango(page, id, valor) {
  // Un `<input type="range">` no acepta `fill()` (Playwright lo rechaza por
  // no ser editable de teclado): se fija `.value` y se disparan los mismos
  // eventos `input`/`change` que `app.mjs` escucha, que es lo que un arrastre
  // de ratón dispararía también.
  await page.evaluate(
    ({ id: elId, valor: v }) => {
      const el = document.getElementById(elId);
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { id, valor },
  );
}

async function esperarRepintado(page, marcaAnterior) {
  await page.waitForFunction(
    (anterior) => document.getElementById("lienzo")?.dataset.render !== anterior,
    marcaAnterior,
    { timeout: 5000 },
  );
}

async function main() {
  await mkdir(salida, { recursive: true });
  const { url, cerrar } = await servirEstatico(RAIZ_REPO);
  const navegador = await chromium.launch();
  try {
    const page = await navegador.newPage({ viewport: { width: 400, height: 320 } });
    await page.goto(`${url}/tools/banco-3d/index.html`, { waitUntil: "load" });
    await page.waitForSelector("#lienzo");

    await fijarSelect(page, "malla", malla);
    await fijarSelect(page, "epoca", epoca);
    let marca = await page.getAttribute("#lienzo", "data-render");
    await fijarRango(page, "fase", fase);
    await esperarRepintado(page, marca);

    const rutas = [];
    for (const yaw of angulos) {
      marca = await page.getAttribute("#lienzo", "data-render");
      await fijarRango(page, "yaw", yaw);
      await esperarRepintado(page, marca);
      const destino = join(salida, `${malla}-${epoca}-yaw${yaw.toFixed(2)}.png`);
      await page.locator("#lienzo").screenshot({ path: destino });
      rutas.push(destino);
      console.log(`[capturar] ${destino}`);
    }
    console.log(`[capturar] ${rutas.length} capturas en ${salida}`);
  } finally {
    await navegador.close();
    await cerrar();
  }
}

main().catch((error) => {
  console.error("[capturar] fallo:", error);
  process.exitCode = 1;
});

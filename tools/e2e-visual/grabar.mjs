#!/usr/bin/env node
// Graba un vídeo de una sesión real de Foundry (login + abrir una herramienta
// de la barra de escena + una secuencia de teclas) usando Playwright sobre un
// display virtual (Xvfb), para no tocar la pantalla real de quien lo ejecuta.
//
// Pensado para demos de QA visual de espaciokoop lagunak: "esto es lo que
// cambió" en vídeo, sin depender de que alguien abra Foundry a mano y grabe su
// propia pantalla. No sustituye a las suites de test (Node/pytest/CTest) — es
// para lo que esas suites no pueden mostrar: cómo SE VE un cambio.
//
// Requisitos, todos fuera de este paquete (no se instalan aquí):
//   - Un servidor Foundry ya arrancado y accesible (ver docs/BUILDING.md /
//     memoria de proyecto para cómo arrancarlo headless).
//   - Xvfb en el PATH (o cualquier X disponible en $DISPLAY).
//   - ffmpeg en el PATH, si quieres convertir el .webm de salida a .mp4.
//
// Uso:
//   DISPLAY=:99 node grabar.mjs \
//     --url=http://localhost:30000 \
//     --world=qa-humo-lagunak --user=Gamemaster \
//     --control=lagunak --tool=lagunak-andar-nave \
//     --teclas="w:2600,e:900,w:2000,q:700,w:1500" \
//     --out=/tmp/demo
//
// `--control` es la categoría de la barra de escena a activar primero (el
// icono de grupo, `data-control`) y `--tool` la herramienta dentro de ese
// grupo (`data-tool`) — deja `--control` vacío para herramientas que no
// cuelgan de un submenú. `--teclas` es una lista `tecla:ms` separada por
// comas, cada una mantenida pulsada esos milisegundos, en orden: es el paseo
// que se quiere enseñar.

import { chromium } from "playwright";

function parsearArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

const PAR_TECLA_MS = /^([^:]+):(\d+)$/;

function parsearTeclas(cadena) {
  if (!cadena) return [];
  return cadena.split(",").map((par) => {
    const m = PAR_TECLA_MS.exec(par);
    const milisegundos = m ? Number(m[2]) : NaN;
    if (!m || !(milisegundos > 0)) {
      throw new Error(
        `--teclas inválido en "${par}": se esperaba "tecla:ms" con ms > 0 (p. ej. "w:2000")`,
      );
    }
    return { tecla: m[1], ms: milisegundos };
  });
}

const args = parsearArgs(process.argv.slice(2));
const url = args.url ?? "http://localhost:30000";
const world = args.world;
const usuario = args.user ?? "Gamemaster";
const control = args.control ?? null;
const tool = args.tool ?? null;
const teclas = parsearTeclas(args.teclas);
const salida = args.out ?? "/tmp/lagunak-demo";

if (!world) {
  console.error("Falta --world=<id-del-mundo>. Ejemplo: --world=qa-humo-lagunak");
  process.exit(1);
}

const dirVideo = `${salida}-video`;
let browser = null;
let context = null;
let page = null;

async function irAlMundo() {
  // El setup de Foundry no permite pedir directamente /join/<mundo>: hay que
  // pasar por /setup, encontrar la tarjeta del mundo y lanzarla — mismo camino
  // que seguiría una persona.
  await page.goto(`${url}/setup`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const entrada = page.locator("li.package.world", { hasText: world }).first();
  await entrada.waitFor({ state: "visible", timeout: 15000 });
  await entrada.click();
  await page.waitForTimeout(500);
  await entrada
    .locator(".control.play, a.play, [data-action='worldLaunch']")
    .first()
    .click({ timeout: 5000 })
    .catch(async () => entrada.dblclick());
  await page.waitForURL((u) => u.pathname === "/join", { timeout: 15000 });
}

async function login() {
  await page.waitForTimeout(1500);
  await page.waitForSelector("select[name='userid']", { state: "visible" });
  await page.selectOption("select[name='userid']", { label: usuario });
  await page.waitForTimeout(500);
  // El clic normal sobre el botón no siempre dispara el submit (visto en
  // #458: el hit-testing fallaba tras el re-render del formulario). Se manda
  // el submit directamente sobre el <form>, que es robusto a eso.
  await page.evaluate(() => {
    const form = document.getElementById("join-game");
    form?.requestSubmit(form.querySelector("button[type=submit]"));
  });
  await page.waitForURL((u) => u.pathname === "/game", { timeout: 20000 });
  await page.waitForTimeout(4000);
}

async function abrirHerramienta() {
  // Selectores probados contra v11/v12. `control-escena.mjs` documenta que
  // v13 cambió la forma de los datos de la barra de escena (arrays -> records
  // con `order`/`onChange`); si eso también cambió esta marca DOM, `--control`
  // / `--tool` fallarán con un timeout claro en vez de un fallo silencioso —
  // no verificado todavía contra un host v13 real.
  if (control) {
    const categoria = page.locator(`li.scene-control[data-control="${control}"]`);
    await categoria.waitFor({ state: "visible", timeout: 10000 });
    await categoria.click();
    await page.waitForTimeout(500);
  }
  if (tool) {
    const boton = page.locator(`li.control-tool[data-tool="${tool}"]`);
    await boton.waitFor({ state: "visible", timeout: 10000 });
    await boton.click();
    await page.waitForTimeout(2500);
  }
}

async function pulsar(tecla, ms) {
  await page.keyboard.down(tecla);
  await page.waitForTimeout(ms);
  await page.keyboard.up(tecla);
}

try {
  browser = await chromium.launch({ headless: false });
  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: dirVideo, size: { width: 1280, height: 800 } },
  });
  page = await context.newPage();

  await irAlMundo();
  await login();
  console.error(`[grabar] dentro de "${world}" como ${usuario}`);
  await abrirHerramienta();
  if (control || tool) console.error(`[grabar] herramienta abierta: control=${control ?? "-"} tool=${tool ?? "-"}`);

  // Foco de teclado sobre el lienzo, si hay uno visible (andar por la nave,
  // minijuegos 3D...); si no lo hay, las teclas simplemente no llegan a nada,
  // que es un no-op razonable para una herramienta sin lienzo.
  const lienzo = page.locator("canvas").first();
  if (await lienzo.count()) {
    await lienzo.click({ position: { x: 5, y: 5 } }).catch(() => {});
  }

  await page.waitForTimeout(1500);
  for (const { tecla, ms } of teclas) {
    await pulsar(tecla, ms);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1500);
} finally {
  // Sin esto, un fallo a mitad de camino (mundo que no carga, login que no
  // completa...) deja el Chromium headless y su grabación de Xvfb huérfanos:
  // en una herramienta pensada para reintentarse mientras se itera una demo,
  // eso acumula procesos zombis hasta agotar memoria o descriptores.
  if (context) await context.close();
  if (browser) await browser.close();
}
console.error(`[grabar] vídeo (.webm) en ${dirVideo}/`);
console.error(
  `[grabar] para convertir a mp4: ffmpeg -y -i ${dirVideo}/*.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart ${salida}.mp4`,
);

#!/usr/bin/env node
// Evidencia RENDERIZADA del tinte de alerta sobre el retrato de tripulación
// (#352). Existe porque la afirmación «la alerta tiñe el retrato» es visual y no
// se puede demostrar leyendo CSS: la primera versión aplicaba el tinte con
// `box-shadow: inset` sobre el `<img>`, la regla estaba escrita y no producía
// ningún efecto —un `<img>` es contenido reemplazado y la sombra interior se
// pinta por debajo de su contenido—. Una prueba de estructura habría pasado
// igual de contenta.
//
// Así que esto pinta de verdad, en un navegador de verdad, y mide los píxeles.
//
// Uso:
//   node tools/evidencia-tinte-retrato.mjs            # escribe las tres páginas
//   node tools/evidencia-tinte-retrato.mjs --medir    # + captura y compara
//
// `--medir` necesita un Chrome/Chromium y un Python con Pillow. No forma parte
// de CI a propósito: depender de un navegador para que pase la suite es cambiar
// una prueba frágil por otra. Esto es una herramienta de revisión, y su salida
// se pega en la PR.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { retratoTripulanteDataUri } from "../foundry-module/scripts/avatar/retrato-tripulante.mjs";
import { readFileSync } from "node:fs";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const salida = process.env.SALIDA ?? join(raiz, ".evidencia-tinte");
const NIVELES = ["sin", "lagunak-alerta-amarilla", "lagunak-alerta-roja"];

function pagina(clase, retrato, css) {
  // La clase de alerta va en el `body` porque ahí es donde la pone el módulo
  // (`alerta-escena.mjs`), y el selector del tinte cuelga de ella. Poner la
  // clase en un contenedor intermedio probaría otra cosa.
  return `<!doctype html><meta charset="utf-8"><style>
:root { --lagunak-line: #2a3b44; --lagunak-puesto-captain: #d1c04a; }
html, body { margin: 0; padding: 0; background: #0b1418; }
#caja { width: 34px; height: 34px; }
${css}
</style>
<body class="${clase === "sin" ? "" : clase}">
  <div id="caja">
    <span class="lagunak-workspace__crew-portrait lagunak-workspace__crew-portrait--captain">
      <img class="lagunak-workspace__crew-portrait-img" src="${retrato}" alt="" width="32" height="32"/>
    </span>
  </div>
</body>`;
}

const css = readFileSync(join(raiz, "foundry-module/styles/espacios-puesto.css"), "utf8");
// Semilla fija: la misma cara en las tres capturas, o la comparación no
// compararía el tinte sino dos retratos distintos.
const retrato = retratoTripulanteDataUri("usuario-de-prueba");

mkdirSync(salida, { recursive: true });
for (const nivel of NIVELES) {
  writeFileSync(join(salida, `${nivel}.html`), pagina(nivel, retrato, css));
}
console.log(`Páginas escritas en ${salida}`);

if (!process.argv.includes("--medir")) {
  console.log("Añade --medir para capturar con el navegador y comparar los píxeles.");
  process.exit(0);
}

const navegador = ["google-chrome", "chromium", "chromium-browser"].find((bin) => {
  try {
    execFileSync("which", [bin], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
});
if (!navegador) {
  console.error("No hay Chrome/Chromium: sin navegador no hay evidencia renderizada.");
  process.exit(1);
}

for (const nivel of NIVELES) {
  execFileSync(navegador, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=40,40",
    `--screenshot=${join(salida, `${nivel}.png`)}`,
    "--virtual-time-budget=2000",
    `file://${join(salida, `${nivel}.html`)}`,
  ], { stdio: "pipe" });
}

const comparador = `
from PIL import Image
caja = (2, 2, 32, 32)
def leer(n):
    return list(Image.open(f"${salida}/{n}.png").convert("RGB").crop(caja).getdata())
sin, ama, roja = leer("sin"), leer("lagunak-alerta-amarilla"), leer("lagunak-alerta-roja")
def media(px):
    return tuple(round(sum(c[i] for c in px) / len(px), 1) for i in range(3))
print("media sin tinte :", media(sin))
print("media amarilla  :", media(ama))
print("media roja      :", media(roja))
print("pixeles tenidos (amarilla):", sum(1 for a, b in zip(sin, ama) if a != b), "/", len(sin))
print("pixeles tenidos (roja)    :", sum(1 for a, b in zip(sin, roja) if a != b), "/", len(sin))
print("amarilla != roja          :", sum(1 for a, b in zip(ama, roja) if a != b), "/", len(sin))
assert sum(1 for a, b in zip(sin, ama) if a != b) > len(sin) * 0.9, "la alerta amarilla no tine el retrato"
assert sum(1 for a, b in zip(sin, roja) if a != b) > len(sin) * 0.9, "la alerta roja no tine el retrato"
assert media(ama) != media(roja), "amarilla y roja se ven igual"
print("OK: el tinte llega a los pixeles, y cada nivel se ve distinto")
`;
console.log(execFileSync("python3", ["-c", comparador], { encoding: "utf8" }));

#!/usr/bin/env node
// Vuelca a disco la baraja publicada como preset de Foundry: un SVG por carta,
// el dorso y el JSON del mazo. El arte se genera desde `cartas-pixelart.mjs`,
// así que estos ficheros son derivados, nunca fuente: si se editan a mano, la
// prueba `minijuegos-baraja-preset.test.mjs` falla.
//
//   node tools/generar-baraja-preset.mjs

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ficherosBaraja } from "../foundry-module/scripts/minijuegos/baraja-preset.mjs";

const destino = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "foundry-module",
  "data",
  "cartas",
);

await mkdir(destino, { recursive: true });

const ficheros = ficherosBaraja();

// Borra lo que ya no genera el arte: una carta retirada no debe quedarse suelta
// en el módulo publicado.
for (const nombre of await readdir(destino)) {
  if (!ficheros.has(nombre)) await rm(path.join(destino, nombre));
}

for (const [nombre, contenido] of ficheros) {
  await writeFile(path.join(destino, nombre), contenido, "utf8");
}

console.log(`baraja generada: ${ficheros.size} ficheros en ${destino}`);

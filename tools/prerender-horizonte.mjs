#!/usr/bin/env node
// Vuelca a disco el matte painting del horizonte como PNG indexados (#584).
//
// Son DERIVADOS, nunca fuente: el dibujo vive en `horizonte-matte.mjs` y esto
// solo lo escribe. Si se editan a mano —o si alguien cambia el generador y no
// los regenera— la prueba `horizonte-matte-preset.test.mjs` falla, igual que ya
// pasa con la baraja de #354.
//
//   node tools/prerender-horizonte.mjs

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ficherosHorizonte } from "../foundry-module/scripts/horizonte-preset.mjs";

const destino = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "foundry-module",
  "data",
  "horizonte",
);

await mkdir(destino, { recursive: true });

const ficheros = ficherosHorizonte();

// Una capa retirada no debe quedarse suelta en el módulo publicado.
for (const nombre of await readdir(destino)) {
  if (!ficheros.has(nombre)) await rm(path.join(destino, nombre));
}

for (const [nombre, bytes] of ficheros) {
  await writeFile(path.join(destino, nombre), bytes);
}

console.log(`horizonte prerenderizado: ${ficheros.size} PNG en ${destino}`);

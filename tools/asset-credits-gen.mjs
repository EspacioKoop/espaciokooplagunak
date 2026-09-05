#!/usr/bin/env node
// Genera `foundry-module/assets/medieval/ASSET_CREDITS.md` a partir de los
// catálogos de procedencia del módulo (#891).
//
// EL CRÉDITO SE DERIVA, NUNCA SE ESCRIBE A MANO. `cartelaDe`
// (`catalogo-piezas.mjs`) y `creditoDe` (`catalogo-tokens.mjs`) ya componen la
// línea de crédito a partir de `provenance`; este script solo las recorre y las
// vuelca a markdown. Editar el markdown a mano es exactamente lo que este
// script existe para evitar — un crédito escrito al lado no falla al
// desincronizarse, sigue ahí, atribuyendo la pieza a una licencia que ya no es
// la suya.
//
// MODO --check, MISMO PATRÓN QUE `tools/prerender-piel.mjs`: regenera en
// memoria y compara con el fichero existente. Un catálogo editado sin
// regenerar créditos falla aquí, no en la mesa de alguien.
//
//   node tools/asset-credits-gen.mjs           # escribe ASSET_CREDITS.md
//   node tools/asset-credits-gen.mjs --check   # sale 1 si el fichero difiere

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { cartelaDe } from "../foundry-module/scripts/catalogo-piezas.mjs";
import { creditoDe } from "../foundry-module/scripts/catalogo-tokens.mjs";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
export const RUTA_SALIDA = path.join(RAIZ, "foundry-module", "assets", "medieval", "ASSET_CREDITS.md");

function lineaPieza(pieza) {
  const { titulo, credito, fuente } = cartelaDe(pieza, "es");
  return fuente ? `- **${titulo}** — ${credito} (${fuente})` : `- **${titulo}** — ${credito}`;
}

function lineaToken(token) {
  const { titulo, categoria, credito, fuente } = creditoDe(token, "es");
  return fuente
    ? `- **${titulo}** (${categoria}) — ${credito} (${fuente})`
    : `- **${titulo}** (${categoria}) — ${credito}`;
}

/**
 * Compone el markdown de créditos a partir de catálogos ya validados.
 *
 * @param {{piezas?: object[], tokens?: object[]}} catalogos entradas ya
 *   validadas por `validarCatalogoPiezas`/`validarCatalogoTokens` — este
 *   generador no vuelve a validar licencias, solo las vuelca.
 */
export function generarCreditos({ piezas = [], tokens = [] } = {}) {
  const secciones = [
    "<!-- Generado por tools/asset-credits-gen.mjs. No editar a mano: la próxima",
    "     ejecución lo pisa. Edita los catálogos de procedencia y regenera. -->",
    "",
    "# Créditos de assets",
    "",
  ];
  if (piezas.length > 0) {
    secciones.push("## Piezas 3D", "", ...piezas.map(lineaPieza), "");
  }
  if (tokens.length > 0) {
    secciones.push("## Tokens 2D", "", ...tokens.map(lineaToken), "");
  }
  if (piezas.length === 0 && tokens.length === 0) {
    secciones.push("_Sin assets curados todavía._", "");
  }
  return `${secciones.join("\n")}`;
}

async function principal() {
  const checkMode = process.argv.includes("--check");

  // Sin catálogo de piezas/tokens real cableado todavía (#891-A/#891-B: el
  // pipeline se entrega antes que el primer lote, ver docs/PROCEDENCIA_ASSETS.md
  // y #891-C), el markdown generado documenta que el catálogo está vacío en vez
  // de mentir con datos de ejemplo.
  const markdown = generarCreditos({ piezas: [], tokens: [] });

  if (checkMode) {
    let existente;
    try {
      existente = await readFile(RUTA_SALIDA, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        console.error(`No existe ${RUTA_SALIDA}. Ejecuta sin --check primero.`);
        process.exit(1);
      }
      throw error;
    }
    if (existente !== markdown) {
      console.error("ASSET_CREDITS.md difiere de lo que generan los catálogos actuales.");
      process.exit(1);
    }
    process.exit(0);
  }

  await mkdir(path.dirname(RUTA_SALIDA), { recursive: true });
  await writeFile(RUTA_SALIDA, markdown, "utf8");
  console.log(`Escrito ${RUTA_SALIDA}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}

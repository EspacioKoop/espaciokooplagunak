#!/usr/bin/env node
// Convierte una imagen de terceros (PNG) en un token 2D del módulo (#891).
//
// QUÉ RESUELVE. Es el equivalente 2D de `tools/convertir-estatua.mjs` (#590):
// ahí entraba geometría de terceros como `{vertices, caras}` sin traer el STL
// al repositorio; aquí entra una imagen de terceros como `{ancho, alto,
// indices, paleta}` sin traer el PNG original. Mismo problema, misma forma de
// resolverlo — lo que cambia es el tipo de dato, no la disciplina.
//
// A DIFERENCIA DE LAS ESTATUAS, EL TOKEN CONSERVA SU PROPIO COLOR. La frontera
// de arte de #351 gobierna las superficies PROCEDURALES del módulo (el arte que
// generamos nosotros); un token de personaje importado no es una de esas
// superficies, es una ilustración con su propia paleta, y repintarlo con
// `paleta.mjs` falsificaría la obra en vez de respetar su licencia. Por eso este
// conversor cuantiza a LA PALETA DEL PROPIO ORIGEN, nunca a la del módulo.
//
// REESCALADO POR VECINO MÁS PRÓXIMO, A PROPÓSITO. Un token pixelart reescalado
// con interpolación (bilineal, bicúbica) se difumina y pierde el borde duro que
// lo hace legible a la distancia de una ficha de Foundry; el vecino más próximo
// es el único método que no inventa colores intermedios que no estaban en el
// original.
//
// CUANTIZACIÓN POR CONTEO DE COLORES EXACTOS, no un k-means con semilla — un
// pack pixelart de itch.io ya viene con una paleta pequeña y cerrada (por eso
// es pixelart), así que basta con contar los RGB exactos que aparecen tras el
// reescalado y quedarse con los más frecuentes hasta el tope de PNG indexado
// (255 colores visibles, `MAX_PALETA` de `png-indexado.mjs`). Si una imagen trae
// más de 255 colores tras reescalar, no es el pixelart que este conversor sabe
// tratar y se rechaza en vez de fundir colores a ciegas.
//
// EL BINARIO DE ORIGEN NO ENTRA EN EL REPOSITORIO. Se descarga aparte, se anota
// su sha256 en la ficha de procedencia y esta herramienta lo consume desde donde
// esté — igual que `convertir-estatua.mjs`.
//
//   node tools/convertir-token.mjs <fichero.png> <nombre>

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { decodificarPngIndexadoOTrueColor } from "./convertir-token-png.mjs";

export const LADO_TOKEN = 128;

/** Vecino más próximo: para cada píxel de destino, el más cercano en origen. */
export function reescalarVecinoMasProximo(origen, anchoDestino, altoDestino) {
  const { ancho, alto, rgba } = origen;
  const destino = new Uint8ClampedArray(anchoDestino * altoDestino * 4);
  for (let y = 0; y < altoDestino; y += 1) {
    const yOrigen = Math.min(alto - 1, Math.floor((y * alto) / altoDestino));
    for (let x = 0; x < anchoDestino; x += 1) {
      const xOrigen = Math.min(ancho - 1, Math.floor((x * ancho) / anchoDestino));
      const iOrigen = (yOrigen * ancho + xOrigen) * 4;
      const iDestino = (y * anchoDestino + x) * 4;
      destino[iDestino] = rgba[iOrigen];
      destino[iDestino + 1] = rgba[iOrigen + 1];
      destino[iDestino + 2] = rgba[iOrigen + 2];
      destino[iDestino + 3] = rgba[iOrigen + 3];
    }
  }
  return { ancho: anchoDestino, alto: altoDestino, rgba: destino };
}

const A_HEX = (n) => n.toString(16).padStart(2, "0");

/**
 * Cuantiza RGBA a `{indices, paleta}` de color indexado: el índice 0 es
 * siempre el hueco transparente (alfa < 128), y la paleta lista los colores
 * OPACOS exactos que aparecen, en orden de primera aparición.
 *
 * Se niega a cuantizar más de `MAX_PALETA - 1` colores visibles: por encima de
 * eso ya no es la paleta cerrada de un pixelart, y fundir colores a ciegas
 * cambiaría la obra sin que quien convierte lo decida a propósito.
 */
export function cuantizarIndexado({ ancho, alto, rgba }, maxColores) {
  const indicePorColor = new Map();
  const paleta = [];
  const indices = new Uint8Array(ancho * alto);
  for (let i = 0; i < ancho * alto; i += 1) {
    const base = i * 4;
    const alfa = rgba[base + 3];
    if (alfa < 128) {
      indices[i] = 0;
      continue;
    }
    const hex = `#${A_HEX(rgba[base])}${A_HEX(rgba[base + 1])}${A_HEX(rgba[base + 2])}`;
    let indice = indicePorColor.get(hex);
    if (indice === undefined) {
      if (paleta.length >= maxColores) {
        throw new Error(
          `La imagen tiene más de ${maxColores} colores opacos tras reescalar: no es una paleta ` +
            "cerrada de pixelart, y este conversor no funde colores a ciegas.",
        );
      }
      paleta.push(hex);
      indice = paleta.length; // 1..n; el 0 es el hueco
      indicePorColor.set(hex, indice);
    }
    indices[i] = indice;
  }
  return { indices, paleta };
}

/**
 * La procedencia de cada token, EN EL CÓDIGO y no solo en la prosa — mismo
 * candado que `FICHAS` en `convertir-estatua.mjs`. Vacía a propósito: traer el
 * primer token real (#891-C) exige verificar su licencia en la página concreta
 * antes de añadir su entrada aquí y en `docs/PROCEDENCIA_ASSETS.md`.
 */
export const FICHAS = Object.freeze({});

export function moduloDeToken(nombre, imagen, ficha) {
  const { ancho, alto, indices, paleta } = imagen;
  return `// ${ficha.obra} — token 2D importado (#891).
//
// GENERADO, NO ESCRITO A MANO. Sale de \`tools/convertir-token.mjs\` a partir
// del fichero de origen que documenta \`docs/PROCEDENCIA_ASSETS.md\`. Si se edita
// aquí, la próxima conversión lo pisa.
//
//   obra       ${ficha.obra}
//   modelo     ${ficha.modelo}
//   autoría    ${ficha.autoria}
//   fuente     ${ficha.fuente}
//   licencia   ${ficha.licencia}
//   sha256     ${ficha.sha256}
//
// Conserva SU PROPIA paleta: a diferencia de la geometría importada de #590,
// un token 2D no está sujeto a la frontera de arte de #351 (esa gobierna las
// superficies procedurales del módulo, no arte de terceros con su propio
// color). ${ancho}x${alto}, color indexado, listo para \`codificarPngIndexado\`.

export const ${nombre.toUpperCase().replace(/-/g, "_")} = Object.freeze({
  ancho: ${ancho},
  alto: ${alto},
  indices: new Uint8Array(${JSON.stringify(Array.from(indices))}),
  paleta: ${JSON.stringify(paleta)},
});
`;
}

async function principal() {
  const [ruta, nombre] = process.argv.slice(2);
  if (!ruta || !nombre) {
    console.error("uso: node tools/convertir-token.mjs <fichero.png> <nombre>");
    process.exit(2);
  }

  const declarada = FICHAS[nombre];
  if (!declarada) {
    console.error(
      `No hay ficha para "${nombre}". Un asset sin procedencia comprobable no entra, ` +
        "por bueno que sea: añádela a FICHAS y a docs/PROCEDENCIA_ASSETS.md antes de convertir.",
    );
    process.exit(2);
  }

  const bytes = new Uint8Array(await readFile(ruta));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const decodificada = decodificarPngIndexadoOTrueColor(bytes);
  const reescalada = reescalarVecinoMasProximo(decodificada, LADO_TOKEN, LADO_TOKEN);
  const { indices, paleta } = cuantizarIndexado(reescalada, 255);

  const destino = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "foundry-module", "data", "tokens");
  await mkdir(destino, { recursive: true });
  const ficha = { ...declarada, sha256 };
  const imagen = { ancho: LADO_TOKEN, alto: LADO_TOKEN, indices, paleta };
  await writeFile(path.join(destino, `${nombre}.mjs`), moduloDeToken(nombre, imagen, ficha), "utf8");

  console.log(`${LADO_TOKEN}x${LADO_TOKEN}, ${paleta.length} colores`);
  console.log("sha256 del origen:", sha256);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}

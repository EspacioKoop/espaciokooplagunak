import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  esAusente,
  leerEntero,
  leerFraccion,
  leerNormalizado,
  leerNumero,
  leerPorcentaje,
} from "../scripts/lectura-puente.mjs";

test("AUSENCIA NO ES CERO: el fallo que este módulo existe para hacer imposible", () => {
  // `Number(null)` es 0 y 0 es finito, así que la versión ingenua cuela un dato
  // que el puente NO PUBLICA como una lectura válida de cero. Pasó dos veces en
  // #331: una calidad ausente dejaba la nave ciega, y una energía ausente
  // anunciaba «ENERGÍA CRÍTICA» a toda la tripulación.
  for (const ausente of [null, undefined, ""]) {
    assert.equal(esAusente(ausente), true);
    assert.equal(leerNumero(ausente), null, `${JSON.stringify(ausente)} no puede leerse como número`);
    assert.equal(leerFraccion(ausente, 100), null);
    assert.equal(leerPorcentaje(ausente, 100), null);
    assert.equal(leerNormalizado(ausente), null);
  }
  // Y la trampa concreta, escrita tal cual para que se vea:
  assert.equal(Number(null), 0, "esto es lo que hace JavaScript");
  assert.equal(leerNumero(null), null, "y esto es lo que tiene que hacer el módulo");
});

test("CERO SÍ ES INFORMACIÓN: un sistema a cero no es un sistema sin lectura", () => {
  assert.equal(leerNumero(0), 0);
  assert.equal(esAusente(0), false);
  assert.equal(leerFraccion(0, 100), 0);
  assert.equal(leerPorcentaje(0, 100), 0);
  assert.equal(leerNormalizado(0), 0);
});

test("lo que no es un número se dice, no se adivina", () => {
  for (const basura of [NaN, "mucho", {}, [], () => {}, Infinity]) {
    assert.equal(leerNumero(basura), null, `${String(basura)} no debería interpretarse`);
  }
  // Una cadena numérica sí: el puente serializa algún campo como texto.
  assert.equal(leerNumero("42.5"), 42.5);
  assert.equal(leerNumero(true), null, "un booleano no es una medida");
});

test("la fracción necesita un divisor que sirva", () => {
  assert.equal(leerFraccion(50, 100), 0.5);
  assert.equal(leerFraccion(50, 0), null, "dividir por cero no da infinito, da null");
  assert.equal(leerFraccion(50, -10), null);
  assert.equal(leerFraccion(50, null), null);
  assert.equal(leerPorcentaje(50, 100), 50);
  // El porcentaje se acota: una lectura por encima del máximo no pinta 130%.
  assert.equal(leerPorcentaje(130, 100), 100);
  assert.equal(leerPorcentaje(-5, 100), 0);
});

test("leerEntero permite un valor de reserva explícito, nunca implícito", () => {
  assert.equal(leerEntero(3.7), 4);
  assert.equal(leerEntero(null), null, "sin reserva declarada, sigue siendo ausencia");
  assert.equal(leerEntero(null, 0), 0, "quien quiera cero, que lo pida");
  assert.equal(leerEntero("no", -1), -1);
});

// ---- La guarda -------------------------------------------------------------

// Módulos que leen telemetría del puente. Es donde la conversión mal escrita
// tiene consecuencias: una alarma falsa, una nave ciega, un sistema que parece
// destruido. `lectura-puente.mjs` queda fuera por definición: es donde vive.
const MODULOS_DE_TELEMETRIA = [
  "../scripts/avisos-guardia.mjs",
  "../scripts/barras-estado.mjs",
  "../scripts/contactos-proyeccion.mjs",
  "../scripts/ship-view.mjs",
  "../scripts/telemetria-difusion.mjs",
];

test("ningún módulo de telemetría convierte por su cuenta", async () => {
  // La parte EXIGIBLE de la regla. Sin esto es prosa, y el módulo siguiente
  // vuelve a escribir `Number(valor)` sin que nadie se entere — que es
  // exactamente como aparecieron los dos fallos de #331.
  for (const ruta of MODULOS_DE_TELEMETRIA) {
    const fuente = await readFile(new URL(ruta, import.meta.url), "utf8");
    const sinComentarios = fuente
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    const conversiones = [
      ...(sinComentarios.match(/\bNumber\s*\(/g) ?? []),
      ...(sinComentarios.match(/\bparseFloat\s*\(/g) ?? []),
      ...(sinComentarios.match(/\bparseInt\s*\(/g) ?? []),
      // El truco clásico de tapar la ausencia con un cero, por si alguien lo
      // reintroduce sin usar Number().
      ...(sinComentarios.match(/\?\?\s*0\b/g) ?? []),
      ...(sinComentarios.match(/\|\|\s*0\b/g) ?? []),
    ];
    assert.deepEqual(
      conversiones,
      [],
      `${ruta} convierte lecturas por su cuenta (${conversiones.join(", ")}); usa lectura-puente.mjs`,
    );

    assert.match(
      fuente,
      /from "\.\/lectura-puente\.mjs"/,
      `${ruta} lee telemetría pero no importa lectura-puente.mjs`,
    );
  }
});

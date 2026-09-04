import assert from "node:assert/strict";
import test from "node:test";

import {
  ESTADOS,
  LADO,
  aplicarIconoDom,
  estadoIcono,
  iconoSistema,
  iconoSistemaDataUri,
  iconoSistemaSvg,
} from "../scripts/iconos-sistema.mjs";
import { barrasSistema } from "../scripts/ship-view/barras-estado.mjs";
import { SISTEMA, contraste } from "../scripts/paleta.mjs";

test("sin lectura NO es ninguno de los otros tres estados", () => {
  // Es el criterio central de #353. Un icono agrietado por falta de sondeo
  // miente diciendo «destruido», y en sesión eso es peor que no dibujar nada.
  for (const vacio of [null, undefined, "", 0, false, { nivel: undefined }, { nivel: "raro" }]) {
    assert.equal(estadoIcono(vacio), "sin-lectura", `${JSON.stringify(vacio)} debería ser sin-lectura`);
  }
});

test("ninguna telemetría ausente puede producir intacto ni dañado", () => {
  // La comprobación que de verdad importa, hecha desde la entrada real: lo que
  // sale de barrasSistema cuando el puente no publica nada.
  const sinNada = barrasSistema({});
  assert.equal(sinNada.salud, null, "barrasSistema ya distingue ausencia de cero");
  const estado = estadoIcono(sinNada.salud);
  assert.equal(estado, "sin-lectura");
  assert.notEqual(estado, "intacto");
  assert.notEqual(estado, "dañado");
  assert.notEqual(estado, "inutilizado");
});

test("cero real sí es un estado grave, y no se confunde con ausencia", () => {
  // Cero es información: el sistema está a cero de salud. Ausencia no lo es.
  const aCero = barrasSistema({ health: 0, heat: 0, power: 0 });
  assert.equal(aCero.salud.pct, 0);
  assert.equal(estadoIcono(aCero.salud), "inutilizado");
});

test("la severidad de la barra se traduce a los cuatro estados", () => {
  assert.equal(estadoIcono(barrasSistema({ health: 100 }).salud), "intacto");
  assert.equal(estadoIcono(barrasSistema({ health: 50 }).salud), "dañado");
  assert.equal(estadoIcono(barrasSistema({ health: 10 }).salud), "inutilizado");
});

test("cada estado se DIBUJA distinto, no solo se colorea distinto", () => {
  // Si dos estados solo se diferenciaran en el color, este módulo no serviría
  // para nada: es exactamente el defecto que viene a corregir (WCAG 1.4.1).
  const formas = new Map();
  for (const estado of ESTADOS) {
    const celdas = iconoSistema(estado, "impulse").celdas;
    formas.set(estado, celdas.map(({ x, y }) => `${x},${y}`).join("|"));
  }
  // «sin lectura» tiene una silueta distinta (contorno discontinuo, núcleo
  // vacío) y «dañado» abre el núcleo: ambos se distinguen de «intacto» por las
  // celdas que ocupan, sin mirar un solo color.
  assert.notEqual(formas.get("sin-lectura"), formas.get("intacto"));
  assert.notEqual(formas.get("dañado"), formas.get("intacto"));
  const ocupadas = (estado) => iconoSistema(estado, "impulse").celdas.length;
  assert.ok(
    ocupadas("dañado") < ocupadas("intacto"),
    "la grieta tiene que quitar celdas, no repintarlas: si solo cambia el tono, " +
      "el estado vuelve a viajar en el color",
  );

  // «inutilizado» sí comparte silueta con «intacto», así que su distinción
  // descansa en el tono y hay que exigirle el contraste que porta información
  // (WCAG 1.4.11). En escala de grises el núcleo apagado se lee como hueco.
  assert.equal(formas.get("inutilizado"), formas.get("intacto"));
  const razon = contraste(SISTEMA.nucleo, SISTEMA.apagado);
  assert.ok(razon >= 3, `núcleo vivo frente a apagado: ${razon.toFixed(2)} < 3`);

  const patron = (estado) =>
    iconoSistema(estado, "impulse")
      .celdas.map(({ x, y, color }) => `${x},${y},${color}`)
      .join("|");
  const patrones = new Set(ESTADOS.map(patron));
  assert.equal(patrones.size, ESTADOS.length, "dos estados se dibujan igual");
});

test("el dibujo es determinista: las grietas no bailan entre sondeos", () => {
  assert.equal(iconoSistemaSvg("inutilizado", "impulse"), iconoSistemaSvg("inutilizado", "impulse"));
  assert.notEqual(iconoSistemaSvg("inutilizado", "impulse"), iconoSistemaSvg("inutilizado", "warp"));
});

test("un estado desconocido cae en sin-lectura, no en intacto", () => {
  // Fallar cerrado: inventarse «intacto» sería optimismo falso sobre la nave.
  assert.equal(iconoSistema("destruido-total").estado, "sin-lectura");
  assert.equal(iconoSistema(undefined).estado, "sin-lectura");
});

test("el SVG es autosuficiente y no lleva texto", () => {
  const svg = iconoSistemaSvg("dañado", "s");
  assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/);
  assert.doesNotMatch(svg, /<image|<text|url\(/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, new RegExp(`viewBox="0 0 ${LADO} ${LADO}"`));
  assert.match(svg, /aria-hidden="true"/);
  assert.match(iconoSistemaDataUri("dañado", "s"), /^data:image\/svg\+xml,/);
});

test("el parcheo del DOM actualiza el icono en su sitio", () => {
  // Doble mínimo: lo que el patcher de V1/V2 hace de verdad sobre la fila.
  let src = "";
  const nodo = {
    getAttribute: () => src,
    setAttribute: (_attr, valor) => {
      src = valor;
    },
  };
  const raiz = { querySelector: (sel) => (sel.includes("impulse") ? nodo : null) };

  aplicarIconoDom(raiz, '[data-sistema-id="impulse"]', "impulse", barrasSistema({ health: 100 }).salud);
  const intacto = src;
  assert.match(intacto, /^data:image\/svg\+xml,/);

  aplicarIconoDom(raiz, '[data-sistema-id="impulse"]', "impulse", null);
  assert.notEqual(src, intacto, "perder la lectura tiene que verse");
  assert.match(decodeURIComponent(src), /data-estado="sin-lectura"/);
});

test("una plantilla sin hueco para el icono no revienta", () => {
  // El icono es el canal AÑADIDO; el texto y la barra son la información.
  assert.doesNotThrow(() => aplicarIconoDom({ querySelector: () => null }, "[x]", "id", null));
  assert.doesNotThrow(() => aplicarIconoDom(null, "[x]", "id", null));
});

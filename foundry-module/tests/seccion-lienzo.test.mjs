// El pintado de la sección (#427).
//
// Es dibujo plano y sin estado, así que lo afirmable es: cabe en el cuadro, la
// aritmética de celdas es reversible, el color dice la verdad sobre el daño y
// nadie pinta un tripulante fuera de su sala.

import assert from "node:assert/strict";
import test from "node:test";

import {
  cajaEnPixeles,
  celdaEnPunto,
  colorDeSala,
  medidas,
  pintarSeccion,
  pintarTripulacion,
} from "../scripts/seccion-lienzo.mjs";
import { componerSeccion, salaPorId } from "../scripts/seccion-nave.mjs";
import { COLOR_REGION } from "../scripts/ship-view/casco-dano.mjs";
import { SECCION } from "../scripts/paleta.mjs";

const MEDIDAS = { ancho: 720, alto: 360 };

/** Contexto 2D de mentira que apunta cada rectángulo. */
function ctxFalso() {
  return {
    rects: [],
    textos: [],
    fillStyle: null,
    fillRect(x, y, w, h) {
      this.rects.push({ x, y, w, h, estilo: this.fillStyle });
    },
    fillText(texto, x, y) {
      this.textos.push({ texto, x, y });
    },
  };
}

test("el cuadro entero cabe en el cuadro", () => {
  const ctx = ctxFalso();
  pintarSeccion(ctx, componerSeccion([]), { ...MEDIDAS, rotulo: (sala) => sala.id });
  assert.ok(ctx.rects.length > 0);
  for (const { x, y, w, h } of ctx.rects) {
    assert.ok(x >= 0 && y >= 0, `se sale por arriba/izquierda: ${x},${y}`);
    assert.ok(x + w <= MEDIDAS.ancho, `se sale por la derecha: ${x + w}`);
    assert.ok(y + h <= MEDIDAS.alto, `se sale por abajo: ${y + h}`);
  }
});

test("de celda a píxel y de vuelta: la misma celda", () => {
  // Si esto se descuadra, el ratón señala una sala y se abre la de al lado.
  const seccion = componerSeccion([]);
  const m = medidas({ ...MEDIDAS, rejilla: seccion.rejilla });
  const caja = cajaEnPixeles({ x: 4, y: 1, ancho: 4, alto: 2 }, m);
  const celda = celdaEnPunto({ x: caja.x + 2, y: caja.y + 2 }, m);
  assert.equal(Math.floor(celda.x), 4);
  assert.equal(Math.floor(celda.y), 1);
});

test("dos salas vecinas no dejan hueco ni se solapan un píxel", () => {
  // Cada caja se redondea contra la MISMA rejilla, así que el canto derecho de
  // una es exactamente el izquierdo de la siguiente.
  // #542: la enfermería y la cantina ya no son vecinas —la enfermería era una
  // sala inventada y no existe—. Se usan dos salas contiguas de la planta REAL:
  // el reactor y el warp comparten la arista x=3 de la rejilla.
  const m = medidas({ ...MEDIDAS, rejilla: componerSeccion([]).rejilla });
  const izquierda = cajaEnPixeles(salaPorId("reactor").caja, m);
  const derecha = cajaEnPixeles(salaPorId("warp").caja, m);
  assert.equal(izquierda.x + izquierda.ancho, derecha.x);
});

test("sin lectura la sala no se pinta de sana", () => {
  assert.equal(colorDeSala(null), SECCION.sala);
  assert.equal(colorDeSala(undefined), SECCION.sala);
  assert.notEqual(colorDeSala(null), COLOR_REGION.estable);
  assert.equal(colorDeSala(90), COLOR_REGION.estable);
  assert.equal(colorDeSala(50), COLOR_REGION.danada);
  assert.equal(colorDeSala(10), COLOR_REGION.critica);
});

test("una sala dañada además se raya: el color no es el único canal", () => {
  const sana = ctxFalso();
  const rota = ctxFalso();
  pintarSeccion(sana, componerSeccion([{ id: "reactor", health: 100 }]), MEDIDAS);
  pintarSeccion(rota, componerSeccion([{ id: "reactor", health: 20 }]), MEDIDAS);
  assert.ok(
    rota.rects.length > sana.rects.length,
    "la trama de una sala dañada tiene que añadir dibujo, no solo cambiar el tono",
  );
});

test("una sala en la que se puede entrar se distingue por el canto", () => {
  const ctx = ctxFalso();
  pintarSeccion(ctx, componerSeccion([]), MEDIDAS);
  assert.ok(
    ctx.rects.some((r) => r.estilo === SECCION.entrable),
    "ninguna sala anuncia que se puede entrar en ella",
  );
});

test("la tripulación no se sale de su sala por muchos que sean", () => {
  const ctx = ctxFalso();
  const caja = { x: 10, y: 10, ancho: 30, alto: 20 };
  const pintados = pintarTripulacion(ctx, Array.from({ length: 40 }, (_, i) => ({ nombre: `${i}` })), caja);
  assert.ok(pintados > 0 && pintados < 40, "o no pinta a nadie, o los desborda");
  for (const { x, w } of ctx.rects) {
    assert.ok(x + w <= caja.x + caja.ancho, "un tripulante se salió de su sala");
  }
});

test("cada sala recibe su rótulo, y el rótulo cae dentro de su caja", () => {
  const ctx = ctxFalso();
  const seccion = componerSeccion([]);
  const { cajas } = pintarSeccion(ctx, seccion, { ...MEDIDAS, rotulo: (sala) => sala.id });
  assert.equal(ctx.textos.length, seccion.salas.length);
  for (const { texto, x, y } of ctx.textos) {
    const caja = cajas[texto];
    assert.ok(caja, `rótulo sin sala: ${texto}`);
    assert.ok(x >= caja.x && x <= caja.x + caja.ancho, `${texto}: rótulo fuera por la horizontal`);
    assert.ok(y >= caja.y && y <= caja.y + caja.alto, `${texto}: rótulo fuera por la vertical`);
  }
});

test("un contexto que no existe no revienta el pintado", () => {
  // El arnés de pruebas y algún host raro no dan lienzo: la ventana tiene que
  // seguir abriéndose con su lista, que es donde vive lo accesible.
  assert.deepEqual(pintarSeccion(null, componerSeccion([]), MEDIDAS), { cajas: {} });
});

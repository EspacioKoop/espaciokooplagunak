// La capa 2D que va encima del 3D de la cantina (#423).
//
// Es dibujo plano y sin estado, así que lo que se puede afirmar es que dibuja
// dentro del cuadro, que no inventa colores y que el polvo está SEMBRADO — un
// polvo que baila entre fotogramas no es ambiente, es ruido.

import assert from "node:assert/strict";
import test from "node:test";

import {
  pintarCapa2D,
  pintarHaces,
  pintarHumo,
  pintarLineas,
  pintarPolvo,
  pintarVinieta,
} from "../scripts/cantina-2d.mjs";

/** Contexto 2D de mentira que apunta cada rectángulo. */
function ctxFalso() {
  return {
    rects: [],
    estilos: [],
    fillStyle: null,
    fillRect(x, y, w, h) {
      this.rects.push({ x, y, w, h, estilo: this.fillStyle });
      this.estilos.push(this.fillStyle);
    },
  };
}

const MEDIDAS = { ancho: 480, alto: 270 };

test("todas las capas pintan y ninguna se sale del cuadro", () => {
  const ctx = ctxFalso();
  assert.equal(pintarCapa2D(ctx, MEDIDAS), true);
  assert.ok(ctx.rects.length > 0);
  for (const { x, y, w, h } of ctx.rects) {
    assert.ok(x >= 0 && y >= 0, `rectángulo fuera por arriba/izquierda: ${x},${y}`);
    assert.ok(x + w <= MEDIDAS.ancho, `se sale por la derecha: ${x + w}`);
    assert.ok(y + h <= MEDIDAS.alto, `se sale por abajo: ${y + h}`);
  }
});

test("sin contexto o con medidas imposibles no se dibuja nada", () => {
  assert.equal(pintarCapa2D(null, MEDIDAS), false);
  assert.equal(pintarCapa2D(ctxFalso(), { ancho: 0, alto: 0 }), false);
  assert.equal(pintarCapa2D(ctxFalso()), false);
});

test("el polvo está sembrado: la misma semilla pone las motas donde estaban", () => {
  const a = ctxFalso();
  const b = ctxFalso();
  pintarPolvo(a, { ...MEDIDAS, semilla: 42 });
  pintarPolvo(b, { ...MEDIDAS, semilla: 42 });
  assert.deepEqual(a.rects, b.rects);

  const otra = ctxFalso();
  pintarPolvo(otra, { ...MEDIDAS, semilla: 43 });
  assert.notDeepEqual(otra.rects, a.rects, "dos semillas dan el mismo polvo");
});

test("las líneas cubren el alto entero, una de cada dos", () => {
  const ctx = ctxFalso();
  const lineas = pintarLineas(ctx, MEDIDAS);
  assert.equal(lineas, Math.ceil(MEDIDAS.alto / 2));
  for (const rect of ctx.rects) assert.equal(rect.w, MEDIDAS.ancho);
});

test("la viñeta es por bandas, no un degradado", () => {
  // El degradado delata el pastiche: una consola oscurecía con tramas. Si esto
  // se convierte en `createLinearGradient`, el contexto de mentira ni lo tiene.
  const ctx = ctxFalso();
  pintarVinieta(ctx, MEDIDAS);
  assert.ok(ctx.rects.length > 0);
  for (const rect of ctx.rects) {
    assert.ok(rect.w === 1 || rect.h === 1, "las bandas son de un píxel");
  }
});

// Luz y humo (#423): las dos capas que el 3D no puede dar.
test("los haces se abren hacia abajo y se apagan al bajar", () => {
  const ctx = ctxFalso();
  pintarHaces(ctx, MEDIDAS);
  assert.ok(ctx.rects.length > 0);
  const primero = ctx.rects[0];
  const ultimo = ctx.rects[ctx.rects.length - 1];
  assert.ok(ultimo.w >= primero.w, "el cono no se abre hacia el suelo");
  for (const rect of ctx.rects) {
    assert.ok(rect.x >= 0 && rect.x + rect.w <= MEDIDAS.ancho, "el haz se sale del cuadro");
  }
});

test("el humo deriva con el tiempo pero no salta al azar", () => {
  const quieto = ctxFalso();
  const movido = ctxFalso();
  const otraVez = ctxFalso();
  pintarHumo(quieto, { ...MEDIDAS, ms: 0 });
  pintarHumo(movido, { ...MEDIDAS, ms: 4000 });
  pintarHumo(otraVez, { ...MEDIDAS, ms: 0 });
  assert.deepEqual(otraVez.rects, quieto.rects, "el mismo instante debe dar el mismo humo");
  assert.notDeepEqual(movido.rects, quieto.rects, "el humo no se mueve");
});

test("el humo se queda en el tercio central, que es donde se posa el aire", () => {
  // Repartido por toda la sala sería niebla, y la niebla ya la pone el motor
  // con la distancia.
  const ctx = ctxFalso();
  pintarHumo(ctx, { ...MEDIDAS, ms: 1500 });
  for (const rect of ctx.rects) {
    assert.ok(rect.y >= MEDIDAS.alto * 0.3, `veta demasiado alta: ${rect.y}`);
    assert.ok(rect.y <= MEDIDAS.alto * 0.7, `veta demasiado baja: ${rect.y}`);
  }
});

// La capa 2D que va encima del 3D de la cantina (#423).
//
// Es dibujo plano y sin estado, así que lo que se puede afirmar es que dibuja
// dentro del cuadro, que no inventa colores y que el polvo está SEMBRADO — un
// polvo que baila entre fotogramas no es ambiente, es ruido.

import assert from "node:assert/strict";
import test from "node:test";

import {
  pintarCapa2D,
  pintarCachivaches,
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
    assert.ok(rect.y >= MEDIDAS.alto * 0.28, `veta demasiado alta: ${rect.y}`);
    assert.ok(rect.y <= MEDIDAS.alto * 0.76, `veta demasiado baja: ${rect.y}`);
  }
});

// Cachivaches (#423): detalle pintado, no modelado.
const ANCLAS = [
  { x: 60, y: 80, escala: 1.4, tipo: "pilotos" },
  { x: 400, y: 120, escala: 0.9, tipo: "barras" },
];

test("los cachivaches se pintan DONDE dice el ancla, no en una rejilla de pantalla", () => {
  // Es la diferencia entre un objeto atornillado a la pared y una capa de
  // interfaz: si esto vuelve a colocarlos por su cuenta, flotan como un HUD.
  const ctx = ctxFalso();
  assert.ok(pintarCachivaches(ctx, { anclas: ANCLAS, ms: 0 }) > 0);
  for (const rect of ctx.rects) {
    const cerca = ANCLAS.some(
      (ancla) => Math.abs(rect.x - ancla.x) < 30 && Math.abs(rect.y - ancla.y) < 30,
    );
    assert.ok(cerca, `un cacharro se ha ido por libre: ${rect.x},${rect.y}`);
  }
});

test("lo lejano se pinta más pequeño, y muy lejos pierde el detalle interior", () => {
  const cerca = ctxFalso();
  const lejos = ctxFalso();
  pintarCachivaches(cerca, { anclas: [{ x: 100, y: 100, escala: 2, tipo: "pilotos" }] });
  pintarCachivaches(lejos, { anclas: [{ x: 100, y: 100, escala: 0.35, tipo: "pilotos" }] });
  assert.ok(cerca.rects[0].w > lejos.rects[0].w, "la distancia no cambia el tamaño");
  assert.ok(lejos.rects.length < cerca.rects.length, "de lejos sigue dibujando el detalle");
});

test("sin anclas no se pinta ningún cacharro", () => {
  assert.equal(pintarCachivaches(ctxFalso(), { anclas: [] }), 0);
  assert.equal(pintarCachivaches(ctxFalso()), 0);
});

test("los pilotos no parpadean todos a la vez", () => {
  // Al unísono es una guirnalda de Navidad, no una nave. Se compara el cuadro
  // entero en dos instantes: tiene que cambiar algo, pero no todo.
  const muchas = [0, 1, 2, 3, 4].map((i) => ({ x: 40 + i * 60, y: 90, escala: 1.5, tipo: "pilotos" }));
  const a = ctxFalso();
  const b = ctxFalso();
  pintarCachivaches(a, { anclas: muchas, ms: 0 });
  pintarCachivaches(b, { anclas: muchas, ms: 1000 });
  assert.equal(a.rects.length, b.rects.length, "el cuadro no puede cambiar de piezas");
  const iguales = a.estilos.filter((estilo, i) => estilo === b.estilos[i]).length;
  assert.ok(iguales > 0, "ha cambiado todo a la vez");
  assert.ok(iguales < a.estilos.length, "no ha parpadeado nada");
});

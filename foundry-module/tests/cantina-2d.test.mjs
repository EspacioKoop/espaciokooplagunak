// La capa 2D que va encima del 3D de la cantina (#423).
//
// Es dibujo plano y sin estado, así que lo que se puede afirmar es que dibuja
// dentro del cuadro, que no inventa colores y que el polvo está SEMBRADO — un
// polvo que baila entre fotogramas no es ambiente, es ruido.

import assert from "node:assert/strict";
import test from "node:test";

import {
  pintarCapa2D,
  estamparCara,
  estamparEscena,
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
    // El recorte se apunta para poder exigir que cada cara lo abra y lo cierre:
    // un `save` sin su `restore` deja el recorte puesto y la cara siguiente se
    // pinta dentro de la anterior — que es un fallo invisible hasta que la sala
    // entera desaparece detrás de un polígono.
    saves: 0,
    restores: 0,
    clips: 0,
    fillRect(x, y, w, h) {
      this.rects.push({ x, y, w, h, estilo: this.fillStyle });
      this.estilos.push(this.fillStyle);
    },
    save() {
      this.saves += 1;
    },
    restore() {
      this.restores += 1;
    },
    clip() {
      this.clips += 1;
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
  };
}

/** Cara cuadrada con el patrón dado, en coordenadas de pantalla. */
function caraFalsa(patron, lado = 40) {
  return {
    patron,
    puntos: [
      { x: 10, y: 10 },
      { x: 10 + lado, y: 10 },
      { x: 10 + lado, y: 10 + lado },
      { x: 10, y: 10 + lado },
    ],
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

// Cachivaches (#423): detalle pintado, no modelado.
test("los cachivaches se quedan en las bandas laterales, fuera del ventanal", () => {
  // Taparlo con cacharros sería repetir el fallo que dejó la sala sin vacío.
  const ctx = ctxFalso();
  pintarCachivaches(ctx, { ...MEDIDAS, ms: 0 });
  assert.ok(ctx.rects.length > 0);
  for (const rect of ctx.rects) {
    const centro = rect.x + rect.w / 2;
    const enElHueco = centro > MEDIDAS.ancho * 0.28 && centro < MEDIDAS.ancho * 0.72;
    assert.ok(!enElHueco, `un cacharro se ha metido en el ventanal: x=${rect.x}`);
    assert.ok(rect.x + rect.w <= MEDIDAS.ancho, "se sale por la derecha");
  }
});

test("los pilotos no parpadean todos a la vez", () => {
  // Al unísono es una guirnalda de Navidad, no una nave. Se compara el cuadro
  // entero en dos instantes: tiene que cambiar algo, pero no todo.
  const a = ctxFalso();
  const b = ctxFalso();
  pintarCachivaches(a, { ...MEDIDAS, ms: 0 });
  pintarCachivaches(b, { ...MEDIDAS, ms: 1000 });
  assert.equal(a.rects.length, b.rects.length, "el cuadro no puede cambiar de piezas");
  const iguales = a.estilos.filter((estilo, i) => estilo === b.estilos[i]).length;
  assert.ok(iguales > 0, "ha cambiado todo a la vez");
  assert.ok(iguales < a.estilos.length, "no ha parpadeado nada");
});


// Textura por cara (#423): el detalle de superficie de la época.
test("cada patrón deja su marca, y el liso no deja ninguna", () => {
  for (const patron of ["plancha", "veta", "rejilla"]) {
    const ctx = ctxFalso();
    assert.ok(estamparCara(ctx, caraFalsa(patron)) > 0, `${patron} no estampa nada`);
  }
  assert.equal(estamparCara(ctxFalso(), caraFalsa("liso")), 0);
  assert.equal(estamparCara(ctxFalso(), caraFalsa(undefined)), 0);
});

test("los tres patrones se distinguen entre sí", () => {
  // Si dos dieran lo mismo, la sala tendría una textura y no tres, y nadie se
  // enteraría de que el suelo y la barra están usando la misma.
  // Se compara el DIBUJO y no el número de trazos: dos patrones distintos
  // pueden coincidir en cuántas líneas usan y no parecerse en nada.
  const dibujos = ["plancha", "veta", "rejilla"].map((patron) => {
    const ctx = ctxFalso();
    estamparCara(ctx, caraFalsa(patron));
    return JSON.stringify(ctx.rects);
  });
  assert.equal(new Set(dibujos).size, 3, "hay dos patrones que dibujan lo mismo");
});

test("cada cara abre y cierra su recorte", () => {
  const ctx = ctxFalso();
  estamparEscena(ctx, {
    poligonos: [caraFalsa("plancha"), caraFalsa("veta"), caraFalsa("rejilla")],
  });
  assert.equal(ctx.clips, 3);
  assert.equal(ctx.saves, ctx.restores, "un recorte se ha quedado abierto");
});

test("una cara diminuta no se textura: sería ruido", () => {
  assert.equal(estamparCara(ctxFalso(), caraFalsa("rejilla", 2)), 0);
});

test("un contexto sin recorte no revienta: se queda sin textura y ya", () => {
  // Un contexto de mentira o un host raro puede no traer `clip`. Perder la
  // textura es aceptable; tirar el bucle de pintado, no.
  const pobre = { fillRect() {}, fillStyle: null };
  assert.equal(estamparCara(pobre, caraFalsa("plancha")), 0);
});

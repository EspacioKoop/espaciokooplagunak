import assert from "node:assert/strict";
import test from "node:test";

import { girarNave, pintarEscena, pintarNave } from "../scripts/retro3d-lienzo.mjs";
import { CASCO_POR_DEFECTO, MALLA_CAZA, componerEscena, mallaDesdeCasco } from "../scripts/retro3d.mjs";
import { FACCIONES } from "../scripts/paleta.mjs";

/** Contexto 2D de mentira: anota lo que le piden en vez de pintarlo. */
function contextoFalso() {
  const ordenes = [];
  const anota = (nombre) => (...args) => ordenes.push([nombre, ...args]);
  return {
    ordenes,
    fillStyle: null,
    strokeStyle: null,
    lineWidth: null,
    beginPath: anota("beginPath"),
    closePath: anota("closePath"),
    moveTo: anota("moveTo"),
    lineTo: anota("lineTo"),
    fill() { ordenes.push(["fill", this.fillStyle]); },
    stroke() { ordenes.push(["stroke", this.strokeStyle]); },
    fillRect: anota("fillRect"),
    clearRect: anota("clearRect"),
  };
}

const lienzoFalso = (ancho = 96, alto = 72) => {
  const ctx = contextoFalso();
  return { width: ancho, height: alto, ctx, getContext: () => ctx };
};

test("cada polígono se pinta cerrado y con su color", () => {
  const ctx = contextoFalso();
  const escena = componerEscena(MALLA_CAZA, { ancho: 96, alto: 72, color: FACCIONES[0], yaw: 0.6 });
  const pintados = pintarEscena(ctx, escena);

  assert.equal(pintados, escena.poligonos.length);
  const cierres = ctx.ordenes.filter(([o]) => o === "closePath").length;
  assert.equal(cierres, escena.poligonos.length, "un camino cerrado por cara");
  const rellenos = ctx.ordenes.filter(([o]) => o === "fill").map(([, color]) => color);
  assert.deepEqual(rellenos, escena.poligonos.map((p) => p.color));
});

test("cada cara se contornea de su propio color, o quedan costuras", () => {
  // A resolución baja, la junta entre dos polígonos vecinos deja una línea de
  // fondo del ancho de un píxel, y eso se lee como un arañazo cruzando la nave.
  const ctx = contextoFalso();
  const escena = componerEscena(MALLA_CAZA, { yaw: 0.6 });
  pintarEscena(ctx, escena);
  const trazos = ctx.ordenes.filter(([o]) => o === "stroke").map(([, color]) => color);
  const rellenos = ctx.ordenes.filter(([o]) => o === "fill").map(([, color]) => color);
  assert.deepEqual(trazos, rellenos, "el contorno usa el mismo color que el relleno");
});

test("sin fondo el lienzo se limpia, con fondo se pinta", () => {
  // Transparente es el modo normal: la nave va sobre lo que ya haya debajo.
  const sinFondo = contextoFalso();
  pintarEscena(sinFondo, componerEscena(MALLA_CAZA, { ancho: 96, alto: 72 }));
  assert.ok(sinFondo.ordenes.some(([o]) => o === "clearRect"));
  assert.ok(!sinFondo.ordenes.some(([o]) => o === "fillRect"));

  const conFondo = contextoFalso();
  pintarEscena(conFondo, componerEscena(MALLA_CAZA, { ancho: 96, alto: 72 }), { fondo: "#000000" });
  const rect = conFondo.ordenes.find(([o]) => o === "fillRect");
  assert.deepEqual(rect, ["fillRect", 0, 0, 96, 72]);
});

test("el tamaño del búfer sale del lienzo, no de un número aparte", () => {
  // Mantener dos tamaños sincronizados a mano es la forma más fácil de que la
  // nave salga descentrada cuando alguien redimensiona el visor.
  const lienzo = lienzoFalso(120, 90);
  const escena = pintarNave(lienzo, { malla: MALLA_CAZA, color: FACCIONES[0] });
  assert.equal(escena.ancho, 120);
  assert.equal(escena.alto, 90);
});

test("sin contexto 2D no se rompe: se devuelve null", () => {
  assert.equal(pintarNave(null, {}), null);
  assert.equal(pintarNave({ getContext: () => null }, {}), null);
  assert.equal(pintarEscena(null, null), 0);
});

test("con movimiento reducido se pinta UNA pose y no se encadena nada", () => {
  // La nave sigue ahí, quieta. No pintar nada dejaría un hueco donde antes
  // había una nave, que no es lo que pide la preferencia.
  const lienzo = lienzoFalso();
  let fotogramasPedidos = 0;
  const parar = girarNave(lienzo, {
    malla: MALLA_CAZA,
    movimientoReducido: () => true,
    pedirFotograma: () => (fotogramasPedidos += 1),
  });
  assert.equal(fotogramasPedidos, 0, "no se pide un fotograma siguiente");
  assert.ok(lienzo.ctx.ordenes.some(([o]) => o === "fill"), "pero sí se ha pintado la nave");
  parar();
});

test("la preferencia se consulta en CADA fotograma, no solo al arrancar", () => {
  // Alguien puede cambiarla con la ventana abierta. Quedarse girando después de
  // pedir que no se gire es exactamente el fallo que la preferencia evita.
  const lienzo = lienzoFalso();
  let reducido = false;
  const pendientes = [];
  girarNave(lienzo, {
    malla: MALLA_CAZA,
    movimientoReducido: () => reducido,
    pedirFotograma: (fn) => pendientes.push(fn),
    ahora: () => 0,
  });
  assert.equal(pendientes.length, 1, "arranca girando");
  reducido = true;
  pendientes.pop()();
  assert.equal(pendientes.length, 0, "y se detiene solo al cambiar la preferencia");
});

test("parar detiene el bucle, y parar dos veces no hace daño", () => {
  const lienzo = lienzoFalso();
  const pendientes = [];
  let cancelados = 0;
  const parar = girarNave(lienzo, {
    malla: MALLA_CAZA,
    movimientoReducido: () => false,
    pedirFotograma: (fn) => { pendientes.push(fn); return pendientes.length; },
    cancelarFotograma: () => (cancelados += 1),
    ahora: () => 0,
  });
  parar();
  assert.equal(cancelados, 1);
  parar();
  assert.equal(cancelados, 1, "la segunda parada no vuelve a cancelar");
  // Un fotograma en vuelo que llegue después de parar no debe repintar.
  const antes = lienzo.ctx.ordenes.length;
  pendientes.forEach((fn) => fn());
  assert.equal(lienzo.ctx.ordenes.length, antes, "nada se pinta tras parar");
});

test("las medidas de casco dan siluetas distintas de verdad", () => {
  // Es la razón de existir de `mallaDesdeCasco` (#362, decisión 3): con una
  // malla a mano, un carguero y un caza eran la misma nave repintada.
  const caza = mallaDesdeCasco({ eslora: 1.6, manga: 0.62, envergadura: 1.9, quilla: 0.3 });
  const carguero = mallaDesdeCasco({ eslora: 1.9, manga: 1.25, envergadura: 0.9, quilla: 0.8 });
  assert.notDeepEqual(caza.vertices, carguero.vertices);
  assert.ok(carguero.vertices[2][0] > caza.vertices[2][0], "el carguero es más ancho de manga");
  assert.ok(caza.vertices[5][0] > carguero.vertices[5][0], "el caza tiene más envergadura");
  // La topología no cambia: solo se mueven los vértices.
  assert.deepEqual(caza.caras, carguero.caras);
});

test("medidas imposibles se acotan en vez de producir una nave del revés", () => {
  for (const basura of [null, undefined, {}, { eslora: -5 }, { manga: NaN }, { quilla: "ancha" }]) {
    const malla = mallaDesdeCasco(basura);
    assert.equal(malla.vertices.length, 6);
    for (const v of malla.vertices) {
      for (const c of v) assert.ok(Number.isFinite(c), `coordenada no finita con ${JSON.stringify(basura)}`);
    }
  }
  // Una eslora enorme se recorta, no se propaga.
  assert.ok(mallaDesdeCasco({ eslora: 1e6 }).vertices[0][2] <= 8);
  assert.deepEqual(mallaDesdeCasco(CASCO_POR_DEFECTO).vertices, MALLA_CAZA.vertices);
});

import assert from "node:assert/strict";
import test from "node:test";

import { girarNave, pintarEscena, pintarEscenaConProfundidad, pintarNave } from "../scripts/retro3d-lienzo.mjs";
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

// ---- La superficie: el casco propio en la consola (#362, rebanada 3) --------

test("el casco apunta al rumbo real, y sin lectura se queda quieto", async () => {
  // Regla heredada de los iconos de sistema (#353): ausencia no es cero. Una
  // nave girando en el puente mientras la real mantiene el rumbo sería una
  // mentira pequeña, y en una consola de mando no hay mentiras pequeñas.
  const { componerEscena } = await import("../scripts/retro3d.mjs");
  const conRumbo = (grados) =>
    componerEscena(MALLA_CAZA, {
      ancho: 96,
      alto: 72,
      yaw: (grados * Math.PI) / 180,
      pitch: 0.42,
      posicion: [0, 0, 4.4],
      fov: 55,
    });

  const norte = conRumbo(0);
  const este = conRumbo(90);
  assert.notDeepEqual(
    norte.poligonos.map((p) => p.puntos),
    este.poligonos.map((p) => p.puntos),
    "dos rumbos distintos tienen que dibujarse distinto",
  );
  // El mismo rumbo dibuja lo mismo: no hay deriva entre repintados.
  assert.deepEqual(conRumbo(214).poligonos, conRumbo(214).poligonos);
  // 360 y 0 son el mismo rumbo.
  assert.deepEqual(
    conRumbo(360).poligonos.map((p) => p.color),
    conRumbo(0).poligonos.map((p) => p.color),
  );
});

// ---- pintarEscenaConProfundidad (#510): z-buffer real -----------------------

function contextoConPixeles() {
  const llamadas = [];
  return { llamadas, putImageData(imagen) { llamadas.push(imagen); } };
}

function pixelEn(imagen, x, y) {
  const o = (y * imagen.width + x) * 4;
  return [imagen.data[o], imagen.data[o + 1], imagen.data[o + 2], imagen.data[o + 3]];
}

test("pintarEscenaConProfundidad: un triángulo pinta dentro y deja fondo fuera", () => {
  const ctx = contextoConPixeles();
  const escena = {
    ancho: 8,
    alto: 8,
    poligonos: [{ color: "#ff0000", puntos: [{ x: 0, y: 0, z: 2 }, { x: 8, y: 0, z: 2 }, { x: 0, y: 8, z: 2 }] }],
  };
  pintarEscenaConProfundidad(ctx, escena, { fondo: "#000000" });
  const imagen = ctx.llamadas[0];
  assert.deepEqual(pixelEn(imagen, 1, 1), [255, 0, 0, 255], "dentro del triángulo");
  assert.deepEqual(pixelEn(imagen, 6, 6), [0, 0, 0, 255], "fuera del triángulo, fondo");
});

test("pintarEscenaConProfundidad: un cuadrilátero (abanico de triángulos) se pinta entero", () => {
  const ctx = contextoConPixeles();
  const escena = {
    ancho: 8,
    alto: 8,
    poligonos: [
      {
        color: "#00ff00",
        puntos: [{ x: 1, y: 1, z: 3 }, { x: 7, y: 1, z: 3 }, { x: 7, y: 7, z: 3 }, { x: 1, y: 7, z: 3 }],
      },
    ],
  };
  pintarEscenaConProfundidad(ctx, escena, { fondo: "#000000" });
  const imagen = ctx.llamadas[0];
  // Las cuatro esquinas del cuadrilátero, no solo el primer triángulo del abanico.
  for (const [x, y] of [[1, 1], [6, 1], [6, 6], [1, 6], [4, 4]]) {
    assert.deepEqual(pixelEn(imagen, x, y), [0, 255, 0, 255], `esquina (${x},${y})`);
  }
});

// La REGRESIÓN que este pintor existe para arreglar (#510, QA: "se
// glitchean las texturas"): con el pintor por orden, cuál de dos piezas
// casi empatadas se ve arriba dependía del orden de la lista, y ese orden
// cambiaba con el temblor de cámara. Con z-buffer real no puede depender del
// orden porque no HAY orden: cada píxel se decide por su propia profundidad.
test("pintarEscenaConProfundidad: lo más cercano gana sin importar en qué orden se pinte (la regresión de #510)", () => {
  const lejano = {
    color: "#0000ff",
    puntos: [{ x: 0, y: 0, z: 10 }, { x: 8, y: 0, z: 10 }, { x: 8, y: 8, z: 10 }, { x: 0, y: 8, z: 10 }],
  };
  const cercano = {
    color: "#ff0000",
    puntos: [{ x: 2, y: 2, z: 1 }, { x: 6, y: 2, z: 1 }, { x: 6, y: 6, z: 1 }, { x: 2, y: 6, z: 1 }],
  };
  const ctxA = contextoConPixeles();
  pintarEscenaConProfundidad(ctxA, { ancho: 8, alto: 8, poligonos: [lejano, cercano] }, { fondo: "#000000" });
  const ctxB = contextoConPixeles();
  pintarEscenaConProfundidad(ctxB, { ancho: 8, alto: 8, poligonos: [cercano, lejano] }, { fondo: "#000000" });

  assert.deepEqual(pixelEn(ctxA.llamadas[0], 4, 4), [255, 0, 0, 255], "orden A: gana lo cercano");
  assert.deepEqual(pixelEn(ctxB.llamadas[0], 4, 4), [255, 0, 0, 255], "orden B: gana lo cercano igual");
  assert.deepEqual(
    Array.from(ctxA.llamadas[0].data),
    Array.from(ctxB.llamadas[0].data),
    "el resultado no puede depender de en qué orden llegaron los polígonos",
  );
});

test("pintarEscenaConProfundidad: dos profundidades casi empatadas (0.001 de diferencia) siguen resolviéndose igual en cualquier orden", () => {
  // El caso exacto que rompía el pintor por orden: no una diferencia grande
  // como el test anterior, sino un empate casi perfecto — el que de verdad
  // parpadeaba con el temblor de cámara.
  const a = { color: "#0000ff", puntos: [{ x: 0, y: 0, z: 3.001 }, { x: 8, y: 0, z: 3.001 }, { x: 8, y: 8, z: 3.001 }, { x: 0, y: 8, z: 3.001 }] };
  const b = { color: "#ff0000", puntos: [{ x: 0, y: 0, z: 3.002 }, { x: 8, y: 0, z: 3.002 }, { x: 8, y: 8, z: 3.002 }, { x: 0, y: 8, z: 3.002 }] };
  const ctxA = contextoConPixeles();
  pintarEscenaConProfundidad(ctxA, { ancho: 8, alto: 8, poligonos: [a, b] }, { fondo: "#000000" });
  const ctxB = contextoConPixeles();
  pintarEscenaConProfundidad(ctxB, { ancho: 8, alto: 8, poligonos: [b, a] }, { fondo: "#000000" });
  assert.deepEqual(
    Array.from(ctxA.llamadas[0].data),
    Array.from(ctxB.llamadas[0].data),
    "el ganador de un casi-empate no puede cambiar con el orden de dibujo",
  );
});

test("pintarEscenaConProfundidad: una estrella nunca tapa geometría real, la pinte cuando la pinte", () => {
  const cuadro = {
    color: "#ff0000",
    puntos: [{ x: 0, y: 0, z: 5 }, { x: 8, y: 0, z: 5 }, { x: 8, y: 8, z: 5 }, { x: 0, y: 8, z: 5 }],
  };
  const ctx = contextoConPixeles();
  pintarEscenaConProfundidad(
    ctx,
    { ancho: 8, alto: 8, poligonos: [cuadro], estrellas: [{ x: 4, y: 4, tam: 2, color: "#ffffff" }] },
    { fondo: "#000000" },
  );
  assert.deepEqual(pixelEn(ctx.llamadas[0], 4, 4), [255, 0, 0, 255], "el cuadro real tapa la estrella");
});

test("pintarEscenaConProfundidad: sin fondo, se pinta negro (un z-buffer no tiene transparente)", () => {
  const ctx = contextoConPixeles();
  pintarEscenaConProfundidad(ctx, { ancho: 4, alto: 4, poligonos: [] });
  assert.deepEqual(pixelEn(ctx.llamadas[0], 0, 0), [0, 0, 0, 255]);
});

test("pintarEscenaConProfundidad: sin putImageData no rompe, devuelve 0", () => {
  assert.equal(pintarEscenaConProfundidad({}, { ancho: 4, alto: 4, poligonos: [] }), 0);
  assert.equal(pintarEscenaConProfundidad(null, { ancho: 4, alto: 4, poligonos: [] }), 0);
});

test("pintarEscenaConProfundidad: devuelve cuántos polígonos traía la escena", () => {
  const ctx = contextoConPixeles();
  const escena = {
    ancho: 4,
    alto: 4,
    poligonos: [
      { color: "#f00", puntos: [{ x: 0, y: 0, z: 1 }, { x: 4, y: 0, z: 1 }, { x: 0, y: 4, z: 1 }] },
      { color: "#0f0", puntos: [{ x: 0, y: 0, z: 2 }, { x: 4, y: 0, z: 2 }, { x: 0, y: 4, z: 2 }] },
    ],
  };
  assert.equal(pintarEscenaConProfundidad(ctx, escena), 2);
});

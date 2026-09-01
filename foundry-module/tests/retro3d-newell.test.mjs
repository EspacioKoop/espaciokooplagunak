// Newell con partición de caras (#510, cuarto intento sobre el orden por
// pintor). Estos tests fabrican geometría de cámara a mano en vez de pasar
// por `componerEscena`, para poder afirmar sobre el ORDEN exacto sin
// depender de una malla real: lo que importa aquí es la primitiva, no una
// escena concreta. La regresión sobre geometría real de producción vive en
// `retro3d-fundir.test.mjs` (la cantina caminable, el caso que documenta la
// cabecera de `retro3d.mjs`).

import test from "node:test";
import assert from "node:assert/strict";

import { ordenarPorPintorNewell, seSolapanEnPantalla } from "../scripts/retro3d.mjs";

const CUADRO_SUPERPUESTO = [
  { x: 40, y: 40 },
  { x: 60, y: 40 },
  { x: 60, y: 60 },
  { x: 40, y: 60 },
];

/** Un cuadrado plano en espacio de cámara, a una profundidad `z` constante. */
function cuadradoPlano(z, { puntos = CUADRO_SUPERPUESTO, profundidad = z, extra = {} } = {}) {
  return {
    puntos,
    camara: [
      [-1, -1, z],
      [1, -1, z],
      [1, 1, z],
      [-1, 1, z],
    ],
    profundidad,
    color: "#808080",
    proyeccion: { ancho: 160, alto: 120, f: 100, rejilla: 0 },
    ...extra,
  };
}

test("dos caras que no se solapan en pantalla no se tocan, aunque empaten en profundidad", () => {
  const a = cuadradoPlano(5, { puntos: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] });
  const b = cuadradoPlano(5, { puntos: [{ x: 40, y: 40 }, { x: 50, y: 40 }, { x: 50, y: 50 }, { x: 40, y: 50 }] });
  assert.equal(seSolapanEnPantalla(a, b), false);
  const orden = ordenarPorPintorNewell([b, a]);
  assert.deepEqual(orden, [b, a], "sin solape, el motor no toca el orden de entrada");
});

test("una profundidad resumen equivocada no engaña a la geometría real", () => {
  // El caso del jitter del centroide, exagerado para que el test sea
  // determinista: `profundidad` (el resumen) dice que NEAR va detrás de FAR,
  // pero su geometría de cámara (`camara`, la fuente de verdad) dice lo
  // contrario. Newell tiene que fiarse de la geometría, no del resumen.
  const far = cuadradoPlano(10);
  const near = cuadradoPlano(2, { profundidad: 50 }); // resumen mentiroso a propósito
  const orden = ordenarPorPintorNewell([near, far]);
  assert.deepEqual(orden, [far, near], "lo más lejano de verdad se pinta primero");
});

test("dos caras que comparten arista no se reordenan ni se parten", () => {
  // El caso más común de todos (#510): dos muros en una esquina, el lomo y el
  // costado de un casco. Comparten plano casi exacto y no deben leerse como
  // un conflicto que hay que resolver partiendo algo.
  const a = cuadradoPlano(5, { puntos: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] });
  const b = cuadradoPlano(5, { puntos: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }] });
  const orden = ordenarPorPintorNewell([a, b]);
  assert.equal(orden.length, 2, "compartir arista no parte ninguna cara");
  assert.deepEqual(orden, [a, b], "sin solape real, se queda el orden de partida");
});

test("un conflicto que ninguno de los dos tests resuelve se parte, no se cuelga", () => {
  // `far` es un cuadro plano a z=10. `straddle` cruza su plano de verdad —dos
  // vértices más cerca, dos más lejos— así que ni «far entero delante de
  // straddle» ni «straddle entero detrás de far» son ciertos: el conflicto
  // cíclico que #510 documenta como el único que de verdad necesita corte.
  const far = cuadradoPlano(10);
  const straddle = {
    puntos: CUADRO_SUPERPUESTO,
    camara: [
      [-1, -1, 8],
      [1, -1, 12],
      [1, 1, 8],
      [-1, 1, 12],
    ],
    profundidad: 10,
    color: "#404040",
    proyeccion: { ancho: 160, alto: 120, f: 100, rejilla: 0 },
  };
  const orden = ordenarPorPintorNewell([far, straddle]);
  assert.ok(orden.length >= 2, "no se pierde geometría");
  assert.ok(orden.every((p) => Array.isArray(p.puntos) && p.puntos.length >= 3), "cada trozo sigue siendo pintable");
});

test("sin geometría de cámara o sin proyección, el motor no revienta ni inventa orden", () => {
  // Polígonos de prueba hechos a mano, como los que ya usaban las suites
  // anteriores a #510: sin `camara` no hay con qué decidir nada geométrico, y
  // el motor tiene que degradarse al orden de entrada en vez de colgarse
  // intentando partir algo que no sabe cortar.
  const sinCamara = { puntos: CUADRO_SUPERPUESTO, profundidad: 5, color: "#111111" };
  const otroSinCamara = { puntos: CUADRO_SUPERPUESTO, profundidad: 8, color: "#222222" };
  assert.doesNotThrow(() => ordenarPorPintorNewell([sinCamara, otroSinCamara]));
  const orden = ordenarPorPintorNewell([sinCamara, otroSinCamara]);
  assert.equal(orden.length, 2);

  // Con `camara` pero sin `proyeccion` y en conflicto cíclico: no se puede
  // reconstruir un trozo cortado, así que se acepta el par tal cual en vez de
  // colgarse buscando una salida que no existe.
  const far = cuadradoPlano(10);
  delete far.proyeccion;
  const straddle = {
    puntos: CUADRO_SUPERPUESTO,
    camara: [
      [-1, -1, 8],
      [1, -1, 12],
      [1, 1, 8],
      [-1, 1, 12],
    ],
    profundidad: 10,
    color: "#404040",
  };
  assert.doesNotThrow(() => ordenarPorPintorNewell([far, straddle]));
});

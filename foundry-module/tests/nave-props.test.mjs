// El vocabulario de props (#583).

import assert from "node:assert/strict";
import test from "node:test";

import { VOCABULARIO, colocarProp } from "../scripts/nave-props.mjs";

/* ---- el vocabulario ------------------------------------------------------- */

test("es material de serie: corto, y con la maquinaria de #560 dentro", () => {
  for (const clave of ["bancada", "armario", "conducto", "registro"]) {
    assert.ok(VOCABULARIO[clave], `${clave} debería seguir en el vocabulario`);
  }
  assert.ok(
    Object.keys(VOCABULARIO).length <= 12,
    "un catálogo largo es la vía rápida a que cada sala parezca de otra nave",
  );
});

test("nada de cubos como representación final: lo que se lee tiene partes (#579)", () => {
  // La maquinaria es de una caja porque un armario cerrado ES una caja. El
  // mobiliario de estar, no: una silla sin respaldo ni patas no es una silla.
  for (const clave of ["silla", "taburete", "mesa", "soporte", "barandilla", "cana"]) {
    assert.ok(VOCABULARIO[clave].partes.length >= 3, `${clave} necesita leerse, no solo ocupar sitio`);
  }
  const silla = VOCABULARIO.silla;
  const patas = silla.partes.filter(({ medidas }) => medidas[0] < 0.1 && medidas[2] < 0.1);
  assert.equal(patas.length, 4, "una silla tiene cuatro patas");
});

test("nada tapa la vista salvo el conducto, que es lo único que se mira hacia arriba", () => {
  // Mismo criterio y mismo margen que ya usaba `nave-mobiliario-sala.test.mjs`
  // sobre las cuatro máquinas: si un mueble te tapa, deja de ser mobiliario y
  // pasa a ser un muro interior que nadie ha puesto en la planta.
  const ALTURA_OJOS = 1.45;
  for (const [clave, { medidas }] of Object.entries(VOCABULARIO)) {
    if (clave === "conducto") continue;
    assert.ok(medidas[1] <= ALTURA_OJOS + 0.5, `${clave} (${medidas[1]} m) tapa la vista`);
  }
  // Y el mobiliario de estar se queda MUY por debajo: es a lo que te asomas por
  // encima, no lo que te encierra.
  for (const clave of ["silla", "taburete", "mesa", "soporte", "barandilla"]) {
    assert.ok(VOCABULARIO[clave].medidas[1] <= 1.1, `${clave} no debería llegar al pecho largo`);
  }
});

test("las medidas son la envolvente real, no un número escrito aparte", () => {
  // Si se declarasen a mano, se quedarían viejas en cuanto alguien moviera una
  // pata. La barandilla mide 2,4 m de largo y llega a 1,01 + 0,04 = 1,05.
  assert.deepEqual([...VOCABULARIO.barandilla.medidas].slice(0, 2), [2.4, 1.05]);
});

test("el vocabulario está congelado de arriba abajo", () => {
  assert.throws(() => {
    VOCABULARIO.silla.color = "#ff0000";
  }, TypeError);
  assert.throws(() => {
    VOCABULARIO.silla.partes[0].medidas[0] = 99;
  }, TypeError);
});

/* ---- colocación ----------------------------------------------------------- */

test("un prop de una sola caja se coloca donde se pide, con su nombre tal cual", () => {
  const { piezas } = colocarProp("armario", { x: 3, z: 5, nombre: "maquina-armario-0" });
  assert.equal(piezas.length, 1);
  assert.equal(piezas[0].nombre, "maquina-armario-0");
  assert.deepEqual(piezas[0].centro, [3, 0.95, 5]);
  assert.deepEqual(piezas[0].medidas, [1.0, 1.9, 0.6]);
});

test("un cuarto de vuelta intercambia ancho y fondo", () => {
  const derecho = colocarProp("armario", { x: 0, z: 0 }).piezas[0];
  const girado = colocarProp("armario", { x: 0, z: 0, cuartos: 1 }).piezas[0];
  assert.deepEqual(girado.medidas, [derecho.medidas[2], derecho.medidas[1], derecho.medidas[0]]);
});

test("girar mueve las partes alrededor del origen, no solo sus medidas", () => {
  // El respaldo de la silla está detrás (z negativa). Al girar tiene que
  // moverse con ella: si solo se intercambiaran las medidas, seguiría detrás y
  // la silla saldría descuartizada.
  const respaldo = (cuartos) =>
    colocarProp("silla", { x: 0, z: 0, cuartos }).piezas.find(({ medidas }) => medidas[1] > 0.4);
  assert.ok(respaldo(0).centro[2] < 0);
  assert.ok(Math.abs(respaldo(0).centro[0]) < 1e-9);
  // Un cuarto de vuelta lleva el frente (+z) a +x, así que el respaldo —que es
  // lo contrario del frente— acaba en -x.
  assert.ok(respaldo(1).centro[0] < 0);
  assert.ok(Math.abs(respaldo(1).centro[2]) < 1e-9);
});

test("cuatro cuartos de vuelta dejan el prop como estaba", () => {
  assert.deepEqual(colocarProp("silla", { x: 2, z: 7, cuartos: 4 }).piezas, colocarProp("silla", { x: 2, z: 7 }).piezas);
});

test("las partes de un prop compuesto tienen nombres distintos", () => {
  const nombres = colocarProp("silla", { x: 0, z: 0, nombre: "silla-terraza" }).piezas.map((p) => p.nombre);
  assert.equal(new Set(nombres).size, nombres.length);
});

test("solo se gira en cuartos de vuelta enteros", () => {
  // El render compone cajas alineadas con los ejes: una silla a 30° saldría
  // como su caja envolvente, que es peor que no girarla.
  assert.throws(() => colocarProp("silla", { x: 0, z: 0, cuartos: 0.5 }), RangeError);
});

test("un prop que no existe revienta al colocarlo, no devuelve nada en silencio", () => {
  assert.throws(() => colocarProp("trono", { x: 0, z: 0 }), RangeError);
});

/* ---- ancla de interacción ------------------------------------------------- */

test("el ancla sale ya en coordenadas de la sala, y gira con el prop (#579, #582)", () => {
  const { ancla } = colocarProp("soporte", { x: 4, z: 9 });
  assert.deepEqual(ancla.punto, [4, 9.75]);
  assert.equal(ancla.orientacion, Math.PI);

  const girado = colocarProp("soporte", { x: 4, z: 9, cuartos: 1 });
  assert.deepEqual(girado.ancla.punto, [4.75, 9]);
  assert.equal(girado.ancla.orientacion, Math.PI + Math.PI / 2);
});

test("un prop sin lado no declara ancla: no se deduce a ojo", () => {
  assert.equal(colocarProp("mesa", { x: 0, z: 0 }).ancla, null);
  assert.equal(colocarProp("bancada", { x: 0, z: 0 }).ancla, null);
});

import assert from "node:assert/strict";
import test from "node:test";

import { crearPlanta } from "../scripts/nave-movimiento.mjs";
import { crearCatalogoEstancias, declararEstancia, puntoDeLlegada } from "../scripts/nave-estancias.mjs";

const PLANTA_A = crearPlanta({ ancho: 10, profundidad: 10 });
const PLANTA_B = crearPlanta({ ancho: 6, profundidad: 6 });

test("declararEstancia exige planta y componer", () => {
  assert.throws(() => declararEstancia({ planta: PLANTA_A }), TypeError);
  assert.throws(() => declararEstancia({ componer: () => ({}) }), TypeError);
});

test("declararEstancia: la entrada por defecto es el centro de la planta", () => {
  const estancia = declararEstancia({ planta: PLANTA_A, componer: () => ({}) });
  assert.deepEqual(estancia.entrada, { x: 5, z: 5, yaw: 0 });
});

test("crearCatalogoEstancias valida al construir: una puerta a una estancia inexistente revienta", () => {
  assert.throws(
    () =>
      crearCatalogoEstancias({
        a: {
          planta: PLANTA_A,
          componer: () => ({}),
          puertas: [{ rect: { x: 0, z: 0, ancho: 1, profundidad: 1 }, destino: { estancia: "no-existe" } }],
        },
      }),
    RangeError,
  );
});

test("crearCatalogoEstancias: dos estancias que se referencian entre sí construyen sin fallo", () => {
  const catalogo = crearCatalogoEstancias({
    a: {
      planta: PLANTA_A,
      componer: () => ({ sala: "a" }),
      puertas: [{ rect: { x: 4, z: 9, ancho: 2, profundidad: 1 }, destino: { estancia: "b", x: 3, z: 0.5, yaw: Math.PI } }],
    },
    b: {
      planta: PLANTA_B,
      componer: () => ({ sala: "b" }),
      puertas: [{ rect: { x: 2, z: -0.5, ancho: 2, profundidad: 1 }, destino: { estancia: "a", x: 5, z: 8.5, yaw: 0 } }],
    },
  });
  assert.deepEqual(catalogo.ids, ["a", "b"]);
  assert.equal(catalogo.tiene("a"), true);
  assert.equal(catalogo.tiene("c"), false);
  assert.equal(catalogo.obtener("c"), null);
});

test("puntoDeLlegada: usa lo que fija la puerta y rellena lo que falta con la entrada de la estancia", () => {
  const catalogo = crearCatalogoEstancias({
    a: { planta: PLANTA_A, componer: () => ({ sala: "a" }), entrada: { x: 1, z: 1, yaw: 0.5 } },
    b: { planta: PLANTA_B, componer: () => ({ sala: "b" }) },
  });
  // La puerta fija x/z/yaw completos: manda ella, no la entrada de "a".
  const llegadaCompleta = puntoDeLlegada(catalogo, { estancia: "a", x: 7, z: 2, yaw: Math.PI });
  assert.deepEqual(llegadaCompleta, { estancia: "a", planta: PLANTA_A, componer: catalogo.obtener("a").componer, puertas: [], x: 7, z: 2, yaw: Math.PI });

  // Sin nada más que el id: cae en la entrada por defecto de "b" (su centro).
  const llegadaPorDefecto = puntoDeLlegada(catalogo, { estancia: "b" });
  assert.equal(llegadaPorDefecto.x, 3);
  assert.equal(llegadaPorDefecto.z, 3);
});

test("puntoDeLlegada: estancia desconocida devuelve null, no revienta", () => {
  const catalogo = crearCatalogoEstancias({ a: { planta: PLANTA_A, componer: () => ({}) } });
  assert.equal(puntoDeLlegada(catalogo, { estancia: "z" }), null);
});

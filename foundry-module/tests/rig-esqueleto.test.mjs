import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_INFLUENCIAS,
  crearRig,
  deformarMalla,
  normalizarPesos,
  posicionesDeHuesos,
} from "../scripts/rig-esqueleto.mjs";

/**
 * EL BRAZO DE PRUEBA, que es el criterio de salida de la fase 1 de #603.
 *
 * Dos tramos de un metro a lo largo de +y: el brazo va de y=0 a y=1 y el
 * antebrazo de y=1 a y=2. Ocho vértices, cuatro por tramo, con la sección en el
 * plano xz — lo justo para poder afirmar dónde acaba la mano.
 */
const MALLA_BRAZO = Object.freeze({
  vertices: [
    [-0.1, 0, -0.1], [0.1, 0, -0.1], [0.1, 0, 0.1], [-0.1, 0, 0.1],
    [-0.1, 1, -0.1], [0.1, 1, -0.1], [0.1, 1, 0.1], [-0.1, 1, 0.1],
    [-0.1, 2, -0.1], [0.1, 2, -0.1], [0.1, 2, 0.1], [-0.1, 2, 0.1],
  ],
  caras: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]],
});

const RIG_BRAZO = crearRig([
  { id: "brazo", cabeza: [0, 0, 0] },
  { id: "antebrazo", padre: "brazo", cabeza: [0, 1, 0] },
]);

/** Los cuatro de abajo son del brazo, los cuatro de arriba del antebrazo, y el
 *  anillo del codo va a medias: es lo que hace que el codo se doble en vez de
 *  romperse en dos trozos. */
const PESOS_BRAZO = normalizarPesos(
  RIG_BRAZO,
  [
    ...Array.from({ length: 4 }, () => [{ hueso: "brazo", peso: 1 }]),
    ...Array.from({ length: 4 }, () => [
      { hueso: "brazo", peso: 0.5 },
      { hueso: "antebrazo", peso: 0.5 },
    ]),
    ...Array.from({ length: 4 }, () => [{ hueso: "antebrazo", peso: 1 }]),
  ],
  MALLA_BRAZO.vertices.length,
);

const CASI = 1e-9;

function cerca(actual, esperado, mensaje, tolerancia = 1e-6) {
  assert.ok(Math.abs(actual - esperado) < tolerancia, `${mensaje}: ${actual} != ${esperado}`);
}

/** El centro de un anillo de cuatro vértices. Se mide el anillo y no cada
 *  vértice porque la sección tiene grosor: al girar, una esquina del codo sube
 *  y la de enfrente baja: son cinco centímetros de anillo, no un fallo. */
function centro(vertices, desde) {
  const cuatro = vertices.slice(desde, desde + 4);
  return [0, 1, 2].map((eje) => cuatro.reduce((suma, v) => suma + v[eje], 0) / 4);
}

test("sin pose, la malla deformada es la misma malla", () => {
  // La prueba que más veces salva: si el reposo no es la identidad, TODO lo
  // demás está midiendo contra una malla que ya venía torcida.
  const quieta = deformarMalla(MALLA_BRAZO, RIG_BRAZO, PESOS_BRAZO);
  quieta.vertices.forEach((vertice, i) => {
    vertice.forEach((valor, eje) => {
      assert.ok(Math.abs(valor - MALLA_BRAZO.vertices[i][eje]) < CASI, `vértice ${i} se movió en reposo`);
    });
  });
});

test("CRITERIO DE SALIDA: el brazo se dobla POR EL CODO (#603 fase 1)", () => {
  // Noventa grados alrededor de +z: la mano deja de apuntar hacia arriba y pasa
  // a apuntar hacia −x, con el codo quieto en su sitio.
  const doblado = deformarMalla(MALLA_BRAZO, RIG_BRAZO, PESOS_BRAZO, {
    antebrazo: { eje: [0, 0, 1], angulo: Math.PI / 2 },
  });

  // 1. El hombro no se entera.
  for (let i = 0; i < 4; i += 1) {
    cerca(doblado.vertices[i][1], 0, `el vértice ${i} del hombro se ha movido`);
  }

  // 2. El codo se queda donde estaba: es el eje del giro.
  cerca(centro(doblado.vertices, 4)[1], 1, "el codo ha cambiado de altura");

  // 3. La mano baja a la altura del codo y se va a −x, que es doblar y no
  //    estirar: un metro de antebrazo, girado un cuarto de vuelta.
  cerca(centro(doblado.vertices, 8)[1], 1, "la mano no ha bajado a la altura del codo");
  for (let i = 8; i < 12; i += 1) {
    assert.ok(doblado.vertices[i][0] < -0.8, `la mano ${i} no se ha ido hacia −x`);
  }

  // 4. Y el antebrazo conserva su longitud: la mezcla lineal no lo estira.
  const codo = centro(doblado.vertices, 4);
  const mano = centro(doblado.vertices, 8);
  cerca(Math.hypot(mano[0] - codo[0], mano[1] - codo[1], mano[2] - codo[2]), 1, "el antebrazo ha cambiado de largo");
});

test("girar el hueso padre arrastra al hijo, y no al revés", () => {
  const hombroGirado = deformarMalla(MALLA_BRAZO, RIG_BRAZO, PESOS_BRAZO, {
    brazo: { eje: [0, 0, 1], angulo: Math.PI / 2 },
  });
  // El brazo entero queda tumbado sobre −x, mano incluida: la jerarquía se
  // aplica de padres a hijos y el antebrazo viaja con su padre sin declararlo.
  const mano = centro(hombroGirado.vertices, 8);
  cerca(mano[0], -2, "la mano no ha seguido al hombro");
  cerca(mano[1], 0, "la mano debería estar a la altura del hombro");
});

test("la topología no cambia: las caras son las mismas, sin copiarlas", () => {
  const doblado = deformarMalla(MALLA_BRAZO, RIG_BRAZO, PESOS_BRAZO, {
    antebrazo: { eje: [0, 0, 1], angulo: 0.6 },
  });
  assert.equal(doblado.caras, MALLA_BRAZO.caras, "las caras se comparten, no se duplican por pose");
  assert.equal(doblado.vertices.length, MALLA_BRAZO.vertices.length);
});

test("la malla de origen NO se toca: viene congelada de data/mallas", () => {
  const antes = JSON.stringify(MALLA_BRAZO.vertices);
  deformarMalla(MALLA_BRAZO, RIG_BRAZO, PESOS_BRAZO, {
    antebrazo: { eje: [1, 0, 0], angulo: 1.2 },
  });
  assert.equal(JSON.stringify(MALLA_BRAZO.vertices), antes);
});

test("una pose PARCIAL es válida: lo que no se nombra se queda en reposo", () => {
  const soloCodo = deformarMalla(MALLA_BRAZO, RIG_BRAZO, PESOS_BRAZO, {
    antebrazo: { eje: [0, 0, 1], angulo: Math.PI / 2 },
  });
  const conRaizExplicita = deformarMalla(MALLA_BRAZO, RIG_BRAZO, PESOS_BRAZO, {
    brazo: { eje: [0, 1, 0], angulo: 0 },
    antebrazo: { eje: [0, 0, 1], angulo: Math.PI / 2 },
  });
  assert.deepEqual(soloCodo.vertices, conRaizExplicita.vertices);
});

test("las cabezas de hueso se pueden consultar posadas, para colgar cosas de ellas", () => {
  const enReposo = posicionesDeHuesos(RIG_BRAZO);
  assert.deepEqual(enReposo.map(({ id }) => id), ["brazo", "antebrazo"]);
  cerca(enReposo[1].punto[1], 1, "el codo en reposo está a un metro");

  const posadas = posicionesDeHuesos(RIG_BRAZO, { brazo: { eje: [0, 0, 1], angulo: Math.PI / 2 } });
  cerca(posadas[1].punto[0], -1, "girado el hombro, el codo se va a −x");
  cerca(posadas[1].punto[1], 0, "y baja a la altura del hombro");
});

test("un rig roto falla al declararlo, no tres capas más abajo", () => {
  assert.throws(() => crearRig([]), (e) => e.code === "rig_vacio");
  assert.throws(
    () => crearRig([{ id: "a", cabeza: [0, 0, 0] }, { id: "a", cabeza: [0, 1, 0] }]),
    (e) => e.code === "id_duplicado",
  );
  assert.throws(
    () => crearRig([{ id: "a", padre: "fantasma", cabeza: [0, 0, 0] }]),
    (e) => e.code === "padre_inexistente",
  );
  assert.throws(
    () => crearRig([{ id: "a", cabeza: [0, "arriba", 0] }]),
    (e) => e.code === "cabeza_invalida",
  );
  // Un ciclo: dos huesos que se declaran padre el uno del otro.
  assert.throws(
    () => crearRig([
      { id: "a", padre: "b", cabeza: [0, 0, 0] },
      { id: "b", padre: "a", cabeza: [0, 1, 0] },
    ]),
    (e) => e.code === "ciclo",
  );
});

test("el orden de la lista de huesos da igual: la jerarquía se resuelve", () => {
  const alReves = crearRig([
    { id: "antebrazo", padre: "brazo", cabeza: [0, 1, 0] },
    { id: "brazo", cabeza: [0, 0, 0] },
  ]);
  const pesos = normalizarPesos(
    alReves,
    PESOS_BRAZO.map((influencias) => influencias.map(({ indice, peso }) => ({
      hueso: RIG_BRAZO.huesos[indice].id,
      peso,
    }))),
    MALLA_BRAZO.vertices.length,
  );
  const doblado = deformarMalla(MALLA_BRAZO, alReves, pesos, {
    antebrazo: { eje: [0, 0, 1], angulo: Math.PI / 2 },
  });
  cerca(centro(doblado.vertices, 8)[1], 1, "la mano no ha bajado al codo");
});

test("los pesos se normalizan a suma 1, y un vértice sin hueso es error", () => {
  const sinNormalizar = normalizarPesos(
    RIG_BRAZO,
    [[{ hueso: "brazo", peso: 3 }, { hueso: "antebrazo", peso: 1 }]],
    1,
  );
  cerca(sinNormalizar[0][0].peso, 0.75, "no se ha normalizado");
  cerca(sinNormalizar[0][1].peso, 0.25, "no se ha normalizado");

  assert.throws(() => normalizarPesos(RIG_BRAZO, [[]], 1), (e) => e.code === "vertice_sin_hueso");
  assert.throws(() => normalizarPesos(RIG_BRAZO, [], 1), (e) => e.code === "pesos_incompletos");
  assert.throws(
    () => normalizarPesos(RIG_BRAZO, [[{ hueso: "codo", peso: 1 }]], 1),
    (e) => e.code === "hueso_inexistente",
  );
  assert.throws(
    () => normalizarPesos(RIG_BRAZO, [[{ hueso: "brazo", peso: -1 }]], 1),
    (e) => e.code === "peso_invalido",
  );
  const demasiadas = Array.from({ length: MAX_INFLUENCIAS + 1 }, () => ({ hueso: "brazo", peso: 1 }));
  assert.throws(() => normalizarPesos(RIG_BRAZO, [demasiadas], 1), (e) => e.code === "demasiadas_influencias");
});

test("una malla importada de verdad se deforma sin degenerar", async () => {
  // La Venus, con un rig de dos huesos partido por la cintura: no es un rig
  // anatómico —eso es la fase 2— pero prueba lo que importa aquí, que el bucle
  // aguanta 448 vértices reales y no sale un amasijo.
  const { VENUS_DE_MILO } = await import("../data/mallas/venus-de-milo.mjs");
  const rig = crearRig([
    { id: "cadera", cabeza: [0, 0, 0] },
    { id: "torso", padre: "cadera", cabeza: [0, 1, 0] },
  ]);
  const pesos = normalizarPesos(
    rig,
    VENUS_DE_MILO.vertices.map(([, y]) => (y < 1
      ? [{ hueso: "cadera", peso: 1 }]
      : [{ hueso: "torso", peso: 1 }])),
    VENUS_DE_MILO.vertices.length,
  );
  const inclinada = deformarMalla(VENUS_DE_MILO, rig, pesos, {
    torso: { eje: [0, 0, 1], angulo: 0.2 },
  });
  assert.equal(inclinada.vertices.length, VENUS_DE_MILO.vertices.length);
  assert.ok(inclinada.vertices.every((v) => v.every(Number.isFinite)), "hay vértices no finitos");
  // Lo de abajo no se mueve y lo de arriba sí: el corte por cintura hace su
  // trabajo aunque los pesos sean de brocha gorda.
  const movidos = inclinada.vertices.filter((v, i) => v[0] !== VENUS_DE_MILO.vertices[i][0]).length;
  assert.ok(movidos > 0 && movidos < VENUS_DE_MILO.vertices.length, `se movieron ${movidos} de 448`);
});

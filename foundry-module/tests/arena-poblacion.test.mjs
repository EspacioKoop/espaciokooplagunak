// Población de la arena (#1013): 4, 8, 16 y 32 cuerpos en el claro.
//
// La revisión de #1028 pedía «revalidar población 4/8/16/32» y no existía la
// prueba. Es la comprobación que le toca a esta escena y no a las de la nave:
// una sala del Phobos tiene aforo de tripulación, y un claro de 45 × 30 m se
// llena de combatientes hasta donde alguien decida.
//
// Lo que se afirma NO es un tope de milisegundos. El coste depende de la
// máquina y un número así se queda mintiendo en cuanto cambia el runner; lo
// que sí es estable, y es lo que rompería de verdad, son dos cosas:
//
//   1. Que doblar la población NO doble el resto de la escena. El claro —los
//      árboles, el suelo, el cierre— cuesta lo mismo con 4 que con 32, así que
//      el crecimiento tiene que ser el de los cuerpos y nada más. Si aparece
//      un coste que crece con el cuadrado de la población, es que algo empareja
//      a cada cuerpo con todos los demás.
//   2. Que la escena siga componiendo, sin NaN ni polígonos vacíos, con la
//      población alta. Un cuerpo mal colocado no revienta: devuelve vértices
//      no finitos y el rasterizador pinta basura.
//
// El presupuesto medido queda anotado en la cabecera del módulo, que es donde
// este repositorio guarda los números que se vuelven a medir a mano.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ANCHO,
  CASILLAS_ANCHO,
  CASILLAS_FONDO,
  ENTRADA,
  LADO_CASILLA,
  PROFUNDIDAD,
  componerArena,
} from "../scripts/arena-combate-escena.mjs";

const POBLACIONES = [4, 8, 16, 32];

/** Reparte `cuantos` cuerpos por el claro, deterministas y sin apilarse. */
function gente(cuantos) {
  const porFila = Math.ceil(Math.sqrt(cuantos));
  return Array.from({ length: cuantos }, (_, i) => ({
    x: 4 + ((i % porFila) * (ANCHO - 8)) / porFila,
    y: 0,
    z: 4 + (Math.floor(i / porFila) * (PROFUNDIDAD - 8)) / porFila,
    yaw: (i * Math.PI) / 7,
    avatar: { raza: ["humano", "enano", "elfo", "mediano", "orco"][i % 5], clase: "guerrero" },
  }));
}

function pintar(cuantos) {
  return componerArena(ENTRADA.x, 1.45, ENTRADA.z, ENTRADA.yaw, {
    ancho: 480,
    alto: 270,
    epoca: "psx",
    otrosJugadores: gente(cuantos),
  });
}

test("la arena compone con 4, 8, 16 y 32 cuerpos", () => {
  for (const cuantos of POBLACIONES) {
    const escena = pintar(cuantos);
    assert.ok(escena.poligonos.length > 0, `con ${cuantos} cuerpos no se pinta nada`);
  }
});

test("ningún vértice deja de ser finito al llenar el claro", () => {
  // El modo de fallo silencioso: un cuerpo mal colocado no lanza, devuelve NaN
  // y el rasterizador pinta basura sin que nada avise.
  for (const cuantos of POBLACIONES) {
    for (const poligono of pintar(cuantos).poligonos) {
      for (const punto of poligono.puntos ?? []) {
        assert.ok(
          Number.isFinite(punto.x) && Number.isFinite(punto.y),
          `con ${cuantos} cuerpos hay un vértice no finito`,
        );
      }
    }
  }
});

test("el claro cuesta lo mismo con 4 que con 32: lo que crece son los cuerpos", () => {
  // Doblar la población dobla el coste de los cuerpos y NADA más. Si el
  // crecimiento se acelerara, sería la señal de que algo empareja cada cuerpo
  // con todos los demás.
  const conteos = POBLACIONES.map((n) => pintar(n).poligonos.length);
  const [c4, c8, c16, c32] = conteos;

  // Incrementos por cada duplicación: si el claro fuera parte del crecimiento,
  // el primer salto sería mucho mayor que los siguientes.
  const salto8 = c8 - c4;
  const salto16 = c16 - c8;
  const salto32 = c32 - c16;

  assert.ok(salto8 > 0, "añadir cuerpos no añadió un solo polígono");
  // Cada duplicación añade aproximadamente tantos cuerpos como había: los
  // saltos crecen al doble, no al cuadrado. Un margen amplio (×3) deja sitio
  // al descarte por distancia, que sí depende de dónde caiga cada cual.
  assert.ok(salto16 < salto8 * 3, `el salto de 8→16 (${salto16}) se dispara frente al de 4→8 (${salto8})`);
  assert.ok(salto32 < salto16 * 3, `el salto de 16→32 (${salto32}) se dispara frente al de 8→16 (${salto16})`);
});

test("la rejilla jugable es la que dice la tarjeta: 30 × 20 casillas de cinco pies", () => {
  // La medida que hace que «cruzar la arena» signifique algo. Va aquí y no en
  // combate-rejilla porque es la escena la que traduce casillas a metros.
  assert.equal(CASILLAS_ANCHO, 30);
  assert.equal(CASILLAS_FONDO, 20);
  assert.equal(Number(LADO_CASILLA.toFixed(3)), 1.524);
  assert.equal(Number(ANCHO.toFixed(2)), 45.72);
  assert.equal(Number(PROFUNDIDAD.toFixed(2)), 30.48);
});

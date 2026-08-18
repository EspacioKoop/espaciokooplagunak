// El kit de exteriores (#589).

import assert from "node:assert/strict";
import test from "node:test";

import {
  ciclo,
  declararSol,
  franja,
  huellaDe,
  sombraDeCaja,
} from "../scripts/escena-exteriores.mjs";
import { SOL, LARGO_SOMBRA, RUMBO_SOMBRA } from "../scripts/playa-escena.mjs";

/* ---- el sol y lo que cuelga de él ----------------------------------------- */

test("lo derivado sale del sol, no de constantes escritas a mano", () => {
  // Es LA invariante del kit: si alguien mueve el sol, las sombras se mueven con
  // él. Escritas aparte, un día la luz viene de un sitio y las sombras van a
  // otro — el fallo que delata una escena antes que ningún otro.
  const bajo = declararSol([1, 0.2, 0]);
  const alto = declararSol([1, 2, 0]);
  assert.ok(bajo.largoSombra > alto.largoSombra, "un sol bajo tira sombras más largas");
});

test("el rumbo de la sombra es el contrario del sol, y unitario", () => {
  const sol = declararSol([0.72, 0.34, 0.52]);
  const [sx, , sz] = sol.direccion;
  const plano = Math.hypot(sx, sz);
  assert.ok(Math.abs(sol.rumboSombra[0] - -sx / plano) < 1e-9);
  assert.ok(Math.abs(sol.rumboSombra[1] - -sz / plano) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...sol.rumboSombra) - 1) < 1e-9);
});

test("el largo de la sombra es 1/tan(altura del sol)", () => {
  const sol = declararSol([0.72, 0.34, 0.52]);
  const largo = Math.hypot(...sol.direccion);
  const seno = sol.direccion[1] / largo;
  assert.ok(Math.abs(sol.largoSombra - Math.sqrt(1 - seno * seno) / seno) < 1e-9);
});

test("un sol en el cenit no divide por cero", () => {
  // Cualquier rumbo valdría porque la sombra cae bajo el objeto: lo que no vale
  // es un NaN colándose en la geometría de toda la escena.
  const sol = declararSol([0, 1, 0]);
  assert.ok(sol.rumboSombra.every(Number.isFinite), "el rumbo tiene que ser un número");
  assert.ok(Number.isFinite(sol.largoSombra));
});

test("un sol bajo el horizonte se rechaza al declararlo, no al pintar", () => {
  assert.throws(() => declararSol([1, -0.2, 0]));
  assert.throws(() => declararSol([0, 0, 0]));
});

test("la sombra se tumba hacia donde dice el rumbo, y sale del objeto", () => {
  const sol = declararSol([1, 0.3, 0]); // luz desde +x, sombra hacia -x
  const sombra = sol.sombraDeCaja({ centro: [0, 2, 0], medidas: [1, 4, 1] });
  const xs = sombra.vertices.map(([x]) => x);
  assert.ok(Math.min(...xs) < -4, "con un sol bajo la sombra tiene que ser larga");
  assert.ok(Math.max(...xs) <= 0.51, "y no debería asomar por el lado iluminado");
});

test("la sombra de un prop sale de las piezas que tocan el suelo, como una silueta", () => {
  // Pieza a pieza saldría una maraña de rectángulos superpuestos en vez de una
  // sombra: manda la más alta de las que arrancan del suelo, con el ancho de la
  // envolvente de esas — el techo volado no ensancha la huella, la cruza.
  const sol = declararSol([1, 0.4, 0]);
  const sombra = sol.sombraDeProp([
    { centro: [0, 1.5, -0.8], medidas: [0.2, 3, 0.2] }, // un montante
    { centro: [0, 1.5, 0.8], medidas: [0.2, 3, 0.2] }, // el otro
    { centro: [0, 3.4, 0], medidas: [2, 0.2, 2] }, // el techo, volando
  ]);
  assert.ok(sombra, "un prop apoyado en el suelo proyecta sombra");
  const zs = sombra.vertices.map(([, , z]) => z);
  assert.ok(Math.max(...zs) - Math.min(...zs) > 0.15, "toma el ancho de los montantes");
  const xs = sombra.vertices.map(([x]) => x);
  assert.ok(Math.min(...xs) < -6, "y el largo lo manda la pieza más alta en pie");
});

test("lo que no toca el suelo no proyecta nada", () => {
  const sol = declararSol([1, 0.4, 0]);
  assert.equal(sol.sombraDeProp([{ centro: [0, 40, 0], medidas: [8, 1, 1] }]), null);
});

test("el disco del sol se pinta donde el sol dice que está", () => {
  const sol = declararSol([1, 0.3, 0.5]);
  const disco = sol.disco({ distancia: 100, radio: 10 });
  const centro = disco.vertices.reduce(
    ([ax, ay, az], [x, y, z]) => [ax + x / 4, ay + y / 4, az + z / 4],
    [0, 0, 0],
  );
  const esperado = sol.unitaria.map((c) => c * 100);
  centro.forEach((c, i) => assert.ok(Math.abs(c - esperado[i]) < 1e-9));
});

/* ---- el terreno ------------------------------------------------------------ */

test("la cara superior de una franja queda exactamente a `alto`", () => {
  // Es todo el contrato de la franja: se declara la cota que se pisa, no dónde
  // cae el fondo de la losa.
  const { malla } = franja({ desde: 0, hasta: 10, z0: -2, z1: 2, alto: 0.5 });
  const techo = Math.max(...malla.vertices.map(([, y]) => y));
  assert.ok(Math.abs(techo - 0.5) < 1e-9);
});

test("una franja tiene grosor, o desaparece al mirarla desde el otro lado", () => {
  const { malla } = franja({ desde: 0, hasta: 10, z0: -2, z1: 2, alto: 0 });
  const ys = malla.vertices.map(([, y]) => y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0, "el motor descarta las caras de espaldas");
});

test("lo que pasa por encima de la cabeza no es un muro", () => {
  // Las aspas de un aerogenerador a 44 m no estorban al andar.
  const piezas = [
    { centro: [5, 1, 5], medidas: [2, 2, 2] },
    { centro: [5, 44, 5], medidas: [30, 2, 2] },
  ];
  const huella = huellaDe(piezas);
  assert.equal(huella.length, 1);
  assert.deepEqual(huella[0], { x: 4, z: 4, ancho: 2, profundidad: 2 });
});

test("dónde está la raya de la cabeza se puede mover", () => {
  const piezas = [{ centro: [0, 3, 0], medidas: [1, 1, 1] }];
  assert.equal(huellaDe(piezas).length, 0);
  assert.equal(huellaDe(piezas, { altura: 5 }).length, 1);
});

test("el ciclo recicla por el borde, también con negativos", () => {
  assert.equal(ciclo(12, 10), 2);
  assert.equal(ciclo(-1, 10), 9);
  assert.equal(ciclo(0, 10), 0);
});

/* ---- que la playa siga siendo la playa ------------------------------------- */

test("la playa consume el kit en vez de tener su propia copia (#589)", () => {
  // Si estas dos dejan de coincidir es que alguien ha vuelto a escribir las
  // sombras a mano dentro de una escena, que es justo lo que el kit evita.
  const sol = declararSol(SOL);
  assert.equal(sol.largoSombra, LARGO_SOMBRA);
  assert.deepEqual([...sol.rumboSombra], [...RUMBO_SOMBRA]);
});

test("sombraDeCaja funciona igual suelta que colgada del sol", () => {
  const sol = declararSol([0.72, 0.34, 0.52]);
  const pieza = { centro: [3, 1, 4], medidas: [1, 2, 1] };
  assert.deepEqual(sombraDeCaja(sol, pieza), sol.sombraDeCaja(pieza));
});

// Piel pixelart del suelo y del techo (#552).
//
// Lo caro de estas dos superficies no es dibujarlas: es que están en cuadro
// SIEMPRE. Casi todo lo que se prueba aquí es presupuesto y comportamiento ante
// salas grandes, que es donde reventó la primera versión.

import test from "node:test";
import assert from "node:assert/strict";

import {
  TOPE_HORIZONTAL,
  piezasPielSuelo,
  piezasPielTecho,
  rejillaSuelo,
  rejillaTecho,
} from "../scripts/nave-piel-suelo.mjs";
import { CELDA } from "../scripts/nave-mural-pixel.mjs";
import { MURAL } from "../scripts/paleta.mjs";
import { crearSalaCaja, ALTURA } from "../scripts/nave-sala-caja.mjs";

/** La sala más grande del catálogo real. Es la medida que manda: el coste del
 *  suelo lo fija la sala mayor, no la media. */
const GRANDE = { ancho: 22, profundidad: 22 };
const PEQUENA = { ancho: 8, profundidad: 6 };

const caras = (piezas) => piezas.reduce((n, p) => n + p.malla.caras.length, 0);

test("la sala más grande del catálogo cabe en el presupuesto del suelo", () => {
  // La primera versión pintaba una plancha por rectángulo y en una sala de 22 m
  // eran trescientas: se pasaba del tope, se cortaba la lista y el suelo salía
  // con juntas en la mitad del fondo y liso en la otra mitad. El test que
  // faltaba era este.
  const suelo = piezasPielSuelo({ ...GRANDE, semilla: 5 });
  assert.ok(caras(suelo) > 0, "una sala de 22x22 SÍ tiene que llevar suelo dibujado");
  assert.ok(caras(suelo) <= TOPE_HORIZONTAL, `${caras(suelo)} caras se pasan del tope`);
  assert.ok(caras(piezasPielTecho({ ...GRANDE, altura: ALTURA })) <= TOPE_HORIZONTAL);
});

test("el suelo es mucho más barato que un muro, porque se paga siempre", () => {
  // Un muro puede quedar a la espalda; el suelo no. Su dibujo tiene que ser
  // deliberadamente más pobre, y eso es una decisión, no una carencia.
  assert.ok(caras(piezasPielSuelo({ ...PEQUENA, semilla: 1 })) < 60);
});

test("todo o nada: nunca media sala con juntas y media lisa", () => {
  // Recortar por el final de la lista deja un suelo pintado por un lado, que se
  // lee como un fallo y no como menos detalle.
  const enorme = piezasPielSuelo({ ancho: 400, profundidad: 400, semilla: 1 });
  assert.deepEqual(enorme, [], "si no cabe entero, no se pinta");
});

test("una sala minúscula no lleva suelo dibujado", () => {
  // Por debajo de una plancha no hay juntas que dibujar, y una junta suelta en
  // una sala de dos metros es una raya en el suelo sin significado.
  assert.deepEqual(piezasPielSuelo({ ancho: 2, profundidad: 2 }), []);
});

test("la junta del suelo va UN paso por encima de la losa, no por debajo", () => {
  // La losa de suelo es el tono más oscuro de la sala y el motor la deja casi
  // tal cual (una cara que mira hacia arriba recibe la luz de lleno), así que
  // por debajo de ella no hay dónde ir: una junta de suelo tiene que ser una
  // línea un punto MÁS CLARA. Con `hueco` (más oscuro) el suelo desaparecía;
  // con `sombra` o `medio` se leía como el carril de una autopista.
  // Se mira la JUNTA, no la rejilla entera: el registro de desagüe sí usa tonos
  // más claros y tiene derecho, porque es una mancha pequeña y no una línea que
  // recorra la sala. Lo que no puede aclararse es lo que converge en perspectiva.
  const rejilla = rejillaSuelo(60, 60, 3);
  // Fila y columna 48 y no 24: el registro de desagüe se coloca entre una
  // plancha y la penúltima, así que puede caer sobre la junta 24 según la
  // semilla — y entonces el test mediría el registro en vez de la junta.
  const juntaHorizontal = rejilla[48];
  const juntaVertical = rejilla.map((f) => f[48]);
  for (const tono of [...juntaHorizontal, ...juntaVertical]) {
    if (!tono) continue;
    assert.ok(
      tono === MURAL.junta || tono === MURAL.hueco,
      `${tono} es demasiado claro para una junta de suelo: convergería como un carril`,
    );
  }
  assert.ok(juntaHorizontal.includes(MURAL.junta), "y la junta existe");
});

test("la piel horizontal cae clavada en la rejilla del casco", () => {
  const enRejilla = (n) => Math.abs(n / CELDA - Math.round(n / CELDA)) < 1e-6;
  for (const { malla } of piezasPielSuelo({ ...PEQUENA, semilla: 2 })) {
    for (const [x, y, z] of malla.vertices) {
      assert.ok(enRejilla(x) && enRejilla(z), "la planta cae en la rejilla");
      assert.ok(y > 0 && y < 0.05, "el suelo va apenas por encima de su losa");
    }
  }
  for (const { malla } of piezasPielTecho({ ...PEQUENA, altura: ALTURA })) {
    for (const [, y] of malla.vertices) {
      assert.ok(y < ALTURA && y > ALTURA - 0.05, "y el techo, apenas por debajo del suyo");
    }
  }
});

test("el suelo mira hacia arriba y el techo hacia abajo", () => {
  // Con el giro invertido, cada uno se vería solo desde el lado donde no hay
  // nadie: el suelo desde el sótano y el techo desde fuera de la nave.
  const normal = ({ vertices, caras: cs }) => {
    const [a, b, c] = cs[0].map((i) => vertices[i]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return Math.sign(u[2] * v[0] - u[0] * v[2]);
  };
  for (const p of piezasPielSuelo({ ...PEQUENA, semilla: 2 })) assert.equal(normal(p.malla), 1);
  for (const p of piezasPielTecho({ ...PEQUENA, altura: ALTURA })) assert.equal(normal(p.malla), -1);
});

test("ni un color propio, y ninguna señal en el suelo", () => {
  // La regla de #526 donde más fácil sería saltársela: una marca en el suelo que
  // parezca indicar por dónde ir afirma algo que nadie ha decidido. Aquí solo
  // hay juntas y un registro, y se comprueba por donde se puede: la paleta y el
  // hecho de que el dibujo sea el MISMO en las dos direcciones —una señal tiene
  // sentido de lectura; una rejilla de planchas, no.
  const permitidos = new Set(Object.values(MURAL));
  for (const { color } of piezasPielSuelo({ ...PEQUENA, semilla: 7 })) assert.ok(permitidos.has(color));
  for (const { color } of piezasPielTecho({ ...PEQUENA, altura: ALTURA })) assert.ok(permitidos.has(color));
  const rejilla = rejillaSuelo(48, 48, 1);
  for (let k = 0; k < 48; k += 1) {
    assert.equal(rejilla[24][k], rejilla[k][24], "las juntas son simétricas en los dos ejes");
  }
});

test("el techo lleva vigas y poco más", () => {
  const tonos = new Set(rejillaTecho(60, 60).flat().filter(Boolean));
  assert.ok(tonos.size <= 3, "se mira poco: no es sitio para un dibujo");
});

test("la piel no cambia por dónde se puede andar, y el interruptor la apaga", () => {
  const comun = { ancho: 8, profundidad: 6 };
  assert.deepEqual(
    crearSalaCaja({ ...comun, pielSuelo: true }).planta,
    crearSalaCaja({ ...comun, pielSuelo: false }).planta,
  );
  const vista = (pielSuelo) =>
    crearSalaCaja({ ...comun, muralPixel: false, pielSuelo })
      // Mirando al suelo desde el centro.
      .componer(4, 0, 3, 0, { ancho: 320, alto: 180 }).poligonos.length;
  assert.ok(vista(true) > vista(false), "de serie, la sala trae suelo dibujado");
});

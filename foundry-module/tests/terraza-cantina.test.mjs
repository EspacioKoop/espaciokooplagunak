/**
 * La terraza de la cantina como ESTANCIA (#579).
 *
 * Las guardias generales de la nave (llegadas fuera de obstáculos, inundación
 * desde la entrada, minimapa completo, rótulo traducido) ya la cubren desde que
 * entró en el catálogo — y de hecho las tres cazaron fallos reales al añadirla.
 * Lo que se prueba aquí es lo que solo la terraza tiene: que sea un espacio
 * ABIERTO y no un cuarto, que se llegue andando desde la cantina y de vuelta, y
 * que el puesto de pesca exista como dato localizable.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ANCHO,
  ENTRADA,
  PLANTA_TERRAZA,
  PROFUNDIDAD,
  PUERTA_CANTINA,
  PUNTO_PESCA,
  componerTerraza,
} from "../scripts/terraza-cantina.mjs";
import { PUERTA_TERRAZA } from "../scripts/cantina-sala.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { ALTURA } from "../scripts/nave-sala-caja.mjs";

test("la terraza es una estancia del catálogo de andar, no una escena aparte", () => {
  // La jerarquía de #577: andar es la navegación principal. Una terraza con
  // ventana propia sería una segunda geografía de la nave.
  assert.ok(CATALOGO_ANDAR.ids.includes("terraza"));
});

test("se llega andando desde la cantina, y se vuelve", () => {
  const cantina = CATALOGO_ANDAR.obtener("cantina");
  const terraza = CATALOGO_ANDAR.obtener("terraza");

  const ida = cantina.puertas.find((p) => p.destino.estancia === "terraza");
  assert.ok(ida, "la cantina tiene puerta a la terraza");
  assert.deepEqual(ida.rect, PUERTA_TERRAZA, "y su disparador es el hueco que abre en su propio muro");

  const vuelta = terraza.puertas.find((p) => p.destino.estancia === "cantina");
  assert.ok(vuelta, "y se puede volver: la terraza no es un callejón sin salida");
  assert.deepEqual(vuelta.rect, PUERTA_CANTINA);
});

test("al volver de la terraza se aparece JUNTO a su puerta, mirando a la sala", () => {
  // La inundación general solo garantiza que desde la ENTRADA de la cantina se
  // llegue a sus puertas; no dice nada de dónde deja a quien vuelve. Y aquí eso
  // importa: la llegada se calcula a partir del rect del hueco, que en el muro
  // oeste es alto en `z` y estrecho en `x` —al revés que la salida sur—, así que
  // confundir sus ejes deja al jugador en mitad de la sala sin que nada falle.
  const vuelta = CATALOGO_ANDAR.obtener("terraza").puertas.find(
    (p) => p.destino.estancia === "cantina",
  );
  const { x, z, yaw } = vuelta.destino;

  assert.ok(
    x > PUERTA_TERRAZA.x + PUERTA_TERRAZA.ancho,
    "adentro del hueco, no encima de su disparador: si no, se rebota de vuelta",
  );
  assert.ok(x < PUERTA_TERRAZA.x + PUERTA_TERRAZA.ancho + 3, "y aun así junto a él, no en mitad de la sala");
  assert.ok(
    z > PUERTA_TERRAZA.z && z < PUERTA_TERRAZA.z + PUERTA_TERRAZA.profundidad,
    "a la altura del hueco: el muro oeste corre a lo largo de z",
  );
  // El frente es `(sen yaw, cos yaw)`: mirar a la sala desde el muro oeste es
  // mirar a +x.
  assert.ok(Math.sin(yaw) > 0.9, "mirando hacia dentro de la cantina, no a la pared");
});

test("entrar por el atajo de la cantina no lleva a la terraza", () => {
  // Requisito explícito de #579: la entrada directa a la cantina sigue siendo la
  // cantina. La terraza se gana andando.
  const cantina = CATALOGO_ANDAR.obtener("cantina");
  assert.ok(cantina.entrada.z > 8, "se aparece junto a la salida sur, como siempre");
});

test("no tiene techo: es una terraza y no un cuarto", () => {
  // La losa de techo va a `ALTURA + 0.05`. Si alguna pieza llegara ahí, la
  // terraza sería un cuarto con antepecho.
  const escena = componerTerraza(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { ancho: 320, alto: 240 });
  assert.ok(escena.poligonos.length > 0, "algo se ve");

  const techo = PLANTA_TERRAZA.obstaculos.some((o) => o.alto >= ALTURA);
  assert.equal(techo, false);
});

test("por encima del antepecho no hay muro: se ve el espacio", () => {
  // Mirando al norte desde el centro, un muro de 3,8 m taparía el cuadro entero.
  // Con antepecho, nada de la terraza se dibuja por encima de la altura de los
  // ojos en esa dirección — que es lo que hace que sea una terraza.
  // `yaw` π mira hacia -z, que es el norte: el lado abierto de la terraza.
  const escena = componerTerraza(ANCHO / 2, 0, PROFUNDIDAD - 1.4, Math.PI, { ancho: 320, alto: 240 });
  const alturaOjos = 1.45;
  const delante = escena.poligonos.filter((p) => p.camara.every((v) => v[2] > 2));
  assert.ok(delante.length > 0, "algo hay delante: las cañas y el antepecho");
  const porEncima = delante.filter((p) => p.camara.some((v) => v[1] > alturaOjos * 0.9));
  assert.ok(
    porEncima.length < delante.length / 2,
    "la mayor parte de lo que hay al norte queda por debajo de los ojos",
  );
});

test("el puesto de pesca existe como dato, no como coordenada suelta", () => {
  // La condición de #579 para que el minijuego que venga después no tenga que
  // rehacer la terraza: que pueda encontrar el punto por nombre.
  assert.equal(PUNTO_PESCA.id, "punto-pesca");
  assert.ok(PUNTO_PESCA.x > 0 && PUNTO_PESCA.x < ANCHO);
  assert.ok(PUNTO_PESCA.z > 0 && PUNTO_PESCA.z < PROFUNDIDAD);
});

test("desde el puesto de pesca se puede estar de pie: no cae dentro del soporte", () => {
  const radio = 0.35;
  const dentro = PLANTA_TERRAZA.obstaculos.some(
    (o) =>
      PUNTO_PESCA.x > o.x - radio &&
      PUNTO_PESCA.x < o.x + o.ancho + radio &&
      PUNTO_PESCA.z > o.z - radio &&
      PUNTO_PESCA.z < o.z + o.profundidad + radio,
  );
  assert.equal(dentro, false, "el punto de pesca está junto al soporte, no dentro de él");
});

test("la terraza cabe en el presupuesto de una sala retro", () => {
  // Misma disciplina que #551: el coste se mide y se escribe. La peor sala de la
  // nave ronda los 800 polígonos visibles; una terraza con muebles no puede
  // costar más que ella por tener sillas de verdad.
  const escena = componerTerraza(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, {
    ancho: 480,
    alto: 270,
    epoca: "gamecube",
  });
  // Medido hoy: 220 desde la entrada y 213 desde el puesto de pesca, contra los
  // 657–789 de la peor sala de la nave. El tope deja margen para que la terraza
  // crezca, pero no para que se convierta en la pieza que rompe el frame.
  assert.ok(
    escena.poligonos.length < 400,
    `${escena.poligonos.length} polígonos visibles desde la entrada`,
  );
});

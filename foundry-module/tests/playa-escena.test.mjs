// La playa de pruebas (#587).
//
// Lo que se comprueba aquí no es que «se vea bonita» —eso es playtest— sino lo
// que un exterior puede romper sin que nadie se entere: que se pueda andar por
// donde se dice, que no se pueda entrar en el mar, que la geometría lejana
// exista de verdad y que la cabina siga siendo la salida.

import assert from "node:assert/strict";
import test from "node:test";

import {
  ANCHO,
  ENTRADA,
  INTERACCIONES,
  PLANTA_PLAYA,
  PROFUNDIDAD,
  VOCABULARIO_PLAYA,
  componerPlaya,
} from "../scripts/playa-escena.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { interaccionAlAlcance } from "../scripts/nave-interaccion.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { PLAYA } from "../scripts/paleta.mjs";

const RADIO = 0.35;

/* ---- por dónde se anda ---------------------------------------------------- */

test("se aparece en sitio libre, mirando al fondo del camino", () => {
  assert.equal(colisiona(ENTRADA.x, ENTRADA.z, RADIO, PLANTA_PLAYA), false);
  assert.equal(ENTRADA.yaw, 0, "yaw 0 mira a +z, que es hacia la cabina");
});

test("el camino de arena se recorre de punta a punta", () => {
  // La comprobación que de verdad importa: si el camino estuviera cortado por un
  // poste mal puesto o por la huella de la cabina, la escena sería un pasillo
  // sin salida y solo se vería al andarla.
  for (let z = 2; z <= PROFUNDIDAD - 2; z += 0.5) {
    assert.equal(colisiona(11, z, RADIO, PLANTA_PLAYA), false, `el camino está cortado en z=${z}`);
  }
});

test("no se entra en el mar: nadar está fuera de alcance", () => {
  for (let z = 2; z <= PROFUNDIDAD - 2; z += 4) {
    assert.equal(colisiona(20, z, RADIO, PLANTA_PLAYA), true, `se puede meter el pie en el agua en z=${z}`);
  }
});

test("la duna baja se pisa y la alta no", () => {
  // El límite que impone que el motor de movimiento no tenga altura de terreno:
  // lo que se puede pisar es lo que no se nota al pisarlo.
  assert.equal(colisiona(6, 20, RADIO, PLANTA_PLAYA), false, "la falda de la duna debería pisarse");
  assert.equal(colisiona(0.5, 20, RADIO, PLANTA_PLAYA), true, "la duna alta debería frenar");
});

test("los postes de luz son sólidos: se rodean, no se atraviesan", () => {
  assert.equal(colisiona(3, 4, RADIO, PLANTA_PLAYA), true);
});

/* ---- lo que se ve --------------------------------------------------------- */

test("la escena se compone y trae geometría de sobra", () => {
  const escena = componerPlaya(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { ancho: 480, alto: 270 });
  assert.equal(escena.ancho, 480);
  assert.ok(escena.poligonos.length > 50, `solo ${escena.poligonos.length} polígonos: falta media playa`);
  // Ni un polígono con coordenadas rotas: un NaN aquí lo aceptaría el pintor sin
  // rechistar y se vería como un tajo en la imagen.
  for (const poligono of escena.poligonos) {
    for (const { x: px, y: py } of poligono.puntos ?? []) {
      assert.ok(Number.isFinite(px) && Number.isFinite(py));
    }
  }
});

test("mirando a los cuatro rumbos siempre hay algo pintado", () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const escena = componerPlaya(ENTRADA.x, 0, ENTRADA.z, yaw, {});
    assert.ok(escena.poligonos.length > 0, `mirando a ${yaw} no se ve nada`);
  }
});

test("el aerogenerador es alto y está mar adentro: es el fondo de la escena", () => {
  const [ancho, alto] = VOCABULARIO_PLAYA.aerogenerador.medidas;
  assert.ok(alto > 40, "un aerogenerador bajo no se vería desde la orilla");
  assert.ok(ancho > 30, "las aspas tienen que barrer, no ser un palo");
});

test("la cabina no es un armario rojo: lleva cristales de otro color", () => {
  const colores = new Set(VOCABULARIO_PLAYA.cabina.partes.map(({ color }) => color));
  assert.ok(colores.has(PLAYA.cristal), "sin vidrio, la cabina no se lee como cabina");
  assert.ok(colores.size >= 3);
});

/* ---- la cabina como salida (#582) ----------------------------------------- */

test("la cabina es el punto de interacción, y su ancla la declara el prop", () => {
  assert.equal(INTERACCIONES.length, 1);
  const [cabina] = INTERACCIONES;
  assert.equal(cabina.id, "cabina-telefono");
  assert.deepEqual(cabina.accion, { tipo: "estancia", estancia: "cantina" });
  assert.ok(Number.isFinite(cabina.orientacion), "el prop declara hacia dónde se mira, no se deduce a ojo");
});

test("plantándose delante de la cabina, el punto responde", () => {
  const [cabina] = INTERACCIONES;
  const [x, z] = cabina.punto;
  assert.equal(interaccionAlAlcance(x, z, RADIO, INTERACCIONES)?.id, "cabina-telefono");
  // Y desde el otro extremo del camino, no.
  assert.equal(interaccionAlAlcance(x, 6, RADIO, INTERACCIONES), null);
});

test("se puede llegar andando hasta el punto de la cabina", () => {
  const [x, z] = INTERACCIONES[0].punto;
  assert.equal(colisiona(x, z, RADIO, PLANTA_PLAYA), false, "la salida está dentro de la propia cabina");
});

/* ---- cómo entra en el catálogo -------------------------------------------- */

test("la playa es una estancia del catálogo, con cielo por fondo y sin puertas", () => {
  const playa = CATALOGO_ANDAR.obtener("playa");
  assert.ok(playa, "no se podría abrir desde la herramienta de GM");
  assert.deepEqual(playa.puertas, [], "no cuelga de ningún mamparo de la nave");
  assert.equal(playa.fondo, PLAYA.cielo);
  assert.equal(playa.interacciones.length, 1);
});

test("la escena cabe en su planta declarada", () => {
  assert.equal(PLANTA_PLAYA.ancho, ANCHO);
  assert.equal(PLANTA_PLAYA.profundidad, PROFUNDIDAD);
});

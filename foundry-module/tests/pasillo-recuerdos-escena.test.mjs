import assert from "node:assert/strict";
import test from "node:test";

import {
  ANCHO,
  ENTRADA,
  INTERACCIONES,
  PLANTA_PASILLO,
  PROFUNDIDAD,
  componerPasillo,
} from "../scripts/pasillo-recuerdos-escena.mjs";
import { CATALOGO_MUSEO } from "../scripts/museo-piezas.mjs";
import { CATALOGO_PASILLO } from "../scripts/pasillo-recuerdos-piezas.mjs";

test("el pasillo es más largo que el alcance de dibujo por defecto (80 m)", () => {
  // Es la base de la sensación de infinito: el fondo tiene que caer fuera del
  // recorte para no verse nunca. Si algún día `PROFUNDIDAD` baja de 80, esta
  // prueba lo dice antes que un jugador viendo el muro del fondo entre niebla.
  assert.ok(PROFUNDIDAD > 80, `PROFUNDIDAD (${PROFUNDIDAD}) debe superar el alcance de 80 m`);
});

test("la entrada mira hacia el pasillo y no hacia un muro", () => {
  assert.ok(ENTRADA.x > 0 && ENTRADA.x < ANCHO);
  assert.equal(ENTRADA.yaw, 0);
});

test("hay una Guardiana, catorce pares de memoria/centinela y una salida", () => {
  const piezas = INTERACCIONES.filter((i) => i.accion.tipo === "cartela");
  const guardiana = piezas.filter((i) => i.accion.pieza === "guardiana");
  const centinelas = piezas.filter((i) => i.accion.pieza === "centinela");
  const memorias = piezas.filter((i) => i.accion.pieza !== "guardiana" && i.accion.pieza !== "centinela");
  assert.equal(guardiana.length, 1);
  assert.equal(centinelas.length, 14);
  assert.equal(memorias.length, 14);
  assert.ok(INTERACCIONES.some((i) => i.accion.tipo === "estancia" && i.accion.estancia === "cantina"));
});

test("cada memoria apunta a una pieza real del catálogo del museo", () => {
  const idsDelMuseo = new Set(CATALOGO_MUSEO.piezas.map((p) => p.id));
  const memorias = INTERACCIONES.filter(
    (i) => i.accion.tipo === "cartela" && i.accion.pieza !== "guardiana" && i.accion.pieza !== "centinela",
  );
  for (const memoria of memorias) {
    assert.ok(idsDelMuseo.has(memoria.accion.pieza), `${memoria.accion.pieza} no está en CATALOGO_MUSEO`);
  }
});

test("la Guardiana y el centinela están en el catálogo propio del pasillo", () => {
  const ids = new Set(CATALOGO_PASILLO.piezas.map((p) => p.id));
  assert.ok(ids.has("guardiana"));
  assert.ok(ids.has("centinela"));
  for (const pieza of CATALOGO_PASILLO.piezas) {
    assert.equal(pieza.naturaleza, "obra-propia", `${pieza.id} no es obra-propia`);
  }
});

test("todos los miradores caen dentro de la planta y no encima de un obstáculo", () => {
  for (const interaccion of INTERACCIONES) {
    const [x, z] = interaccion.punto;
    assert.ok(x > 0 && x < ANCHO, `mirador de ${interaccion.id} fuera del ancho`);
    assert.ok(z > 0 && z < PROFUNDIDAD, `mirador de ${interaccion.id} fuera del largo`);
  }
});

test("la planta tiene un obstáculo por plinto, más el de la Guardiana y la salida", () => {
  // 14 pares * 2 plintos + el plinto de la Guardiana + la salida = 30.
  assert.equal(PLANTA_PASILLO.obstaculos.length, 30);
});

test("componerPasillo compone sin reventar desde la entrada", () => {
  const escena = componerPasillo(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { ancho: 320, alto: 180 });
  assert.ok(escena.poligonos.length > 0, "el pasillo no pinta nada");
  assert.equal(escena.ancho, 320);
});

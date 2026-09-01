import assert from "node:assert/strict";
import test from "node:test";

import { ESTUDIO } from "../scripts/paleta.mjs";
import {
  ANCHO,
  ENTRADA,
  FOCOS,
  INTERACCIONES,
  PLANTA_ESTUDIO,
  PROFUNDIDAD,
  componerEstudio,
} from "../scripts/estudio-escena.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";

test("se entra dentro de la sala, en suelo libre", () => {
  assert.equal(colisiona(ENTRADA.x, ENTRADA.z, 0.35, PLANTA_ESTUDIO), false);
  assert.ok(ENTRADA.x > 0 && ENTRADA.x < ANCHO);
  assert.ok(ENTRADA.z > 0 && ENTRADA.z < PROFUNDIDAD);
});

test("la salida devuelve a la nave, y es lo único que transporta", () => {
  const salida = INTERACCIONES.find((punto) => punto.id === "salida");
  assert.deepEqual(salida.accion, { tipo: "estancia", estancia: "cantina" });
  assert.equal(INTERACCIONES.length, 1, "un plató de pruebas no necesita más de un punto de interacción");
});

test("el rig declara entre uno y TOPE_FOCOS focos, todos dentro de la sala", () => {
  assert.ok(FOCOS.length >= 1 && FOCOS.length <= 4);
  for (const foco of FOCOS) {
    const [x, y, z] = foco.posicion;
    assert.ok(x >= 0 && x <= ANCHO, `foco "${foco.nombre}" fuera de la sala en x`);
    assert.ok(z >= 0 && z <= PROFUNDIDAD, `foco "${foco.nombre}" fuera de la sala en z`);
    assert.ok(y > 0 && y < 3, `foco "${foco.nombre}" a una altura inverosímil`);
  }
});

test("compone una escena con polígonos y sin colarse ningún color de fuera de ESTUDIO", () => {
  const escena = componerEstudio(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { ancho: 320, alto: 180 });
  assert.ok(escena.poligonos.length > 0, "la sala no pinta nada");
  assert.equal(escena.ancho, 320);
});

test("la piel del muro va texturada de serie: es el único punto de esta sala", () => {
  // Al contrario que las trece salas del Phobos (`pielMuro` por defecto
  // "geometria"), este plató existe para enseñar la opción B de #584 — si
  // aquí también estuviera en geometría, la sala no probaría nada.
  const escena = componerEstudio(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { ancho: 320, alto: 180 });
  assert.ok(escena.poligonos.some((p) => p.textura), "el muro tendría que verse texturado");
});

test("el rig de focos deja cuadros del muro más claros que otros: la subdivisión funciona", () => {
  // La prueba de fuego, igual que en piel-textura.test.mjs pero con el rig
  // REAL de la sala en vez de uno declarado a mano: si el paño fuera un solo
  // cuadrilátero por cara (opción A), los tres focos lo aclararían de golpe y
  // TODOS sus polígonos compartirían intensidad.
  const escena = componerEstudio(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { ancho: 640, alto: 400, fov: 75 });
  const intensidades = escena.poligonos.filter((p) => p.textura).map((p) => p.intensidad);
  assert.ok(intensidades.length > 1, "hacen falta varios cuadros para que la prueba diga algo");
  assert.ok(
    Math.max(...intensidades) - Math.min(...intensidades) > 0.05,
    "el rig de focos no está dejando ningún cuadro más claro que otro",
  );
});

test("los colores de la sala son de la paleta y están todos declarados (#351)", () => {
  assert.ok(Object.keys(ESTUDIO).length >= 6);
  assert.ok(Object.values(ESTUDIO).every((color) => /^#[0-9a-f]{6}$/.test(color)));
});

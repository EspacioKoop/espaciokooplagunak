import assert from "node:assert/strict";
import test from "node:test";

import {
  CARAS_CASCO_SERIE,
  COLOR_REGION,
  colorParaSalud,
  componerCascoPorDano,
  saludPorRegion,
} from "../scripts/casco-dano.mjs";
import { CASCO_POR_DEFECTO, mallaDesdeCasco } from "../scripts/retro3d.mjs";

test("el mapa de serie cubre cada cara una vez", () => {
  const caras = Object.values(CARAS_CASCO_SERIE).flat().sort((a, b) => a - b);
  assert.deepEqual(caras, [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("la peor lectura conocida gobierna cada región sin convertir ausencia en cero", () => {
  const salud = saludPorRegion([
    { id: "reactor", health: 82 },
    { id: "maneuver", health: null },
    { id: "impulse", health: 61 },
    { id: "warp", health: 24 },
    { id: "desconocido", health: 0 },
  ]);

  assert.equal(salud.lomo, 82);
  assert.equal(salud.popa, 24, "se conserva el peor sistema conocido de la región");
  assert.equal(salud.quilla, 82, "la ausencia de maniobra no borra la lectura del reactor");
  assert.equal(salud.costados, null, "sin escudo frontal leído no se inventa daño");
  assert.equal(salud.alaDerecha, null);
});

test("la escala cerrada distingue ausencia, daño y estado estable", () => {
  assert.equal(colorParaSalud(null), COLOR_REGION.sinLectura);
  assert.equal(colorParaSalud(0), COLOR_REGION.critica);
  assert.equal(colorParaSalud(34), COLOR_REGION.critica);
  assert.equal(colorParaSalud(35), COLOR_REGION.danada);
  assert.equal(colorParaSalud(69), COLOR_REGION.danada);
  assert.equal(colorParaSalud(70), COLOR_REGION.estable);
});

test("la escena regional conserva profundidad global y no muta la malla", () => {
  const malla = mallaDesdeCasco(CASCO_POR_DEFECTO);
  const copia = structuredClone(malla);
  const escena = componerCascoPorDano(malla, [
    { id: "reactor", health: 90 },
    { id: "beamweapons", health: 55 },
    { id: "missilesystem", health: 10 },
  ], {
    ancho: 96,
    alto: 72,
    yaw: 0.4,
    pitch: 0.42,
    posicion: [0, 0, 4.4],
    fov: 55,
  });

  assert.ok(escena.poligonos.length > 0);
  assert.ok(escena.poligonos.every(({ region }) => Object.hasOwn(CARAS_CASCO_SERIE, region)));
  for (let i = 1; i < escena.poligonos.length; i += 1) {
    assert.ok(escena.poligonos[i - 1].profundidad >= escena.poligonos[i].profundidad);
  }
  assert.deepEqual(malla, copia);
});

test("la perspectiva de ingeniería deja visibles daños distintos en cubierta y alas", () => {
  const escena = componerCascoPorDano(mallaDesdeCasco(CASCO_POR_DEFECTO), [
    { id: "reactor", health: 90 },
    { id: "beamweapons", health: 55 },
    { id: "missilesystem", health: 10 },
    { id: "impulse", health: 80 },
  ], {
    ancho: 96,
    alto: 72,
    yaw: 0.7,
    pitch: -0.42,
    posicion: [0, 0, 4.4],
    fov: 55,
  });

  const visibles = new Set(escena.poligonos.map(({ region }) => region));
  assert.deepEqual(visibles, new Set(["lomo", "popa", "alaIzquierda", "alaDerecha"]));
  const colores = new Map(escena.poligonos.map(({ region, color }) => [region, color]));
  assert.notEqual(colores.get("lomo"), colores.get("alaIzquierda"), "estable y dañada se distinguen");
  assert.notEqual(colores.get("alaIzquierda"), colores.get("alaDerecha"), "dañada y crítica se distinguen");
});
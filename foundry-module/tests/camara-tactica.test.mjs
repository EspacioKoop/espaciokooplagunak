import assert from "node:assert/strict";
import test from "node:test";

import {
  alternarCuadricula,
  crearCamaraTactica,
  desplazarCamara,
  lineasCuadricula,
  zoomCamara,
} from "../scripts/camara-tactica.mjs";

test("crearCamaraTactica devuelve una cámara ortográfica cenital estable", () => {
  assert.deepEqual(crearCamaraTactica(), {
    modo: "tactica",
    proyeccion: "ortografica",
    centro: { x: 0, y: 0 },
    zoom: 1,
    cuadricula: false,
    tamanoCasilla: 5,
  });
});

test("zoom y desplazamiento están acotados y no mutan la cámara", () => {
  const camera = crearCamaraTactica({ centro: { x: 10, y: -5 }, zoom: 2 });

  assert.deepEqual(zoomCamara(camera, 99), { ...camera, zoom: 4 });
  assert.deepEqual(zoomCamara(camera, -99), { ...camera, zoom: 0.25 });
  assert.deepEqual(desplazarCamara(camera, { x: 3, y: 4 }), {
    ...camera,
    centro: { x: 13, y: -1 },
  });
  assert.deepEqual(camera.centro, { x: 10, y: -5 });
});

test("la cuadrícula es conmutable y produce líneas alineadas al tamaño de casilla", () => {
  const camera = alternarCuadricula(crearCamaraTactica({ zoom: 2 }), true);
  const lines = lineasCuadricula(camera, { ancho: 20, alto: 10 });

  assert.equal(camera.cuadricula, true);
  assert.deepEqual(lines.vertical, [-10, -5, 0, 5, 10]);
  assert.deepEqual(lines.horizontal, [-5, 0, 5]);
  assert.deepEqual(lineasCuadricula({ ...camera, cuadricula: false }, { ancho: 20, alto: 10 }), {
    vertical: [],
    horizontal: [],
  });
});

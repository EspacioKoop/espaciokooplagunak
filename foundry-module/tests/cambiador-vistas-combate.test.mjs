import assert from "node:assert/strict";
import test from "node:test";

import {
  VISTAS_COMBATE,
  resolverVistaCombate,
  atajoVista,
  siguienteVista,
  normalizarVista,
} from "../scripts/cambiador-vistas-combate.mjs";

test("normalizarVista y siguienteVista usan el ciclo táctico completo", () => {
  assert.deepEqual(VISTAS_COMBATE, ["tactica", "pov", "tercera", "libre"]);
  assert.equal(normalizarVista("inexistente"), "tactica");
  assert.equal(siguienteVista("tactica"), "pov");
  assert.equal(siguienteVista("libre"), "tactica");
});

test("atajoVista traduce teclas de combate y deja pasar teclas ajenas", () => {
  assert.equal(atajoVista("1"), "tactica");
  assert.equal(atajoVista("2"), "pov");
  assert.equal(atajoVista("3"), "tercera");
  assert.equal(atajoVista("4"), "libre");
  assert.equal(atajoVista("v"), null);
  assert.equal(atajoVista("V"), null);
  assert.equal(atajoVista("x"), null);
});

test("el ciclo no muta la vista recibida", () => {
  const view = "tercera";
  assert.equal(siguienteVista(view), "libre");
  assert.equal(view, "tercera");
});

test("atajoVista rechaza claves heredadas del prototipo (prototype pollution)", () => {
  assert.equal(atajoVista("constructor"), null);
  assert.equal(atajoVista("__proto__"), null);
  assert.equal(atajoVista("toString"), null);
});

test("las cuatro vistas despachan módulos reales y devuelven la misma forma", () => {
  const entrada = Object.freeze({ x: 5, z: 7, yaw: 0.2, origenCasilla: { x: 4.572, z: 6.096 },
    centro: { x: 12, y: -3 }, posicion: { x: 8, y: 3, z: 2 }, zoom: 2,
    orbita: { yaw: 0.4, pitch: -0.2 }, esGM: true });
  const original = structuredClone(entrada);
  const vistas = VISTAS_COMBATE.map((modo) => resolverVistaCombate(modo, entrada));
  const campos = ["modo", "camara", "yaw", "pitch", "zoom", "proyeccion", "dibujarPropio"].sort();
  for (const vista of vistas) {
    assert.deepEqual(Object.keys(vista).sort(), campos);
    assert.ok(vista.camara.every(Number.isFinite));
    assert.ok(Object.isFrozen(vista) && Object.isFrozen(vista.camara));
    assert.equal(typeof vista.dibujarPropio, "boolean");
  }
  assert.deepEqual(vistas[0].camara, [12, 10, -3]);
  assert.equal(vistas[0].proyeccion, "ortografica");
  assert.equal(vistas[0].zoom, 2);
  assert.deepEqual(vistas[1].camara, [5, 1.45, 7]);
  assert.equal(vistas[1].dibujarPropio, false);
  assert.notDeepEqual(vistas[2].camara, vistas[1].camara);
  assert.deepEqual(vistas[3].camara, [8, 3, 2]);
  assert.equal(vistas[3].pitch, -0.2);
  assert.deepEqual(entrada, original);
});

test("nombres ajenos caen al catálogo táctico sin acceder a prototipos", () => {
  for (const nombre of ["constructor", "__proto__", null, "ausente"]) {
    assert.deepEqual(resolverVistaCombate(nombre), resolverVistaCombate("tactica"));
  }
});

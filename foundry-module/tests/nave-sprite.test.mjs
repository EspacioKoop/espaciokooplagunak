import assert from "node:assert/strict";
import test from "node:test";

import {
  SILUETAS,
  ajustarBrillo,
  clasificarNave,
  construirSpriteNave,
} from "../scripts/nave-sprite.mjs";
import { proyectarContactos } from "../scripts/ventana-nave.mjs";

test("clasificarNave: la nave propia siempre usa la silueta jugador", () => {
  assert.equal(clasificarNave(null, true), "jugador");
  assert.equal(clasificarNave("Cualquier cosa", true), "jugador");
});

test("clasificarNave mapea las clases de EmptyEpsilon por palabra clave", () => {
  assert.equal(clasificarNave("Fighter"), "caza");
  assert.equal(clasificarNave("Goods Freighter 5"), "carguero");
  assert.equal(clasificarNave("Atlantis Cruiser"), "crucero");
  assert.equal(clasificarNave("Sensor Station"), "estacion");
});

test("DTO real del bridge conserva clase hasta el clasificador de sprites", () => {
  const [adder] = proyectarContactos({
    contacts: [{
      callsign: "Adder-1",
      position: { x: 100, y: 200 },
      faction: "Kraylor",
      type: "Adder MK5",
      class: "Starfighter",
      subclass: "Gunship",
      is_player: false,
    }],
    centro: { x: 0, y: 0 },
  });
  assert.equal(adder.tipo, "Adder MK5");
  assert.equal(adder.clase, "Starfighter");
  assert.equal(adder.subclase, "Gunship");
  assert.equal(clasificarNave(adder), "caza");

  assert.equal(clasificarNave({ tipo: "Phobos T3", clase: "Frigate", subclase: "Cruiser" }), "crucero");
  assert.equal(clasificarNave({ tipo: "Goods Freighter 5", clase: "Corvette", subclase: "Freighter" }), "carguero");
  assert.equal(clasificarNave({ tipo: "Large Station" }), "estacion");
});

test("clasificarNave sin tipo utilizable cae en desconocido", () => {
  assert.equal(clasificarNave(null), "desconocido");
  assert.equal(clasificarNave(""), "desconocido");
  assert.equal(clasificarNave("nave misteriosa"), "desconocido");
});

test("ajustarBrillo aclara hacia blanco y oscurece hacia negro, en hex válido", () => {
  const base = "#3aa0ff";
  const claro = ajustarBrillo(base, 0.5);
  const oscuro = ajustarBrillo(base, -0.5);
  assert.match(claro, /^#[0-9a-f]{6}$/i);
  assert.match(oscuro, /^#[0-9a-f]{6}$/i);
  assert.ok(parseInt(claro.slice(1, 3), 16) > parseInt(base.slice(1, 3), 16), "canal R más claro");
  assert.ok(parseInt(oscuro.slice(1, 3), 16) < parseInt(base.slice(1, 3), 16), "canal R más oscuro");
  assert.equal(ajustarBrillo("#ffffff", 0.5), "#ffffff"); // saturado no desborda
  assert.equal(ajustarBrillo("#000000", -0.5), "#000000");
});

test("construirSpriteNave produce celdas centradas y con color válido", () => {
  const celdas = construirSpriteNave({ clave: "caza", color: "#3aa0ff" });
  assert.ok(celdas.length > 0);
  for (const c of celdas) {
    assert.equal(typeof c.dx, "number");
    assert.equal(typeof c.dy, "number");
    assert.match(c.color, /^#[0-9a-f]{6}$/i);
  }
  // Centrado: hay celdas a ambos lados del eje vertical.
  assert.ok(celdas.some((c) => c.dx < 0) && celdas.some((c) => c.dx > 0));
});

test("construirSpriteNave es determinista y varía por silueta", () => {
  const a = construirSpriteNave({ clave: "crucero", color: "#ff0000" });
  const b = construirSpriteNave({ clave: "crucero", color: "#ff0000" });
  assert.deepEqual(a, b);
  const caza = construirSpriteNave({ clave: "caza", color: "#ff0000" });
  assert.notDeepEqual(a, caza);
});

test("una clave desconocida cae en la silueta genérica sin romper", () => {
  const celdas = construirSpriteNave({ clave: "inexistente", color: "#00ff00" });
  assert.deepEqual(celdas, construirSpriteNave({ clave: "desconocido", color: "#00ff00" }));
});

test("el color de facción tiñe el casco pero la cabina queda crema", () => {
  const celdas = construirSpriteNave({ clave: "jugador", color: "#3aa0ff" });
  // La cabina '*' se resuelve a crema fijo, presente en la silueta jugador.
  assert.ok(celdas.some((c) => c.color.toLowerCase() === "#fdfffc"), "hay celdas de cabina crema");
  // Y hay casco base con el color de facción exacto.
  assert.ok(celdas.some((c) => c.color.toLowerCase() === "#3aa0ff"), "hay casco con color de facción");
});

test("todas las siluetas declaradas construyen al menos una celda", () => {
  for (const clave of Object.keys(SILUETAS)) {
    assert.ok(construirSpriteNave({ clave, color: "#888888" }).length > 0, `${clave} tiene celdas`);
  }
});

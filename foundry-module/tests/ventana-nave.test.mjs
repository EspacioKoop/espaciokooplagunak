import assert from "node:assert/strict";
import test from "node:test";

import {
  COLOR_JUGADOR,
  COLOR_NEUTRO,
  colorFaccion,
  crearCampoEstrellas,
  offsetParallax,
  proyectarContactos,
  rngSemilla,
} from "../scripts/ventana-nave.mjs";

test("colorFaccion reserva colores para jugador y sin facción", () => {
  assert.equal(colorFaccion("Kraylor", true), COLOR_JUGADOR);
  assert.equal(colorFaccion(null), COLOR_NEUTRO);
  assert.equal(colorFaccion(""), COLOR_NEUTRO);
});

test("colorFaccion es determinista y estable por facción", () => {
  const a = colorFaccion("Kraylor");
  const b = colorFaccion("Kraylor");
  assert.equal(a, b);
  assert.match(a, /^#[0-9a-f]{6}$/i);
  // Facciones distintas no tienen por qué diferir, pero el reparto es estable.
  assert.equal(colorFaccion("Human Navy"), colorFaccion("Human Navy"));
});

test("rngSemilla: misma semilla, misma secuencia", () => {
  const r1 = rngSemilla(42);
  const r2 = rngSemilla(42);
  for (let i = 0; i < 5; i += 1) assert.equal(r1(), r2());
  // Valores en [0,1).
  const v = rngSemilla(7)();
  assert.ok(v >= 0 && v < 1);
});

test("crearCampoEstrellas: capas ordenadas de lejana a cercana, reproducible", () => {
  const campo = crearCampoEstrellas(123, { capas: 3, porCapa: 10, ancho: 200, alto: 100 });
  assert.equal(campo.length, 3);
  assert.ok(campo[0].factor < campo[2].factor); // más lejana primero
  for (const capa of campo) {
    assert.equal(capa.estrellas.length, 10);
    for (const e of capa.estrellas) {
      assert.ok(e.x >= 0 && e.x < 200);
      assert.ok(e.y >= 0 && e.y < 100);
    }
  }
  // Reproducible con la misma semilla.
  const otra = crearCampoEstrellas(123, { capas: 3, porCapa: 10, ancho: 200, alto: 100 });
  assert.deepEqual(otra, campo);
});

test("offsetParallax envuelve al tamaño del lienzo y las capas cercanas se mueven más", () => {
  const centro = { x: 1000, y: 0 };
  const lejana = offsetParallax(0.33, centro, 0.1, 320, 320);
  const cercana = offsetParallax(1.0, centro, 0.1, 320, 320);
  for (const o of [lejana, cercana]) {
    assert.ok(o.dx >= 0 && o.dx < 320);
    assert.ok(o.dy >= 0 && o.dy < 320);
  }
  // El desplazamiento bruto de la capa cercana es mayor (antes de envolver):
  // lo comprobamos con un centro pequeño que no llega a envolver.
  const cerca2 = { x: 100, y: 0 };
  const l = offsetParallax(0.25, cerca2, 0.1, 1000, 1000).dx; // -2.5 -> 997.5
  const c = offsetParallax(1.0, cerca2, 0.1, 1000, 1000).dx; // -10 -> 990
  assert.ok(c < l); // la cercana se desplaza más (queda más "atrás")
});

test("proyectarContactos centra al jugador y marca dentro/fuera del visor", () => {
  const contacts = [
    { callsign: "Itsaso 1", position: { x: 0, y: 0 }, faction: "Human Navy", is_player: true },
    { callsign: "Lejos", position: { x: 100000, y: 0 }, faction: "Kraylor", is_player: false },
  ];
  const centro = { x: 0, y: 0 };
  const proy = proyectarContactos({ contacts, centro, radioMundo: 30000, ancho: 320, alto: 320 });
  // El jugador queda en el centro del lienzo.
  assert.equal(proy[0].x, 160);
  assert.equal(proy[0].y, 160);
  assert.equal(proy[0].esJugador, true);
  assert.equal(proy[0].dentro, true);
  // Un contacto a 100000 (> radioMundo) queda fuera del visor.
  assert.equal(proy[1].dentro, false);
  assert.equal(proy[1].distancia, 100000);
});

test("proyectarContactos rota el mundo según el rumbo (cabina: morro arriba)", () => {
  const contacts = [{ callsign: "A", position: { x: 0, y: 10000 }, faction: null }];
  const centro = { x: 0, y: 0 };
  const sinRumbo = proyectarContactos({ contacts, centro, headingDeg: 0, radioMundo: 30000, ancho: 320, alto: 320 });
  const conRumbo = proyectarContactos({ contacts, centro, headingDeg: 90, radioMundo: 30000, ancho: 320, alto: 320 });
  // Con rumbo distinto, la posición proyectada cambia (hay rotación real).
  assert.notEqual(Math.round(sinRumbo[0].x), Math.round(conRumbo[0].x));
});

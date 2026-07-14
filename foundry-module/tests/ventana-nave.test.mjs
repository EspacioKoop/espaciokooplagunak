import assert from "node:assert/strict";
import test from "node:test";

import {
  COLOR_JUGADOR,
  COLOR_NEUTRO,
  colorFaccion,
  componerFrame,
  crearCampoEstrellas,
  debeDibujar,
  interpolarAngulo,
  interpolarCentro,
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

test("interpolarCentro tweenea entre muestras y NUNCA extrapola", () => {
  const prev = { tMs: 1000, centro: { x: 0, y: 0 } };
  const actual = { tMs: 2000, centro: { x: 100, y: 200 } };
  // Punto medio a t=0.5.
  assert.deepEqual(interpolarCentro(prev, actual, 1500), { x: 50, y: 100 });
  // Clamp: antes de prev se queda en prev; después de actual se queda en actual.
  assert.deepEqual(interpolarCentro(prev, actual, 500), { x: 0, y: 0 });
  assert.deepEqual(interpolarCentro(prev, actual, 99999), { x: 100, y: 200 });
});

test("interpolarCentro degenerado: sin prev o timestamps iguales devuelve la actual", () => {
  const actual = { tMs: 2000, centro: { x: 7, y: 9 } };
  assert.deepEqual(interpolarCentro(null, actual, 1500), { x: 7, y: 9 });
  const mismoT = { tMs: 2000, centro: { x: 0, y: 0 } };
  assert.deepEqual(interpolarCentro(mismoT, actual, 3000), { x: 7, y: 9 });
  // Sin muestra actual no hay nada que pintar: origen.
  assert.deepEqual(interpolarCentro(null, null, 0), { x: 0, y: 0 });
});

test("interpolarAngulo va por el camino corto y normaliza a [0,360)", () => {
  // 350°→10° cruza por 0°, no da la vuelta por 180°.
  assert.equal(interpolarAngulo(350, 10, 0.5), 0);
  assert.equal(interpolarAngulo(10, 350, 0.5), 0);
  // Camino normal.
  assert.equal(interpolarAngulo(0, 90, 0.5), 45);
  // Clamp de t.
  assert.equal(interpolarAngulo(0, 90, 2), 90);
  assert.equal(interpolarAngulo(0, 90, -1), 0);
  // Siempre en [0, 360).
  const v = interpolarAngulo(350, 10, 0.25);
  assert.ok(v >= 0 && v < 360);
});

test("debeDibujar respeta fpsMax y el primer frame siempre pinta", () => {
  assert.equal(debeDibujar(null, 123, 30), true);
  // A 30 fps el intervalo es ~33.3 ms.
  assert.equal(debeDibujar(1000, 1010, 30), false);
  assert.equal(debeDibujar(1000, 1040, 30), true);
});

test("componerFrame sin muestra devuelve sinDatos y nada que pintar", () => {
  const frame = componerFrame({ tMs: 0 });
  assert.equal(frame.sinDatos, true);
  assert.deepEqual(frame.capas, []);
  assert.deepEqual(frame.blips, []);
});

test("componerFrame compone capas con parallax y blips coloreados", () => {
  const campo = crearCampoEstrellas(7, { capas: 2, porCapa: 3, ancho: 320, alto: 320 });
  const contactos = [
    { callsign: "Itsaso 1", position: { x: 50, y: 100 }, faction: "Human Navy", is_player: true },
    { callsign: "K-7", position: { x: 5000, y: 0 }, faction: "Kraylor", is_player: false },
  ];
  const muestraPrev = { tMs: 1000, centro: { x: 0, y: 0 }, rumboDeg: 0 };
  const muestraActual = { tMs: 2000, centro: { x: 100, y: 200 }, rumboDeg: 90 };
  const frame = componerFrame({ muestraPrev, muestraActual, contactos, campo, tMs: 1500 });

  assert.equal(frame.sinDatos, false);
  // Centro y rumbo interpolados a t=0.5.
  assert.deepEqual(frame.centro, { x: 50, y: 100 });
  assert.equal(frame.rumboDeg, 45);
  // Capas: mismas estrellas, con el offset de offsetParallax para ese centro.
  assert.equal(frame.capas.length, 2);
  assert.deepEqual(
    { dx: frame.capas[0].dx, dy: frame.capas[0].dy },
    offsetParallax(campo[0].factor, { x: 50, y: 100 }, 0.05, 320, 320),
  );
  assert.equal(frame.capas[0].estrellas, campo[0].estrellas);
  // Blips: color por facción, jugador centrado (su posición ES el centro interpolado).
  const jugador = frame.blips.find((b) => b.esJugador);
  assert.equal(jugador.color, COLOR_JUGADOR);
  assert.equal(Math.round(jugador.x), 160);
  assert.equal(Math.round(jugador.y), 160);
  assert.equal(jugador.parpadeo, true); // la nave propia no parpadea (siempre encendida)
  const rival = frame.blips.find((b) => !b.esJugador);
  assert.equal(rival.color, colorFaccion("Kraylor"));
  assert.equal(rival.dentro, true);
});

test("componerFrame es determinista y el parpadeo depende solo de la fase temporal", () => {
  const campo = crearCampoEstrellas(1, { capas: 1, porCapa: 2 });
  const base = {
    muestraActual: { tMs: 0, centro: { x: 0, y: 0 }, rumboDeg: 0 },
    contactos: [{ callsign: "A", position: { x: 100, y: 0 }, faction: null }],
    campo,
  };
  assert.deepEqual(componerFrame({ ...base, tMs: 100 }), componerFrame({ ...base, tMs: 100 }));
  // Fases opuestas de parpadeo (período 300 ms): 100→encendido, 400→apagado.
  const on = componerFrame({ ...base, tMs: 100 }).blips[0].parpadeo;
  const off = componerFrame({ ...base, tMs: 400 }).blips[0].parpadeo;
  assert.equal(on, true);
  assert.equal(off, false);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  construirMuestra,
  debeMuestrear,
  interpolarJugador,
  posicionesVisibles,
  programarMuestra,
} from "../scripts/nave-movimiento-red.mjs";

// ---- debeMuestrear: throttle -----------------------------------------------

test("la primera muestra (sin ultimoSelloEnviado) siempre se publica", () => {
  assert.equal(debeMuestrear({ ahoraMs: 1000, ultimoSelloEnviado: null }), true);
});

test("un cambio de estancia se publica siempre, sin esperar el intervalo", () => {
  assert.equal(
    debeMuestrear({ ahoraMs: 1001, ultimoSelloEnviado: 1000, cambioDeEstancia: true, intervaloMs: 150 }),
    true,
  );
});

test("fuera de esos casos, respeta el intervalo", () => {
  assert.equal(debeMuestrear({ ahoraMs: 1100, ultimoSelloEnviado: 1000, intervaloMs: 150 }), false);
  assert.equal(debeMuestrear({ ahoraMs: 1150, ultimoSelloEnviado: 1000, intervaloMs: 150 }), true);
});

// ---- construirMuestra -------------------------------------------------------

test("construirMuestra recoge el estado confirmado con su sello", () => {
  assert.deepEqual(
    construirMuestra({ x: 1.5, z: -2, y: 0.3, yaw: 0.7, estancia: "cantina" }, 5000),
    { x: 1.5, z: -2, y: 0.3, yaw: 0.7, estancia: "cantina", sello: 5000 },
  );
});

test("construirMuestra es defensiva ante valores no finitos", () => {
  assert.deepEqual(
    construirMuestra({ x: NaN, z: undefined, yaw: "no numero", estancia: 42 }, "no-tiempo"),
    { x: 0, z: 0, y: 0, yaw: 0, estancia: null, sello: 0 },
  );
});

// ---- programarMuestra: la "ventana al futuro" ------------------------------

test("la primera muestra de un jugador se pinta de golpe (aparecer no es moverse)", () => {
  const historial = programarMuestra(null, { x: 1, z: 2, y: 0, yaw: 0, sello: 1000 }, 1000);
  assert.equal(historial.prev, historial.actual);
  assert.equal(historial.actual.sello, 1000);
});

test("una muestra siguiente se programa con una ventana hacia el futuro, no llega ya cumplida", () => {
  const primera = programarMuestra(null, { x: 0, z: 0, y: 0, yaw: 0, sello: 1000 }, 1000);
  // La segunda muestra llega 150ms después en tiempo real (ahoraMs=1150).
  const segunda = programarMuestra(primera, { x: 1, z: 0, y: 0, yaw: 0, sello: 1150 }, 1150);
  assert.equal(segunda.prev, primera.actual);
  assert.equal(segunda.actual.sello, 1150 + 150, "se programa 150ms en el futuro, la ventana observada");
});

test("la ventana se acota a ventanaMaxMs, para no arrastrar un retraso larguísimo", () => {
  const primera = programarMuestra(null, { x: 0, z: 0, y: 0, yaw: 0, sello: 0 }, 0);
  // Llega 5 segundos después (reconexión, lag): la ventana no puede ser 5000ms.
  const segunda = programarMuestra(primera, { x: 1, z: 0, y: 0, yaw: 0, sello: 5000 }, 5000, 1000);
  assert.equal(segunda.actual.sello, 5000 + 1000);
});

test("sin muestra nueva, conserva el historial anterior", () => {
  const historial = programarMuestra(null, { x: 1, z: 1, y: 0, yaw: 0, sello: 100 }, 100);
  assert.equal(programarMuestra(historial, null, 200), historial);
});

// ---- interpolarJugador: nunca extrapola más allá de lo confirmado --------

test("a mitad de camino entre dos muestras, la posición es la mitad", () => {
  const historial = {
    prev: { x: 0, z: 0, y: 0, yaw: 0, sello: 1000, estancia: "a" },
    actual: { x: 10, z: 20, y: 1, yaw: 0, sello: 2000, estancia: "a" },
  };
  assert.deepEqual(interpolarJugador(historial, 1500), { x: 5, z: 10, y: 0.5, yaw: 0, estancia: "a" });
});

test("antes de tiempo (t<0) o después (t>1) se acota, nunca extrapola", () => {
  const historial = {
    prev: { x: 0, z: 0, y: 0, yaw: 0, sello: 1000, estancia: "a" },
    actual: { x: 10, z: 0, y: 0, yaw: 0, sello: 2000, estancia: "a" },
  };
  assert.deepEqual(interpolarJugador(historial, 500), { x: 0, z: 0, y: 0, yaw: 0, estancia: "a" });
  assert.deepEqual(interpolarJugador(historial, 9000), { x: 10, z: 0, y: 0, yaw: 0, estancia: "a" });
});

test("el giro toma el camino más corto (de 350° a 10° pasa por 0°, no da la vuelta larga)", () => {
  const historial = {
    prev: { x: 0, z: 0, y: 0, yaw: (350 * Math.PI) / 180, sello: 0, estancia: "a" },
    actual: { x: 0, z: 0, y: 0, yaw: (10 * Math.PI) / 180, sello: 1000, estancia: "a" },
  };
  const punto = interpolarJugador(historial, 500);
  const grados = ((punto.yaw * 180) / Math.PI + 360) % 360;
  // El camino corto pasa por 0°/360°, así que a mitad de camino debe rondar
  // los 0°, muy lejos de los 180° que daría la vuelta larga.
  assert.ok(grados < 15 || grados > 345, `esperaba cerca de 0°, salió ${grados}°`);
});

test("sin historial (actual ausente) no hay nada que interpolar", () => {
  assert.equal(interpolarJugador(null, 1000), null);
  assert.equal(interpolarJugador({ prev: null, actual: null }, 1000), null);
});

test("con solo actual (sin prev útil) se devuelve tal cual, sin inventar un tramo", () => {
  const soloActual = { actual: { x: 3, z: 4, y: 0, yaw: 1, sello: 1000, estancia: "a" } };
  assert.deepEqual(interpolarJugador(soloActual, 1000), { x: 3, z: 4, y: 0, yaw: 1, estancia: "a" });
});

// ---- posicionesVisibles: sala propia, no uno mismo, muestra fresca --------

function historialDe(x, z, estancia, sello) {
  const muestra = { x, z, y: 0, yaw: 0, estancia, sello };
  return { prev: muestra, actual: muestra };
}

test("solo se ven jugadores en la MISMA estancia que uno mismo", () => {
  const estados = new Map([
    ["otro-misma-sala", historialDe(1, 1, "cantina", 1000)],
    ["otro-otra-sala", historialDe(2, 2, "puente", 1000)],
  ]);
  const visibles = posicionesVisibles(estados, { estanciaPropia: "cantina", miUserId: "yo", ahoraMs: 1000 });
  assert.deepEqual(visibles.map((v) => v.userId), ["otro-misma-sala"]);
});

test("uno mismo nunca aparece en la lista de visibles", () => {
  const estados = new Map([["yo", historialDe(0, 0, "cantina", 1000)]]);
  const visibles = posicionesVisibles(estados, { estanciaPropia: "cantina", miUserId: "yo", ahoraMs: 1000 });
  assert.deepEqual(visibles, []);
});

test("una muestra obsoleta (sin actualizar hace tiempo) deja de mostrarse, no se congela ahí", () => {
  const estados = new Map([["otro", historialDe(1, 1, "cantina", 0)]]);
  const reciente = posicionesVisibles(estados, { estanciaPropia: "cantina", miUserId: "yo", ahoraMs: 500, obsoletoMs: 2000 });
  assert.equal(reciente.length, 1);
  const tarde = posicionesVisibles(estados, { estanciaPropia: "cantina", miUserId: "yo", ahoraMs: 3000, obsoletoMs: 2000 });
  assert.equal(tarde.length, 0, "sin muestra fresca, no se pinta un fantasma");
});

test("sin ningún jugador registrado, la lista de visibles está vacía", () => {
  assert.deepEqual(posicionesVisibles(new Map(), { estanciaPropia: "a", miUserId: "yo", ahoraMs: 0 }), []);
  assert.deepEqual(posicionesVisibles(null, { estanciaPropia: "a", miUserId: "yo", ahoraMs: 0 }), []);
});

test("un jugador sin estancia registrada (dato incompleto) no se muestra en ninguna sala", () => {
  const estados = new Map([["otro", historialDe(1, 1, null, 1000)]]);
  const visibles = posicionesVisibles(estados, { estanciaPropia: "cantina", miUserId: "yo", ahoraMs: 1000 });
  assert.deepEqual(visibles, []);
});

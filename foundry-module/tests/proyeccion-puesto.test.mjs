// Pruebas de la proyección por puesto (#331, paso 2).
//
// La prueba que sostiene todas las demás es la primera: una proyección NO AÑADE
// NADA. Si eso se rompe, cada puesto empieza a ver una nave distinta y ya no hay
// una sola verdad que discutir en la mesa.

import test from "node:test";
import assert from "node:assert/strict";

import { ENFASIS, proyectarParaPuesto } from "../scripts/proyeccion-puesto.mjs";

const BLIPS = Object.freeze([
  { indiceContacto: 0, callsign: "MV Ardora", faction: "Kraylor", clase: "frigate", esJugador: false, x: 10, y: 20, dentro: true },
  { indiceContacto: 1, callsign: "?", faction: null, clase: null, esJugador: false, x: 30, y: 40, dentro: true },
  { indiceContacto: 2, callsign: "Lagunak", faction: "Humanos", clase: "corvette", esJugador: true, x: 160, y: 160, dentro: true },
]);

const FRAME = Object.freeze({
  blips: BLIPS,
  destino: { nombre: "Ancla Norte", x: 100, y: 50, dentro: true },
});

const NAVE = Object.freeze({ velocity: 60, velocity_max: 120 });
const SISTEMAS = Object.freeze([
  { id: "reactor", name: "Reactor", heat: 91 },
  { id: "maneuver", name: "Maniobra", heat: 40 },
  { id: "beamweapons", name: "Cañones", heat: null },
]);

const PUESTOS = ["captain", "navigation", "engineering", "sensors", "communications", "weapons"];

test("una proyección no añade nada: quitando el énfasis vuelve el frame", () => {
  // LA prueba. Sin esto, «resaltar» acaba siendo «inventar» sin que nadie lo
  // note, y cada puesto vería una nave distinta.
  for (const puesto of PUESTOS) {
    const vista = proyectarParaPuesto(FRAME, puesto, { nave: NAVE, sistemas: SISTEMAS });
    const desnudos = vista.blips.map(({ enfasis, etiqueta, ...resto }) => resto);
    assert.deepEqual(desnudos, BLIPS, `${puesto} tocó los datos del frame`);
    assert.equal(vista.blips.length, BLIPS.length, `${puesto} cambió el número de contactos`);
    for (const blip of vista.blips) assert.ok(ENFASIS.includes(blip.enfasis));
  }
});

test("dos puestos leen distinto el MISMO frame", () => {
  // El criterio literal de #331: al menos dos proyecciones diferenciadas.
  const sensores = proyectarParaPuesto(FRAME, "sensors", {});
  const comunicaciones = proyectarParaPuesto(FRAME, "communications", {});
  const navegacion = proyectarParaPuesto(FRAME, "navigation", { nave: NAVE });

  // Sensores vive de lo que NO sabe identificar: el contacto sin clase sube.
  assert.equal(sensores.blips[1].enfasis, "alto");
  assert.equal(sensores.blips[0].enfasis, "normal");
  // Comunicaciones mira quién es: sube lo que tiene facción, baja lo anónimo.
  assert.equal(comunicaciones.blips[0].enfasis, "alto");
  assert.equal(comunicaciones.blips[1].enfasis, "tenue");
  // Y navegación aparta los contactos porque tiene el vector encima.
  assert.equal(navegacion.blips[0].enfasis, "tenue");

  assert.notDeepEqual(sensores.blips, comunicaciones.blips);
  assert.notDeepEqual(sensores.blips, navegacion.blips);
});

test("la nave propia nunca se atenúa, mire quien mire", () => {
  for (const puesto of PUESTOS) {
    const vista = proyectarParaPuesto(FRAME, puesto, { nave: NAVE, sistemas: SISTEMAS });
    assert.equal(vista.blips[2].enfasis, "alto", puesto);
    assert.equal(vista.blips[2].etiqueta, null, "y no se etiqueta a sí misma");
  }
});

test("las etiquetas solo salen de datos publicados", () => {
  // Un «?» pintado sobre el mapa se lee como «hay algo sin identificar», cuando
  // en realidad significa que el puente no publicó el campo.
  const vista = proyectarParaPuesto(FRAME, "communications", {});
  assert.equal(vista.blips[0].etiqueta, "MV Ardora · Kraylor");
  assert.equal(vista.blips[1].etiqueta, null);
  // Y ningún otro puesto etiqueta.
  for (const puesto of PUESTOS.filter((p) => p !== "communications")) {
    const otra = proyectarParaPuesto(FRAME, puesto, {});
    assert.deepEqual(otra.blips.map((b) => b.etiqueta), [null, null, null], puesto);
  }
});

test("con indicativo pero sin facción se etiqueta solo el indicativo", () => {
  const frame = { blips: [{ callsign: "Errante", faction: null, esJugador: false }] };
  assert.equal(proyectarParaPuesto(frame, "communications", {}).blips[0].etiqueta, "Errante");
});

test("el vector de navegación no miente sobre la velocidad", () => {
  const conMaxima = proyectarParaPuesto(FRAME, "navigation", { nave: NAVE });
  assert.deepEqual(conMaxima.vector, { magnitud01: 0.5, velocidad: 60 });

  // Sin máxima publicada no se normaliza contra un número inventado.
  const sinMaxima = proyectarParaPuesto(FRAME, "navigation", { nave: { velocity: 60 } });
  assert.equal(sinMaxima.vector.magnitud01, null);
  assert.equal(sinMaxima.vector.velocidad, 60);

  // Y sin lectura no hay vector: un vector de largo cero se leería como
  // «parada», y no saber a qué velocidad va no es ir a cero.
  assert.equal(proyectarParaPuesto(FRAME, "navigation", { nave: {} }).vector, null);
  assert.equal(proyectarParaPuesto(FRAME, "navigation", {}).vector, null);
});

test("solo navegación trae vector, solo sensores anillos, solo ingeniería calor", () => {
  const contexto = { nave: NAVE, sistemas: SISTEMAS };
  for (const puesto of PUESTOS) {
    const vista = proyectarParaPuesto(FRAME, puesto, contexto);
    assert.equal(Boolean(vista.vector), puesto === "navigation", `vector en ${puesto}`);
    assert.equal(vista.anillos.length > 0, puesto === "sensors", `anillos en ${puesto}`);
    assert.equal(Boolean(vista.superposicion), puesto === "engineering", `calor en ${puesto}`);
  }
});

test("el calor se ordena y lo que no tiene lectura no se pinta como frío", () => {
  // Cero y «no se sabe» son cosas distintas (#353). Un sistema sin lectura al
  // final de la lista se leería como el más frío de la nave.
  const { superposicion } = proyectarParaPuesto(FRAME, "engineering", { sistemas: SISTEMAS });
  assert.deepEqual(superposicion.filas.map((f) => f.id), ["reactor", "maneuver"]);
  assert.deepEqual(superposicion.sinLectura, ["beamweapons"]);
  assert.equal(superposicion.filas[0].critico, true);
  assert.equal(superposicion.filas[1].critico, false);
  assert.equal(superposicion.filas[0].valor01, 0.91);
});

test("el destino nunca se apaga: es una orden ya tomada", () => {
  for (const puesto of PUESTOS) {
    const vista = proyectarParaPuesto(FRAME, puesto, {});
    assert.equal(vista.destino.nombre, "Ancla Norte");
    assert.equal(vista.destino.enfasis, puesto === "navigation" ? "alto" : "normal");
  }
  assert.equal(proyectarParaPuesto({ blips: [] }, "navigation", {}).destino, null);
});

test("un frame sin contactos no los inventa en ninguna vista", () => {
  // Es el caso de la tripulación: el GM no difunde contactos, así que el frame
  // llega vacío y las vistas se quedan vacías por sí solas. La proyección no es
  // un control de acceso y no tiene que fingir que lo es.
  for (const puesto of PUESTOS) {
    const vista = proyectarParaPuesto({ blips: [], destino: null }, puesto, { nave: NAVE });
    assert.deepEqual(vista.blips, [], puesto);
    assert.equal(vista.destino, null);
    assert.deepEqual(vista.anillos, []);
  }
});

test("entradas rotas no revientan y un puesto desconocido cae en capitán", () => {
  assert.deepEqual(proyectarParaPuesto(null, "sensors", {}).blips, []);
  assert.deepEqual(proyectarParaPuesto(undefined, null, {}).blips, []);
  assert.equal(proyectarParaPuesto(FRAME, "cocina", {}).puesto, "captain");
  assert.deepEqual(
    proyectarParaPuesto(FRAME, "cocina", {}).blips.map((b) => b.enfasis),
    proyectarParaPuesto(FRAME, "captain", {}).blips.map((b) => b.enfasis),
  );
  assert.equal(proyectarParaPuesto(FRAME, "engineering", { sistemas: null }).superposicion, null);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  COLOR_JUGADOR,
  COLOR_NEUTRO,
  claveContacto,
  colorFaccion,
  componerFrame,
  contactoEnPunto,
  crearCampoEstrellas,
  debeDibujar,
  firmaEstructuralContactos,
  interpolarAngulo,
  interpolarCentro,
  interpolarContactos,
  leyendaContactos,
  normalizarContactosMapa,
  normalizarPosicionMapa,
  offsetParallax,
  prepararDetalleContacto,
  proyectarContactos,
  proyectarDestino,
  reconciliarIndiceContacto,
  rumboHacia,
  rngSemilla,
  rotarMuestras,
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

test("interpolarContactos mueve identidades únicas y conserva la muestra actual", () => {
  const prev = [
    { callsign: "Itsaso 1", is_player: true, position: { x: 0, y: 0 } },
    { callsign: "K-7", faction: "Kraylor", type: "CpuShip", position: { x: 100, y: 200 } },
  ];
  const actual = [
    { callsign: "Itsaso 1", is_player: true, position: { x: 20, y: 40 } },
    { callsign: "K-7", faction: "Kraylor", type: "CpuShip", position: { x: 300, y: 600 } },
  ];
  const mitad = interpolarContactos(prev, actual, 0.5);
  assert.deepEqual(mitad.map((c) => c.position), [
    { x: 10, y: 20 },
    { x: 200, y: 400 },
  ]);
  assert.equal(mitad[1].faction, "Kraylor");
  assert.equal(claveContacto(actual[0]), "player");
});

test("interpolarContactos no mezcla anónimos/duplicados y elimina desaparecidos", () => {
  const prev = [
    { callsign: "?", position: { x: 10, y: 10 } },
    { callsign: "DUP", faction: null, position: { x: 20, y: 20 } },
    { callsign: "DUP", faction: null, position: { x: 30, y: 30 } },
    { callsign: "YA-NO", position: { x: 40, y: 40 } },
  ];
  const actual = [
    { callsign: "?", position: { x: 100, y: 100 } },
    { callsign: "DUP", faction: null, position: { x: 200, y: 200 } },
    { callsign: "DUP", faction: null, position: { x: 300, y: 300 } },
    { callsign: "NUEVO", position: { x: Number.NaN, y: 50 } },
  ];
  const salida = interpolarContactos(prev, actual, 0.5);
  assert.deepEqual(salida.map((c) => c.position), [
    { x: 100, y: 100 },
    { x: 200, y: 200 },
    { x: 300, y: 300 },
  ]);
  assert.equal(salida.some((c) => c.callsign === "YA-NO"), false);
  assert.equal(salida.some((c) => c.callsign === "NUEVO"), false);
  assert.equal(claveContacto(actual[0]), null);
});

test("la frontera numérica descarta coordenadas inválidas sin inventar (0,0)", () => {
  assert.deepEqual(normalizarPosicionMapa({ x: 1, y: -2 }), { x: 1, y: -2 });
  assert.equal(normalizarPosicionMapa({ x: Number.NaN, y: 2 }), null);
  assert.equal(normalizarPosicionMapa({ x: 1, y: Infinity }), null);
  const contactos = normalizarContactosMapa([
    { callsign: "VALIDO", position: { x: 1, y: 2 } },
    { callsign: "NAN", position: { x: Number.NaN, y: 2 } },
    { callsign: "TEXTO", position: { x: "1", y: 2 } },
  ]);
  assert.deepEqual(contactos.map((c) => c.callsign), ["VALIDO"]);
  const proyectados = proyectarContactos({ contacts: contactos, centro: { x: 0, y: 0 } });
  assert.equal(proyectados.length, 1);
  assert.ok(proyectados.every((c) => [c.x, c.y, c.distancia].every(Number.isFinite)));
  const detalle = prepararDetalleContacto(
    { callsign: "NAN", position: { x: Number.NaN, y: 2 } },
    { x: 0, y: 0 },
  );
  assert.equal(detalle.distancia, null);
  assert.equal(detalle.rumboDeg, null);
});

test("firmaEstructuralContactos ignora movimiento y detecta cambios visibles", () => {
  const base = [{ callsign: "K-7", faction: "Kraylor", type: "CpuShip", position: { x: 0, y: 0 } }];
  const movido = [{ ...base[0], position: { x: 999, y: -400 } }];
  const cambiado = [{ ...base[0], type: "Station", position: { x: 999, y: -400 } }];
  assert.equal(firmaEstructuralContactos(base), firmaEstructuralContactos(movido));
  assert.notEqual(firmaEstructuralContactos(base), firmaEstructuralContactos(cambiado));
});

test("rotarMuestras y componerFrame producen blips intermedios de contactos", () => {
  const c1 = [{ callsign: "K-7", faction: "Kraylor", position: { x: 0, y: 0 } }];
  const c2 = [{ callsign: "K-7", faction: "Kraylor", position: { x: 100, y: 0 } }];
  const r1 = rotarMuestras(null, { centro: { x: 0, y: 0 }, rumboDeg: 0, contactos: c1 }, 1000);
  const r2 = rotarMuestras(r1.actual, { centro: { x: 0, y: 0 }, rumboDeg: 0, contactos: c2 }, 3000);
  const frame = componerFrame({
    muestraPrev: r2.prev,
    muestraActual: r2.actual,
    contactos: c2,
    campo: [],
    tMs: 4000,
  });
  assert.equal(frame.blips.length, 1);
  assert.equal(frame.blips[0].distancia, 50);
});

test("debeDibujar respeta fpsMax y el primer frame siempre pinta", () => {
  assert.equal(debeDibujar(null, 123, 30), true);
  // A 30 fps el intervalo es ~33.3 ms.
  assert.equal(debeDibujar(1000, 1010, 30), false);
  assert.equal(debeDibujar(1000, 1040, 30), true);
});

test("debeDibujar conserva 60 FPS con timestamps fraccionales de rAF", () => {
  let ultimo = null;
  let dibujos = 0;
  for (let tick = 0; tick < 600; tick += 1) {
    const ahora = tick * (1000 / 60);
    if (!debeDibujar(ultimo, ahora, 60)) continue;
    ultimo = ahora;
    dibujos += 1;
  }
  assert.equal(dibujos, 600);
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

test("ciclo sondeo→frames: la ventana de reproducción produce frames intermedios reales", () => {
  // El caso que la revisión reprodujo: el dibujo ocurre SIEMPRE en tiempos
  // posteriores a la recepción de la muestra. Con rotarMuestras el tween se
  // ancla hacia delante, así que los frames intermedios existen de verdad.

  // Primera muestra recibida en t=1000: se pinta directa, sin tween.
  const r1 = rotarMuestras(null, { centro: { x: 0, y: 0 }, rumboDeg: 0 }, 1000);
  assert.equal(r1.prev, null);
  const inicial = componerFrame({ muestraPrev: r1.prev, muestraActual: r1.actual, campo: [], tMs: 1000 });
  assert.deepEqual(inicial.centro, { x: 0, y: 0 });

  // Segunda muestra recibida en t=3000 (2 s después): ventana de 2 s por delante.
  const r2 = rotarMuestras(r1.actual, { centro: { x: 100, y: 200 }, rumboDeg: 90 }, 3000);
  const frame = (tMs) => componerFrame({ muestraPrev: r2.prev, muestraActual: r2.actual, campo: [], tMs });

  // En el instante de recepción arranca en lo confirmado ANTERIOR…
  assert.deepEqual(frame(3000).centro, { x: 0, y: 0 });
  // …a mitad de ventana hay un frame intermedio real (el bug lo hacía imposible)…
  assert.deepEqual(frame(4000).centro, { x: 50, y: 100 });
  assert.equal(frame(4000).rumboDeg, 45);
  // …al agotar la ventana llega a lo recién confirmado…
  assert.deepEqual(frame(5000).centro, { x: 100, y: 200 });
  assert.equal(frame(5000).rumboDeg, 90);
  // …y después queda clavado ahí: nunca extrapola.
  assert.deepEqual(frame(99999).centro, { x: 100, y: 200 });
});

test("rotarMuestras acota la ventana de reproducción (huecos de backoff)", () => {
  const r1 = rotarMuestras(null, { centro: { x: 0, y: 0 }, rumboDeg: 0 }, 1000);
  // La siguiente muestra llega 60 s después (backoff): el tween NO dura un
  // minuto — la ventana se acota al máximo (4 s por defecto).
  const r2 = rotarMuestras(r1.actual, { centro: { x: 100, y: 0 }, rumboDeg: 0 }, 61000);
  assert.equal(r2.actual.tMs - r2.prev.tMs, 4000);
  // Y la cadena continúa: una tercera muestra usa la recepción real de la
  // segunda (recibidaMs), no su timestamp de reproducción.
  const r3 = rotarMuestras(r2.actual, { centro: { x: 200, y: 0 }, rumboDeg: 0 }, 63000);
  assert.equal(r3.actual.tMs - r3.prev.tMs, 2000);
});

/* --- Onboarding del mapa (issue #126): rumbo, detalle y leyenda --- */

test("rumboHacia usa la convención de EmptyEpsilon (0° = norte, horario)", () => {
  const centro = { x: 0, y: 0 };
  // En EE la Y crece hacia el sur: un objeto en -y queda al norte (0°).
  assert.equal(rumboHacia(centro, { x: 0, y: -100 }), 0);
  assert.equal(rumboHacia(centro, { x: 100, y: 0 }), 90);
  assert.equal(rumboHacia(centro, { x: 0, y: 100 }), 180);
  assert.equal(rumboHacia(centro, { x: -100, y: 0 }), 270);
});

test("prepararDetalleContacto calcula distancia y rumbo y conserva tipo/facción", () => {
  const d = prepararDetalleContacto(
    { callsign: "K-7", type: "SpaceStation", faction: "Kraylor", position: { x: 300, y: 400 } },
    { x: 0, y: 0 },
  );
  assert.equal(d.callsign, "K-7");
  assert.equal(d.tipo, "SpaceStation");
  assert.equal(d.faccion, "Kraylor");
  assert.equal(d.distancia, 500);
  assert.equal(d.color, colorFaccion("Kraylor"));
  assert.ok(d.rumboDeg > 90 && d.rumboDeg < 180); // sureste en convención EE
});

test("prepararDetalleContacto tolera DTOs sin tipo ni facción", () => {
  const d = prepararDetalleContacto({ callsign: "?", position: { x: 0, y: 10 } }, { x: 0, y: 0 });
  assert.equal(d.tipo, null);
  assert.equal(d.faccion, null);
  assert.equal(d.color, COLOR_NEUTRO);
});

test("contactoEnPunto selecciona el blip más cercano dentro de tolerancia", () => {
  const blips = [
    { indiceContacto: 0, callsign: "K-1", x: 100, y: 100, dentro: true },
    { indiceContacto: 1, callsign: "K-2", x: 200, y: 200, dentro: true },
  ];
  assert.equal(contactoEnPunto(blips, 102, 98), 0);
  assert.equal(contactoEnPunto(blips, 197, 203), 1);
});

test("contactoEnPunto devuelve null fuera de tolerancia o sin blips", () => {
  const blips = [{ indiceContacto: 0, callsign: "K-1", x: 100, y: 100, dentro: true }];
  assert.equal(contactoEnPunto(blips, 150, 150), null);
  assert.equal(contactoEnPunto([], 100, 100), null);
});

test("contactoEnPunto ignora contactos fuera de alcance (recortados al anillo)", () => {
  // Un blip `dentro: false` se pinta recortado al anillo, no en x/y real:
  // pinchar en esas coordenadas no debe seleccionarlo.
  const blips = [{ indiceContacto: 0, callsign: "Lejano", x: 100, y: 100, dentro: false }];
  assert.equal(contactoEnPunto(blips, 100, 100), null);
});

test("contactoEnPunto desempata por distancia cuando dos blips caen en tolerancia", () => {
  const blips = [
    { indiceContacto: 0, callsign: "Lejos", x: 100, y: 100, dentro: true },
    { indiceContacto: 1, callsign: "Cerca", x: 103, y: 100, dentro: true },
  ];
  assert.equal(contactoEnPunto(blips, 104, 100), 1);
});

test("contactoEnPunto distingue homónimos y anónimos por índice de frame", () => {
  const blips = [
    { indiceContacto: 0, callsign: "Itsaso 1", x: 50, y: 50, dentro: true },
    { indiceContacto: 1, callsign: "Itsaso 1", x: 150, y: 150, dentro: true },
    { indiceContacto: 2, callsign: "?", x: 250, y: 250, dentro: true },
  ];
  assert.equal(contactoEnPunto(blips, 50, 50), 0);
  assert.equal(contactoEnPunto(blips, 150, 150), 1);
  assert.equal(contactoEnPunto(blips, 250, 250), 2);
});

test("reconciliarIndiceContacto sigue al homónimo más cercano aunque cambie el orden", () => {
  const anteriores = [
    { callsign: "DUP", type: "CpuShip", faction: "Human Navy", position: { x: 10, y: 10 } },
    { callsign: "DUP", type: "CpuShip", faction: "Human Navy", position: { x: 100, y: 100 } },
  ];
  const actuales = [
    { callsign: "DUP", type: "CpuShip", faction: "Human Navy", position: { x: 102, y: 101 } },
    { callsign: "DUP", type: "CpuShip", faction: "Human Navy", position: { x: 12, y: 9 } },
  ];
  assert.equal(reconciliarIndiceContacto(anteriores, actuales, 0), 1);
  assert.equal(reconciliarIndiceContacto(anteriores, actuales, 1), 0);
});

test("reconciliarIndiceContacto deselecciona ante desaparición o empate ambiguo", () => {
  const anteriores = [{ callsign: "?", position: { x: 0, y: 0 } }];
  const empate = [
    { callsign: "?", position: { x: -1, y: 0 } },
    { callsign: "?", position: { x: 1, y: 0 } },
  ];
  assert.equal(reconciliarIndiceContacto(anteriores, [], 0), null);
  assert.equal(reconciliarIndiceContacto(anteriores, empate, 0), null);
  const duplicados = [
    { callsign: "DUP", position: { x: 0, y: 0 } },
    { callsign: "DUP", position: { x: 100, y: 100 } },
  ];
  assert.equal(
    reconciliarIndiceContacto(duplicados, [duplicados[1]], 0),
    null,
    "si desaparece un homónimo no salta silenciosamente al superviviente",
  );
});

test("leyendaContactos: nave propia primero, una entrada por facción y neutros al final", () => {
  const leyenda = leyendaContactos([
    { callsign: "Itsaso 1", faction: "Human Navy", is_player: true },
    { callsign: "K-1", faction: "Kraylor" },
    { callsign: "K-2", faction: "Kraylor" },
    { callsign: "roca", faction: null },
  ]);
  assert.equal(leyenda.length, 3);
  assert.equal(leyenda[0].esJugador, true);
  assert.equal(leyenda[0].color, COLOR_JUGADOR);
  assert.equal(leyenda[1].faccion, "Kraylor");
  assert.equal(leyenda[2].color, COLOR_NEUTRO);
});

test("leyendaContactos sin contactos deja solo la nave propia", () => {
  const leyenda = leyendaContactos([]);
  assert.equal(leyenda.length, 1);
  assert.equal(leyenda[0].esJugador, true);
});

/* --- Destino en el mapa vivo (issue #175) --- */

test("proyectarDestino dentro del visor: punto proyectado con su nombre", () => {
  const d = proyectarDestino({
    destino: { name: "Argia", position: { x: 0, y: -15000 } },
    centro: { x: 0, y: 0 },
    headingDeg: 0,
    radioMundo: 30000,
  });
  assert.equal(d.nombre, "Argia");
  assert.equal(d.dentro, true);
  assert.equal(d.distancia, 15000);
  // A mitad del radio del mundo, morro al norte: mitad del radio del visor.
  assert.equal(Math.round(d.x), 160);
  assert.equal(Math.round(d.y), 80);
});

test("proyectarDestino fuera de alcance: recortado al anillo, dirección intacta", () => {
  const d = proyectarDestino({
    destino: { name: "Argia", position: { x: 90000, y: 0 } },
    centro: { x: 0, y: 0 },
    headingDeg: 0,
    radioMundo: 30000,
  });
  assert.equal(d.dentro, false);
  assert.equal(d.distancia, 90000);
  // Al este a rumbo 0: recortado al borde derecho del anillo.
  assert.equal(Math.round(d.x), 320);
  assert.equal(Math.round(d.y), 160);
});

test("proyectarDestino gira con el rumbo (proyección de cabina)", () => {
  // Destino al este, nave con morro al este: el destino queda arriba.
  const d = proyectarDestino({
    destino: { name: "Argia", position: { x: 15000, y: 0 } },
    centro: { x: 0, y: 0 },
    headingDeg: 90,
    radioMundo: 30000,
  });
  assert.equal(Math.round(d.x), 160);
  assert.equal(Math.round(d.y), 80);
});

test("proyectarDestino no inventa: null sin destino, sin nombre o sin posición", () => {
  const base = { centro: { x: 0, y: 0 }, headingDeg: 0 };
  assert.equal(proyectarDestino({ destino: null, ...base }), null);
  assert.equal(proyectarDestino({ destino: { name: "", position: { x: 1, y: 1 } }, ...base }), null);
  assert.equal(proyectarDestino({ destino: { name: "Argia" }, ...base }), null);
  assert.equal(proyectarDestino({ destino: { name: "Argia", position: { x: NaN, y: 0 } }, ...base }), null);
});

test("componerFrame publica frame.destino y lo deja null sin datos o sin destino", () => {
  const muestra = { tMs: 0, centro: { x: 0, y: 0 }, rumboDeg: 0 };
  const conDestino = componerFrame({
    muestraActual: muestra,
    destino: { name: "Argia", position: { x: 0, y: -15000 } },
    tMs: 0,
  });
  assert.equal(conDestino.destino.nombre, "Argia");
  assert.equal(conDestino.destino.dentro, true);

  const sinDestino = componerFrame({ muestraActual: muestra, tMs: 0 });
  assert.equal(sinDestino.destino, null);

  const sinDatos = componerFrame({ destino: { name: "Argia", position: { x: 0, y: 0 } } });
  assert.equal(sinDatos.sinDatos, true);
  assert.equal(sinDatos.destino, null);
});

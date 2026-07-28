import assert from "node:assert/strict";
import test from "node:test";

import {
  NIVELES_CONTACTO,
  RADIOS,
  calidadValida,
  marcacion,
  nivelPorDistancia,
  proyectarContacto,
  proyectarContactos,
} from "../scripts/contactos-proyeccion.mjs";

const ORIGEN = { x: 0, y: 0 };
const enX = (distancia, extra = {}) => ({
  callsign: "Kestrel",
  faction: "Hostil",
  position: { x: distancia, y: 0 },
  ...extra,
});

test("el callsign SOLO con identificación positiva: nunca se aproxima un nombre", () => {
  // Un nombre equivocado es peor que ningún nombre: la tripulación actuaría
  // sobre una identificación falsa creyéndola buena.
  const cerca = proyectarContacto(enX(1000), ORIGEN);
  assert.equal(cerca.nivel, "identificado");
  assert.equal(cerca.callsign, "Kestrel");

  for (const distancia of [10000, 25000]) {
    const lejos = proyectarContacto(enX(distancia), ORIGEN);
    assert.equal(lejos.callsign, null, `a ${distancia} no debería haber nombre`);
    assert.ok(NIVELES_CONTACTO.includes(lejos.nivel));
  }
});

test("la posición exacta no viaja salvo identificado: es el mapa del GM", () => {
  // Con las coordenadas de todo, un cliente reconstruye el mapa completo y la
  // degradación no habría servido de nada.
  assert.deepEqual(proyectarContacto(enX(1000), ORIGEN).position, { x: 1000, y: 0 });
  assert.equal(proyectarContacto(enX(10000), ORIGEN).position, null);
  assert.equal(proyectarContacto(enX(25000), ORIGEN).position, null);
});

test("la facción se conoce antes que el nombre, pero no en una traza", () => {
  // Un perfil de emisiones dice «de los suyos» mucho antes que «el Kestrel».
  assert.equal(proyectarContacto(enX(1000), ORIGEN).faccion, "Hostil");
  assert.equal(proyectarContacto(enX(10000), ORIGEN).faccion, "Hostil");
  assert.equal(proyectarContacto(enX(25000), ORIGEN).faccion, null, "una traza no tiene bando");
});

test("fuera de alcance NO aparece, que no es lo mismo que aparecer vacío", () => {
  // Un contacto que no se detecta no existe para la consola. Listarlo sin datos
  // diría «hay algo ahí» — que es justo la información que no se tiene.
  assert.equal(proyectarContacto(enX(45000), ORIGEN), null);
  assert.equal(nivelPorDistancia(45000), null);
  assert.equal(nivelPorDistancia(RADIOS.traza + 1), null);
  assert.equal(nivelPorDistancia(RADIOS.traza), "traza", "el borde entra");
});

test("la incertidumbre quita precisión, no falsea el dato", () => {
  // Marcación redondeada y distancia en banda. El valor sigue siendo cierto,
  // solo que menos fino.
  const traza = proyectarContacto({ ...enX(0), position: { x: 20000, y: 3000 } }, ORIGEN);
  assert.equal(traza.nivel, "traza");
  assert.equal(traza.marcacion % 15, 0, "la marcación de una traza va de 15 en 15");
  assert.equal(traza.distancia % 5000, 0, "y la distancia en bandas de 5000");

  const cerca = proyectarContacto({ ...enX(0), position: { x: 3000, y: 1000 } }, ORIGEN);
  assert.equal(cerca.distancia % 100, 0, "cerca se afina, pero sigue redondeando");
});

test("SIN AZAR: el mismo estado da la misma lectura siempre", () => {
  // Si parpadeara entre niveles de un sondeo a otro, la lista se leería como
  // ruido de la interfaz y no como una lectura de la nave.
  const contacto = enX(9000);
  const primera = proyectarContacto(contacto, ORIGEN);
  for (let i = 0; i < 20; i += 1) {
    assert.deepEqual(proyectarContacto(contacto, ORIGEN), primera);
  }
});

test("la calidad de sensores escala el alcance, y a cero la nave está ciega", () => {
  // Hoy no hay de dónde sacarla —EmptyEpsilon no tiene sistema de sensores— así
  // que entra como parámetro con valor pleno por defecto. El día que lo haya, se
  // conecta aquí y no hay que tocar nada más.
  assert.equal(nivelPorDistancia(4000, 1), "identificado");
  assert.equal(nivelPorDistancia(4000, 0.5), "detectado", "a media calidad, ya no se identifica");
  assert.equal(nivelPorDistancia(4000, 0), null, "a cero no hay ni trazas");
  // A calidad 0.1 los radios quedan en 500 / 1500 / 3000: 2000 es traza.
  assert.equal(nivelPorDistancia(2000, 0.1), "traza");
  assert.equal(nivelPorDistancia(1000, 0.1), "detectado");

  // Basura acotada, no propagada.
  for (const rara of [null, undefined, "mucha", NaN, {}]) assert.equal(calidadValida(rara), 1);
  assert.equal(calidadValida(-3), 0);
  assert.equal(calidadValida(9), 1);
});

test("la marcación es 0 al norte y crece a la derecha", () => {
  assert.equal(Math.round(marcacion(ORIGEN, { x: 0, y: -100 })), 0, "norte");
  assert.equal(Math.round(marcacion(ORIGEN, { x: 100, y: 0 })), 90, "este");
  assert.equal(Math.round(marcacion(ORIGEN, { x: 0, y: 100 })), 180, "sur");
  assert.equal(Math.round(marcacion(ORIGEN, { x: -100, y: 0 })), 270, "oeste");
});

test("la marcación redondeada nunca sale 360", () => {
  // 358 redondeado de 15 en 15 daría 360, que como marcación no existe: es 0.
  const casi = proyectarContacto({ ...enX(0), position: { x: -300, y: -20000 } }, ORIGEN);
  assert.ok(casi.marcacion < 360, `marcación ${casi.marcacion}`);
});

test("la nave propia no se lista como contacto de sí misma", () => {
  assert.equal(proyectarContacto(enX(0, { is_player: true }), ORIGEN), null);
});

test("la lista va de más cerca a más lejos y está acotada", () => {
  // Va por socket en cada sondeo: una nube de asteroides no debe convertir la
  // telemetría en un chorro. Y quien vigila mira primero lo que tiene encima.
  const contacts = [enX(20000), enX(1000), enX(9000), enX(50000)];
  const lista = proyectarContactos({ contacts, origen: ORIGEN });
  assert.deepEqual(lista.map((c) => c.nivel), ["identificado", "detectado", "traza"]);
  assert.ok(lista[0].distancia < lista[1].distancia);

  const muchos = Array.from({ length: 40 }, (_, i) => enX(1000 + i * 100));
  assert.equal(proyectarContactos({ contacts: muchos, origen: ORIGEN }).length, 12);
  assert.equal(proyectarContactos({ contacts: muchos, origen: ORIGEN, maximo: 3 }).length, 3);
});

test("entradas rotas se descartan en vez de colarse a medias", () => {
  const rotos = [null, undefined, {}, { position: null }, { position: { x: "lejos", y: 0 } }];
  assert.deepEqual(proyectarContactos({ contacts: rotos, origen: ORIGEN }), []);
  assert.deepEqual(proyectarContactos({ contacts: [enX(1000)], origen: null }), []);
  assert.deepEqual(proyectarContactos({}), []);
  assert.deepEqual(proyectarContactos({ contacts: "no-es-lista", origen: ORIGEN }), []);
});

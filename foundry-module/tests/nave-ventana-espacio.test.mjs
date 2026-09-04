import assert from "node:assert/strict";
import test from "node:test";

import { RUMBO_DEL_MURO, ladoDeVentana, persianaCerrada, piezasDeVentana } from "../scripts/nave-ventana-espacio.mjs";
import { SECCION } from "../scripts/paleta.mjs";

const SALA = { ancho: 10, profundidad: 11.85 };
const VENTANA_ESTE = { x: 9.6, z: 2.2, ancho: 0.4, profundidad: 3.6 };
const VENTANA_NORTE = { x: 3, z: 0, ancho: 3.6, profundidad: 0.4 };

const identificado = { rumboDeg: 90, distancia: 5000, callsign: "EKL-2", faccion: "Human Navy" };
const eco = { rumboDeg: 270, distancia: 5000 };
const sensores = { alcance: { corto: 5000, largo: 20000 }, contactos: [identificado, eco] };

test("cada ventana sabe a qué muro pertenece", () => {
  assert.equal(ladoDeVentana(VENTANA_ESTE, SALA), "este");
  assert.equal(ladoDeVentana(VENTANA_NORTE, SALA), "norte");
  assert.equal(ladoDeVentana({ x: 0, z: 4, ancho: 0.4, profundidad: 2 }, SALA), "oeste");
  assert.equal(ladoDeVentana({ x: 3, z: 11.45, ancho: 2, profundidad: 0.4 }, SALA), "sur");
  // Un rect que no toca ningún muro no es una ventana: no se adivina.
  assert.equal(ladoDeVentana({ x: 4, z: 4, ancho: 1, profundidad: 1 }, SALA), null);
});

test("el muro norte mira a la PROA y el sur a la popa", () => {
  // Si esto se invirtiera, la ventana enseñaría el sector girado respecto al
  // rumbo. La rejilla del interior nativo hace crecer `y` hacia popa y la sala
  // hereda ese eje como `z`.
  assert.equal(RUMBO_DEL_MURO.norte, 0);
  assert.equal(RUMBO_DEL_MURO.sur, 180);
  assert.equal(RUMBO_DEL_MURO.este, 90);
  assert.equal(RUMBO_DEL_MURO.oeste, 270);
});

test("sin lectura baja la PERSIANA, no un cielo de relleno", () => {
  // La decisión del QA, y la honesta: estrellas quietas y sin contactos
  // afirmarían «he mirado y no hay nada», que es un dato que no tenemos.
  for (const sinNada of [null, undefined, {}, { contactos: null }]) {
    const piezas = piezasDeVentana({ rect: VENTANA_ESTE, sala: SALA, sensores: sinNada, rumboNave: 0 });
    assert.ok(piezas.length > 0, "la persiana tiene que dibujarse");
    for (const pieza of piezas) assert.equal(pieza.color, SECCION.mamparo);
  }
});

test("con lectura pero sin rumbo también baja la persiana", () => {
  // Sin rumbo propio no se puede saber a dónde mira la ventana: colocar los
  // contactos igualmente sería inventar la orientación.
  const piezas = piezasDeVentana({ rect: VENTANA_ESTE, sala: SALA, sensores, rumboNave: null });
  assert.ok(piezas.every((pieza) => pieza.color === SECCION.mamparo), "debería ser persiana");
});

test("la persiana llena el hueco con lamas horizontales", () => {
  const lamas = persianaCerrada(VENTANA_ESTE, "este");
  assert.equal(lamas.length, 6);
  const alturas = lamas.map((lama) => lama.malla.vertices[0][1]);
  // Escalonadas y todas dentro del hueco de ventana de la fábrica (1.14 a 2.4).
  assert.deepEqual(alturas, [...alturas].sort((a, b) => a - b));
  for (const y of alturas) assert.ok(y >= 1.1 && y <= 2.4, `lama fuera del hueco: y=${y}`);
});

test("lo que queda A LA ESPALDA de la ventana no se pinta", () => {
  // Un contacto a babor no puede salir por la ventana de estribor: sería una
  // lectura falsa, del tipo que este módulo existe para no cometer.
  const soloBabor = { alcance: { corto: 5000, largo: 20000 }, contactos: [{ rumboDeg: 270, distancia: 5000, callsign: "X", faccion: "Human Navy" }] };
  const piezas = piezasDeVentana({ rect: VENTANA_ESTE, sala: SALA, sensores: soloBabor, rumboNave: 0 });
  assert.deepEqual(piezas, [], "con rumbo 0 y ventana a estribor, un contacto a babor no se ve");
});

test("la vista GIRA con el rumbo de la nave", () => {
  const proa = piezasDeVentana({ rect: VENTANA_ESTE, sala: SALA, sensores, rumboNave: 0 });
  const popa = piezasDeVentana({ rect: VENTANA_ESTE, sala: SALA, sensores, rumboNave: 180 });
  assert.equal(proa.length, 1);
  assert.equal(popa.length, 1);
  // Y no es el mismo contacto: al girar 180° la ventana de estribor pasa a ver
  // lo que antes quedaba a babor. Se compara la MALLA y no el color: el color de
  // facción de este contacto coincide con el gris del eco, así que compararlo
  // habría hecho pasar esta prueba por el motivo equivocado.
  assert.notEqual(
    proa[0].malla.vertices.length,
    popa[0].malla.vertices.length,
    "al girar debería verse el OTRO contacto (silueta identificada frente a borrón)",
  );
});

test("un eco sin identidad se dibuja como borrón, no como silueta", () => {
  // Misma disciplina que el visor del piloto: el margen se dibuja. Un eco de
  // banda ancha no puede tener el perfil afilado de un contacto identificado.
  const soloEco = { alcance: { corto: 5000, largo: 20000 }, contactos: [{ rumboDeg: 90, distancia: 5000 }] };
  const soloNave = { alcance: { corto: 5000, largo: 20000 }, contactos: [{ rumboDeg: 90, distancia: 5000, callsign: "EKL-2", faccion: "Human Navy" }] };
  const piezasEco = piezasDeVentana({ rect: VENTANA_ESTE, sala: SALA, sensores: soloEco, rumboNave: 0 });
  const piezasNave = piezasDeVentana({ rect: VENTANA_ESTE, sala: SALA, sensores: soloNave, rumboNave: 0 });
  assert.equal(piezasEco.length, 1);
  assert.equal(piezasNave.length, 1);
  assert.notEqual(piezasEco[0].malla.vertices.length, piezasNave[0].malla.vertices.length,
    "el eco y la nave identificada no pueden compartir malla");
});

test("un contacto sin marcación legible se descarta en silencio", () => {
  for (const roto of [{ distancia: 5000 }, { rumboDeg: null, distancia: 5000 }, { rumboDeg: "90", distancia: 5000 }]) {
    const piezas = piezasDeVentana({
      rect: VENTANA_ESTE, sala: SALA, sensores: { alcance: { corto: 5000, largo: 20000 }, contactos: [roto] }, rumboNave: 0,
    });
    assert.deepEqual(piezas, [], `no se debe colocar un contacto con rumbo ${JSON.stringify(roto.rumboDeg)}`);
  }
});

test("una lectura vacía SÍ se pinta: «he mirado y no hay nada» es un dato", () => {
  // Distinto de no tener lectura. Con sondeo vivo y cero contactos, la ventana
  // se abre y no se ve nada — no baja la persiana.
  const piezas = piezasDeVentana({
    rect: VENTANA_ESTE, sala: SALA, sensores: { alcance: { corto: 5000, largo: 20000 }, contactos: [] }, rumboNave: 0,
  });
  assert.deepEqual(piezas, [], "sin contactos no hay piezas, pero tampoco persiana");
});

test("la forma de `sensores` es la que publica el puente DE VERDAD, no una inventada", async () => {
  // Esta prueba existe porque las fixtures de arriba mintieron: leían un campo
  // `sensores.alcanceLargo` que no existe. La forma real es `alcance.largo`, y
  // como `profundidadDe(d, undefined)` devuelve null, la ventana descartaba TODOS
  // los contactos y se quedaba vacía y sin persiana, con la suite en verde.
  //
  // Así que aquí el sobre no se escribe a mano: lo construye el mismo código que
  // lo construye en producción.
  const { sobreTelemetria } = await import("../scripts/ship-view/telemetria-difusion.mjs");
  const sobre = sobreTelemetria(
    { ship: { position: { x: 0, y: 0 }, heading: 0, radar: { short_range: 5000, long_range: 30000 } } },
    1,
    { contacts: [{ position: { x: 12000, y: 0 } }] },
  );
  assert.ok(sobre?.sensores?.contactos?.length, "el sobre real debería traer contactos");

  const piezas = piezasDeVentana({
    rect: VENTANA_ESTE,
    sala: SALA,
    sensores: sobre.sensores,
    rumboNave: sobre.ship.heading,
  });
  assert.equal(piezas.length, 1, "un contacto a estribor tiene que verse por la ventana de estribor");
  assert.notEqual(piezas[0].color, SECCION.mamparo, "no debería ser la persiana: hay lectura");
});

test("lo que se ve por la ventana está A LA ALTURA del hueco, no en el suelo", () => {
  // El fallo que el QA reportó como «no se ve». `situarContacto` devuelve `y = 0`
  // porque la simulación es 2D, pero el hueco de ventana de la fábrica empieza a
  // 1.14 m: un contacto a ras de suelo queda ENTERO detrás del muro. La ventana
  // se veía vacía con telemetría buena, que además es el peor estado posible
  // porque afirma «he mirado y no hay nada».
  const ALFEIZAR = 1.14;
  const DINTEL = 2.4;
  const piezas = piezasDeVentana({ rect: VENTANA_ESTE, sala: SALA, sensores, rumboNave: 0 });
  assert.ok(piezas.length > 0, "debería haber algo que ver");
  for (const pieza of piezas) {
    const ys = pieza.malla.vertices.map((v) => v[1]);
    const arriba = Math.max(...ys);
    const abajo = Math.min(...ys);
    assert.ok(
      arriba > ALFEIZAR && abajo < DINTEL,
      `la pieza ocupa y de ${abajo.toFixed(2)} a ${arriba.toFixed(2)}: fuera del hueco (${ALFEIZAR}–${DINTEL})`,
    );
  }
});

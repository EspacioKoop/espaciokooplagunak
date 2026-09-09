import assert from "node:assert/strict";
import test from "node:test";

import { RADIO_ANDAR } from "../scripts/nave-movimiento-lienzo.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";

// Un checkpoint guardado es geometría de AYER.
//
// `andar-nave-app.mjs` arranca en la posición que guardó el jugador la última vez.
// Si la sala cambió desde entonces —la cantina cambió de sistema de coordenadas Y
// de colisión al pasar por la fábrica— ese punto puede caer hoy dentro de un
// mueble, y con el punto de partida bloqueado el motor rechaza todos los pasos:
// no hay error ni aviso, simplemente no te mueves. Lo reportó el QA dos veces.
//
// La app valida el checkpoint contra la planta antes de usarlo. Aquí se comprueba
// la propiedad de la que depende esa validación: que el radio con el que se
// valida sea EL MISMO con el que se anda.

test("el radio de colisión es uno solo y está exportado", () => {
  // Con dos copias, un checkpoint podía validarse contra un radio y luego moverse
  // con otro: pasaría la validación y quedaría atascado igual.
  assert.equal(typeof RADIO_ANDAR, "number");
  assert.ok(RADIO_ANDAR > 0 && RADIO_ANDAR < 1, `radio fuera de lo razonable: ${RADIO_ANDAR}`);
});

test("las entradas del catálogo son válidas para ESE radio", () => {
  // El punto al que cae la validación cuando el checkpoint no sirve. Si la propia
  // entrada estuviera bloqueada, el rescate dejaría al jugador igual de atascado.
  for (const id of CATALOGO_ANDAR.ids) {
    const estancia = CATALOGO_ANDAR.obtener(id);
    assert.equal(
      colisiona(estancia.entrada.x, estancia.entrada.z, RADIO_ANDAR, estancia.planta),
      false,
      `la entrada de ${id} no sirve como rescate: está bloqueada`,
    );
  }
});

test("hay puntos DENTRO de la cantina que la bloquean: el peligro es real", () => {
  // Los dos puntos que de verdad dejaron al QA sin poder moverse: eran la entrada
  // y la llegada que yo mismo había escrito a mano, y los dos caen sobre muebles
  // con la colisión real de la sala. Un checkpoint guardado puede ser cualquiera
  // de ellos, así que validar antes de usar no es precaución teórica.
  //
  // (Ojo: `(1.5, 4)`, la entrada aún más antigua, HOY no colisiona. Se probó y se
  // descartó como caso: una prueba montada sobre ese punto habría pasado sin
  // cubrir nada. `(3, 5)` era el segundo caso histórico y se le unió al hacer
  // taburetes de verdad: rozaba la esquina de la caja de 0,5 m que hacía de
  // taburete, y un taburete con pie y base ocupa 0,42 — la diferencia son cinco
  // centímetros y bastan. No es que el peligro haya desaparecido, es que ese
  // punto concreto ya no lo corre; el caso se sustituye por uno sobre la barra,
  // que es un mueble que no va a adelgazar.)
  const cantina = CATALOGO_ANDAR.obtener("cantina");
  for (const punto of [{ x: 2.4, z: 8.6 }, { x: 5, z: 6.5 }]) {
    const dentro = punto.x > 0 && punto.z > 0
      && punto.x < cantina.planta.ancho && punto.z < cantina.planta.profundidad;
    assert.ok(dentro, `${JSON.stringify(punto)} debería caer dentro de la sala`);
    assert.equal(
      colisiona(punto.x, punto.z, RADIO_ANDAR, cantina.planta),
      true,
      `${JSON.stringify(punto)} ya no bloquea: busca otro caso o esta prueba no cubre nada`,
    );
  }
});

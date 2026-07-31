// Lo que se ve por el ojo de buey (#423, camino a #427).
//
// La regla que fija este archivo: por la ventana se ve EL ESPACIO QUE TENEMOS,
// no un cielo inventado — y se ve como una ventana, no como un radar.

import assert from "node:assert/strict";
import test from "node:test";

import { PHI, cuerpoMayor, cuerposPorLaVentana, puntosAureos } from "../scripts/cantina-ventana.mjs";

test("los puntos áureos no son ni el centro ni los tercios", () => {
  const puntos = puntosAureos(480, 270);
  assert.equal(puntos.length, 4);
  for (const punto of puntos) {
    assert.notEqual(punto.x, 240, "ha caído en el centro");
    assert.ok(Math.abs(punto.x - 160) > 1, "ha caído en el tercio");
  }
  assert.ok(Math.abs(PHI - 1.618) < 0.001);
});

test("un contacto delante se ve; uno a popa, no", () => {
  // Por una ventana no se ve lo que queda detrás, y fingir lo contrario la
  // convierte en un radar con marco.
  const centro = { x: 0, y: 0 };
  const delante = cuerposPorLaVentana(
    { centro, rumbo: 0, contactos: [{ x: 0, y: 5000, faccion: "Kraylor" }] },
    { ancho: 480, alto: 270 },
  );
  assert.equal(delante.length, 1);

  const detras = cuerposPorLaVentana(
    { centro, rumbo: 0, contactos: [{ x: 0, y: -5000, faccion: "Kraylor" }] },
    { ancho: 480, alto: 270 },
  );
  assert.equal(detras.length, 0);
});

test("el rumbo manda: girar la nave mueve lo que se ve por la ventana", () => {
  const contactos = [{ x: 5000, y: 0, faccion: "Kraylor" }];
  const aEstribor = cuerposPorLaVentana({ rumbo: 0, contactos }, {});
  const deFrente = cuerposPorLaVentana({ rumbo: 90, contactos }, {});
  assert.equal(aEstribor.length, 0, "a 90° de la proa no cabe en el cristal");
  assert.equal(deFrente.length, 1, "con la proa hacia él tiene que verse");
});

test("lo lejano se ve más pequeño, y nada baja de un píxel", () => {
  const cerca = cuerposPorLaVentana({ rumbo: 0, contactos: [{ x: 0, y: 300 }] }, {})[0];
  const lejos = cuerposPorLaVentana({ rumbo: 0, contactos: [{ x: 0, y: 90000 }] }, {})[0];
  assert.ok(cerca.tam > lejos.tam, "la distancia no cambia el tamaño");
  assert.ok(lejos.tam >= 1, "un contacto lejano ha desaparecido del todo");
});

test("datos rotos no ensucian el cristal", () => {
  const cuerpos = cuerposPorLaVentana(
    { rumbo: NaN, contactos: [{ x: "no", y: null }, null, { x: 0, y: 0 }] },
    {},
  );
  assert.deepEqual(cuerpos, []);
  assert.deepEqual(cuerposPorLaVentana(), []);
});

test("el cuerpo mayor cae en un punto áureo y tiene su lado a oscuras", () => {
  // Un disco plano y uniforme es una pegatina; la sombra es lo que lo hace un
  // cuerpo. Y centrado sería una diana.
  const puntos = cuerpoMayor({ ancho: 480, alto: 270, radio: 40 });
  assert.ok(puntos.length > 0);
  const xs = puntos.map((p) => p.x);
  const centroX = (Math.min(...xs) + Math.max(...xs)) / 2;
  assert.ok(Math.abs(centroX - 240) > 20, "el cuerpo mayor está centrado");

  // Con terminador, el disco no es simétrico: pesa más de un lado.
  const izquierda = puntos.filter((p) => p.x < centroX).length;
  const derecha = puntos.length - izquierda;
  assert.notEqual(izquierda, derecha, "el disco está uniformemente iluminado");
});

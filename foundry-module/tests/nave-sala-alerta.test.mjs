// El cable de la alerta hasta el techo de una sala (#995).
//
// La lógica pura de la luminaria ya está cubierta en `nave-luminaria.test.mjs`.
// Estas pruebas recorren la costura que faltaba: `crearSalaCaja(...).componer()`
// recibe la telemetría de cada fotograma, resuelve la salud del sistema de ESA
// sala y entrega al lienzo el estado calculado por `colorDifusorLuminaria`.

import test from "node:test";
import assert from "node:assert/strict";

import { crearSalaCaja } from "../scripts/nave-sala-caja.mjs";
import { colorDifusorLuminaria } from "../scripts/nave-luminaria.mjs";
import { ALERTA, LUZ_CALIDA } from "../scripts/paleta.mjs";

const SALA = { ancho: 8, profundidad: 6, muralPixel: false, pielSuelo: false };
const TIEMPO_APAGADO = 500;

/** Los colores que de verdad han llegado al lienzo en esta pasada.
 *
 * El difusor es la única malla emisiva de la sala (#555): se pinta a intensidad
 * plena y sin sombrear, así que su color llega al polígono tal cual. */
function coloresDe(escena) {
  return new Set(escena.poligonos.map((poligono) => poligono.color));
}

/** Desde el fondo de la sala y mirando al frente: postura desde la que las
 * luminarias del techo entran de verdad en el campo de visión. */
function mirarAlTecho(sala, opciones = {}) {
  return sala.componer(4, 0, 0.6, 0, { ancho: 320, alto: 180, ...opciones });
}

test("sin lectura de alerta, el difusor sigue en la luz cálida de siempre", () => {
  const sala = crearSalaCaja(SALA);
  const colores = coloresDe(mirarAlTecho(sala));
  assert.ok(colores.has(LUZ_CALIDA), "un dato que no ha llegado no puede pintar la nave");
  assert.equal(colores.has(ALERTA.niveles.roja.borde), false);
});

test("con alerta roja difundida, el difusor va en el borde de la alerta", () => {
  const sala = crearSalaCaja(SALA);
  const colores = coloresDe(mirarAlTecho(sala, { aviso: "roja" }));
  assert.ok(colores.has(ALERTA.niveles.roja.borde));
  assert.equal(colores.has(LUZ_CALIDA), false, "el difusor no puede conservar a la vez el tono anterior");
});

test("el aviso entero vale igual que el nivel suelto", () => {
  const sala = crearSalaCaja(SALA);
  const colores = coloresDe(mirarAlTecho(sala, {
    aviso: { nivel: "amarilla", motivos: ["casco"] },
  }));
  assert.ok(colores.has(ALERTA.niveles.amarilla.borde));
});

test("la sala con el sistema dañado parpadea, y la de al lado no", () => {
  const reactor = crearSalaCaja({ ...SALA, sistema: "reactor" });
  const impulso = crearSalaCaja({ ...SALA, sistema: "impulse" });
  const saludSistemas = {
    reactor: { health: 0.1 },
    impulse: { health: 1 },
  };

  const reactorEncendido = coloresDe(mirarAlTecho(reactor, { saludSistemas, tiempo: 0 }));
  const reactorApagado = coloresDe(mirarAlTecho(reactor, {
    saludSistemas,
    tiempo: TIEMPO_APAGADO,
  }));
  assert.ok(reactorEncendido.has(LUZ_CALIDA));
  assert.ok(reactorApagado.has(0x000000), "la mitad apagada llega al lienzo como difusor negro emisivo");
  assert.equal(reactorApagado.has(LUZ_CALIDA), false);

  // La misma telemetría y la misma marca de tiempo en la sala sana: quieta.
  const vecina = coloresDe(mirarAlTecho(impulso, {
    saludSistemas,
    tiempo: TIEMPO_APAGADO,
  }));
  assert.ok(vecina.has(LUZ_CALIDA), "el parpadeo pertenece a ESA sala, no al reloj global");
});

test("la alerta y la avería son lecturas independientes", () => {
  const sala = crearSalaCaja({ ...SALA, sistema: "reactor" });
  const saludSistemas = { reactor: { health: 0.1 } };

  const encendida = coloresDe(mirarAlTecho(sala, {
    aviso: "roja",
    saludSistemas,
    tiempo: 0,
  }));
  assert.ok(encendida.has(ALERTA.niveles.roja.borde), "una sala dañada en alerta roja sigue roja al encenderse");

  const apagada = coloresDe(mirarAlTecho(sala, {
    aviso: "roja",
    saludSistemas,
    tiempo: TIEMPO_APAGADO,
  }));
  assert.ok(apagada.has(0x000000));
  assert.equal(apagada.has(ALERTA.niveles.roja.borde), false);
});

test("teñir no cuesta ni un polígono: la geometría se funde una sola vez", () => {
  const sala = crearSalaCaja(SALA);
  const normal = mirarAlTecho(sala).poligonos.length;
  const roja = mirarAlTecho(sala, { aviso: "roja" }).poligonos.length;
  assert.equal(roja, normal);
});

test("el estado del difusor de la sala es el del módulo puro, sin reglas paralelas", () => {
  const sala = crearSalaCaja({ ...SALA, sistema: "reactor" });
  const casos = [
    {
      opciones: { aviso: null, saludSistemas: { reactor: { health: 1 } }, tiempo: 0 },
      estado: { aviso: null, health: 1, timeMs: 0 },
    },
    {
      opciones: { aviso: "roja", saludSistemas: { reactor: { health: 1 } }, tiempo: 0 },
      estado: { aviso: "roja", health: 1, timeMs: 0 },
    },
    {
      opciones: {
        aviso: "roja",
        saludSistemas: { reactor: { health: 0.1 } },
        tiempo: TIEMPO_APAGADO,
      },
      estado: { aviso: "roja", health: 0.1, timeMs: TIEMPO_APAGADO },
    },
  ];

  for (const { opciones, estado } of casos) {
    const esperado = colorDifusorLuminaria(estado);
    const colores = coloresDe(mirarAlTecho(sala, opciones));
    assert.ok(colores.has(esperado.color), `la sala debe emitir ${String(esperado.color)}`);
  }
});

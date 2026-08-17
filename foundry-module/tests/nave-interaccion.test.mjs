// Puntos de interacción declarados (#582).

import assert from "node:assert/strict";
import test from "node:test";

import {
  RADIO_INTERACCION,
  buscarInteraccion,
  declararInteraccion,
  declararInteracciones,
  interaccionAlAlcance,
} from "../scripts/nave-interaccion.mjs";

const RADIO_JUGADOR = 0.35;

/* ---- declaración ---------------------------------------------------------- */

test("declararInteraccion exige id y ancla", () => {
  assert.throws(() => declararInteraccion({ punto: [1, 1] }), TypeError);
  assert.throws(() => declararInteraccion({ id: "", punto: [1, 1] }), TypeError);
  assert.throws(() => declararInteraccion({ id: "sin-sitio" }), TypeError);
  assert.throws(() => declararInteraccion({ id: "x", punto: [1, NaN] }), TypeError);
  assert.throws(() => declararInteraccion({ id: "x", punto: [1, 1], radio: 0 }), RangeError);
});

test("con zona y sin punto, el ancla es el centro de la zona", () => {
  const punto = declararInteraccion({
    id: "consola-engineering",
    zona: { x: 4, z: 8, ancho: 2, profundidad: 1 },
  });
  assert.deepEqual([...punto.punto], [5, 8.5]);
});

test("la orientación es opcional y se queda en null si no es un número", () => {
  assert.equal(declararInteraccion({ id: "a", punto: [1, 1] }).orientacion, null);
  assert.equal(declararInteraccion({ id: "a", punto: [1, 1], orientacion: "sur" }).orientacion, null);
  assert.equal(declararInteraccion({ id: "a", punto: [1, 1], orientacion: 0 }).orientacion, 0);
});

test("lo declarado queda congelado: nadie mueve un punto en mitad de una sesión", () => {
  const punto = declararInteraccion({ id: "a", punto: [1, 1], zona: { x: 0, z: 0, ancho: 1, profundidad: 1 } });
  assert.throws(() => {
    punto.radio = 99;
  }, TypeError);
  assert.throws(() => {
    punto.zona.x = 99;
  }, TypeError);
});

test("declararInteracciones no admite dos ids iguales", () => {
  assert.throws(
    () => declararInteracciones([{ id: "mismo", punto: [1, 1] }, { id: "mismo", punto: [5, 5] }]),
    RangeError,
  );
});

/* ---- alcance -------------------------------------------------------------- */

test("un punto suelto responde dentro de su radio y no fuera", () => {
  const puntos = declararInteracciones([{ id: "pesca", punto: [5, 5], accion: { tipo: "pesca" } }]);
  const dentro = interaccionAlAlcance(5, 5 + RADIO_INTERACCION, RADIO_JUGADOR, puntos);
  assert.equal(dentro?.id, "pesca");
  assert.equal(interaccionAlAlcance(5, 5 + RADIO_INTERACCION + RADIO_JUGADOR + 0.01, RADIO_JUGADOR, puntos), null);
});

test("una zona responde igual que lo hacía la consola: por su rectángulo", () => {
  // La invariante de la migración. La zona va de z=8 a z=9, así que a z=7.7 se
  // toca (0,3 < radio del jugador) y a z=7.5 todavía no.
  const puntos = declararInteracciones([{ id: "consola", zona: { x: 4, z: 8, ancho: 2, profundidad: 1 } }]);
  assert.equal(interaccionAlAlcance(5, 7.7, RADIO_JUGADOR, puntos)?.id, "consola");
  assert.equal(interaccionAlAlcance(5, 7.5, RADIO_JUGADOR, puntos), null);
  // Y el radio de serie NO se aplica cuando hay zona: si se aplicara, a z=7.5
  // (a 0,5 del rectángulo, dentro de los 1,2 m del círculo) habría respondido.
});

test("con dos al alcance manda el más cercano", () => {
  const puntos = declararInteracciones([
    { id: "lejos", punto: [5, 6] },
    { id: "cerca", punto: [5, 5.2] },
  ]);
  assert.equal(interaccionAlAlcance(5, 5, RADIO_JUGADOR, puntos)?.id, "cerca");
});

test("a igual distancia gana el id menor, no el orden de la lista", () => {
  // El caso que hace falta que sea estable: dos clientes de la mesa con el
  // avatar en el mismo sitio tienen que resolver el mismo punto.
  const enUnOrden = declararInteracciones([
    { id: "silla-b", punto: [6, 5] },
    { id: "silla-a", punto: [4, 5] },
  ]);
  const enElOtro = declararInteracciones([
    { id: "silla-a", punto: [4, 5] },
    { id: "silla-b", punto: [6, 5] },
  ]);
  assert.equal(interaccionAlAlcance(5, 5, RADIO_JUGADOR, enUnOrden)?.id, "silla-a");
  assert.equal(interaccionAlAlcance(5, 5, RADIO_JUGADOR, enElOtro)?.id, "silla-a");
});

test("sin lista, o con la lista vacía, no hay punto activo (no revienta)", () => {
  assert.equal(interaccionAlAlcance(0, 0, RADIO_JUGADOR, undefined), null);
  assert.equal(interaccionAlAlcance(0, 0, RADIO_JUGADOR, []), null);
});

/* ---- búsqueda por id ------------------------------------------------------ */

test("un punto se localiza por su id, sin coordenadas incrustadas (#579)", () => {
  const puntos = declararInteracciones([
    { id: "punto-pesca", punto: [3, 9], orientacion: Math.PI, accion: { tipo: "pesca" } },
  ]);
  const pesca = buscarInteraccion(puntos, "punto-pesca");
  assert.deepEqual([...pesca.punto], [3, 9]);
  assert.equal(pesca.orientacion, Math.PI);
  assert.equal(buscarInteraccion(puntos, "no-existe"), null);
  assert.equal(buscarInteraccion(undefined, "punto-pesca"), null);
});

// La mesa de blackjack en 3D (#308 sobre #362).
//
// Lo que se afirma aquí es lo que no se ve mirando un tapete bonito: que la
// mano de la banca tapada son SIEMPRE dos cartas (una cara, una dorso) y
// nunca más ni menos; que la fila de un jugador crece con cada carta que
// pide; y que el orden por pintor sigue siendo global, como en la mesa de
// póker.

import assert from "node:assert/strict";
import test from "node:test";

import { componerMesa, disco, plazas } from "../scripts/minijuegos/blackjack-3d.mjs";
import { EPOCAS } from "../scripts/retro3d.mjs";
import { afirmarOrdenPorPintor } from "./ayuda-orden-pintor.mjs";

test("la banca tapada siempre pinta dos cartas, aunque diga tener más", () => {
  const dosCartas = componerMesa({ banca: { cartas: 2, oculta: true }, jugadores: [] }).poligonos.length;
  const conMasCartas = componerMesa({ banca: { cartas: 6, oculta: true }, jugadores: [] }).poligonos.length;
  assert.equal(dosCartas, conMasCartas, "la banca tapada no puede haber pedido ya");
});

test("la banca revelada pinta exactamente las cartas que trae", () => {
  const alturaCon = (cartas) =>
    componerMesa({ banca: { cartas, oculta: false }, jugadores: [] }).poligonos.length;
  assert.ok(alturaCon(4) > alturaCon(2), "pedir tras destapar no añade cartas a la mesa");
});

test("la fila de un jugador crece con cada carta que pide", () => {
  const conCartas = (cartas) =>
    componerMesa({ banca: { cartas: 2, oculta: true }, jugadores: [{ cartas }] }).poligonos.length;
  assert.ok(conCartas(3) > conCartas(2), "pedir una carta no añade nada a la fila");
  // Y no crece sin límite: una mesa no puede pintar cartas fuera de cuadro.
  assert.equal(conCartas(20), conCartas(8));
});

test("la apuesta levanta una pila de fichas y la vacía no pinta ninguna", () => {
  const conFichas = componerMesa({
    banca: { cartas: 2, oculta: true },
    jugadores: [{ cartas: 2, apuesta: 50 }],
  }).poligonos.length;
  const sinApuesta = componerMesa({
    banca: { cartas: 2, oculta: true },
    jugadores: [{ cartas: 2, apuesta: 0 }],
  }).poligonos.length;
  assert.ok(conFichas > sinApuesta, "una apuesta viva no se ve sobre la mesa");
});

test("los sitios son un arco delantero: no hay nadie al otro lado del tapete", () => {
  // Al contrario que en póker, en blackjack nadie juega contra el de al lado
  // — todos miran a la banca —, así que ningún jugador debe caer detrás.
  const cinco = plazas(5);
  assert.equal(cinco.length, 5);
  for (const [, , z] of cinco) {
    assert.ok(z > 0, "un jugador no puede estar al otro lado del tapete, mirando a nadie");
  }
  assert.equal(plazas(50).length, 5);
});

test("el disco cierra su costado, como en la mesa de póker y en la cantina", () => {
  const malla = disco({ lados: 10 });
  assert.equal(malla.vertices.length, 20);
  assert.equal(malla.caras.length, 12);
});

test("el orden por pintor es global: lo lejano antes que lo cercano", () => {
  const { poligonos } = componerMesa({
    banca: { cartas: 2, oculta: true },
    jugadores: [{ cartas: 3, apuesta: 40 }, { cartas: 2, apuesta: 10 }],
  });
  afirmarOrdenPorPintor(poligonos, "la mesa de blackjack");
});

test("la mesa se compone en las dos épocas y aguanta entrada rota", () => {
  for (const epoca of EPOCAS) {
    assert.ok(
      componerMesa({ banca: { cartas: 2, oculta: true }, jugadores: [{ cartas: 2 }] }, { epoca }).poligonos.length
        > 0,
    );
  }
  const rota = componerMesa({ banca: {}, jugadores: "no es una lista" }, { ancho: NaN });
  for (const poligono of rota.poligonos) {
    for (const punto of poligono.puntos) {
      assert.ok(Number.isFinite(punto.x) && Number.isFinite(punto.y));
    }
  }
});

test("el propio jugador no lleva busto; el resto sí", () => {
  // La cámara está donde estás tú: pintarte un busto sería pintarte la nuca.
  // Mismas cartas y apuesta, la única diferencia es `propio`.
  const propio = componerMesa({
    banca: { cartas: 2, oculta: true },
    jugadores: [{ cartas: 2, apuesta: 10, propio: true }],
  }).poligonos.length;
  const ajeno = componerMesa({
    banca: { cartas: 2, oculta: true },
    jugadores: [{ cartas: 2, apuesta: 10, propio: false }],
  }).poligonos.length;
  assert.ok(ajeno > propio, "el rival no trae busto propio");
});

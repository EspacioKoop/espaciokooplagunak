// La mesa de blackjack en 3D (#308 sobre #362).
//
// Lo que se afirma aquí es lo que no se ve mirando un tapete bonito: que la
// mano de la banca tapada son SIEMPRE dos cartas (una cara, una dorso) y
// nunca más ni menos; que la fila de un jugador crece con cada carta que
// pide; y que el orden por pintor sigue siendo global, como en la mesa de
// póker.

import assert from "node:assert/strict";
import test from "node:test";

import { componerMesa, disco, plazas, VISTA } from "../scripts/minijuegos/blackjack-3d.mjs";
import { FICHA, PIXEL } from "../scripts/paleta.mjs";
import { componerEscena, EPOCAS } from "../scripts/retro3d.mjs";
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

test("se ve el tapete por arriba, que es lo que hacía invisibles las cartas (#559)", () => {
  // LA REGRESIÓN, tal cual la contó QA: «la mesa es un plano verde». No
  // faltaban cartas en la escena —estaban todas y las otras pruebas las
  // cuentan— sino que la cámara orbitaba por DEBAJO del tapete: se miraba el
  // fieltro por su cara inferior, con toda la mesa entre el ojo y las manos.
  // Desde ahí ninguna carta podía verse, y no había nada mal ordenado que
  // detectar: el motor tapaba bien lo que de verdad estaba delante.
  //
  // Por eso lo que se afirma es el PUNTO DE VISTA, y se le pregunta al propio
  // motor en vez de mirar el número: con la cámara de la mesa, la cara de
  // arriba del tapete se ve y la de abajo no. Si alguien vuelve a poner la
  // cámara bajo la mesa, esto se cae.
  const ALTO = 0.06;
  const cara = (arriba) => {
    const y = arriba ? ALTO / 2 : -ALTO / 2;
    const vertices = [
      [-3, y, -2.2],
      [3, y, -2.2],
      [3, y, 2.2],
      [-3, y, 2.2],
    ];
    return componerEscena(
      { vertices, caras: [arriba ? [3, 2, 1, 0] : [0, 1, 2, 3]] },
      {
        ancho: 480,
        alto: 320,
        color: FICHA.tapete,
        fov: VISTA.fov,
        pitch: VISTA.pitch,
        yaw: VISTA.yaw,
        posicion: [0, VISTA.altura, VISTA.atras],
      },
    ).poligonos.length;
  };

  assert.equal(cara(true), 1, "el tapete tiene que verse por su cara de arriba");
  assert.equal(cara(false), 0, "si se ve el fieltro por debajo, la cámara está bajo la mesa");
});

test("con la cámara de la mesa, las cartas caen dentro del cuadro (#559)", () => {
  // La otra mitad del defecto: subir la cámara sin más cruzaba al otro lado y
  // dejaba el reparto de la banca fuera de pantalla. Se comprueba que todas las
  // cartas compuestas caen en el lienzo, no solo que existan.
  const mesa = componerMesa(
    {
      banca: { cartas: 2, oculta: true },
      jugadores: [
        { cartas: 2, apuesta: 10, propio: true },
        { cartas: 3, apuesta: 5 },
        { cartas: 2, apuesta: 15 },
      ],
    },
    { ancho: 480, alto: 320 },
  );
  const caras = mesa.poligonos.filter((p) => p.color === PIXEL.cara);
  assert.ok(caras.length >= 6, "las cartas boca arriba tienen que estar compuestas");
  for (const poligono of caras) {
    const dentro = poligono.puntos.some(
      (p) => p.x >= 0 && p.x <= 480 && p.y >= 0 && p.y <= 320,
    );
    assert.ok(dentro, "una carta se compone entera fuera del lienzo");
  }
});

test("la cámara mira el tapete desde arriba, no desde debajo (#559)", () => {  // La forma corta de la misma afirmación, para que si alguien vuelve a tocar
  // el encuadre sepa qué se le pide: el signo del pitch ES el bug.
  assert.ok(VISTA.pitch < 0, "pitch positivo pone la cámara bajo el tapete");
});

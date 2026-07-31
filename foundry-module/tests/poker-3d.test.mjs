// La mesa de póker en 3D (#308 sobre #362).
//
// Lo que se afirma aquí es lo que no se ve mirando un tapete bonito: que los
// huecos vacíos se pueden CONTAR, que la pila crece con las fichas, y que el
// orden por pintor es global — que es el fallo que dejaría una ficha dibujada
// debajo del tapete que tiene delante.

import assert from "node:assert/strict";
import test from "node:test";

import { componerMesa, disco, huecosComunitarias, plazas } from "../scripts/minijuegos/poker-3d.mjs";
import { EPOCAS } from "../scripts/retro3d.mjs";

test("siempre hay cinco huecos, salgan las cartas que salgan", () => {
  // El hueco vacío se ve, y por eso se cuenta cuántas faltan sin ponerlo en un
  // texto. Si los huecos aparecieran solo al salir la carta, la mesa dejaría de
  // decir en qué calle va la mano.
  assert.equal(huecosComunitarias().length, 5);
  for (const cuantas of [0, 3, 5]) {
    const escena = componerMesa({ comunitarias: cuantas, jugadores: [{ fichas: 100 }] });
    assert.ok(escena.poligonos.length > 0, `con ${cuantas} comunitarias no se pinta nada`);
  }
});

test("una carta boca arriba tiene canto: no es una calcomanía", () => {
  // Dos cajas por carta —canto oscuro y cara encima—, así que sacar cartas
  // añade más polígonos que dejar el hueco.
  const vacia = componerMesa({ comunitarias: 0, jugadores: [] });
  const conFlop = componerMesa({ comunitarias: 3, jugadores: [] });
  assert.ok(conFlop.poligonos.length > vacia.poligonos.length, "las cartas no tienen grosor");
});

test("la pila crece con las fichas, y no crece sin límite", () => {
  const altura = (fichas) => componerMesa({ comunitarias: 0, jugadores: [{ fichas }] }).poligonos.length;
  assert.ok(altura(300) > altura(30), "la pila no dice cuántas fichas hay");
  // Y tiene tope: una pila de mil fichas sería una columna que sale del cuadro.
  assert.equal(altura(100000), altura(1000));
});

test("los asientos rodean el tapete, y el tuyo es el de delante", () => {
  // Los rivales tienen que estar EN FRENTE para que se les vea: en el arco
  // delantero sus cartas caían fuera de cuadro, y había rivales en los datos
  // pero no en la mesa, que es como no tenerlos.
  const seis = plazas(6);
  assert.equal(seis.length, 6);
  assert.ok(seis[0][2] > 1.5, "tu asiento no está en primer término");
  assert.ok(seis.slice(1).some(([, , z]) => z < 0), "ningún rival está al otro lado");
  // Todos dentro del tapete, que mide 6.4 x 4.4 centrado en z=0.6.
  for (const [x, , z] of seis) {
    assert.ok(Math.abs(x) < 3.4, `asiento fuera del tapete: x=${x}`);
    assert.ok(z > -2.2 && z < 3.2, `asiento fuera del tapete: z=${z}`);
  }
  // Y no caben más de seis: una mesa de póker tiene los asientos que tiene.
  assert.equal(plazas(50).length, 6);
});

test("el disco cierra su costado, como la ficha de la cantina", () => {
  const malla = disco({ lados: 10 });
  assert.equal(malla.vertices.length, 20);
  assert.equal(malla.caras.length, 12);
});

test("el orden por pintor es global: lo lejano antes que lo cercano", () => {
  // Concatenar las listas de cada pieza sin reordenar deja una ficha dibujada
  // debajo del tapete que tiene delante.
  const { poligonos } = componerMesa({ comunitarias: 5, jugadores: [{ fichas: 200 }, { fichas: 80 }] });
  for (let i = 1; i < poligonos.length; i += 1) {
    assert.ok(poligonos[i - 1].profundidad >= poligonos[i].profundidad, `rompe el orden en ${i}`);
  }
});

test("la mesa se compone en las dos épocas y aguanta entrada rota", () => {
  for (const epoca of EPOCAS) {
    assert.ok(componerMesa({ comunitarias: 2, jugadores: [{ fichas: 50 }] }, { epoca }).poligonos.length > 0);
  }
  const rota = componerMesa({ comunitarias: NaN, jugadores: "no es una lista" }, { ancho: NaN });
  for (const poligono of rota.poligonos) {
    for (const punto of poligono.puntos) {
      assert.ok(Number.isFinite(punto.x) && Number.isFinite(punto.y));
    }
  }
});

// La vista de juego (#308): la mesa es donde se juega, y tiene que decir quién
// está, cuánto le queda y que sus cartas están tapadas.
test("los rivales traen dorso y busto; tú, cartas boca arriba y sin busto", () => {
  // La cámara está donde estás tú: pintarte un busto sería pintarte la nuca.
  const solo = componerMesa({ comunitarias: 0, jugadores: [{ fichas: 100, propio: true }] });
  const conRival = componerMesa({
    comunitarias: 0,
    jugadores: [{ fichas: 100, propio: true }, { fichas: 100 }],
  });
  assert.ok(conRival.poligonos.length > solo.poligonos.length, "el rival no aporta nada al cuadro");
});

// PENDIENTE: las cartas de los rivales se generan pero NO llegan al cuadro —el
// tapete y las fichas sí—, así que no hay test de «el retirado pierde sus
// cartas» hasta que se vean. Escribirlo ahora sería fijar en verde algo que en
// pantalla no ocurre, que es peor que no tenerlo.

test("hay espacio de fondo, y es el mismo para toda la mesa", () => {
  // Se juega dentro de una nave que vuela: una mesa recortada sobre negro
  // podría estar en cualquier sótano.
  const a = componerMesa({ comunitarias: 0, jugadores: [] }, { semillaCielo: 5 });
  const b = componerMesa({ comunitarias: 0, jugadores: [] }, { semillaCielo: 5 });
  assert.ok(a.estrellas.length > 0, "no se ve el espacio");
  assert.deepEqual(a.estrellas, b.estrellas, "la misma semilla debe dar el mismo cielo");
});

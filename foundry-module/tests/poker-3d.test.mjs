// La mesa de póker en 3D (#308 sobre #362).
//
// Lo que se afirma aquí es lo que no se ve mirando un tapete bonito: que los
// huecos vacíos se pueden CONTAR, que la pila crece con las fichas, y que el
// orden por pintor es global — que es el fallo que dejaría una ficha dibujada
// debajo del tapete que tiene delante.

import assert from "node:assert/strict";
import test from "node:test";

import { componerMesa, disco, huecosComunitarias, plazas, VISTA } from "../scripts/minijuegos/poker-3d.mjs";
import { componerEscena, EPOCAS } from "../scripts/retro3d.mjs";
import { FICHA, PIXEL } from "../scripts/paleta.mjs";
import { afirmarOrdenPorPintor } from "./ayuda-orden-pintor.mjs";

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
  afirmarOrdenPorPintor(poligonos, "la mesa de póker");
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

test("quien se ha retirado deja de tener cartas en la mesa", () => {
  // Un dorso visible es la información de que ese jugador SIGUE en la mano. Este
  // test estuvo fuera a propósito mientras las cartas no llegaban al cuadro:
  // ponerlo en verde entonces habría fijado algo que en pantalla no ocurría.
  const mesa = (enMano) => ({
    comunitarias: 3,
    jugadores: [{ fichas: 98, propio: true }, { fichas: 60, enMano }],
  });
  const dentro = componerMesa(mesa(true), { ancho: 480, alto: 280 });
  const fuera = componerMesa(mesa(false), { ancho: 480, alto: 280 });
  assert.ok(fuera.poligonos.length < dentro.poligonos.length, "el retirado conserva sus cartas");
});

test("la mesa cabe en el cuadro: ni se sale ni se ve de canto", () => {
  // Los dos fallos que ya se colaron por poner la cámara a ojo: primero se
  // proyectaba entera por encima del lienzo, después el tapete se veía como una
  // banda de cincuenta píxeles. Esto mide dónde cae de verdad.
  const escena = componerMesa(
    { comunitarias: 5, jugadores: [{ fichas: 98, propio: true }, { fichas: 60 }, { fichas: 120 }] },
    { ancho: 480, alto: 280 },
  );
  const ys = escena.poligonos.flatMap((p) => p.puntos.map((q) => q.y));
  const alto = Math.max(...ys) - Math.min(...ys);
  assert.ok(alto > 280 * 0.4, `la mesa ocupa solo ${alto.toFixed(0)} de 280: se ve de canto`);
  assert.ok(Math.min(...ys) >= 0 && Math.max(...ys) <= 280, "la mesa se sale por arriba o por abajo");
});

test("hay espacio de fondo, y es el mismo para toda la mesa", () => {
  // Se juega dentro de una nave que vuela: una mesa recortada sobre negro
  // podría estar en cualquier sótano.
  const a = componerMesa({ comunitarias: 0, jugadores: [] }, { semillaCielo: 5 });
  const b = componerMesa({ comunitarias: 0, jugadores: [] }, { semillaCielo: 5 });
  assert.ok(a.estrellas.length > 0, "no se ve el espacio");
  assert.deepEqual(a.estrellas, b.estrellas, "la misma semilla debe dar el mismo cielo");
});

test("se ve el tapete por arriba, no por debajo (#566)", () => {
  // El mismo defecto que #559 en la mesa de blackjack: con `pitch` positivo la
  // cámara orbita por DEBAJO del tapete —la rotación va antes de la traslación
  // en `transformar`— y se mira el fieltro por su cara inferior. Se le pregunta
  // al motor, que es quien decide qué cara sobrevive al descarte de espaldas.
  const ALTO = 0.06;
  const cara = (arriba) => {
    const y = arriba ? ALTO / 2 : -ALTO / 2;
    const vertices = [
      [-3, y, -1.4],
      [3, y, -1.4],
      [3, y, 2.6],
      [-3, y, 2.6],
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

test("las comunitarias no quedan enterradas bajo el fieltro (#566)", () => {
  // La segunda mitad de #566, y la que NO tenía la mesa de blackjack: las
  // comunitarias están en el centro del tapete, justo donde su profundidad
  // media empata con la del fieltro, y el empate lo ganaba el tapete. Cortarlo
  // en franjas es lo que rompe el empate; esto lo comprueba.
  const escena = componerMesa(
    { comunitarias: 5, jugadores: [{ fichas: 100, propio: true }, { fichas: 60 }] },
    { ancho: 480, alto: 320 },
  );
  const marco = (poligono) => {
    const xs = poligono.puntos.map((p) => p.x);
    const ys = poligono.puntos.map((p) => p.y);
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  };
  const contiene = (fuera, dentro) =>
    fuera[0] <= dentro[0] && fuera[1] >= dentro[1] && fuera[2] <= dentro[2] && fuera[3] >= dentro[3];

  const caras = escena.poligonos
    .map((poligono, i) => ({ poligono, i }))
    .filter(({ poligono }) => poligono.color === PIXEL.cara);
  const fieltro = escena.poligonos
    .map((poligono, i) => ({ poligono, i }))
    .filter(({ poligono }) => poligono.color === FICHA.tapete);
  assert.ok(caras.length >= 5, "las cinco comunitarias tienen que estar compuestas");
  assert.ok(fieltro.length > 2, "el tapete tiene que ir cortado en franjas");

  for (const { poligono, i } of caras) {
    const tapada = fieltro.some(
      ({ poligono: verde, i: j }) => j > i && contiene(marco(verde), marco(poligono)),
    );
    assert.ok(!tapada, `una carta se pinta debajo del fieltro (polígono ${i})`);
  }
});

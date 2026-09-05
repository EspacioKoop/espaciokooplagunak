import assert from "node:assert/strict";
import test from "node:test";

import {
  CERCA,
  LEJOS,
  componerVisorPiloto,
  marcacionRelativa,
  piezaDeContacto,
  profundidadDe,
  situarContacto,
} from "../../scripts/visor-piloto/visor-piloto.mjs";
import { PIXEL } from "../../scripts/paleta.mjs";

const ALCANCE = { corto: 5000, largo: 30000 };

function contacto(extra = {}) {
  return {
    banda: "corto",
    esJugador: false,
    callsign: "CN-1",
    faction: "Human Navy",
    distancia: 2000,
    rumboDeg: 0,
    precision: 10,
    rumboPrecision: 1,
    ...extra,
  };
}

function sondeo(contactos) {
  return { contactos, alcance: ALCANCE };
}

test("sin sondeo el visor se apaga, y un sondeo vacío NO es lo mismo", () => {
  // Es el cuarto estado (#353) en la superficie donde más caro sale
  // confundirlo: un sector negro y limpio afirma «no hay nada ahí fuera», y eso
  // solo se puede decir si alguien ha mirado.
  assert.equal(componerVisorPiloto(null), null);
  assert.equal(componerVisorPiloto(undefined), null);
  assert.equal(componerVisorPiloto({}), null);

  const vacio = componerVisorPiloto(sondeo([]));
  assert.notEqual(vacio, null, "un sondeo vacío sí se pinta");
  assert.equal(vacio.dibujados, 0);
  assert.equal(vacio.poligonos.length, 0);
  assert.ok(vacio.estrellas.length > 0, "el vacío se ve como vacío, con cielo");
});

test("la profundidad conserva el orden y cabe en la banda de la escena", () => {
  // Lo único que este visor promete es el orden. Si dos contactos se cruzaran de
  // sitio al comprimir la distancia, el piloto vería adelantar a quien no
  // adelanta.
  const distancias = [0, 1, 250, 2000, 12000, 29999, 30000];
  let anterior = -Infinity;
  for (const d of distancias) {
    const z = profundidadDe(d, ALCANCE.largo);
    assert.ok(z >= CERCA - 1e-9 && z <= LEJOS + 1e-9, `${d} cae fuera de la banda`);
    assert.ok(z >= anterior, `${d} rompe el orden`);
    anterior = z;
  }
});

test("una lectura ilegible no se coloca en ningún sitio", () => {
  // Ni al fondo ni delante: los dos son una afirmación. `Number(null)` es 0, así
  // que convertir a la brava habría puesto los contactos sin distancia justo
  // encima del piloto, que es la mentira cara de las dos.
  for (const malo of [null, undefined, NaN, "lejos", ""]) {
    assert.equal(profundidadDe(malo, ALCANCE.largo), null);
    assert.equal(profundidadDe(1000, malo), null);
  }
  // Alcance cero: no se divide por él, y tampoco se inventa un sitio.
  assert.equal(profundidadDe(1000, 0), null);
  // Y un contacto así no llega a la escena.
  assert.equal(situarContacto(contacto({ distancia: null }), { alcanceLargo: ALCANCE.largo }), null);
});

test("la marcación se resta del rumbo propio, que es lo que mira el piloto", () => {
  // Un contacto al norte del mundo con la nave apuntando al norte está por la
  // PROA. Sin la resta saldría siempre al norte de la pantalla aunque la nave
  // hubiera virado, que es la peor forma de equivocarse en una cabina.
  assert.ok(Math.abs(marcacionRelativa(0, 0)) < 1e-9);
  assert.ok(Math.abs(marcacionRelativa(90, 90)) < 1e-9);
  // Contacto al norte con la nave mirando al este: queda por babor (270°).
  assert.ok(Math.abs(marcacionRelativa(0, 90) - (3 * Math.PI) / 2) < 1e-9);
  // Sin rumbo legible no se inventa: se trata como cero y se dice fuera.
  assert.ok(Math.abs(marcacionRelativa(45, null) - Math.PI / 4) < 1e-9);
  assert.equal(marcacionRelativa(null, 0), null);
});

test("un contacto por la proa va delante y uno por estribor, a la derecha", () => {
  const proa = situarContacto(contacto({ rumboDeg: 0 }), { rumboPropio: 0, alcanceLargo: ALCANCE.largo });
  assert.ok(Math.abs(proa[0]) < 1e-9, "por la proa no se desvía a los lados");
  assert.ok(proa[2] > 0, "por la proa va delante");

  const estribor = situarContacto(contacto({ rumboDeg: 90 }), { rumboPropio: 0, alcanceLargo: ALCANCE.largo });
  assert.ok(estribor[0] > 0, "90° cae a la derecha");

  const babor = situarContacto(contacto({ rumboDeg: 270 }), { rumboPropio: 0, alcanceLargo: ALCANCE.largo });
  assert.ok(babor[0] < 0, "270° cae a la izquierda");

  // Todo en el mismo plano: la simulación es 2D y no hay altura que representar.
  for (const punto of [proa, estribor, babor]) assert.equal(punto[1], 0);
});

test("un eco de banda larga no se disfraza de nave identificada", () => {
  const identificado = piezaDeContacto(contacto(), { alcanceLargo: ALCANCE.largo });
  const eco = piezaDeContacto(
    contacto({ banda: "largo", callsign: null, faction: null, rumboPrecision: 15 }),
    { alcanceLargo: ALCANCE.largo },
  );
  assert.equal(eco.color, PIXEL.sinFaccion, "un eco no tiene color de facción");
  assert.notEqual(identificado.color, eco.color);
  assert.notDeepEqual(identificado.malla.vertices, eco.malla.vertices);
});

test("cuanto peor es la lectura, más ancho es el borrón", () => {
  // El margen viaja con el dato desde `contactos-degradados.mjs`; dibujar un eco
  // de 15° con la misma anchura que uno de 1° deshace esa honestidad al pintar.
  const ancho = (rumboPrecision, distancia) => {
    const { malla } = piezaDeContacto(
      contacto({ banda: "largo", callsign: null, faction: null, rumboPrecision, distancia }),
      { alcanceLargo: ALCANCE.largo },
    );
    return Math.max(...malla.vertices.map((v) => v[0]));
  };
  assert.ok(ancho(15, 20000) > ancho(1, 20000), "más margen, más ancho");
  assert.ok(ancho(15, 28000) > ancho(15, 4000), "más lejos con el mismo margen, más ancho");
});

test("la nave propia no se dibuja: se está dentro de ella", () => {
  const escena = componerVisorPiloto(
    sondeo([
      { ...contacto(), banda: "propia", esJugador: true, distancia: 0, rumboDeg: 0 },
      contacto({ rumboDeg: 30 }),
    ]),
  );
  assert.equal(escena.dibujados, 1, "solo entra el contacto ajeno");
});

test("un contacto sin marcación legible se descarta en vez de caer en la proa", () => {
  const escena = componerVisorPiloto(sondeo([contacto({ rumboDeg: null }), contacto()]));
  assert.equal(escena.dibujados, 1);
});

test("los polígonos salen ordenados de lejos a cerca", () => {
  // El orden por pintor no es componible: cada contacto se compone por su cuenta
  // y concatenar dos listas correctas da una incorrecta en cuanto se solapan.
  const escena = componerVisorPiloto(
    sondeo([
      contacto({ distancia: 25000, rumboDeg: 5 }),
      contacto({ distancia: 800, rumboDeg: 0 }),
      contacto({ distancia: 9000, rumboDeg: 350 }),
    ]),
  );
  assert.equal(escena.dibujados, 3);
  for (let i = 1; i < escena.poligonos.length; i += 1) {
    assert.ok(
      escena.poligonos[i - 1].profundidad >= escena.poligonos[i].profundidad,
      "hay un polígono cercano pintado antes que uno lejano",
    );
  }
});

test("gira el sector con el rumbo, no el sector entero por su cuenta", () => {
  // El mismo contacto visto con dos rumbos propios distintos tiene que cambiar
  // de lado. Si no cambiara, el visor estaría enseñando marcaciones absolutas.
  const uno = componerVisorPiloto(sondeo([contacto({ rumboDeg: 90 })]), { rumboPropio: 0 });
  const otro = componerVisorPiloto(sondeo([contacto({ rumboDeg: 90 })]), { rumboPropio: 180 });
  const centro = (escena) => {
    const xs = escena.poligonos.flatMap((p) => p.puntos.map((punto) => punto.x));
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  assert.ok(centro(uno) !== centro(otro), "el rumbo propio no está entrando");
});

test("la época por defecto es PSX, que es la que #362 propuso para esta superficie", () => {
  const escena = componerVisorPiloto(sondeo([contacto()]));
  assert.equal(escena.epoca, "psx");
});

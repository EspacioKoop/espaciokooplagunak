// El local de la cantina (#423 sobre #362): geometría, no aspecto.
//
// Lo que se puede afirmar de una sala sin mirarla: que sus cajas están bien
// construidas, que todos los muebles llegan a la escena, y que el orden por
// pintor es global y no por mueble — que es el único fallo de esta pieza capaz
// de dejar la barra dibujada detrás del mamparo.

import assert from "node:assert/strict";
import test from "node:test";

import { MUEBLES, caja, componerCantina } from "../scripts/cantina-escena.mjs";
import { PLANOS } from "../scripts/cantina-planos.mjs";
import { EPOCAS } from "../scripts/retro3d.mjs";

test("la caja tiene ocho vértices, seis caras y las medidas que se le piden", () => {
  const malla = caja([1, 2, 3], [2, 4, 6]);
  assert.equal(malla.vertices.length, 8);
  assert.equal(malla.caras.length, 6);
  const xs = malla.vertices.map((v) => v[0]);
  const ys = malla.vertices.map((v) => v[1]);
  const zs = malla.vertices.map((v) => v[2]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs)], [0, 2]);
  assert.deepEqual([Math.min(...ys), Math.max(...ys)], [0, 4]);
  assert.deepEqual([Math.min(...zs), Math.max(...zs)], [0, 6]);
});

test("cada cara de la caja usa cuatro vértices distintos", () => {
  // Un índice repetido da un polígono degenerado que el motor descarta en
  // silencio: la sala saldría con un agujero y sin un solo error por ningún lado.
  for (const cara of caja([0, 0, 0], [1, 1, 1]).caras) {
    assert.equal(new Set(cara).size, 4);
    for (const indice of cara) assert.ok(indice >= 0 && indice < 8);
  }
});

test("la sala se compone y todos sus muebles ponen polígonos", () => {
  const escena = componerCantina({ ancho: 320, alto: 180 });
  assert.ok(escena.poligonos.length > 0);
  assert.equal(escena.ancho, 320);
  assert.equal(escena.alto, 180);
  // Un mueble por color: si un material desaparece de la escena, es que su caja
  // se está quedando fuera del encuadre o de espaldas a la cámara.
  const colores = new Set(MUEBLES.map((m) => m.color));
  assert.ok(colores.size >= 5, "la sala tiene varios materiales, no uno");
});

test("el orden por pintor es global: lo lejano se pinta antes que lo cercano", () => {
  // La regresión que este test existe para impedir: concatenar las listas de
  // cada mueble sin reordenar da una lista ordenada por tramos, correcta dentro
  // de cada mueble y falsa entre muebles.
  const { poligonos } = componerCantina();
  for (let i = 1; i < poligonos.length; i += 1) {
    assert.ok(
      poligonos[i - 1].profundidad >= poligonos[i].profundidad,
      `polígono ${i} rompe el orden por pintor`,
    );
  }
});

test("la sala se compone en las dos épocas y ninguna se queda vacía", () => {
  for (const epoca of EPOCAS) {
    const escena = componerCantina({ epoca });
    assert.equal(escena.epoca, epoca);
    assert.ok(escena.poligonos.length > 0, `la época ${epoca} no pinta nada`);
  }
});

// Moverse por la sala (#423): la cámara se asoma, no viaja.
test("entrada rota no propaga números rotos a la escena", () => {
  const escena = componerCantina({ ancho: NaN, alto: undefined, plano: "no-existe" });
  for (const poligono of escena.poligonos) {
    for (const punto of poligono.puntos) {
      assert.ok(Number.isFinite(punto.x) && Number.isFinite(punto.y));
    }
  }
});

// El ventanal (#423, camino a #427): por el hueco del mamparo se ve el vacío.
test("hay cielo por la ventana, sembrado y estable", () => {
  const a = componerCantina({ semillaCielo: 7 });
  const b = componerCantina({ semillaCielo: 7 });
  assert.ok(a.estrellas.length > 0, "no se ve nada por el ventanal");
  assert.deepEqual(a.estrellas, b.estrellas, "la misma semilla debe dar el mismo cielo");
  assert.notDeepEqual(componerCantina({ semillaCielo: 8 }).estrellas, a.estrellas);
});

test("no hay caja de ventana: el hueco lo tapa el mamparo, no un cartón", () => {
  // Si alguien vuelve a meter un panel en el hueco, las estrellas dejan de
  // verse y la sala parece tener una pared azul en vez de un vacío detrás.
  assert.equal(MUEBLES.some((mueble) => mueble.nombre === "ventana"), false);
});

test("la sala está amueblada, no solo construida", () => {
  // La primera versión era correcta y estaba vacía. Botellas, taburetes y
  // costillas son lo que la hace un local en vez de una caja.
  const nombres = MUEBLES.map((mueble) => mueble.nombre);
  for (const prefijo of ["botella", "taburete", "nervio", "mesa", "lampara"]) {
    assert.ok(
      nombres.some((nombre) => nombre.startsWith(prefijo)),
      `la sala se ha quedado sin ${prefijo}`,
    );
  }
});

// El goblin ciego (#423): el único habitante de la sala.
test("el goblin está en la sala, con sus orejas, su venda y sus jarras", () => {
  const nombres = MUEBLES.map((mueble) => mueble.nombre);
  for (const pieza of ["goblinCuerpo", "goblinCabeza", "goblinOreja", "goblinVenda", "goblinBandeja", "jarra"]) {
    assert.ok(nombres.some((nombre) => nombre.startsWith(pieza)), `falta ${pieza}`);
  }
});

test("el goblin sirve al fondo, no delante de la barra", () => {
  // Está a lo suyo, en la mesa del fondo. Si acaba en medio del encuadre deja
  // de ser un habitante y pasa a ser un actor esperando su turno.
  for (const mueble of MUEBLES.filter((m) => m.nombre.startsWith("goblin"))) {
    assert.ok(mueble.centro[2] > 4.5, `el goblin se ha venido al frente: z=${mueble.centro[2]}`);
  }
});

// La sala tiene que estar CERRADA (#423): girarse no puede ser asomarse al vacío.
test("hay pared de entrada a la espalda de quien llega", () => {
  const nombres = MUEBLES.map((mueble) => mueble.nombre);
  assert.ok(nombres.some((nombre) => nombre.startsWith("paredEntrada")), "falta la pared de entrada");
  assert.ok(nombres.includes("vanoEntrada"), "falta el vano por el que se entra");
  // Y va DETRÁS del punto de partida: si estuviera delante, taparía la barra.
  for (const mueble of MUEBLES.filter((m) => m.nombre.startsWith("paredEntrada"))) {
    assert.ok(mueble.centro[2] < -2, `la entrada se ha colado en la sala: z=${mueble.centro[2]}`);
  }
});

test("todos los planos enseñan sala y ofrecen algo que hacer", () => {
  // Un plano vacío o sin salidas es un callejón: la cámara está autorada, así
  // que si un encuadre no funciona no hay forma de que el jugador lo arregle.
  for (const plano of PLANOS) {
    const escena = componerCantina({ plano: plano.id });
    assert.ok(escena.poligonos.length > 20, `el plano ${plano.id} está casi vacío`);
    assert.ok(escena.opciones.length > 0, `el plano ${plano.id} no ofrece nada`);
    assert.equal(escena.plano, plano.id);
  }
});

test("una opción fuera de cuadro se pega al borde, no desaparece", () => {
  // Descartarla sería esconder una salida. Se marca `fuera` para poder pintarla
  // distinto: «está ahí» y «está por ahí» no son lo mismo.
  const escena = componerCantina({ plano: "ventanal" });
  for (const opcion of escena.opciones) {
    assert.ok(opcion.x >= 0 && opcion.x <= escena.ancho);
    assert.ok(opcion.y >= 0 && opcion.y <= escena.alto);
  }
  assert.ok(escena.opciones.some((o) => o.fuera), "ninguna se ha marcado como fuera");
});

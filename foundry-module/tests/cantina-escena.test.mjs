// El local de la cantina (#423 sobre #362): geometría, no aspecto.
//
// Lo que se puede afirmar de una sala sin mirarla: que sus cajas están bien
// construidas, que todos los muebles llegan a la escena, y que el orden por
// pintor es global y no por mueble — que es el único fallo de esta pieza capaz
// de dejar la barra dibujada detrás del mamparo.

import assert from "node:assert/strict";
import test from "node:test";

import { MUEBLES, PASEO, acotarCamara, caja, componerCantina } from "../scripts/cantina-escena.mjs";
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
test("andar y mirar son cosas distintas, y las dos cambian la vista", () => {
  const quieto = componerCantina({ camara: { x: 0, z: 0, yaw: 0, pitch: 0 } });
  const andado = componerCantina({ camara: { x: 0, z: 2, yaw: 0, pitch: 0 } });
  const girado = componerCantina({ camara: { x: 0, z: 0, yaw: 0.4, pitch: 0 } });
  const alzado = componerCantina({ camara: { x: 0, z: 0, yaw: 0, pitch: 0.2 } });
  assert.notDeepEqual(andado.poligonos, quieto.poligonos, "andar no mueve nada");
  assert.notDeepEqual(girado.poligonos, quieto.poligonos, "girar no mueve nada");
  assert.notDeepEqual(alzado.poligonos, quieto.poligonos, "mirar arriba no mueve nada");
  // Y no son lo mismo: andar de frente no puede dar la misma vista que girar.
  assert.notDeepEqual(andado.poligonos, girado.poligonos);
});

test("el paseo está acotado: no se atraviesa la barra ni se sale de la sala", () => {
  // Detrás de la barra no hay nada modelado; dejar entrar ahí es enseñar el
  // decorado por dentro.
  const tope = componerCantina({ camara: { x: PASEO.maxX, z: PASEO.maxZ } });
  const pasado = componerCantina({ camara: { x: 900, z: 900 } });
  assert.deepEqual(pasado.poligonos, tope.poligonos);
  assert.deepEqual(acotarCamara({ x: -50, z: -50 }), {
    x: PASEO.minX,
    z: PASEO.minZ,
    yaw: 0,
    pitch: 0,
  });
});

test("una cámara rota deja la sala centrada, no vacía", () => {
  const rota = componerCantina({ camara: { x: NaN, z: undefined, yaw: NaN } });
  assert.deepEqual(rota.poligonos, componerCantina().poligonos);
  assert.ok(rota.poligonos.length > 0);
});

test("hay paralaje: al desplazarse, lo cercano se mueve más que lo lejano", () => {
  // Es LA razón de que la cámara se mueva. Sin paralaje esto sería una imagen
  // que se agita, y quien mire no leerá la sala como un espacio con fondo.
  const quieto = componerCantina({ camara: { x: 0, z: 0 } });
  const asomado = componerCantina({ camara: { x: 2, z: 0 } });
  const centroX = (escena, indice) => {
    const puntos = escena.poligonos[indice].puntos;
    return puntos.reduce((suma, p) => suma + p.x, 0) / puntos.length;
  };
  // Los polígonos vienen ordenados de lejos a cerca: el primero y el último.
  const lejano = Math.abs(centroX(asomado, 0) - centroX(quieto, 0));
  const cercano = Math.abs(
    centroX(asomado, asomado.poligonos.length - 1) - centroX(quieto, quieto.poligonos.length - 1),
  );
  assert.ok(cercano > lejano, `sin paralaje: cercano ${cercano}, lejano ${lejano}`);
});

test("entrada rota no propaga números rotos a la escena", () => {
  const escena = componerCantina({ ancho: NaN, alto: undefined, camara: { yaw: NaN } });
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
    assert.ok(mueble.centro[2] < PASEO.minZ, `la entrada se ha colado en la sala: z=${mueble.centro[2]}`);
  }
});

test("mires hacia donde mires desde el centro, hay sala", () => {
  // Cuatro rumbos cardinales: en ninguno puede salir un cuadro vacío, que es lo
  // que pasaba al darse la vuelta cuando la sala no tenía cuarta pared.
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const escena = componerCantina({ camara: { x: 0, z: 0, yaw } });
    assert.ok(escena.poligonos.length > 0, `mirando a ${yaw.toFixed(2)} no se ve nada`);
  }
});

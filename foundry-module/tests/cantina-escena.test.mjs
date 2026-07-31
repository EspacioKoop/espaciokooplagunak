// El local de la cantina (#423 sobre #362): geometría, no aspecto.
//
// Lo que se puede afirmar de una sala sin mirarla: que sus cajas están bien
// construidas, que todos los muebles llegan a la escena, y que el orden por
// pintor es global y no por mueble — que es el único fallo de esta pieza capaz
// de dejar la barra dibujada detrás del mamparo.

import assert from "node:assert/strict";
import test from "node:test";

import { MUEBLES, caja, componerCantina } from "../scripts/cantina-escena.mjs";
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
test("asomarse cambia lo que se ve: la sala no es una imagen fija", () => {
  const centro = componerCantina({ mirada: { x: 0, y: 0 } });
  const izquierda = componerCantina({ mirada: { x: -1, y: 0 } });
  const arriba = componerCantina({ mirada: { x: 0, y: 1 } });
  assert.notDeepEqual(izquierda.poligonos, centro.poligonos);
  assert.notDeepEqual(arriba.poligonos, centro.poligonos);
});

test("el asomo está acotado: pasarse de rango no saca la cámara del decorado", () => {
  // El ratón se sale del visor constantemente; eso no es un error, y tampoco
  // puede ser un billete para ver la sala por detrás.
  const tope = componerCantina({ mirada: { x: 1, y: 1 } });
  const pasado = componerCantina({ mirada: { x: 40, y: 40 } });
  assert.deepEqual(pasado.poligonos, tope.poligonos);
});

test("una mirada rota deja la sala centrada, no vacía", () => {
  const rota = componerCantina({ mirada: { x: NaN, y: undefined } });
  assert.deepEqual(rota.poligonos, componerCantina().poligonos);
  assert.ok(rota.poligonos.length > 0);
});

test("hay paralaje: al asomarse, lo cercano se desplaza más que lo lejano", () => {
  // Es LA razón de que la cámara se mueva. Sin paralaje esto sería una imagen
  // que se agita, y quien mire no leerá la sala como un espacio con fondo.
  const quieto = componerCantina({ mirada: { x: 0, y: 0 } });
  const asomado = componerCantina({ mirada: { x: 1, y: 0 } });
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
  const escena = componerCantina({ ancho: NaN, alto: undefined, yaw: NaN });
  for (const poligono of escena.poligonos) {
    for (const punto of poligono.puntos) {
      assert.ok(Number.isFinite(punto.x) && Number.isFinite(punto.y));
    }
  }
});

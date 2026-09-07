import assert from "node:assert/strict";
import test from "node:test";

import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { RADIO_ANDAR } from "../scripts/nave-movimiento-lienzo.mjs";

// DEUDA MEDIDA, no una prueba de que algo funcione.
//
// Al hacer taburetes de verdad (asiento, pie, base y reposapiés, con el asiento
// a 0,63 m en vez de la caja de 0,90 que era la misma que la barra) el paso
// siguiente era declararlos como asientos. No se declararon, y este archivo es
// por qué: A LA BARRA NO SE LLEGA ANDANDO.
//
// La pared de ventanal de la escena clásica —`mamparoIzq`, `mamparoDer`,
// `dintel` y `antepecho`, en z 8,85–9,45 locales— cruza la sala de lado a lado
// sin un hueco, y la entrada cae del lado de FUERA. Lo andable es la franja
// z 9,8–11,4 a lo largo del muro sur; la barra, sus taburetes y las dos mesas
// están al otro lado.
//
// No es un descubrimiento: #579 ya lo dejó escrito al elegir dónde poner la
// puerta de la terraza. Allí era un dato para colocar una puerta; aquí es lo que
// impide sentarse en la barra, y por eso se convierte en número.
//
// Cuando alguien abra ese paso, esta prueba FALLARÁ. Eso es lo que tiene que
// pasar: el mensaje dice qué hacer entonces.

/** Celdas del suelo alcanzables andando desde la entrada de una estancia. */
function inundarDesdeLaEntrada(estancia, paso = 0.1) {
  const { planta, entrada } = estancia;
  const libre = (x, z) =>
    x > RADIO_ANDAR &&
    z > RADIO_ANDAR &&
    x < planta.ancho - RADIO_ANDAR &&
    z < planta.profundidad - RADIO_ANDAR &&
    !colisiona(x, z, RADIO_ANDAR, planta);

  const clave = (i, j) => `${i},${j}`;
  const inicio = [Math.round(entrada.x / paso), Math.round(entrada.z / paso)];
  const vistas = new Set([clave(...inicio)]);
  const pendientes = [inicio];
  while (pendientes.length) {
    const [i, j] = pendientes.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = clave(i + di, j + dj);
      if (vistas.has(k)) continue;
      if (!libre((i + di) * paso, (j + dj) * paso)) continue;
      vistas.add(k);
      pendientes.push([i + di, j + dj]);
    }
  }
  return { vistas, paso, libre };
}

/** Lo que le falta a un punto para estar en la zona alcanzable, en metros. */
function distanciaALoAndable(vistas, paso, x, z) {
  let mejor = Infinity;
  for (const k of vistas) {
    const [i, j] = k.split(",").map(Number);
    mejor = Math.min(mejor, Math.hypot(i * paso - x, j * paso - z));
  }
  return mejor;
}

/** Dónde caen los cuatro taburetes en coordenadas de la fábrica. */
const TABURETES = [
  [2.6, 4.45],
  [4.2, 4.45],
  [5.8, 4.45],
  [7.4, 4.45],
];

test("hoy no se llega a los taburetes de la barra: por eso no son asientos", () => {
  const cantina = CATALOGO_ANDAR.obtener("cantina");
  const { vistas, paso } = inundarDesdeLaEntrada(cantina);

  for (const [x, z] of TABURETES) {
    const distancia = distanciaALoAndable(vistas, paso, x, z);
    assert.ok(
      distancia > 1.2,
      `al taburete de (${x}, ${z}) se llega a ${distancia.toFixed(2)} m de lo andable: ` +
        "si esto falla es que la barra ya es alcanzable, y entonces toca declarar sus cuatro " +
        "asientos en `cantina-sala.mjs` y borrar esta prueba",
    );
  }
});

test("y la franja andable de la cantina está medida, no supuesta", () => {
  const cantina = CATALOGO_ANDAR.obtener("cantina");
  const { vistas, paso, libre } = inundarDesdeLaEntrada(cantina);

  let libres = 0;
  for (let i = 0; i * paso < cantina.planta.ancho; i += 1) {
    for (let j = 0; j * paso < cantina.planta.profundidad; j += 1) {
      if (libre(i * paso, j * paso)) libres += 1;
    }
  }
  const fraccion = vistas.size / libres;
  // Un cuarto del suelo libre. La cota es holgada a propósito: lo que vigila no
  // es el número exacto sino que nadie dé por hecho que la cantina se recorre.
  assert.ok(fraccion < 0.4, `alcanzable el ${(fraccion * 100).toFixed(0)}% del suelo libre`);

  // Y es una franja pegada al muro sur, no un trozo repartido por la sala.
  let zMin = Infinity;
  for (const k of vistas) zMin = Math.min(zMin, Number(k.split(",")[1]) * paso);
  assert.ok(zMin > cantina.planta.profundidad * 0.7, `la zona andable empieza en z=${zMin.toFixed(1)}`);
});

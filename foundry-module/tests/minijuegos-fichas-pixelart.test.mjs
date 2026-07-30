import assert from "node:assert/strict";
import test from "node:test";

import {
  DENOMINACIONES,
  LADO,
  fichaDataUri,
  fichaSvg,
  pilaDeFichas,
} from "../scripts/minijuegos/fichas-pixelart.mjs";
import { FICHA } from "../scripts/paleta.mjs";

test("la pila reparte de mayor a menor y suma exactamente la cantidad", () => {
  const pila = pilaDeFichas(678);
  assert.deepEqual(pila, [
    { valor: 500, cuenta: 1 },
    { valor: 100, cuenta: 1 },
    { valor: 25, cuenta: 3 },
    { valor: 1, cuenta: 3 },
  ]);
  const suma = pila.reduce((total, m) => total + m.valor * m.cuenta, 0);
  assert.equal(suma, 678);
});

test("cualquier cantidad razonable se reparte sin perder ni inventar fichas", () => {
  for (let cantidad = 1; cantidad <= 2000; cantidad += 1) {
    const suma = pilaDeFichas(cantidad).reduce((t, m) => t + m.valor * m.cuenta, 0);
    assert.equal(suma, cantidad, `${cantidad} no cuadra`);
  }
});

test("la pila nunca pasa de un montón por denominación", () => {
  // Es lo que acota lo que la ventana pinta: cien fichas de 1 son UN montón con
  // su cuenta, no cien dibujos.
  for (const cantidad of [1, 99, 4321, 999999]) {
    const pila = pilaDeFichas(cantidad);
    assert.ok(pila.length <= DENOMINACIONES.length);
    assert.equal(new Set(pila.map((m) => m.valor)).size, pila.length);
  }
});

test("donde no hay cifra no hay fichas", () => {
  // Antes del reparto un asiento no tiene stack: dibujar un montón ahí sería
  // inventarse un estado de la mesa.
  for (const nada of [0, -5, null, undefined, 12.5, "100", NaN]) {
    assert.deepEqual(pilaDeFichas(nada), [], `${nada} no debería dar fichas`);
  }
});

test("cada denominación se distingue por su forma, no solo por su color", () => {
  // El criterio de accesibilidad del módulo: si el color no se percibe, el
  // número de cuñas del canto sigue diciendo qué ficha es.
  const cunas = DENOMINACIONES.map((d) => d.cunas);
  assert.equal(new Set(cunas).size, cunas.length, "dos denominaciones con la misma forma");
  for (const { valor } of DENOMINACIONES) {
    assert.ok(FICHA.valores[valor], `la denominación ${valor} no tiene color en la paleta`);
  }
});

test("la ficha se dibuja en su rejilla y con los colores de la paleta", () => {
  const svg = fichaSvg(25);
  assert.match(svg, new RegExp(`viewBox="0 0 ${LADO} ${LADO}"`));
  assert.match(svg, /shape-rendering="crispEdges"/);
  const colores = new Set([...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]));
  assert.deepEqual([...colores].sort(), [FICHA.canto, FICHA.valores[25]].sort());
  // Nada se sale del lienzo: un rect fuera de la rejilla se vería recortado y
  // el píxel dejaría de ser cuadrado.
  for (const [, x] of svg.matchAll(/x="(\d+)"/g)) assert.ok(Number(x) < LADO);
});

test("la silueta lleva siempre canto crema: es lo que la despega del fieltro", () => {
  // Los tonos de denominación NO llegan a 3:1 contra el tapete —el rojo se
  // queda en 1,84— así que quien porta la silueta es el canto. Si alguien
  // pintase el borde del color del valor, la ficha se perdería en la mesa.
  for (const { valor } of DENOMINACIONES) {
    const svg = fichaSvg(valor);
    // Fila central: los extremos de la ficha en horizontal.
    const centro = Math.floor(LADO / 2);
    const fila = [...svg.matchAll(/x="(\d+)" y="(\d+)" width="1" height="1" fill="([^"]+)"/g)]
      .filter((m) => Number(m[2]) === centro)
      .sort((a, b) => Number(a[1]) - Number(b[1]));
    assert.equal(fila.at(0)[3], FICHA.canto, `${valor}: el borde izquierdo no es canto`);
    assert.equal(fila.at(-1)[3], FICHA.canto, `${valor}: el borde derecho no es canto`);
  }
});

test("una denominación que no existe se dice, no se dibuja en gris", () => {
  assert.throws(() => fichaSvg(3), RangeError);
  assert.throws(() => fichaSvg("100"), RangeError);
});

test("el data: URI va escapado y sirve para un <img> sin tocar disco", () => {
  const uri = fichaDataUri(500);
  assert.ok(uri.startsWith("data:image/svg+xml,"));
  assert.equal(decodeURIComponent(uri.slice("data:image/svg+xml,".length)), fichaSvg(500));
  assert.ok(!uri.includes("#"), "un # sin escapar cortaría el URI");
});

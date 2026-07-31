import assert from "node:assert/strict";
import test from "node:test";

import {
  ALTO,
  ANCHO,
  DENOMINACIONES,
  MAXIMO_APILADO,
  altoDePila,
  fichaDataUri,
  fichaSvg,
  pilaSvg,
  pilaDeFichas,
} from "../scripts/minijuegos/fichas-pixelart.mjs";
import { FICHA, canales, luminancia } from "../scripts/paleta.mjs";

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

test("la ficha se dibuja en su rejilla y solo con su color, en sus planos", () => {
  // La pared es el MISMO color en sombra, no un color nuevo: si alguien
  // declarase un gris de canto, la paleta pasaría de cinco tonos a diez y la
  // guardia de #351 dejaría de significar nada. Se comprueba por proporción de
  // canales, que es lo que sobrevive a un cambio de factor de sombra.
  const svg = fichaSvg(25);
  assert.match(svg, new RegExp(`viewBox="0 0 ${ANCHO} ${ALTO}"`));
  assert.match(svg, /shape-rendering="crispEdges"/);
  const propio = canales(FICHA.valores[25]);
  for (const [, relleno] of svg.matchAll(/fill="([^"]+)"/g)) {
    if (relleno === FICHA.canto) continue;
    const rgb = canales(relleno);
    assert.ok(rgb, `${relleno} no es un color legible`);
    const factor = rgb[0] / propio[0];
    for (let i = 1; i < 3; i += 1) {
      assert.ok(
        Math.abs(rgb[i] / propio[i] - factor) < 0.05,
        `${relleno} no es el verde de la ficha en otro plano`,
      );
    }
  }
});

test("el montón crece hacia arriba y su lienzo crece con él", () => {
  // Es LO QUE HACE que la ficha sea 3D y no un disco: quién manda la mesa se
  // ve por lo alto que tiene el montón. Un lienzo de alto fijo lo aplastaría.
  let anterior = 0;
  for (let fichas = 1; fichas <= 5; fichas += 1) {
    const alto = altoDePila(fichas);
    assert.ok(alto > anterior, `${fichas} fichas no suben respecto a ${fichas - 1}`);
    assert.match(pilaSvg(100, fichas), new RegExp(`viewBox="0 0 ${ANCHO} ${alto}"`));
    anterior = alto;
  }
});

test("el montón dibujado se corta en el tope, la cuenta escrita no", () => {
  // Cien fichas apiladas serían una columna ilegible. El dibujo se detiene y
  // manda la cifra de al lado, que es la que no puede mentir.
  assert.equal(altoDePila(50), altoDePila(MAXIMO_APILADO));
  assert.equal(pilaSvg(5, 50), pilaSvg(5, MAXIMO_APILADO));
});

test("las cuñas se ven en el canto, que es lo que no tapa el montón", () => {
  // En un montón alto las caras quedan ocultas casi enteras: si la forma que
  // distingue la denominación viviese solo en la cara, se perdería justo
  // cuando más fichas hay.
  // La fila alta del canto: por debajo van el apoyo y el contorno, que no
  // llevan cuñas. Si la cuña se leyese ahí, este test pasaría por el borde.
  const filaAlta = altoDePila(4) - 4;
  const canto = [...pilaSvg(500, 4).matchAll(/y="(\d+)" width="1" height="1" fill="([^"]+)"/g)]
    .filter(([, y]) => Number(y) === filaAlta);
  const tonos = new Set(canto.map(([, , relleno]) => relleno));
  assert.ok(tonos.has(FICHA.canto), "el canto no enseña ni una cuña");
  assert.ok(tonos.size > 1, "el canto es crema entero: no se distingue una cuña de otra");
});

test("REGRESIÓN: en un montón alto, TODAS las fichas enseñan sus cuñas", () => {
  // El apoyo y el contorno son el suelo del montón y van una sola vez. Cuando
  // vivían dentro del canto se repetían en cada ficha y, como el canto de la de
  // arriba tapa el de la de abajo, lo ÚNICO que se veía entre ficha y ficha era
  // esa base: un montón de rayas donde no se podía contar ni una cuña.
  const fichas = 4;
  const alto = altoDePila(fichas);
  const filas = new Map();
  for (const [, y, relleno] of pilaSvg(500, fichas).matchAll(
    /y="(\d+)" width="1" height="1" fill="([^"]+)"/g,
  )) {
    if (!filas.has(Number(y))) filas.set(Number(y), new Set());
    filas.get(Number(y)).add(relleno);
  }
  // Las dos últimas filas son el suelo; por encima, cada ficha aporta su canto.
  for (let y = ALTO - 2; y < alto - 2; y += 1) {
    const tonos = filas.get(y);
    assert.ok(tonos.has(FICHA.canto), `la fila ${y} del montón no enseña cuña`);
    assert.ok(tonos.size > 1, `la fila ${y} del montón es de un solo tono`);
  }
});

test("la silueta lleva siempre contorno crema: es lo que la despega del fieltro", () => {
  // El tapete es verde oscuro y los tonos de denominación NO llegan a 3:1
  // contra él —el rojo se queda en 1,84 y la pared en sombra, en 1,2—, así que
  // quien porta la silueta es el crema. Si alguien pintase el contorno del
  // color del valor, el montón se perdería en la mesa justo por abajo, donde se
  // apoya. Se comprueba en las cuatro esquinas del recorrido: fila central
  // (extremos izquierdo y derecho) y última fila (borde de apoyo).
  for (const { valor } of DENOMINACIONES) {
    const celdas = [
      ...fichaSvg(valor).matchAll(/x="(\d+)" y="(\d+)" width="1" height="1" fill="([^"]+)"/g),
    ].map(([, x, y, color]) => ({ x: Number(x), y: Number(y), color }));

    // La fila más ancha es el ecuador de la elipse: donde la ficha llega más
    // lejos por los costados, que es donde el contorno más se juega.
    const anchoPorFila = new Map();
    for (const c of celdas) anchoPorFila.set(c.y, (anchoPorFila.get(c.y) ?? 0) + 1);
    const centro = [...anchoPorFila].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    const fila = celdas.filter((c) => c.y === centro).sort((a, b) => a.x - b.x);
    assert.equal(fila.at(0).color, FICHA.canto, `${valor}: el borde izquierdo no es contorno`);
    assert.equal(fila.at(-1).color, FICHA.canto, `${valor}: el borde derecho no es contorno`);

    const ultima = Math.max(...celdas.map((c) => c.y));
    const abajo = new Set(celdas.filter((c) => c.y === ultima).map((c) => c.color));
    assert.deepEqual([...abajo], [FICHA.canto], `${valor}: el borde de apoyo no es contorno`);
  }
});

test("la ficha se apoya: bajo la pared hay un plano más oscuro que la ficha", () => {
  // Sin sombra de apoyo el montón flota sobre el tapete en vez de estar puesto.
  // Va POR DENTRO del contorno: la silueta la porta el crema, la profundidad la
  // porta la sombra, y cada una hace un trabajo distinto.
  const celdas = [
    ...fichaSvg(5).matchAll(/x="(\d+)" y="(\d+)" width="1" height="1" fill="([^"]+)"/g),
  ].map(([, x, y, color]) => ({ x: Number(x), y: Number(y), color }));
  const apoyo = Math.max(...celdas.map((c) => c.y)) - 1;
  const tonos = celdas.filter((c) => c.y === apoyo && c.color !== FICHA.canto).map((c) => c.color);
  assert.ok(tonos.length > 0, "no hay fila de apoyo bajo el contorno");
  for (const tono of new Set(tonos)) {
    assert.ok(
      luminancia(tono) < luminancia(FICHA.valores[5]),
      `${tono}: el apoyo no es más oscuro que la ficha`,
    );
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

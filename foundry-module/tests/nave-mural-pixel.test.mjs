// Pixelart de casco sobre los muros (#548).
//
// Lo que se prueba aquí es lo que no se ve mirando la pared: que el mural es el
// mismo en todas las pantallas, que no cuesta un fotograma, que no cambia por
// dónde se puede andar y que sus caras miran a la sala y no al vacío. Lo que sí
// se ve —si queda bonito— no lo decide un test.

import test from "node:test";
import assert from "node:assert/strict";

import {
  CELDA,
  SALIENTE,
  TOPE_PIEZAS,
  caraInterior,
  fundirRectangulos,
  fundirTiradas,
  piezasMuralPixel,
  rejillaMural,
} from "../scripts/nave-mural-pixel.mjs";
import { MURAL, SECCION } from "../scripts/paleta.mjs";
import { crearSalaCaja, ALTURA } from "../scripts/nave-sala-caja.mjs";

const SALA = { ancho: 8, profundidad: 6 };
const GROSOR = 0.4;
/** Los cuatro tramos perimetrales tal y como los construye `crearSalaCaja`. */
const MURO_NORTE = { x: -GROSOR, z: -GROSOR, ancho: SALA.ancho + GROSOR * 2, profundidad: GROSOR };
const MURO_SUR = { x: -GROSOR, z: SALA.profundidad, ancho: SALA.ancho + GROSOR * 2, profundidad: GROSOR };
const MURO_OESTE = { x: -GROSOR, z: 0, ancho: GROSOR, profundidad: SALA.profundidad };
const MURO_ESTE = { x: SALA.ancho, z: 0, ancho: GROSOR, profundidad: SALA.profundidad };

test("la cara interior de cada muro mira a la sala", () => {
  assert.deepEqual(caraInterior(MURO_NORTE, SALA), { eje: "x", plano: 0, sentido: 1, u0: -GROSOR, largo: 8.8 });
  assert.deepEqual(caraInterior(MURO_SUR, SALA), { eje: "x", plano: 6, sentido: -1, u0: -GROSOR, largo: 8.8 });
  assert.deepEqual(caraInterior(MURO_OESTE, SALA), { eje: "z", plano: 0, sentido: 1, u0: 0, largo: 6 });
  assert.deepEqual(caraInterior(MURO_ESTE, SALA), { eje: "z", plano: 8, sentido: -1, u0: 0, largo: 6 });
});

test("un rectángulo que no es muro perimetral no recibe mural", () => {
  // Una columna en mitad de la sala: no hay «cara interior» que valga, y la
  // respuesta correcta es no pintar nada en vez de inventarse una orientación.
  const columna = { x: 3, z: 3, ancho: 0.8, profundidad: 0.8 };
  assert.equal(caraInterior(columna, SALA), null);
  assert.deepEqual(piezasMuralPixel({ rect: columna, sala: SALA, altura: ALTURA }), []);
});

test("la misma semilla da el mismo mural, y una distinta lo cambia", () => {
  const a = JSON.stringify(rejillaMural(20, 19, 7));
  assert.equal(a, JSON.stringify(rejillaMural(20, 19, 7)), "misma semilla, mismo muro en toda la mesa");
  assert.notEqual(a, JSON.stringify(rejillaMural(20, 19, 8)));
});

test("dos muros iguales de la misma sala no salen idénticos", () => {
  // Sin mezclar la posición del tramo en la semilla, norte y sur (mismo largo)
  // saldrían con los parches en el mismo sitio y la sala se leería como una
  // habitación de espejos.
  const norte = piezasMuralPixel({ rect: MURO_NORTE, sala: SALA, altura: ALTURA, semilla: 3 });
  const sur = piezasMuralPixel({ rect: MURO_SUR, sala: SALA, altura: ALTURA, semilla: 3 });
  assert.notEqual(
    JSON.stringify(norte.map((p) => p.color)),
    JSON.stringify(sur.map((p) => p.color)),
  );
});

test("el mural no pinta el fondo: solo lo que no es muro pelado", () => {
  const rejilla = rejillaMural(20, 19, 5);
  const celdas = rejilla.flat();
  assert.ok(celdas.some((c) => c === null), "el color base del muro sigue siendo el fondo");
  const tonos = new Set(celdas.filter(Boolean));
  const permitidos = new Set(Object.values(MURAL));
  for (const tono of tonos) assert.ok(permitidos.has(tono), `${tono} no está en MURAL (#351)`);
  assert.ok(!tonos.has(SECCION.casco), "pintar el fondo sería gastar polígonos en nada");
});

test("las tiradas horizontales se funden en un solo polígono", () => {
  // Una junta horizontal de 40 celdas tiene que salir como UN rectángulo: es lo
  // que hace que el mural quepa en el presupuesto de un fotograma.
  const fila = new Array(40).fill(MURAL.junta);
  const tiradas = fundirTiradas([fila]);
  assert.equal(tiradas.length, 1);
  assert.deepEqual(tiradas[0], { v: 0, u0: 0, ancho: 40, color: MURAL.junta });
});

test("una tirada se corta al cambiar de color y al llegar un hueco", () => {
  const fila = [MURAL.junta, MURAL.junta, null, MURAL.parche, MURAL.junta];
  assert.deepEqual(fundirTiradas([fila]), [
    { v: 0, u0: 0, ancho: 2, color: MURAL.junta },
    { v: 0, u0: 3, ancho: 1, color: MURAL.parche },
    { v: 0, u0: 4, ancho: 1, color: MURAL.junta },
  ]);
});

test("el mural de un muro largo cabe en el presupuesto", () => {
  const piezas = piezasMuralPixel({ rect: MURO_NORTE, sala: SALA, altura: ALTURA, semilla: 11 });
  assert.ok(piezas.length > 0, "un muro de 8,8 m sí lleva piel");
  assert.ok(piezas.length <= TOPE_PIEZAS, `${piezas.length} piezas pasan del tope`);
  // El tope es duro incluso con un muro absurdamente largo.
  const largo = { x: -GROSOR, z: -GROSOR, ancho: 60, profundidad: GROSOR };
  assert.ok(
    piezasMuralPixel({ rect: largo, sala: { ancho: 60, profundidad: 6 }, altura: ALTURA }).length <= TOPE_PIEZAS,
  );
});

test("las chapas se apoyan en la cara del muro, dentro de la sala y sin salirse del tramo", () => {
  for (const rect of [MURO_NORTE, MURO_SUR, MURO_OESTE, MURO_ESTE]) {
    const cara = caraInterior(rect, SALA);
    for (const { malla } of piezasMuralPixel({ rect, sala: SALA, altura: ALTURA, semilla: 2 })) {
      for (const [x, y, z] of malla.vertices) {
        const plano = cara.eje === "x" ? z : x;
        assert.ok(
          Math.abs(plano - (cara.plano + SALIENTE * cara.sentido)) < 1e-9,
          "una chapa vive en el plano de su muro, adelantada lo justo",
        );
        assert.ok(y >= -1e-9 && y <= ALTURA + 1e-9, "ni por debajo del suelo ni por encima del techo");
        const u = cara.eje === "x" ? x : z;
        assert.ok(u >= cara.u0 - 1e-9 && u <= cara.u0 + cara.largo + 1e-9, "no se sale del tramo de muro");
      }
    }
  }
});

test("las caras del mural miran a la sala y no al vacío", () => {
  // `componerEscena` descarta las caras de espaldas, así que una chapa con el
  // giro invertido no se vería desde dentro de la sala —se vería desde fuera del
  // casco, donde no hay nadie—. La normal se compara con la de la cara del PROPIO
  // muro que la sostiene (`caja`, sentido antihorario visto desde fuera de la
  // caja, que para el muro perimetral es desde dentro de la sala): así el test
  // exige la convención del módulo y no una que yo haya deducido aparte.
  const esperadas = [
    [MURO_NORTE, [0, 0, 1]],
    [MURO_SUR, [0, 0, -1]],
    [MURO_OESTE, [1, 0, 0]],
    [MURO_ESTE, [-1, 0, 0]],
  ];
  for (const [rect, dentro] of esperadas) {
    const piezas = piezasMuralPixel({ rect, sala: SALA, altura: ALTURA, semilla: 4 });
    assert.ok(piezas.length > 0);
    for (const { malla } of piezas) {
      assert.deepEqual(normalUnitaria(malla), dentro, "cara de espaldas: el giro está invertido");
    }
  }
});

/** Normal de la primera (y única) cara de una chapa, redondeada a un eje. */
function normalUnitaria({ vertices, caras }) {
  const [a, b, c] = caras[0].map((i) => vertices[i]);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const largo = Math.hypot(...n);
  return n.map((k) => Math.round(k / largo) + 0);
}

test("la piel no cambia por dónde se puede andar", () => {
  // El mural es chapa de grosor cero sobre el muro: nadie choca con un remache.
  const con = crearSalaCaja({ ancho: 8, profundidad: 6, muralPixel: true });
  const sin = crearSalaCaja({ ancho: 8, profundidad: 6, muralPixel: false });
  assert.deepEqual(con.planta, sin.planta);
});

test("la fábrica emite la piel de serie y el interruptor la apaga", () => {
  const vista = (sala) =>
    sala.componer(4, 0, 3, 0, { ancho: 320, alto: 180, epoca: "psx" }).poligonos.length;
  assert.ok(
    vista(crearSalaCaja({ ancho: 8, profundidad: 6 })) >
      vista(crearSalaCaja({ ancho: 8, profundidad: 6, muralPixel: false })),
    "una sala sin pedir nada ya trae piel de casco",
  );
});

test("el mural no dibuja nada que se pueda leer como una medida", () => {
  // La regla de #526 sobre la superficie que más de cerca se mira. No se puede
  // testear «no parece un dial», pero sí lo que lo haría posible.
  //
  // Este test decía antes «una celda de alto, ni más ni menos», y eso no era la
  // regla: era el fundido por tiradas de #548 escrito como si fuera una promesa.
  // Al fundir en rectángulos (#551) las piezas son más altas y el test se
  // rompió sin que nada del dibujo hubiera cambiado de naturaleza. Lo exigible
  // es que TODA pieza esté clavada a la rejilla —posición y tamaño en múltiplos
  // enteros de `CELDA`—, que es lo que impide una barra que crezca, una escala
  // graduada o un glifo: nada de eso cabe en celdas enteras de un dibujo fijo.
  const rejilla = rejillaMural(24, 38, 9);
  for (const { color } of fundirTiradas(rejilla)) assert.ok(Object.values(MURAL).includes(color));

  const enRejilla = (n) => Math.abs(n / CELDA - Math.round(n / CELDA)) < 1e-6;
  for (const { malla } of piezasMuralPixel({ rect: MURO_NORTE, sala: SALA, altura: ALTURA, semilla: 9 })) {
    const alturas = malla.vertices.map(([, y]) => y);
    assert.ok(alturas.every(enRejilla), "toda altura cae en la rejilla");
    assert.ok(enRejilla(Math.max(...alturas) - Math.min(...alturas)), "y todo alto es un número entero de celdas");
  }
});

test("el fundido en rectángulos dibuja lo mismo que celda a celda", () => {
  // La red de seguridad del cambio de #548 a #551: un mallado codicioso es fácil
  // de escribir con un solapamiento o un hueco, y ninguna de las dos cosas se ve
  // en una captura. Se reconstruye la rejilla desde los rectángulos y tiene que
  // salir idéntica —ni una celda pisada dos veces, ni una sin cubrir.
  const rejilla = rejillaMural(37, 38, 4);
  const reconstruida = rejilla.map((fila) => fila.map(() => null));
  for (const { v, u0, ancho, alto, color } of fundirRectangulos(rejilla)) {
    for (let dv = 0; dv < alto; dv += 1) {
      for (let du = 0; du < ancho; du += 1) {
        assert.equal(reconstruida[v + dv][u0 + du], null, "dos rectángulos se pisan");
        reconstruida[v + dv][u0 + du] = color;
      }
    }
  }
  assert.deepEqual(reconstruida, rejilla);
});

test("fundir en rectángulos cuesta bastante menos que fundir en tiradas", () => {
  // Es la condición del detalle nuevo, no una optimización suelta: sin este
  // ahorro, el dibujo de #551 no cabía en el presupuesto de un fotograma.
  const rejilla = rejillaMural(37, 38, 4);
  assert.ok(
    fundirRectangulos(rejilla).length < fundirTiradas(rejilla).length * 0.6,
    "el mallado 2D tiene que ahorrar al menos un 40%",
  );
});

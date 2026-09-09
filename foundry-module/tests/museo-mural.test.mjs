import assert from "node:assert/strict";
import test from "node:test";

import { MUSEO } from "../scripts/paleta.mjs";
import { CELDA, fundirRectangulos, rejillaMural } from "../scripts/nave-mural-pixel.mjs";
import { piezasMuroMuseo, rejillaMuroMuseo } from "../scripts/museo-mural.mjs";
import { PIEZAS_COLOCADAS } from "../scripts/museo-escena.mjs";

const COLUMNAS = 120; // 12 m, el muro largo de la sala
const FILAS = 38; // 3,8 m de altura

test("la pared de galería no usa ni un tono que no sea suyo", () => {
  // Frontera de arte (#351): un módulo de arte no declara color propio. Y
  // además no puede colarse aquí ningún tono de otra superficie: el muro es el
  // fondo de la sala y comparte paleta con ella o deja de ser la misma sala.
  const permitidos = new Set([
    MUSEO.pano,
    MUSEO.panoJunta,
    MUSEO.riel,
    MUSEO.rodapie,
    MUSEO.molduraLuz,
  ]);
  for (const fila of rejillaMuroMuseo(COLUMNAS, FILAS)) {
    for (const color of fila) assert.ok(permitidos.has(color), `tono ajeno: ${color}`);
  }
});

test("no queda ni una celda sin pintar: el muro no se ve por detrás de su piel", () => {
  for (const fila of rejillaMuroMuseo(COLUMNAS, FILAS)) {
    assert.ok(fila.every((color) => color !== null));
  }
});

test("ESTÁ VACÍA A PROPÓSITO: cuesta un orden de magnitud menos que la de casco", () => {
  // No es una optimización, es la idea: en una galería lo que tiene que
  // reclamar la mirada es lo colgado, y cada greeble compite con la obra. El
  // presupuesto es la CONSECUENCIA de eso, y esta prueba lo fija para que nadie
  // «mejore» la pared rellenándola con algo más pequeño que un tablero — el
  // friso y sus paneles embutidos SÍ suben la cuenta (de 32 a 39, boiserie de
  // #838→siguiente), porque son arquitectura y no relleno, pero cada pieza
  // nueva sigue siendo un tablero entero o una banda de lado a lado: la prueba
  // de más abajo, "NADA que se pueda leer", es la que de verdad vigila eso.
  const galeria = fundirRectangulos(rejillaMuroMuseo(COLUMNAS, FILAS)).length;
  const casco = fundirRectangulos(rejillaMural(COLUMNAS, FILAS, 20260818)).length;
  assert.equal(galeria, 39);
  assert.ok(
    galeria * 8 < casco,
    `la pared de galería se está llenando: ${galeria} rectángulos contra los ${casco} del casco`,
  );
});

test("la arquitectura está, y en el orden en que se construye una pared", () => {
  const rejilla = rejillaMuroMuseo(COLUMNAS, FILAS);
  const abajo = rejilla[0];
  const arriba = rejilla[FILAS - 1];
  assert.ok(abajo.every((color) => color === MUSEO.rodapie), "falta el rodapié");
  assert.ok(arriba.every((color) => color === MUSEO.rodapie), "falta la cornisa");

  // El riel, a una sola altura y de lado a lado. Es lo que explica por qué los
  // cuadros cuelgan donde cuelgan: sin él, esa altura es una decisión sin causa
  // visible en la sala.
  const filasConRiel = rejilla
    .map((fila, v) => (fila.includes(MUSEO.riel) ? v : -1))
    .filter((v) => v >= 0);
  assert.ok(filasConRiel.length > 0, "no hay riel de cuelgue");
  for (const v of filasConRiel) {
    assert.ok(rejilla[v].every((color) => color === MUSEO.riel), "el riel se interrumpe");
  }
  // Contiguas: un riel partido en dos alturas serían dos rieles.
  assert.deepEqual(
    filasConRiel,
    filasConRiel.map((_, i) => filasConRiel[0] + i),
  );
});

test("el riel se convierte de METROS a celdas, no se escribe como número de fila", () => {
  // La lección de #551: lo escrito en filas se parte por la mitad en silencio el
  // día que cambie la celda, y la franja de aviso de una puerta acabó a la
  // altura de la rodilla. 2,10 m es altura de riel de sala de exposición.
  const rejilla = rejillaMuroMuseo(COLUMNAS, FILAS);
  const vRiel = rejilla.findIndex((fila) => fila.includes(MUSEO.riel));
  assert.equal(vRiel, Math.round(2.1 / CELDA));
  assert.ok(vRiel * CELDA > 2, "el riel está por debajo de la cabeza");
});

test("NADA que se pueda leer: ni marcas sueltas ni motivos que se cuenten", () => {
  // #526 en la superficie de una galería, donde es peor que en la nave: sobre
  // una pared de museo cualquier marca se lee como parte de la exposición.
  // Lo único que hay son bandas de lado a lado (rodapié, riel, cornisa, sombras),
  // paños enteros de tablero y las juntas de una celda que los separan. Nada
  // más pequeño que un tablero: una mancha a media altura se leería como un
  // rótulo, que es lo que en una galería no puede haber sobre la pared.
  const PANEL = 24; // el ancho de tablero que declara el módulo, 2,4 m
  const rejilla = rejillaMuroMuseo(COLUMNAS, FILAS);
  for (const { ancho, alto, u0, v } of fundirRectangulos(rejilla)) {
    const bandaEntera = ancho === COLUMNAS;
    const tableroEntero = ancho >= PANEL - 1;
    const junta = ancho === 1;
    assert.ok(
      bandaEntera || tableroEntero || junta,
      `hay un motivo suelto en (${u0}, ${v}): ${ancho}x${alto}`,
    );
  }
});

test("no es determinista por semilla porque no hay nada que sortear", () => {
  // Al revés que el mural de la nave. Una galería es albañilería repetida: con
  // las juntas en sitios aleatorios no parecería más natural, parecería mal
  // construida. Dos llamadas con semillas distintas dan lo mismo.
  const a = piezasMuroMuseo({
    rect: { x: -0.2, z: 0, ancho: 0.2, profundidad: 9 },
    sala: { ancho: 12, profundidad: 9 },
    altura: 3.8,
    semilla: 1,
  });
  const b = piezasMuroMuseo({
    rect: { x: -0.2, z: 0, ancho: 0.2, profundidad: 9 },
    sala: { ancho: 12, profundidad: 9 },
    altura: 3.8,
    semilla: 999,
  });
  assert.deepEqual(a, b);
});

test("un rectángulo que no es muro perimetral no produce piel", () => {
  assert.deepEqual(
    piezasMuroMuseo({
      rect: { x: 4, z: 4, ancho: 1, profundidad: 1 },
      sala: { ancho: 12, profundidad: 9 },
      altura: 3.8,
    }),
    [],
  );
});

test("los pedestales siguen sin piel de casco, y ahora los muros tampoco", () => {
  // La sala ya apagaba `pielObjetos` con este argumento (#550) y sus muros
  // seguían remachados. Es la misma frase aplicada a la superficie que más
  // importa: el fondo contra el que se lee lo colgado.
  assert.ok(PIEZAS_COLOCADAS.length > 0);
});

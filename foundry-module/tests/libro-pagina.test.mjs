import assert from "node:assert/strict";
import test from "node:test";

import { libroGeometria } from "../scripts/libro-geometria.mjs";
import {
  CELDA_PAGINA,
  TOPE_PAGINA,
  rejillaPagina,
  mallaPagina,
  colocarPagina,
} from "../scripts/libro-pagina.mjs";
import { PAGINA } from "../scripts/paleta.mjs";

// La página se mira más de cerca que el cuadro colgado (#836/#838): su celda es
// más fina, no más gruesa. Si alguien la sube a 2,5 cm estaría rompiendo esa
// regla de composición a propósito, y el test lo caza.
test("la celda de la página es más fina que la del cuadro (2,5 cm)", () => {
  const CELDA_CUADRO = 0.025;
  assert.ok(
    CELDA_PAGINA < CELDA_CUADRO,
    `CELDA_PAGINA (${CELDA_PAGINA}) debe ser < ${CELDA_CUADRO}`,
  );
});

test("la rejilla es de los colores de la paleta PAGINA, sin color propio", () => {
  const rejilla = rejillaPagina(1);
  const tonos = new Set(PAGINA ? Object.values(PAGINA) : []);
  for (const fila of rejilla) {
    for (const celda of fila) {
      assert.ok(
        celda === null || tonos.has(celda),
        `celda con color ajeno a PAGINA: ${celda}`,
      );
    }
  }
});

test("la rejilla tiene mancha (tinta) y respira (papel), no es un bloque plano", () => {
  const rejilla = rejillaPagina(7);
  let tinta = 0;
  let papel = 0;
  let cabecera = 0;
  for (const fila of rejilla) {
    for (const celda of fila) {
      if (celda === PAGINA.tinta) tinta += 1;
      else if (celda === PAGINA.papel) papel += 1;
      else if (celda === PAGINA.cabecera) cabecera += 1;
    }
  }
  assert.ok(tinta > 0, "la página no dibuja ningún bloque de texto sugerido");
  assert.ok(cabecera > 0, "la página no dibuja cabecera");
  assert.ok(papel > 0, "la página no deja respira de papel");
});

test("la malla respeta el presupuesto declarado: ≤ TOPE_PAGINA caras y cuadriláteros", () => {
  const m = mallaPagina(1);
  assert.ok(
    m.caras.length <= TOPE_PAGINA,
    `mallaPagina(1) produce ${m.caras.length} caras, tope ${TOPE_PAGINA}`,
  );
  for (const cara of m.caras) {
    assert.equal(cara.length, 4);
    for (const i of cara) {
      assert.ok(Number.isInteger(i) && i >= 0 && i < m.vertices.length);
    }
  }
});

test("el tope al importar no dispara una excepción con la página típica", () => {
  // El módulo valida al importar; si llegamos aquí, la guarda pasó. Lo afirmamos
  // llamando de nuevo para confirmar que la cuenta no se dispara.
  const m = mallaPagina(42);
  assert.ok(m.caras.length > 0 && m.caras.length <= TOPE_PAGINA);
});

test("mallaPagina es determinista para la misma semilla", () => {
  const a = mallaPagina(123);
  const b = mallaPagina(123);
  assert.deepEqual(a.vertices, b.vertices);
  assert.deepEqual(a.caras, b.caras);
});

test("colocarPagina pinta sobre la cara de la hoja que gira", () => {
  const { caras } = libroGeometria(Math.PI / 2, Math.PI / 4);
  // Cara local de prueba: una hoja plana mirando a +x.
  const cara = { eje: "z", plano: 0, sentido: 1, u0: -0.1, largo: 0.2 };
  const piezas = colocarPagina(1, cara);
  assert.ok(piezas.length >= 1, "colocarPagina no devuelve piezas");
  for (const { malla, color } of piezas) {
    assert.ok(malla.vertices.length > 0);
    assert.ok(Object.values(PAGINA).includes(color));
  }
});

test("ninguna página repite la misma mancha para semillas distintas", () => {
  const a = rejillaPagina(1).flat().join("");
  const b = rejillaPagina(2).flat().join("");
  assert.notEqual(a, b, "dos semillas distintas dan la misma página");
});

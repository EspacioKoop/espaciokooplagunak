import assert from "node:assert/strict";
import test from "node:test";

import { CUADRO } from "../scripts/paleta.mjs";
import { CELDA } from "../scripts/nave-mural-pixel.mjs";
import {
  ALTO_TOTAL,
  ANCHO_TOTAL,
  CELDA_LIENZO,
  COMPOSICIONES,
  LIENZO,
  MARCO,
  SALIENTE_CUADRO,
  TOPE_CUADRO,
  costeCuadro,
  piezasCuadro,
  rejillaCuadro,
} from "../scripts/museo-cuadro.mjs";
import { CATALOGO_CUADROS, MALLAS_CUADROS } from "../scripts/museo-cuadros.mjs";
import { validarCatalogoPiezas, cartelaDe } from "../scripts/catalogo-piezas.mjs";
import {
  ANCHO,
  CUADROS_COLGADOS,
  INTERACCIONES,
  PIEZAS_COLOCADAS,
  PLANTA_MUSEO,
  colgarCuadro,
} from "../scripts/museo-escena.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { interaccionAlAlcance } from "../scripts/nave-interaccion.mjs";

const mallasDisponibles = new Set(MALLAS_CUADROS);

/* ---- el catálogo ----------------------------------------------------------- */

test("el catálogo de cuadros pasa el MISMO validador que las esculturas", () => {
  // La unificación es el punto (#598): dos validadores de licencia se
  // desincronizan, y una licencia desincronizada no es un fallo de forma.
  assert.equal(validarCatalogoPiezas(CATALOGO_CUADROS, { mallasDisponibles }), true);
  assert.equal(CATALOGO_CUADROS.piezas.length, 2, "dos cuadros, uno por muro lateral");
});

test("cada ficha apunta a una composición que existe de verdad", () => {
  for (const pieza of CATALOGO_CUADROS.piezas) {
    assert.ok(COMPOSICIONES[pieza.malla], `${pieza.id} apunta a un dibujo que no está`);
  }
});

test("LA NORMA DE LA CASA: una cartela de obra generada dice que está generada", () => {
  // El mismo criterio que obliga al León a decir que es una reconstrucción y a
  // la Afrodita a decir que es un vaciado. Si un cuadro pintado por una máquina
  // no lo dijera, la sala estaría enseñando algo sin decir qué es.
  for (const pieza of CATALOGO_CUADROS.piezas) {
    assert.equal(pieza.naturaleza, "obra-propia");
    assert.match(pieza.cartela.es, /GENERAD/);
    assert.match(pieza.cartela.en, /GENERATED/);
  }
});

test("nombre y cartela en los dos idiomas, y el crédito se deriva", () => {
  for (const pieza of CATALOGO_CUADROS.piezas) {
    for (const idioma of ["es", "en"]) {
      const cartela = cartelaDe(pieza, idioma);
      assert.equal(cartela.titulo, pieza.nombre[idioma]);
      assert.equal(cartela.texto, pieza.cartela[idioma]);
      assert.ok(cartela.credito, `${pieza.id} sin crédito derivado en ${idioma}`);
    }
  }
});

/* ---- la celda, que es el mando de escala ----------------------------------- */

test("el lienzo tiene su PROPIA celda, y la piel de la nave no se ha movido", () => {
  // Lo que #551 enseñó por las malas: bajar la celda compartida parte en
  // silencio todo lo que estaba medido en filas. La del cuadro es suya.
  assert.equal(CELDA_LIENZO, 0.025);
  assert.equal(CELDA, 0.1, "la celda del mural de la nave NO se toca desde aquí");
  assert.ok(CELDA_LIENZO < CELDA, "un cuadro se mira más de cerca que un muro");
  assert.ok(SALIENTE_CUADRO > 0.01, "el cuadro va por delante de la piel, no dentro de ella");
});

test("la rejilla mide lo que dicen las medidas en METROS, no al revés", () => {
  const rejilla = rejillaCuadro("campo-partido");
  assert.equal(rejilla[0].length, Math.round(LIENZO.ancho / CELDA_LIENZO) + MARCO * 2);
  assert.equal(rejilla.length, Math.round(LIENZO.alto / CELDA_LIENZO) + MARCO * 2);
  assert.equal(Math.round(ANCHO_TOTAL * 1000), 1300);
  assert.equal(Math.round(ALTO_TOTAL * 1000), 900);
});

/* ---- el dibujo -------------------------------------------------------------- */

test("el marco lleva relieve y el lienzo NO", () => {
  const rejilla = rejillaCuadro("campo-partido");
  const arriba = rejilla[rejilla.length - 1];
  const abajo = rejilla[0];
  // La luz viene de arriba (`LUZ` en retro3d): canto claro arriba, oscuro
  // abajo. Invertirlo dejaría el marco hundido en vez de montado.
  // La esquina de arriba a la derecha es donde se cruzan luz y sombra, y ahí
  // manda la sombra: es el costado derecho, que es el que no ve la luz.
  assert.ok(arriba.slice(0, -1).every((color) => color === CUADRO.marcoLuz));
  assert.equal(arriba.at(-1), CUADRO.marcoSombra);
  assert.ok(abajo.every((color) => color === CUADRO.marcoSombra));
  // Y dentro del lienzo no aparece ni un tono de marco: la pintura es plana.
  const dentro = rejilla
    .slice(MARCO, rejilla.length - MARCO)
    .flatMap((fila) => fila.slice(MARCO, fila.length - MARCO));
  for (const color of dentro) {
    assert.ok(
      ![CUADRO.marco, CUADRO.marcoLuz, CUADRO.marcoSombra].includes(color),
      "una composición ha pintado encima del marco",
    );
  }
});

test("ninguna composición se sale del lienzo ni deja un hueco sin pintar", () => {
  for (const id of Object.keys(COMPOSICIONES)) {
    const rejilla = rejillaCuadro(id);
    for (const fila of rejilla) {
      assert.equal(fila.length, rejilla[0].length);
      assert.ok(fila.every((color) => color !== null), `${id} deja el muro a la vista`);
    }
  }
});

/* ---- el presupuesto, que es la condición ----------------------------------- */

test("EL PRESUPUESTO: cada composición cabe en el tope, y con margen", () => {
  // Un cuadro no se recorta al tope como se recorta un muro: media pintura se
  // lee como un fallo. Por eso el módulo revienta al importar si no cabe, y por
  // eso esta prueba mide la cifra en vez de comprobar que no ha explotado.
  const costes = Object.fromEntries(
    Object.keys(COMPOSICIONES).map((id) => [id, costeCuadro(id)]),
  );
  assert.deepEqual(costes, { "campo-partido": 19, "escalera-de-verdin": 26 });
  for (const [id, coste] of Object.entries(costes)) {
    assert.ok(coste <= TOPE_CUADRO, `${id} se pasa del tope`);
  }
});

test("fundir es lo que hace que esto quepa: 1.872 celdas caben en decenas de caras", () => {
  const celdas = rejillaCuadro("campo-partido").flat().length;
  assert.equal(celdas, 1872);
  assert.ok(
    costeCuadro("campo-partido") < celdas / 50,
    "sin fundir rectángulos este dibujo no cabría en un fotograma",
  );
});

/* ---- colgado en la sala ----------------------------------------------------- */

test("los dos cuadros cuelgan de los muros laterales, hacia DENTRO de la sala", () => {
  assert.equal(CUADROS_COLGADOS.length, 2);
  const [oeste, este] = CUADROS_COLGADOS;
  const xs = (colgado) => colgado.chapas.flatMap(({ malla }) => malla.vertices.map(([x]) => x));
  assert.ok(xs(oeste).every((x) => x > 0 && x < 0.1), "el cuadro del oeste no está en su muro");
  assert.ok(
    xs(este).every((x) => x < ANCHO && x > ANCHO - 0.1),
    "el cuadro del este no está en su muro",
  );
});

test("cuelga a la altura del ojo, no en la mitad del muro", () => {
  for (const colgado of CUADROS_COLGADOS) {
    const ys = colgado.chapas.flatMap(({ malla }) => malla.vertices.map(([, y]) => y));
    assert.ok(Math.min(...ys) > 1.0, `${colgado.pieza.id} cuelga demasiado bajo`);
    assert.ok(Math.max(...ys) < 2.2, `${colgado.pieza.id} cuelga por encima de la mirada`);
    assert.ok(Math.abs(colgado.centro[1] - 1.6) < 0.01, "el centro del cuadro va a 1,60 m");
  }
});

test("desde el mirador de cada cuadro se alcanza SU cartela, mirando al muro", () => {
  for (const colgado of CUADROS_COLGADOS) {
    const [x, z] = colgado.mirador;
    assert.equal(colisiona(x, z, 0.35, PLANTA_MUSEO), false, "no se puede llegar al mirador");
    const alcanzada = interaccionAlAlcance(x, z, 0.35, INTERACCIONES);
    assert.equal(alcanzada?.accion?.tipo, "cartela");
    assert.equal(alcanzada?.accion?.pieza, colgado.pieza.id);
    // El frente es (sen yaw, cos yaw): mirar al muro es mirar en x, no en z.
    assert.ok(Math.abs(Math.sin(colgado.yaw)) > 0.99, "el mirador no mira al muro");
  }
});

test("un cuadro NO se puede tocar andando: lo que frena es el muro", () => {
  // Chocarse con un cuadro es de las cosas que rompen un sitio, igual que
  // chocarse con una cartela.
  for (const colgado of CUADROS_COLGADOS) {
    const [, , z] = colgado.centro;
    const dentro = colgado.centro[0] === 0 ? 0.45 : ANCHO - 0.45;
    assert.equal(colisiona(dentro, z, 0.35, PLANTA_MUSEO), false, "el cuadro estorba al andar");
  }
});

test("ningún cuadro se cuelga detrás de una escultura", () => {
  // El muro del fondo es el de los pedestales: un cuadro ahí le disputa la
  // lectura a la pieza que tiene delante.
  for (const colgado of CUADROS_COLGADOS) {
    for (const colocada of PIEZAS_COLOCADAS) {
      const dx = colgado.centro[0] - colocada.centro[0];
      const dz = colgado.centro[2] - colocada.centro[2];
      assert.ok(Math.hypot(dx, dz) > 1.5, `${colgado.pieza.id} pisa a ${colocada.pieza.id}`);
    }
  }
});

test("colgar más cuadros que muros no se apaña en silencio", () => {
  assert.throws(
    () => colgarCuadro(CATALOGO_CUADROS.piezas[0], 2),
    /decisión de diseño/,
    "un tercer cuadro tiene que reventar, no aparecer solo",
  );
});

test("una composición que no existe falla al pedirla, no al pintarla", () => {
  assert.throws(() => rejillaCuadro("no-existe"), /composición/);
  assert.throws(() => piezasCuadro({
    cara: { eje: "z", plano: 0, sentido: 1 },
    u: 0,
    cota: 1,
    composicion: "no-existe",
  }), /composición/);
});

test("NADA de lo que añaden los cuadros concede, cuenta ni recuerda", () => {
  const deCuadros = INTERACCIONES.filter((punto) => punto.id.startsWith("cuadro-"));
  assert.equal(deCuadros.length, 2);
  for (const punto of deCuadros) {
    assert.deepEqual(Object.keys(punto.accion).sort(), ["pieza", "tipo"]);
    assert.equal(punto.accion.tipo, "cartela");
  }
});

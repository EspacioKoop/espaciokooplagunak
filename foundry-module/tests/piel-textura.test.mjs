// La piel del muro como textura tileada (#584).

import assert from "node:assert/strict";
import test from "node:test";

import { ANCHO_TESELA, METROS_POR_TEXEL, teselaMuro, texturaMuro } from "../scripts/piel-textura.mjs";
import { ALTURA, SUBDIVISION_PANO_METROS, crearSalaCaja } from "../scripts/nave-sala-caja.mjs";
import { SALAS_PHOBOS, medidasSala } from "../scripts/nave-planta-phobos.mjs";
import { texturaUtilizable } from "../scripts/retro3d-lienzo.mjs";
import { MURAL } from "../scripts/paleta.mjs";

const ANCHO = Math.round(ANCHO_TESELA / METROS_POR_TEXEL);
const ALTO = Math.round(ALTURA / METROS_POR_TEXEL);

/* ---- la tesela ------------------------------------------------------------- */

test("la tesela mide EXACTAMENTE el alto del muro", () => {
  // Es la coincidencia de la que vive todo esto: la `v` va de 0 a 1 clavada, así
  // que no hay que elegir tamaño de tesela ni enumerar un catálogo de vanos —
  // que eran las dos opciones malas de #584.
  assert.ok(Math.abs(ALTO * METROS_POR_TEXEL - ALTURA) < 1e-9);
});

test("es más fina que la rejilla de cajas a la que sustituye", () => {
  // Con cajas de 10 cm cada detalle cuesta un polígono y hay que racionarlos.
  // A dos centímetros y medio por téxel caben los remaches y las juntas finas.
  assert.ok(METROS_POR_TEXEL < 0.1 / 3);
});

test("va por bandas: zócalo, paño y cornisa", () => {
  // Un paño uniforme se lee como papel pintado por muchos remaches que lleve.
  const rejilla = teselaMuro({ ancho: ANCHO, alto: ALTO });
  const colores = (v) => new Set(rejilla[v]);
  assert.ok(colores(2).has(MURAL.sombra), "el zócalo va en su tono");
  assert.ok(colores(Math.round(ALTO * 0.9)).has(MURAL.sombra), "y la cornisa también");
  assert.notDeepEqual([...colores(2)].sort(), [...colores(Math.round(ALTO * 0.45))].sort());
});

test("el bisel va con el canto claro ARRIBA", () => {
  // La luz del motor viene de arriba. Invertido, las planchas se leen hundidas y
  // el muro entero parece un molde en negativo: es el error clásico del relieve
  // dibujado, y aquí no se puede corregir con luz porque la luz va pintada.
  const rejilla = teselaMuro({ ancho: ANCHO, alto: ALTO });
  const claros = rejilla.filter((fila) => fila.includes(MURAL.claro)).length;
  assert.ok(claros > 0, "tiene que haber cantos a la luz");
});

test("lleva lo que en cajas no cabía", () => {
  const usados = new Set(teselaMuro({ ancho: ANCHO, alto: ALTO }).flat());
  for (const [nombre, color] of [
    ["remaches", MURAL.remache],
    ["conducto", MURAL.conducto],
    ["abrazaderas", MURAL.abrazadera],
    ["ventilación", MURAL.ventilacion],
    ["parches", MURAL.parche],
  ]) {
    assert.ok(usados.has(color), `falta ${nombre}`);
  }
});

test("dos semillas dan teselas distintas, y la misma semilla la misma", () => {
  // Sin variación, dos vanos contiguos se leen como la misma imagen pegada dos
  // veces, que es lo que delata un tileado antes que nada.
  const a = teselaMuro({ ancho: ANCHO, alto: ALTO, semilla: 1 });
  const b = teselaMuro({ ancho: ANCHO, alto: ALTO, semilla: 2 });
  const c = teselaMuro({ ancho: ANCHO, alto: ALTO, semilla: 1 });
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, c, "misma semilla, misma imagen: la mesa entera ve lo mismo");
});

test("la textura es consumible por el rasterizador y no tiene huecos", () => {
  // Un téxel transparente en mitad de una pared sería un agujero al vacío.
  const textura = texturaMuro({ ancho: ANCHO, alto: ALTO });
  assert.ok(texturaUtilizable(textura));
  assert.ok([...textura.indices].every((i) => i < textura.paleta.length));
});

test("cabe de sobra en una paleta indexada", () => {
  assert.ok(texturaMuro({ ancho: ANCHO, alto: ALTO }).paleta.length <= 16);
});

/* ---- en la sala ------------------------------------------------------------ */

const MEDIDAS = medidasSala(SALAS_PHOBOS[0]);

function componer(pielMuro, opciones = {}) {
  const sala = crearSalaCaja({ ...MEDIDAS, puertas: [], mobiliario: [], pielMuro });
  return sala.componer(MEDIDAS.ancho / 2, 0, MEDIDAS.profundidad / 2 - 2, 0.35, {
    ancho: 640,
    alto: 400,
    ...opciones,
  });
}

test("de serie el muro va texturado (#458: la decisión de arte ya se tomó)", () => {
  // Cambia el aspecto de las trece salas del Phobos a la vez, y ya no es una
  // decisión aparte: `pielMuro: "textura"` es el valor por defecto desde #458.
  // `"geometria"` sigue disponible como opción explícita para quien la pida.
  const sala = crearSalaCaja({ ...MEDIDAS, puertas: [], mobiliario: [] });
  const escena = sala.componer(MEDIDAS.ancho / 2, 0, MEDIDAS.profundidad / 2 - 2, 0.35, {
    ancho: 640,
    alto: 400,
  });
  assert.ok(escena.poligonos.some((p) => p.textura), "el muro tiene que llegar texturado sin pedir nada");
});

test("pedir geometría explícitamente sigue funcionando: sin texturas", () => {
  const escena = componer("geometria");
  assert.equal(escena.poligonos.filter((p) => p.textura).length, 0);
});

test("texturada, el muro llega al cuadro", () => {
  const texturados = componer("textura").poligonos.filter((p) => p.textura);
  assert.ok(texturados.length > 0, "el paño tiene que verse");
  assert.ok(texturados.every((p) => p.puntos.every((q) => Number.isFinite(q.u))));
});

test("el paño mira hacia la sala, no hacia dentro del muro", () => {
  // Con la normal al revés el motor lo descarta por dar la espalda y el muro
  // simplemente NO APARECE — sin error en ningún sitio, que es lo que hace que
  // cueste encontrarlo. Pasó, y esta prueba es para que no vuelva a pasar.
  assert.ok(componer("textura").poligonos.some((p) => p.textura), "se ve desde dentro");
});

test("texturar quita la mayor parte de la geometría de una sala", () => {
  // El número que resolvió #584: la piel del muro era casi toda la sala.
  //
  // SE DESCUENTA EL HAZ. Desde que las luminarias dibujan su cono y su polvo,
  // la escena tiene un suelo fijo de polígonos que NINGÚN modo de piel quita
  // —van con la lámpara, no con el muro— y que se cuela igual en los dos
  // lados de la división. Contarlos hacía que la rebaja pareciera empeorar de
  // 0,228 a 0,283 sin que la piel hubiera cambiado ni un polígono: descontados,
  // los dos modos dan exactamente los mismos 413 y 94 que antes de que
  // existiera el haz.
  //
  // El descuento se DERIVA de `alpha` y no se escribe como número, que es lo
  // que hace que siga valiendo: al repartir el polvo por el haz (aceptación
  // visual de #556) las motas pasaron de 5 a 10 por luminaria y la cuenta fija
  // cambió sola, sin tocar esta prueba.
  //
  // Se distinguen por `alpha`: el haz y las motas son lo único traslúcido de
  // una sala. Si algún día lo es algo más, este filtro deja de valer y hay que
  // marcar el haz explícitamente.
  const sinHaz = (piel) => {
    const poligonos = componer(piel).poligonos;
    return poligonos.length - poligonos.filter((p) => Number.isFinite(p.alpha)).length;
  };
  const geo = sinHaz("geometria");
  const tex = sinHaz("textura");
  assert.ok(tex < geo / 4, `de ${geo} a ${tex} no es la rebaja que se esperaba`);
});

test("la tesela se genera una vez por semilla, no una por sala", () => {
  // Trece salas comparten semilla: sin caché se generaría la misma imagen trece
  // veces en cada carga.
  const a = componer("textura").poligonos.find((p) => p.textura).textura;
  const b = componer("textura").poligonos.find((p) => p.textura).textura;
  assert.equal(a, b, "tiene que ser el MISMO objeto, no una copia igual");
});

/* ---- subdivisión para la luz (#584, opción B) ------------------------------ */

test("el paño no es un solo cuadro: hay varias alturas de suelo distintas", () => {
  // Es la propiedad que distingue la opción B de la A: si todo el paño fuera un
  // único cuadrilátero, todos sus polígonos compartirían el mismo par de alturas
  // (el suelo y `ALTURA`) y `intensidadCara` (#556) los trataría como una sola
  // superficie con un único centroide — la luz de punto no tendría dónde
  // interpolar.
  const texturados = componer("textura").poligonos.filter((p) => p.textura);
  const alturasDeSuelo = new Set(
    texturados.map((p) => Math.min(...p.puntos.map((q) => q.y)).toFixed(3)),
  );
  assert.ok(
    alturasDeSuelo.size >= Math.round(ALTURA / SUBDIVISION_PANO_METROS) - 1,
    `se esperaban varias filas de subdivisión, hay ${alturasDeSuelo.size}: ${[...alturasDeSuelo]}`,
  );
});

test("la subdivisión sigue muy por debajo del presupuesto de geometría", () => {
  // La rejilla gruesa de la opción B tiene más cuadros que un único paño por
  // cara, pero el punto de #584 —la rebaja de polígonos— no puede deshacerse
  // por el camino: sigue siendo un puñado de cuadros, no cientos de chapas.
  const geo = componer("geometria").poligonos.length;
  const tex = componer("textura").poligonos.length;
  assert.ok(tex < geo / 2, `de ${geo} a ${tex} se ha comido la rebaja de #584`);
});

test("un foco cercano aclara unos cuadros del paño más que otros", () => {
  // Esta es la prueba de fuego de la opción B: si el paño fuera un único
  // cuadrilátero (opción A), TODOS sus polígonos comparten centroide y un foco
  // cercano los aclararía exactamente igual — una sola intensidad para todo
  // el muro. Con la subdivisión, cada cuadro tiene su propio centroide y el
  // foco tiene que dejar unos más claros que otros.
  const sala = crearSalaCaja({ ...MEDIDAS, puertas: [], mobiliario: [], pielMuro: "textura" });
  const x = MEDIDAS.ancho / 2;
  const z = MEDIDAS.profundidad / 2 - 2;
  const escena = sala.componer(x, 0, z, 0.35, {
    ancho: 640,
    alto: 400,
    // Pegado a la esquina del muro del fondo que SÍ entra en el campo de
    // visión de esta cámara (el otro extremo del muro de 22 m queda fuera del
    // cono de 62°, y un foco ahí no se distinguiría de uno apagado — no
    // porque la subdivisión no funcione, sino porque nada de ese trozo se
    // pinta este fotograma).
    focos: [{ posicion: [MEDIDAS.ancho - 1, 1.8, MEDIDAS.profundidad - 0.3], potencia: 3, alcance: 8 }],
  });
  const intensidades = escena.poligonos.filter((p) => p.textura).map((p) => p.intensidad);
  assert.ok(intensidades.length > 1, "hacen falta varios cuadros para que la prueba diga algo");
  const min = Math.min(...intensidades);
  const max = Math.max(...intensidades);
  assert.ok(max - min > 0.05, `intensidades demasiado uniformes: min=${min} max=${max}`);
});

/* ---- las luminarias iluminan, pero no se comen el presupuesto de focos ----- */

test("un foco declarado por la escena sobrevive a las luminarias de la sala", () => {
  // LA TRAMPA QUE ESTO VIGILA. Desde que las luminarias son focos de verdad,
  // una sala declara hasta 36 —una cada 4 m—, y el motor se queda con los
  // `TOPE_FOCOS` (4) más CERCANOS al observador. Como las luminarias cuelgan
  // del techo de la propia sala, SIEMPRE hay cuatro más cerca que cualquier
  // foco que declare la escena: medido en la primera sala del Phobos, las
  // cuatro elegidas estaban a 2,5 y 4,3 m, y el foco declarado —potencia 3, a
  // 12 m— se caía de la lista sin que nada avisara.
  //
  // El síntoma no es un error: es que `focos` (#556) deja de hacer NADA en
  // cualquier sala iluminada. La escena pide una luz, el módulo la acepta, y
  // no se ve. Por eso `nave-sala-caja` reserva el presupuesto para la escena
  // primero y rellena el resto con luminarias, y por eso se prueba aquí en vez
  // de confiar en el comentario.
  const conFoco = componer("textura", {
    focos: [{ posicion: [MEDIDAS.ancho - 1, 1.8, MEDIDAS.profundidad - 0.3], potencia: 3, alcance: 8 }],
  });
  const sinFoco = componer("textura");
  const niveles = (escena) =>
    new Set(escena.poligonos.filter((p) => p.textura).map((p) => p.intensidad));

  assert.ok(
    niveles(conFoco).size > niveles(sinFoco).size,
    "el foco de la escena no cambia nada: se lo han comido las luminarias",
  );
});

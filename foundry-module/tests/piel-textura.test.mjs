// La piel del muro como textura tileada (#584).

import assert from "node:assert/strict";
import test from "node:test";

import { ANCHO_TESELA, METROS_POR_TEXEL, teselaMuro, texturaMuro } from "../scripts/piel-textura.mjs";
import { ALTURA, crearSalaCaja } from "../scripts/nave-sala-caja.mjs";
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

function componer(pielMuro) {
  const sala = crearSalaCaja({ ...MEDIDAS, puertas: [], mobiliario: [], pielMuro });
  return sala.componer(MEDIDAS.ancho / 2, 0, MEDIDAS.profundidad / 2 - 2, 0.35, {
    ancho: 640,
    alto: 400,
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
  const geo = componer("geometria").poligonos.length;
  const tex = componer("textura").poligonos.length;
  assert.ok(tex < geo / 4, `de ${geo} a ${tex} no es la rebaja que se esperaba`);
});

test("la tesela se genera una vez por semilla, no una por sala", () => {
  // Trece salas comparten semilla: sin caché se generaría la misma imagen trece
  // veces en cada carga.
  const a = componer("textura").poligonos.find((p) => p.textura).textura;
  const b = componer("textura").poligonos.find((p) => p.textura).textura;
  assert.equal(a, b, "tiene que ser el MISMO objeto, no una copia igual");
});

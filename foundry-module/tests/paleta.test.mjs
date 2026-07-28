import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { FACCIONES, LENGUAJES, PIXEL, TINTA, canales, contraste, lenguajePara, luminancia } from "../scripts/paleta.mjs";
import { TINTA as TINTA_LAMINAS } from "../scripts/laminas-clasicas.mjs";
import { PALETA } from "../scripts/minijuegos/cartas-pixelart.mjs";
import { COLOR_JUGADOR, COLOR_NEUTRO, PALETA_FACCIONES } from "../scripts/ventana-nave.mjs";

// Módulos de arte que deben tomar sus colores de la paleta común. `paleta.mjs`
// queda fuera por definición: es donde viven.
//
// `decorado-fondo.mjs` y `mapa-render.mjs` NO están todavía: sus colores son
// catálogos de contenido (tipos de planeta, nebulosas) y tonos de lienzo, y
// decidir si eso es paleta compartida o dato de decorado es una discusión de
// diseño, no una mudanza mecánica. Queda anotado en #351 para no perderlo.
const MODULOS_DE_ARTE = [
  "../scripts/laminas-clasicas.mjs",
  "../scripts/nave-sprite.mjs",
  "../scripts/minijuegos/cartas-pixelart.mjs",
  "../scripts/ventana-nave.mjs",
  "../scripts/iconos-sistema.mjs",
];

test("los colores no cambian al mudarse: mismo valor que antes en cada módulo", () => {
  // Esta es la garantía de que la refactorización es invisible en pantalla.
  assert.equal(TINTA_LAMINAS, TINTA, "laminas-clasicas debe reexportar la tinta común");
  assert.equal(TINTA.linea, "#c9b48a");
  assert.equal(TINTA.papel, "#0b0f18");
  assert.equal(PALETA.cara, "#f4e8c8");
  assert.equal(PALETA.negro, "#1c1a2e");
  assert.equal(PALETA.rojo, "#b3212a");
  assert.equal(PIXEL.cabina, "#fdfffc");
  assert.equal(PIXEL.motor, "#ffb703");
  assert.equal(COLOR_JUGADOR, "#fdfffc");
  assert.equal(COLOR_NEUTRO, "#7d8597");
  assert.deepEqual(PALETA_FACCIONES, FACCIONES);
  assert.equal(PALETA_FACCIONES.length, 8, "el hash reparte sobre ocho colores");
  assert.equal(PALETA_FACCIONES[2], "#ffb703");
});

test("la nave propia del mapa y la cabina del sprite son el mismo crema", () => {
  // No es coincidencia y por eso no se escribe dos veces: el comentario que
  // acompañaba a `COLOR_JUGADOR` ya decía «como la nave propia del mapa», pero
  // nada impedía que uno de los dos derivase.
  assert.equal(COLOR_JUGADOR, PIXEL.cabina);
  assert.equal(PALETA_FACCIONES[2], PIXEL.motor, "el ámbar de facción es el de propulsión");
});

test("ningún módulo de arte esconde un color propio", async () => {
  // La parte EXIGIBLE de la frontera. Sin esto, la regla es prosa y el cuarto
  // módulo vuelve a inventarse su propio sepia sin que nadie se entere.
  for (const ruta of MODULOS_DE_ARTE) {
    const fuente = await readFile(new URL(ruta, import.meta.url), "utf8");
    const sinComentarios = fuente
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // Se buscan literales de color en cadena; las siluetas usan '#' como píxel
    // dentro de cadenas, así que solo cuenta un hexadecimal completo. Cuentan
    // las tres comillas y también las notaciones funcionales: si la guardia
    // solo mirase `"#rrggbb"`, bastaría un apóstrofo o un `rgba()` para
    // saltársela sin querer, y el módulo no tiene linter que fuerce el estilo.
    const literales = [
      ...(sinComentarios.match(/["'`]#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})["'`]/g) ?? []),
      ...(sinComentarios.match(/\b(?:rgba?|hsla?)\(\s*\d/g) ?? []),
    ];
    assert.deepEqual(literales, [], `${ruta} declara colores propios: ${literales.join(", ")}`);
  }
});

test("la frontera se decide por una pregunta, no por una lista de superficies", () => {
  assert.equal(lenguajePara(true), "pixel");
  assert.equal(lenguajePara(false), "grabado");
  for (const lenguaje of [lenguajePara(true), lenguajePara(false)]) {
    assert.ok(LENGUAJES.includes(lenguaje));
  }
});

test("la luminancia pesa los canales como el ojo, no como un promedio", () => {
  // Si fuese un promedio, verde y azul puros darían lo mismo. No lo dan, y esa
  // diferencia es la que evita aprobar combinaciones ilegibles.
  assert.ok(luminancia("#00ff00") > luminancia("#0000ff"));
  assert.equal(Math.round(luminancia("#ffffff") * 1000) / 1000, 1);
  assert.equal(luminancia("#000000"), 0);
});

test("el contraste va de 1 a 21 y tolera formas cortas", () => {
  assert.equal(Math.round(contraste("#000000", "#ffffff")), 21);
  assert.equal(contraste("#123456", "#123456"), 1);
  assert.equal(contraste("#fff", "#ffffff"), 1, "la forma de tres dígitos es la misma");
});

test("lo que no es un color hexadecimal se dice, no se adivina", () => {
  for (const basura of [null, undefined, 7, "", "rojo", "#12", "#12345", "#gggggg", "rgba(1,2,3,0.5)"]) {
    assert.equal(canales(basura), null, `${basura} no debería interpretarse`);
    assert.equal(contraste(basura, "#000000"), null);
  }
  // `lineaSuave` es rgba a propósito (velo del grabado), así que no se puede
  // medir con esta función y hay que saberlo en vez de recibir un número falso.
  assert.equal(contraste(TINTA.lineaSuave, TINTA.papel), null);
});

test("cada par que porta información llega al mínimo de WCAG", () => {
  // 4.5:1 para lo que se lee como texto (los índices de las cartas son texto
  // aunque estén dibujados píxel a píxel).
  const texto = [
    ["índice negro sobre cara", PALETA.negro, PALETA.cara],
    ["índice rojo sobre cara", PALETA.rojo, PALETA.cara],
    ["tinta sobre papel", TINTA.linea, TINTA.papel],
    ["realce sobre papel", TINTA.realce, TINTA.papel],
  ];
  for (const [nombre, frente, fondo] of texto) {
    const razon = contraste(frente, fondo);
    assert.ok(razon >= 4.5, `${nombre}: ${razon.toFixed(2)} < 4.5`);
  }

  // 3:1 para elementos gráficos que portan información (WCAG 1.4.11).
  const graficos = [
    ["d20 del dorso", PIXEL.dorsoMotivo, PIXEL.dorsoFondo],
    ["estrellas del dorso", PIXEL.dorsoEstrella, PIXEL.dorsoFondo],
    ["cabina sobre papel", PIXEL.cabina, TINTA.papel],
    ["motor sobre papel", PIXEL.motor, TINTA.papel],
  ];
  for (const [nombre, frente, fondo] of graficos) {
    const razon = contraste(frente, fondo);
    assert.ok(razon >= 3, `${nombre}: ${razon.toFixed(2)} < 3`);
  }
});

test("déficit conocido: el motor apagado no llega a 3:1 sobre el papel", () => {
  // Hallazgo de este issue, no un fallo que se tape. `motorApagado` señala
  // «sin propulsión», así que porta información, y sobre el papel oscuro da
  // 2.63:1 — por debajo del 3:1 de WCAG 1.4.11.
  //
  // NO se corrige aquí a propósito: el contrato de #351 es reunir la paleta con
  // diff visual nulo, y cambiar el tono sería colar un cambio de arte en una
  // refactorización. Se fija el valor medido para que el arreglo sea deliberado
  // y no accidental, y se hace en #353, cuyo objeto es justo que el estado no
  // viaje solo en el color.
  //
  // Mientras tanto el estado sigue siendo distinguible por otra vía: la estela
  // aparece o no aparece, que es forma y no tono.
  const razon = contraste(PIXEL.motorApagado, TINTA.papel);
  assert.ok(razon < 3, "si ya cumple, quita esta prueba y añade el par a la lista de arriba");
  assert.equal(razon.toFixed(2), "2.63");
  // Y encendido frente a apagado sí se distinguen bien entre sí.
  assert.ok(contraste(PIXEL.motor, PIXEL.motorApagado) >= 3);
});

test("las paletas son inmutables: nadie retoca un color en caliente", () => {
  assert.throws(() => {
    TINTA.papel = "#ff0000";
  });
  assert.throws(() => {
    PIXEL.motor = "#ff0000";
  });
});

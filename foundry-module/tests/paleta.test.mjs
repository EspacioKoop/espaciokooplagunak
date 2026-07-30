import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { FACCIONES, FICHA, LENGUAJES, PIXEL, TINTA, canales, contraste, lenguajePara, luminancia } from "../scripts/paleta.mjs";
import { TINTA as TINTA_LAMINAS } from "../scripts/laminas-clasicas.mjs";
import { PALETA } from "../scripts/minijuegos/cartas-pixelart.mjs";
import { DENOMINACIONES } from "../scripts/minijuegos/fichas-pixelart.mjs";
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
  "../scripts/minijuegos/fichas-pixelart.mjs",
  "../scripts/ventana-nave.mjs",
  "../scripts/iconos-sistema.mjs",
  "../scripts/retrato-tripulante.mjs",
  // El 3D retro (#362) tampoco declara color propio: recibe el base y solo lo
  // sombrea. Entra en la guardia desde el primer día para que la nave nueva no
  // pueda colar su verde cuando ya nadie recuerde la regla.
  "../scripts/retro3d.mjs",
  // Y el fondo estelar (#384) tampoco: el azul del cielo sale de `PIXEL`, donde
  // se ve al lado del crema de la nave propia y se puede decidir que no compitan.
  "../scripts/retro3d-estrellas.mjs",
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
    // Estaba por debajo (2,63:1) y #351 lo dejó fijado a propósito para que el
    // arreglo fuese deliberado. Se corrige aquí, que es donde toca: #353 existe
    // justo para que el estado no viaje solo en el color.
    ["motor apagado sobre papel", PIXEL.motorApagado, TINTA.papel],
  ];
  for (const [nombre, frente, fondo] of graficos) {
    const razon = contraste(frente, fondo);
    assert.ok(razon >= 3, `${nombre}: ${razon.toFixed(2)} < 3`);
  }
});

test("el motor apagado se distingue del encendido, no solo del fondo", () => {
  // El par cumple dos mínimos a la vez y por eso tiene prueba propia: subirlo
  // sobre el papel es fácil, pero un ámbar más claro se acerca al motor
  // encendido y entonces se pierde justo la distinción que porta la
  // información. La ventana que cumple ambos es estrecha.
  assert.ok(contraste(PIXEL.motor, PIXEL.motorApagado) >= 3);
  // Y el estado sigue teniendo además un canal no cromático: la estela aparece
  // o no aparece, que es forma y no tono.
});

test("las paletas son inmutables: nadie retoca un color en caliente", () => {
  assert.throws(() => {
    TINTA.papel = "#ff0000";
  });
  assert.throws(() => {
    PIXEL.motor = "#ff0000";
  });
});

test("la ficha se ve sobre el fieltro aunque su color no llegue", () => {
  // Los tonos de denominación NO llegan a 3:1 contra el tapete —el rojo se
  // queda en 1,84— y eso está aceptado: la silueta la porta el canto crema, no
  // el valor. Lo que sí es exigible es que el canto se despegue del fieltro y
  // que cada denominación se despegue de la cara de su propia ficha, o el
  // dibujo se convierte en una mancha.
  const cantoSobreTapete = contraste(FICHA.canto, FICHA.tapete);
  assert.ok(cantoSobreTapete >= 3, `canto sobre tapete: ${cantoSobreTapete.toFixed(2)} < 3`);
  for (const { valor } of DENOMINACIONES) {
    const razon = contraste(FICHA.valores[valor], FICHA.canto);
    assert.ok(razon >= 3, `ficha de ${valor} sobre su cara: ${razon.toFixed(2)} < 3`);
  }
});

test("no hay dos denominaciones del mismo color", () => {
  // Serían indistinguibles para quien SÍ usa el color como atajo, que es para
  // lo que está.
  const colores = DENOMINACIONES.map(({ valor }) => FICHA.valores[valor]);
  assert.equal(new Set(colores).size, colores.length);
});

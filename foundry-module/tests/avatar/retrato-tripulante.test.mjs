import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LADO,
  retratoTripulante,
  retratoTripulanteSvg,
  retratoTripulanteDataUri,
} from "../../scripts/avatar/retrato-tripulante.mjs";
import { RETRATO, TINTA, contraste } from "../../scripts/paleta.mjs";

const raiz = new URL("../../", import.meta.url);
const read = (ruta) => readFileSync(new URL(ruta, raiz), "utf8");

test("el retrato es determinista por semilla: misma cara en todos los clientes", () => {
  // Es lo que permite no sincronizar ni un byte: cada cliente lo dibuja igual.
  assert.equal(retratoTripulanteSvg("usuario-1"), retratoTripulanteSvg("usuario-1"));
  assert.notEqual(retratoTripulanteSvg("usuario-1"), retratoTripulanteSvg("usuario-2"));
});

test("la semilla es el id, así que renombrar no cambia la cara", () => {
  // El retrato se pide con `user.id`; el nombre no entra en ningún sitio. La
  // contrapartida, aceptada en #352: reinvitar a alguien sí le cambia la cara,
  // porque Foundry le da un id nuevo.
  const antes = retratoTripulanteSvg("aBcD1234");
  const despues = retratoTripulanteSvg("aBcD1234");
  assert.equal(antes, despues);
});

test("desconectado es gris, y gris de verdad: ni un canal de color", () => {
  const svg = retratoTripulanteSvg("mesa", { activo: false });
  for (const [, color] of svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)) {
    const [r, g, b] = [1, 3, 5].map((i) => color.slice(i, i + 2));
    assert.equal(r, g, `${color} no es gris`);
    assert.equal(g, b, `${color} no es gris`);
  }
  // Y en línea sí tiene color, o el estado no se distinguiría.
  const vivo = retratoTripulanteSvg("mesa", { activo: true });
  assert.notEqual(vivo, svg);
});

test("la silueta se recorta contra el papel del panel", () => {
  // El retrato es decorativo (aria-hidden, el texto lleva la información), así
  // que WCAG 1.4.11 no le obliga. Pero si el casco no se separa del fondo no
  // sirve de ancla visual para nadie, que es su única razón de existir.
  for (const casco of RETRATO.cascos) {
    const razon = contraste(casco, TINTA.papel);
    assert.ok(razon >= 3, `casco ${casco}: ${razon.toFixed(2)} < 3 sobre el papel`);
  }
});

test("el visor se lee sobre el casco: cristal oscuro, no brillante", () => {
  // El primer intento fueron visores luminosos: 1.15:1 contra el casco, o sea
  // invisibles justo en el rasgo que más se mira.
  for (const casco of RETRATO.cascos) {
    for (const visor of RETRATO.visores) {
      const razon = contraste(casco, visor);
      assert.ok(razon >= 3, `visor ${visor} sobre casco ${casco}: ${razon.toFixed(2)} < 3`);
    }
  }
});

test("el SVG es autosuficiente: sin red, sin imágenes, sin fuentes", () => {
  const svg = retratoTripulanteSvg("s");
  assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/);
  assert.doesNotMatch(svg, /<image/);
  assert.doesNotMatch(svg, /url\(/);
  assert.doesNotMatch(svg, /<text/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, new RegExp(`viewBox="0 0 ${LADO} ${LADO}"`));
});

test("el retrato se declara decorativo, porque el texto es la verdad", () => {
  // El puesto y el estado van en texto en la misma fila. Si el retrato se
  // anunciara a un lector de pantalla, repetiría esa información en una forma
  // que además NO es autoridad ni permiso (#237).
  assert.match(retratoTripulanteSvg("s"), /aria-hidden="true"/);
});

test("una semilla hostil no inyecta marcado", () => {
  const svg = retratoTripulanteSvg('"><script>alert(1)</script>');
  assert.doesNotMatch(svg, /<script/i);
  // La semilla no llega al documento en absoluto: solo elige rasgos.
  assert.doesNotMatch(svg, /alert/);
});

test("el data URI se puede meter en un src tal cual", () => {
  const uri = retratoTripulanteDataUri("s");
  assert.match(uri, /^data:image\/svg\+xml,/);
  const svg = decodeURIComponent(uri.slice("data:image/svg+xml,".length));
  assert.match(svg, /^<svg /);
});

test("hay variedad real: las semillas no caen todas en el mismo retrato", () => {
  const vistos = new Set();
  for (let i = 0; i < 200; i += 1) vistos.add(retratoTripulanteSvg(`u${i}`));
  // 3 cascos x 3 visores x 5 tonos x 3 cristales x 4 acentos: de sobra para que
  // una mesa de seis no repita cara. Se comprueba que el sorteo no está sesgado
  // a un puñado de combinaciones.
  assert.ok(vistos.size > 40, `solo ${vistos.size} retratos distintos en 200 semillas`);
});

test("basura por semilla u opciones no rompe el retrato", () => {
  for (const semilla of [null, undefined, 0, "", 42, {}]) {
    const svg = retratoTripulanteSvg(semilla);
    assert.match(svg, /^<svg /);
    assert.doesNotMatch(svg, /NaN|undefined/);
  }
  const modelo = retratoTripulante("s", { activo: "sí" });
  assert.equal(modelo.activo, true, "cualquier valor con verdad cuenta como en línea");
  assert.equal(retratoTripulante("s", {}).filas.length, LADO);
});

test("el tinte de alerta se pinta POR ENCIMA del retrato, no bajo la imagen", () => {
  // Un <img> es contenido reemplazado: una capa interior (inset shadow, fondo)
  // queda por debajo del SVG opaco de 32x32 y el tinte no se ve. Por eso el
  // retrato es un contenedor con la imagen dentro y el tinte va en un
  // pseudo-elemento superpuesto. Esta prueba fija esa estructura, que es de lo
  // que depende el efecto: la regla puede existir y no producir nada.
  const template = read("templates/espacio-puesto.hbs");
  const css = read("styles/espacios-puesto.css");

  // El contenedor lleva las clases de puesto; la imagen es una capa aparte.
  assert.match(
    template,
    /<span class="lagunak-workspace__crew-portrait \{\{#if station\}\}lagunak-workspace__crew-portrait--\{\{station\}\}\{\{\/if\}\}"/,
  );
  assert.match(template, /<img class="lagunak-workspace__crew-portrait-img"/);
  assert.doesNotMatch(
    template,
    /<img class="lagunak-workspace__crew-portrait[ "]/,
    "el tinte no puede colgar del propio <img>",
  );

  // El contenedor es el contexto de posicionamiento del tinte.
  assert.match(css, /\.lagunak-workspace__crew-portrait \{[^}]*position: relative;/);

  // Cada nivel de alerta tiñe por ::after, superpuesto y sin capturar el ratón.
  for (const nivel of ["amarilla", "roja"]) {
    assert.match(
      css,
      new RegExp(`body\\.lagunak-alerta-${nivel} \\.lagunak-workspace__crew-portrait::after`),
      `falta el tinte de alerta ${nivel} sobre el retrato`,
    );
  }
  const capa = css.match(
    /body\.lagunak-alerta-amarilla \.lagunak-workspace__crew-portrait::after,[\s\S]*?\{([^}]*)\}/,
  );
  assert.ok(capa, "la capa de tinte debe declararse una sola vez para ambos niveles");
  assert.match(capa[1], /position: absolute;/);
  assert.match(capa[1], /inset: 0;/);
  assert.match(capa[1], /pointer-events: none;/);

  // Y el mecanismo que NO funcionaba no puede volver a colarse.
  assert.doesNotMatch(css, /\.lagunak-workspace__crew-portrait \{[^}]*box-shadow: inset/);
});

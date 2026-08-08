import assert from "node:assert/strict";
import test from "node:test";

import { estiloMarcoMapa, marcoMapaDataUri } from "../scripts/mapa-marco.mjs";
import { cartografiaSvg, rosaDeLosVientos } from "../scripts/laminas-clasicas.mjs";
import { TINTA } from "../scripts/paleta.mjs";

/** El data URI vuelve a SVG para poder afirmar sobre el marcado, no sobre bytes. */
function svgDelMarco(opciones = {}) {
  const uri = marcoMapaDataUri(opciones);
  assert.ok(uri.startsWith("data:image/svg+xml,"), "el marco tiene que ser un data URI de SVG");
  return decodeURIComponent(uri.slice("data:image/svg+xml,".length));
}

/**
 * Quita el bloque `<defs>` antes de afirmar sobre lo dibujado.
 *
 * `cartografiaSvg` declara ahí los patrones de trama del grabado, que llevan
 * paths propios y NO se pintan salvo que algo los referencie. Sin esta poda, la
 * prueba de «no hay tics» pasaría o fallaría por el contenido de defs, que es
 * otra cosa.
 */
function svgDibujado(opciones = {}) {
  return svgDelMarco(opciones).replace(/<defs>[\s\S]*?<\/defs>/g, "");
}

test("el marco no dibuja tics de limbo: sobre el mapa serían una escala que nadie ha calculado", () => {
  const dibujado = svgDibujado({ ancho: 508, alto: 508 });
  // Fuera de defs, los únicos paths del registro de cartografía son los tics y
  // los brazos de la rosa; sin ninguno de los dos, no queda ni un path.
  assert.equal(dibujado.includes("<path"), false, "un path dibujado solo puede ser un tic o un brazo de rosa");
  // Y los patrones de trama siguen ahí, sin que nada los use: si algún día se
  // referencian, el marco pasaría a sombrear el interior y esto avisará.
  assert.equal(svgDelMarco({ ancho: 508, alto: 508 }).includes("url(#"), false, "nada referencia una trama");
});

test("el marco no dibuja la rosa de los vientos: sería una marcación inventada", () => {
  // Comparación estructural en vez de buscar una cadena: el marco con rosa
  // apagada tiene que ser MÁS CORTO que el mismo marco con rosa, y esa
  // diferencia es exactamente la que aporta el grupo de brazos.
  const sinRosa = cartografiaSvg({ ancho: 508, alto: 508, tics: false, rosa: false });
  const conRosa = cartografiaSvg({ ancho: 508, alto: 508, tics: false, rosa: true });
  assert.ok(conRosa.length > sinRosa.length, "la rosa tiene que aportar marcado");
  assert.equal(svgDelMarco({ ancho: 508, alto: 508 }), sinRosa);
  // Y la rosa que se está apagando existe de verdad: si algún día
  // `rosaDeLosVientos` devolviese vacío, esta prueba pasaría por el motivo
  // equivocado.
  assert.equal(rosaDeLosVientos(18).length, 8);
});

test("el interior queda hueco: el marco no puede tapar ni recolorear el mapa", () => {
  const svg = svgDelMarco({ ancho: 508, alto: 508 });
  // Los dos filetes del encuadre son los únicos rects, y los dos van sin
  // relleno. Un `fill` que no sea "none" ahí dentro taparía el lienzo.
  const rects = svg.match(/<rect[^>]*>/g) ?? [];
  assert.equal(rects.length, 2, "solo el doble filete");
  for (const rect of rects) {
    assert.ok(rect.includes('fill="none"'), `un filete con relleno taparía el mapa: ${rect}`);
  }
});

test("va aria-hidden: un lector de pantalla no gana nada anunciando un filete", () => {
  assert.ok(svgDelMarco().includes('aria-hidden="true"'));
});

test("no declara ni un color propio: la tinta sale de paleta.mjs (#351)", () => {
  const svg = svgDelMarco({ ancho: 508, alto: 508, titulo: "EKL-01" });
  const colores = new Set((svg.match(/(?:stroke|fill)="(#[0-9a-fA-F]{3,8})"/g) ?? [])
    .map((coincidencia) => coincidencia.match(/"(#[^"]+)"/)[1]));
  const permitidos = new Set(Object.values(TINTA).filter((valor) => typeof valor === "string"));
  for (const color of colores) {
    assert.ok(permitidos.has(color), `${color} no está en TINTA: el arte no declara color propio`);
  }
});

test("el título viaja escapado: un distintivo con marcado no puede inyectar SVG", () => {
  const svg = svgDelMarco({ titulo: '<script>alert(1)</script>' });
  assert.equal(svg.includes("<script"), false);
  assert.ok(svg.includes("&lt;script&gt;"));
});

test("el estilo en línea es lo único que toca la ventana, y no repite el fondo", () => {
  const estilo = estiloMarcoMapa({ ancho: 508, alto: 508 });
  assert.ok(estilo.includes("background-image:url(\"data:image/svg+xml,"));
  assert.ok(estilo.includes("background-size:100% 100%"));
  assert.ok(estilo.includes("background-repeat:no-repeat"), "sin esto un redondeo azulejaría el marco");
});

test("un título vacío no deja una cartela vacía flotando", () => {
  const svg = svgDelMarco({ ancho: 508, alto: 508 });
  assert.equal(svg.includes("<text"), false, "sin título no hay cartela");
});

test("las opciones de tics y rosa siguen ENCENDIDAS por defecto para el resto del módulo", () => {
  // El registro completo de Hevelius es el comportamiento de serie: apagarlos es
  // una decisión del marco del mapa, no un cambio de la lámina para todos.
  const completo = cartografiaSvg({ ancho: 200, alto: 200 });
  assert.ok(completo.includes("<path"), "la lámina de serie sigue con tics y rosa");
});

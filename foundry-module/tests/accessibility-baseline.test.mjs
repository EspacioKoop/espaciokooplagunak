import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(hex) {
  const channels = rgb(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

test("el mapa expone selección y alternativa textual sin depender del color", () => {
  const template = read("templates/consola-caliente.hbs");
  assert.match(template, /class="lagunak-mapa-contacto[^\n]+aria-pressed="\{\{this\.seleccionado\}\}"/);
  assert.match(template, /<canvas[^>]+role="img"[^>]+aria-label=/s);
  assert.match(template, /<ul class="lagunak-mapa-leyenda">/);
  for (const swatch of template.matchAll(/<span class="lagunak-mapa-color"[^>]*>/g)) {
    assert.match(swatch[0], /aria-hidden="true"/);
  }
});

// El selector de previsualización GM vivía en espacio-puesto.hbs (pestañas
// `is-selected`/`aria-pressed`); #276 paso 4 lo migró a la pestaña
// "Previsualización" de la consola caliente, que sigue el mismo patrón.
test("consola caliente: las pestañas de previsualización GM exponen selección sin depender solo del color", () => {
  const template = read("templates/consola-caliente.hbs");
  assert.match(
    template,
    /<button type="button" class="\{\{#if activo\}\}is-selected\{\{\/if\}\}" aria-pressed="\{\{activo\}\}" data-lagunak-previsualizacion-estacion="\{\{id\}\}">/,
  );
  assert.match(template, /<nav class="lagunak-previsualizacion-estaciones" aria-label=/);
});

test("los iconos decorativos del formulario de token no contaminan su nombre", () => {
  const template = read("templates/token-puente.hbs");
  for (const icon of template.matchAll(/<i class="fa-solid[^>]*>/g)) {
    assert.match(icon[0], /aria-hidden="true"/);
  }
  assert.match(template, /<label for="lagunak-bridge-token">/);
  assert.match(template, /<input id="lagunak-bridge-token"[\s\S]+type="password"/);
});

test("todos los controles propios tienen foco explícito de dos píxeles", () => {
  const consoleCss = read("styles/lagunak-consola.css");
  const workspaceCss = read("styles/espacios-puesto.css");
  for (const selector of [
    ".lagunak-estado-cuerpo button:focus-visible",
    ".lagunak-estado-cuerpo select:focus-visible",
    ".lagunak-puestos__contenido select:focus-visible",
    ".lagunak-token-form input:focus-visible",
    ".lagunak-token-form button:focus-visible",
    ".lagunak-mapa-contacto:focus-visible",
    ".lagunak-ayuda summary:focus-visible",
  ]) assert.ok(consoleCss.includes(selector), `falta foco: ${selector}`);
  assert.ok(workspaceCss.includes(".lagunak-workspace button:focus-visible"));
  assert.match(consoleCss, /outline:\s*2px solid var\(--lagunak-accent\)/);
  assert.match(workspaceCss, /outline:\s*2px solid var\(--lagunak-accent\)/);
});

test("el orden de estilos y reduced-motion cubren la regla legacy animada", () => {
  const manifest = JSON.parse(read("module.json"));
  assert.ok(manifest.styles.indexOf("styles/lagunak-consola.css") > manifest.styles.indexOf("styles/lagunak.css"));
  const consoleCss = read("styles/lagunak-consola.css");
  const workspaceCss = read("styles/espacios-puesto.css");
  assert.match(consoleCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]+\.lagunak-mapa-cuerpo \*[\s\S]+animation: none !important/);
  assert.match(workspaceCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]+\.lagunak-workspace \*[\s\S]+animation: none !important/);
});

test("toda hoja de module.json con animación declara su bloque prefers-reduced-motion (#227)", () => {
  const manifest = JSON.parse(read("module.json"));
  // Garantía mínima por hoja: ninguna hoja animada puede omitir por completo
  // la alternativa reduced-motion. Las animaciones conocidas se atan además
  // a sus selectores concretos en regresiones focales como la siguiente.
  for (const hoja of manifest.styles) {
    const css = read(hoja);
    const anima = /@keyframes\b/.test(css) || /\banimation:/.test(css);
    if (!anima) continue;
    assert.match(
      css,
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none\s*!important/,
      `${hoja} anima pero no neutraliza el movimiento bajo prefers-reduced-motion`,
    );
  }
});

test("lagunak.css neutraliza las dos transiciones de pausa bajo reduced-motion (#227)", () => {
  const css = read("styles/lagunak.css");
  // Regresión recuperada tras la integración de #300 y el cierre sin merge de
  // su PR hija #303: ambos estados deben seguir en una única regla para que la
  // neutralización sea idéntica y ninguno pierda cobertura por separado.
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.lagunak-pausa-pausando \.lagunak-punto\s*,\s*\.lagunak-pausa-reanudando \.lagunak-punto\s*\{[^}]*animation:\s*none\s*!important/,
    "pausando y reanudando deben compartir la neutralización de movimiento",
  );
});

test("gestión de puestos: cada select de asignación tiene nombre accesible por label", () => {
  const template = read("templates/puestos-tripulacion.hbs");
  // El <label for> envuelve la fila y apunta al id del <select>: nombre
  // accesible ligado al control, no solo texto visual cercano.
  assert.match(template, /<label class="lagunak-puestos__fila" for="lagunak-station-\{\{id\}\}">/);
  assert.match(template, /<select id="lagunak-station-\{\{id\}\}"[^>]+data-station-user/);
});

test("espacio de puesto: región de conexión es aria-live y su pulso decorativo está oculto a lectores", () => {
  const template = read("templates/espacio-puesto.hbs");
  assert.match(template, /class="lagunak-workspace__connection[^"]*" role="status" aria-live="polite"/);
  assert.match(template, /<span class="lagunak-workspace__pulse" aria-hidden="true">/);
});

test("espacio de puesto: métricas con barra de progreso llevan role=meter con límites y nombre", () => {
  const template = read("templates/espacio-puesto.hbs");
  assert.match(template, /role="meter" aria-label="\{\{label\}\}: \{\{value\}\}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="\{\{progress\}\}"/);
});

test("espacio de puesto: todos los formularios de orden tienen input/select con label asociado por id", () => {
  const template = read("templates/espacio-puesto.hbs");
  for (const form of template.matchAll(/<form class="lagunak-workspace__orden"[\s\S]*?<\/form>/g)) {
    const cuerpo = form[0];
    const ids = [...cuerpo.matchAll(/<(?:input|select) id="([^"]+)"/g)].map((m) => m[1]);
    for (const id of ids) {
      assert.match(cuerpo, new RegExp(`<label for="${id}">`), `input/select sin label: ${id}`);
    }
  }
});

test("espacio de puesto: los iconos decorativos de acciones y estados no contaminan el nombre accesible", () => {
  const template = read("templates/espacio-puesto.hbs");
  // aria-hidden se hereda a los descendientes: un <i> vale si lo lleva él
  // mismo o si un ancestro directo (p. ej. el <span> que lo envuelve) ya lo
  // declara — no hace falta duplicarlo en cada nivel.
  for (const icon of template.matchAll(/(?:<span[^>]*aria-hidden="true"[^>]*>\s*)?<i class="fa-solid[^>]*>/g)) {
    assert.match(icon[0], /aria-hidden="true"/, `icono sin aria-hidden propio ni de ancestro directo: ${icon[0]}`);
  }
});

test("cantina: las puertas son botones nativos con nombre propio y lista etiquetada (#423)", () => {
  const template = read("templates/cantina.hbs");
  // Botón nativo, no un <div> con manejador: es lo que hace que Enter y
  // Espacio abran la mesa sin escribir una sola línea de teclado a mano.
  assert.match(template, /<button type="button" class="lagunak-cantina-puerta" data-puerta=/);
  // El icono es adorno; el nombre accesible lo pone el <span> con el título.
  for (const icon of template.matchAll(/<i class="\{\{this\.icono\}\}"[^>]*>/g)) {
    assert.match(icon[0], /aria-hidden="true"/);
  }
  assert.match(template, /<ul class="lagunak-cantina-puertas" aria-label=/);
});

test("cantina: el foco de sus puertas se ve, como en el resto de controles propios", () => {
  const css = read("styles/lagunak.css");
  assert.ok(css.includes(".lagunak-cantina-puerta:focus-visible"));
});

test("los colores de texto de consola cumplen contraste AA sobre sus fondos", () => {
  const css = read("styles/lagunak-consola.css");
  const token = (name) => {
    const match = css.match(new RegExp(`--lagunak-${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(match, `falta token CSS: ${name}`);
    return match[1];
  };
  const backgrounds = [token("bg"), token("panel")];
  const colors = ["text", "muted", "accent", "danger", "warning", "good"];
  for (const name of colors) {
    for (const background of backgrounds) {
      const ratio = contrast(token(name), background);
      assert.ok(ratio >= 4.5, `${name} sobre ${background} no alcanza 4.5:1: ${ratio.toFixed(2)}`);
    }
  }
});
test("los <select> del panel definen color/fondo propios: sus opciones abiertas no heredan el tema claro del navegador (#287)", () => {
  const css = read("styles/lagunak-consola.css");
  for (const selector of [
    ".lagunak-estado-cuerpo select",
    ".lagunak-puestos__contenido select",
    ".lagunak-estado-cuerpo select option",
    ".lagunak-puestos__contenido select option",
  ]) assert.ok(css.includes(selector), `falta color/fondo explícito: ${selector}`);
});

/**
 * Extrae los controles interactivos nativos (button/select/input/summary) de
 * una plantilla en orden de aparición en el DOM, con un identificador legible
 * por control (data-action/data-workspace-action/data-field/id/name). Sin
 * tabindex en ningún sitio del módulo (comprobado más abajo), el orden del
 * DOM ES el orden de tabulación: esto es exactamente lo que recorrería
 * teclado en cada superficie.
 */
function controlesInteractivos(html) {
  const controles = [];
  for (const match of html.matchAll(/<(button|select|input|summary)\b([^>]*)>/g)) {
    const [, tag, attrs] = match;
    const get = (name) => (attrs.match(new RegExp(`${name}="([^"]*)"`)) || [])[1];
    controles.push({
      tag,
      id: get("data-action") ?? get("data-workspace-action") ?? get("data-field") ?? get("id") ?? get("name") ?? tag,
      tieneTabindex: /\btabindex=/.test(attrs),
    });
  }
  return controles;
}

test("ninguna de las seis superficies fija tabindex: el orden del DOM es el orden de teclado", () => {
  for (const archivo of [
    "templates/consola-caliente.hbs",
    "templates/puestos-tripulacion.hbs",
    "templates/token-puente.hbs",
    "templates/espacio-puesto.hbs",
    "templates/cantina.hbs",
    "templates/seccion-nave.hbs",
  ]) {
    const controles = controlesInteractivos(read(archivo));
    for (const control of controles) {
      assert.ok(!control.tieneTabindex, `${archivo}: ${control.tag} "${control.id}" fija tabindex y rompe el orden natural`);
    }
  }
});

// La consola caliente (#276) fusionó estado+mapa+encuentros+previsualización
// en un único PARTS.main con {{#if}} por pestaña: el orden de teclado dentro
// de cada pestaña sigue siendo el que importa (nunca dos pestañas activas a la
// vez), pero como esta prueba solo regexea el HBS crudo -sin evaluar los
// condicionales- no puede afirmar un orden lineal único como hacían las
// cuatro ventanas sueltas. Lo que sí se sigue pudiendo fijar es que cada
// panel, tomado por separado, mantiene su propio orden interno.
test("consola caliente: la cabecera de tempo/maniobra precede a las pestañas", () => {
  const ids = controlesInteractivos(read("templates/consola-caliente.hbs")).map((c) => c.id);
  assert.deepEqual(ids.slice(0, 6), [
    "pausar",
    "reanudar",
    "ordenarImpulso",
    "ordenarWarp",
    "maniobra-rumbo",
    "ordenarRumbo",
  ]);
});

test("gestión de puestos: un select de asignación por fila, sin controles fuera de orden", () => {
  const controles = controlesInteractivos(read("templates/puestos-tripulacion.hbs"));
  assert.deepEqual(controles.map((c) => c.tag), ["select"]);
});

test("credencial del puente: campo de token antes que guardar/borrar", () => {
  const ids = controlesInteractivos(read("templates/token-puente.hbs")).map((c) => c.id);
  assert.deepEqual(ids, ["lagunak-bridge-token", "saveToken", "clearToken"]);
});

test("espacio de puesto: órdenes operativas y acciones de pie en ese orden", () => {
  const ids = controlesInteractivos(read("templates/espacio-puesto.hbs")).map((c) => c.id);
  assert.deepEqual(ids, [
    "lagunak-orden-rumbo",
    "orden-rumbo",
    "lagunak-orden-impulso",
    "orden-impulso",
    "lagunak-orden-warp",
    "orden-warp",
    "lagunak-orden-sistema",
    "lagunak-orden-nivel",
    "orden-potencia",
    "lagunak-orden-sistema-refrig",
    "lagunak-orden-nivel-refrig",
    "orden-refrigerante",
    "orden-escudos-subir",
    "orden-escudos-bajar",
    "orden-comms-contestar",
    "orden-comms-ignorar",
    "orden-comms-cerrar",
    "lagunak-orden-comms-opcion",
    "orden-comms-opcion",
    "lagunak-orden-comms-mensaje",
    "orden-comms-mensaje",
    "assignments",
    "refresh",
    "assignments",
  ]);
});

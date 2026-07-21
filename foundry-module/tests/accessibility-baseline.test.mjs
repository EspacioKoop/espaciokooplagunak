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
  const template = read("templates/mapa-vivo.hbs");
  assert.match(template, /class="lagunak-mapa-contacto[^\n]+aria-pressed="\{\{this\.seleccionado\}\}"/);
  assert.match(template, /<canvas[^>]+role="img"[^>]+aria-label=/s);
  assert.match(template, /<ul class="lagunak-mapa-leyenda">/);
  for (const swatch of template.matchAll(/<span class="lagunak-mapa-color"[^>]*>/g)) {
    assert.match(swatch[0], /aria-hidden="true"/);
  }
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

test("gestión de puestos: cada select de asignación tiene nombre accesible por label", () => {
  const template = read("templates/puestos-tripulacion.hbs");
  // El <label for> envuelve la fila y apunta al id del <select>: nombre
  // accesible ligado al control, no solo texto visual cercano.
  assert.match(template, /<label class="lagunak-puestos__fila" for="lagunak-station-\{\{id\}\}">/);
  assert.match(template, /<select id="lagunak-station-\{\{id\}\}"[^>]+data-station-user/);
});

test("espacio de puesto: pestañas de previsualización GM exponen selección sin depender solo del color", () => {
  const template = read("templates/espacio-puesto.hbs");
  // aria-pressed en el botón de pestaña: el estado seleccionado es semántico,
  // no solo la clase visual "is-selected".
  assert.match(template, /<button type="button" class="\{\{#if selected\}\}is-selected\{\{\/if\}\}" aria-pressed="\{\{selected\}\}"/);
  assert.match(template, /<nav class="lagunak-workspace__tabs" aria-label=/);
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

test("ninguna de las cinco superficies fija tabindex: el orden del DOM es el orden de teclado", () => {
  for (const archivo of [
    "templates/estado-nave.hbs",
    "templates/mapa-vivo.hbs",
    "templates/puestos-tripulacion.hbs",
    "templates/token-puente.hbs",
    "templates/espacio-puesto.hbs",
  ]) {
    const controles = controlesInteractivos(read(archivo));
    for (const control of controles) {
      assert.ok(!control.tieneTabindex, `${archivo}: ${control.tag} "${control.id}" fija tabindex y rompe el orden natural`);
    }
  }
});

test("estado de nave: el orden de teclado va de tempo a encuentros, ingeniería, maniobra y anotar", () => {
  const ids = controlesInteractivos(read("templates/estado-nave.hbs")).map((c) => c.id);
  assert.deepEqual(ids, [
    "pausar",
    "reanudar",
    "lagunak-encuentro-arquetipo",
    "lagunak-encuentro-rumbo",
    "encuentro",
    "summary",
    "ingenieria-sistema",
    "ingenieria-nivel",
    "ajustarIngenieria",
    "ordenarImpulso",
    "ordenarWarp",
    "maniobra-rumbo",
    "ordenarRumbo",
    "ordenarEscudos",
    "ordenarEscudos",
    "anotar",
  ]);
});

test("mapa vivo: la ayuda se alcanza antes que la lista de contactos", () => {
  const controles = controlesInteractivos(read("templates/mapa-vivo.hbs"));
  assert.deepEqual(controles.map((c) => c.tag), ["summary", "button"]);
});

test("gestión de puestos: un select de asignación por fila, sin controles fuera de orden", () => {
  const controles = controlesInteractivos(read("templates/puestos-tripulacion.hbs"));
  assert.deepEqual(controles.map((c) => c.tag), ["select"]);
});

test("credencial del puente: campo de token antes que guardar/borrar", () => {
  const ids = controlesInteractivos(read("templates/token-puente.hbs")).map((c) => c.id);
  assert.deepEqual(ids, ["lagunak-bridge-token", "saveToken", "clearToken"]);
});

test("espacio de puesto: pestañas GM, órdenes operativas y acciones de pie en ese orden", () => {
  const ids = controlesInteractivos(read("templates/espacio-puesto.hbs")).map((c) => c.id);
  assert.deepEqual(ids, [
    "preview",
    "lagunak-orden-rumbo",
    "orden-rumbo",
    "lagunak-orden-impulso",
    "orden-impulso",
    "lagunak-orden-warp",
    "orden-warp",
    "lagunak-orden-sistema",
    "lagunak-orden-nivel",
    "orden-potencia",
    "orden-escudos-subir",
    "orden-escudos-bajar",
    "assignments",
    "refresh",
    "assignments",
  ]);
});

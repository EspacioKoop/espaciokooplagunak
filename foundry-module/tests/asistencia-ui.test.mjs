import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";

// El arnés mínimo que la ventana necesita para existir fuera de Foundry. Se
// monta ANTES de importar el módulo porque `registrarAsistenciaUI` engancha
// hooks al registrarse.
const hooks = new Map();
globalThis.Hooks = {
  on: (nombre, fn) => hooks.set(nombre, fn),
  off: () => {},
  callAll: (nombre, carga) => hooks.get(nombre)?.(carga),
};
const flags = [];
globalThis.game = {
  user: { id: "yo", isGM: false, setFlag: (_m, _k, v) => flags.push(v) },
  users: { get: () => null, activeGM: null },
  i18n: { localize: (k) => k, format: (k, d) => `${k}:${JSON.stringify(d)}` },
};
globalThis.foundry = { utils: { randomID: () => "nonce-1" } };

const wiring = await import("../scripts/asistencia-wiring.mjs");
const ui = await import("../scripts/asistencia-ui.mjs");

wiring.registrarAsistencia("mod");
ui.registrarAsistenciaUI("mod");

test.beforeEach(() => {
  ui._reiniciarParaPruebas();
  flags.length = 0;
});

test("arranca en el menú, con las tareas de TODOS los puestos", () => {
  // Ayudar es cruzar de puesto por definición: filtrar por el propio dejaría la
  // lista vacía justo para quien más ganas tiene de echar una mano.
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.enMenu, true);
  assert.ok(contexto.tareas.length >= 3);
  const puestos = new Set(contexto.tareas.map((t) => t.puestoAsistido));
  assert.ok(puestos.size >= 3, "no se filtra por el puesto de quien mira");
});

test("una oferta con otro nonce se ignora: no se pinta la ayuda de otro", () => {
  // Las respuestas llegan por socket dirigido, pero una carga con nonce ajeno
  // no puede secuestrar la ventana.
  Hooks.callAll("lagunakAsistenciaOferta", { nonce: "de-otro", oferta: { via: "destreza", enfoques: [] } });
  assert.equal(ui.contextoAsistencia().enMenu, true, "seguimos en el menú");
});

/** Deja la ventana esperando respuesta, que es donde vive el nonce. */
function pidiendoAyuda() {
  const tareaId = ui.contextoAsistencia().tareas[0].id;
  ui.pedirDesdeVentana(tareaId);
  return "nonce-1";
}

test("un rechazo cierra con su motivo, y se puede volver al menú", () => {
  const nonce = pidiendoAyuda();
  Hooks.callAll("lagunakAsistenciaRechazo", { nonce, codigo: "presupuesto-agotado" });
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.cerrada, true);
  assert.equal(contexto.cierre.tipo, "rechazo");
  assert.equal(contexto.cierre.claveDetalle, "LAGUNAK.Asistencia.Error.presupuesto-agotado");
});

test("un resultado sin fruto NO se cuenta como error: es el juego funcionando", () => {
  const nonce = pidiendoAyuda();
  Hooks.callAll("lagunakAsistenciaResultado", { nonce, propuesta: { accion: null, banda: BANDAS.FALLO } });
  assert.equal(ui.contextoAsistencia().cierre.tipo, "sin-fruto");
});

test("un resultado con nonce ajeno no cierra la petición viva", () => {
  // Llega la respuesta tardía a algo que ya no está en curso. Cerrar por ella
  // mataría la petición SIGUIENTE, que no tiene nada que ver con esa.
  pidiendoAyuda();
  Hooks.callAll("lagunakAsistenciaResultado", { nonce: "de-otra", propuesta: { accion: null, banda: BANDAS.FALLO } });
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.cerrada, false);
  assert.equal(contexto.esperando, true, "se sigue esperando la respuesta propia");
});

test("con la ventana en el menú, una respuesta tardía no la cierra", () => {
  // Sin petición viva no hay nada que cerrar: quien volvió al menú se
  // encontraría un cierre surgido de la nada.
  for (const hook of ["lagunakAsistenciaResultado", "lagunakAsistenciaRechazo"]) {
    Hooks.callAll(hook, { nonce: "nonce-1", codigo: "caducada", propuesta: null });
    assert.equal(ui.contextoAsistencia().enMenu, true, `${hook} no debería sacarnos del menú`);
  }
});

test("la barra se repinta sin re-renderizar la ventana", () => {
  // Un `render()` por fotograma reconstruiría la ventana entera y tiraría el
  // foco del teclado 60 veces por segundo.
  const nodos = {
    "[data-asistencia-cursor]": { style: {}, classList: { toggle(_c, v) { this.dentro = v; } } },
    "[data-asistencia-zona]": { style: {} },
    "[data-asistencia-lectura]": { textContent: "" },
  };
  const raiz = { querySelector: (sel) => nodos[sel] ?? null };

  const vista = {
    cursor: 42.5,
    zonaDesde: 30,
    zonaAncho: 20,
    dentro: true,
    lectura: { zona: "centro", segundosRestantes: 4.2, expirado: false },
  };
  assert.equal(ui.pintarBarra(vista, raiz), vista);
  assert.equal(nodos["[data-asistencia-cursor]"].style.left, "42.5%");
  assert.equal(nodos["[data-asistencia-cursor]"].classList.dentro, true);
  assert.equal(nodos["[data-asistencia-zona]"].style.left, "30%");
  assert.equal(nodos["[data-asistencia-zona]"].style.width, "20%");
  assert.ok(
    nodos["[data-asistencia-lectura]"].textContent.includes("LAGUNAK.Asistencia.Reto.Lectura"),
    "la lectura de texto se escribe: es el canal no visual del reto",
  );
});

test("sin raíz ni vista, pintar no revienta", () => {
  assert.equal(ui.pintarBarra(null, null), null);
  assert.equal(ui.pintarBarra({ cursor: 1 }, null), null);
});

test("el control de escena lo ven todos, no solo el GM", () => {
  // Es la mecánica cooperativa: un botón solo-GM no sería cooperación.
  const grupo = { name: "lagunak", tools: [] };
  ui.addAsistenciaControl([grupo]);
  assert.deepEqual(grupo.tools.map((t) => t.name), ["lagunak-asistencia"]);
  assert.equal(typeof grupo.tools[0].onClick, "function");
});

test("en el formato de controles de v13 el botón también entra", () => {
  const controls = { lagunak: { tools: {} } };
  ui.addAsistenciaControl(controls);
  assert.ok(controls.lagunak.tools["lagunak-asistencia"]);
  assert.equal(typeof controls.lagunak.tools["lagunak-asistencia"].onChange, "function");
});

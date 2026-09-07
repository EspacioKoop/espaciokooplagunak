import assert from "node:assert/strict";
import test from "node:test";

// El cable de la convocatoria (#689, endurecido en #876 tras una revisión de
// seguridad). El receptor original aceptaba CUALQUIER mensaje de un socket
// compartido sin comprobar que el emisor fuera GM ni que la estancia
// existiera en el catálogo: un jugador podía emitir el payload de
// convocatoria directamente (sin pasar por `convocarYTransmitir`, que solo
// protege a quien coopera) y abrir tanto salas reales como inventadas.
//
// El arreglo cambia el canal de un socket crudo a un AJUSTE DE MUNDO
// (`scope: "world"`): Foundry solo deja escribir un ajuste de mundo a quien
// tiene permiso de modificar ajustes del juego (el GM), y lo comprueba el
// SERVIDOR al escribir, no este módulo al leer. El doble de `game.settings`
// de abajo simula justo esa autoridad: `set()` lanza si quien la invoca no es
// GM, tal y como lo haría Foundry real, así que un cliente sin autoridad ni
// siquiera consigue que el ajuste cambie — el hook `updateSetting` nunca
// llega a dispararse con un valor suyo.

let usuario = { id: "gm", isGM: true };
let valorAjuste = null;
const escuchasHooks = new Map();

const ajustesFoundry = {
  registrado: false,
  register(_moduleId, _key, _opciones) {
    this.registrado = true;
  },
  set(_moduleId, _key, valor) {
    // Simula la comprobación de permisos que hace el SERVIDOR de Foundry
    // para un ajuste `scope: "world"`: solo el GM puede escribirlo. Esto no
    // es una comprobación de este módulo — es lo que hace que la
    // "autoridad verificable" no dependa de nada que el módulo declare.
    if (!usuario.isGM) throw new Error("solo el GM puede modificar ajustes del mundo");
    valorAjuste = valor;
    // Foundry dispara `updateSetting` para TODOS los clientes conectados,
    // incluido el que escribió. El doble hace lo mismo.
    dispararUpdateSetting({ namespace: "prueba", key: AJUSTE, value: valor });
    return Promise.resolve();
  },
};

const hooksFoundry = {
  on(nombre, fn) {
    if (!escuchasHooks.has(nombre)) escuchasHooks.set(nombre, new Set());
    escuchasHooks.get(nombre).add(fn);
  },
  off(nombre, fn) {
    escuchasHooks.get(nombre)?.delete(fn);
  },
};

function dispararUpdateSetting(setting) {
  for (const fn of escuchasHooks.get("updateSetting") ?? []) fn(setting);
}

globalThis.game = {
  get user() {
    return usuario;
  },
  settings: ajustesFoundry,
};
globalThis.Hooks = hooksFoundry;

const {
  AJUSTE_CONVOCATORIA: AJUSTE,
  convocarYTransmitir,
  registrarAjusteConvocatoria,
  registrarConvocatoriaEstancia,
} = await import("../scripts/convocatoria-difusion.mjs");

registrarAjusteConvocatoria("prueba", ajustesFoundry);

function arnes({ isGM = true } = {}) {
  escuchasHooks.clear();
  valorAjuste = null;
  usuario = { id: "gm", isGM };
  const aperturas = [];
  registrarConvocatoriaEstancia("prueba", { abrir: (estancia) => aperturas.push(estancia), hooks: hooksFoundry });
  return aperturas;
}

/** Simula el hook disparándose directamente con un valor arbitrario, como si
 * llegara de otro cliente — sin pasar por `ajustesFoundry.set` ni por su
 * comprobación de GM. Es justo el escenario que un socket crudo permitía y
 * que este test demuestra que ya no basta para abrir nada. */
function llegaValorArbitrario(valor) {
  dispararUpdateSetting({ namespace: "prueba", key: AJUSTE, value: valor });
}

test("registrar sin una función de apertura falla al registrar, no al llegar el mensaje", () => {
  assert.throws(() => registrarConvocatoriaEstancia("prueba", { hooks: hooksFoundry }), TypeError);
});

test("el ajuste que cambia abre la estancia convocada", () => {
  const aperturas = arnes();
  llegaValorArbitrario({ estancia: "museo" });
  assert.deepEqual(aperturas, ["museo"]);
});

test("un ajuste de otro nombre, o sin estancia, no abre nada", () => {
  const aperturas = arnes();
  dispararUpdateSetting({ namespace: "prueba", key: "otro-ajuste", value: { estancia: "museo" } });
  llegaValorArbitrario({});
  llegaValorArbitrario({ estancia: "" });
  llegaValorArbitrario(null);
  assert.deepEqual(aperturas, []);
});

test("volver a registrar no deja dos escuchas: la estancia se abre una sola vez", () => {
  const primeras = arnes();
  const segundas = [];
  registrarConvocatoriaEstancia("prueba", { abrir: (e) => segundas.push(e), hooks: hooksFoundry });
  llegaValorArbitrario({ estancia: "museo" });
  assert.deepEqual(primeras, []);
  assert.deepEqual(segundas, ["museo"]);
});

test("el GM convoca: escribe el ajuste de mundo (no un socket) y abre también la suya", () => {
  const aperturas = arnes();
  assert.equal(convocarYTransmitir("museo", { ajustes: ajustesFoundry }), true);
  assert.equal(valorAjuste.estancia, "museo");
  assert.deepEqual(aperturas, ["museo"]);
});

test("quien no es GM no convoca ni consigue escribir el ajuste", () => {
  const aperturas = arnes({ isGM: false });
  assert.equal(convocarYTransmitir("museo", { ajustes: ajustesFoundry }), false);
  assert.equal(valorAjuste, null);
  assert.deepEqual(aperturas, []);
});

test("una estancia que el catálogo no conoce no se difunde desde convocarYTransmitir", () => {
  const aperturas = arnes();
  assert.equal(convocarYTransmitir("sala-de-maquinas-imaginaria", { ajustes: ajustesFoundry }), false);
  assert.equal(valorAjuste, null);
  assert.deepEqual(aperturas, []);
});

// --- Regresión de seguridad (#876): el RECEPTOR, no solo el emisor ---

test("un cliente sin autoridad GM verificable no consigue abrir NINGUNA ventana", () => {
  // Un jugador (isGM: false) que intentase escribir el ajuste directamente
  // se encuentra con el mismo rechazo que impondría el servidor de Foundry:
  // `set()` lanza y el hook nunca se dispara con su valor.
  const aperturas = arnes({ isGM: false });
  assert.throws(() => ajustesFoundry.set("prueba", AJUSTE, { estancia: "museo" }));
  assert.deepEqual(aperturas, []);
});

test("una estancia inexistente en el valor del ajuste se rechaza, aunque el ajuste SÍ cambie", () => {
  // Incluso si el hook llega a dispararse (un dato corrupto, una versión
  // vieja del módulo, cualquier fuente que ya no sea el propio emisor
  // cooperativo), el receptor vuelve a validar contra el catálogo real antes
  // de abrir nada.
  const aperturas = arnes();
  llegaValorArbitrario({ estancia: "not-a-real-room" });
  assert.deepEqual(aperturas, []);
});

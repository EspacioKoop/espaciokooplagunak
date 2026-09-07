import assert from "node:assert/strict";
import test from "node:test";

import {
  ID_BOTON,
  herramientaVisor3D,
  registrarVisorSistema3D,
} from "../scripts/visor-3d-sistema-app.mjs";
import { SISTEMA_EJEMPLO, aplanarSistema } from "../standalone/visor-3d-sistema/datos.mjs";

async function vaciarMicrotareas() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

function crearContenidoFalso() {
  return {
    dataset: {},
    innerHTML: "",
    hijos: [],
    appendChild(el) {
      this.hijos.push(el);
    },
  };
}

// Application (V1) clásica real: `render()` devuelve la instancia
// INMEDIATAMENTE y el HTML aparece más tarde, de forma asíncrona, cuando
// Foundry llama internamente a `_render`. Esta fábrica simula justo esa
// asincronía diferida — el bug original montaba el iframe dentro de un
// `await super.render()` que ya había resuelto antes de que el DOM
// existiera, así que terminaba con cero iframes. `contenidos` acumula cada
// `.window-content` simulado que se crea, uno por render, para poder
// inspeccionarlo desde el test.
function crearApplicationV1Diferida(contenidos) {
  return class ApplicationV1Diferida {
    constructor() {
      this.element = null;
    }

    render(force, options) {
      Promise.resolve().then(() => {
        const content = crearContenidoFalso();
        contenidos.push(content);
        this.element = [{ querySelector: (selector) => (selector === ".window-content" ? content : null) }];
        this._render(force, options);
      });
      return this;
    }

    async _render() {
      // La subclase real sobreescribe esto y llama a super._render() primero.
    }
  };
}

// --- Tests del registro en la barra de escena, sin Foundry real ---

function dobleHooks() {
  const listeners = [];
  return {
    listeners,
    on(_nombre, handler) {
      listeners.push(handler);
    },
    disparar(controls) {
      for (const fn of listeners) fn(controls);
    },
  };
}

test("la herramienta exportada tiene el id, título, icono y un onClick", () => {
  assert.equal(herramientaVisor3D.name, ID_BOTON);
  assert.equal(herramientaVisor3D.title, "LAGUNAK.Controles.AbrirVisor3DSistema");
  assert.equal(herramientaVisor3D.icon, "fa-solid fa-satellite");
  assert.equal(typeof herramientaVisor3D.onClick, "function");
});

test("registrarVisorSistema3D con hooks nulo no registra nada (Node sin Foundry)", () => {
  const hooks = dobleHooks();
  registrarVisorSistema3D(null); // no debe lanzar ni registrar
  assert.equal(hooks.listeners.length, 0);
});

test("el botón se añade al grupo lagunak en la forma v11 (array)", () => {
  globalThis.game = { user: { isGM: true } };
  const hooks = dobleHooks();
  registrarVisorSistema3D(hooks);

  const controles = [
    { name: "token", tools: [] },
    { name: "lagunak", tools: [] },
  ];
  hooks.disparar(controles);

  const grupo = controles.find((g) => g.name === "lagunak");
  const herr = grupo.tools.find((t) => t.name === ID_BOTON);
  assert.ok(herr, "el botón está en el grupo lagunak");
  assert.equal(herr.title, herramientaVisor3D.title);
});

test("el botón se añade al grupo lagunak en la forma v13 (record)", () => {
  globalThis.game = { user: { isGM: true } };
  const hooks = dobleHooks();
  registrarVisorSistema3D(hooks);

  const controles = { token: { tools: {} }, lagunak: { tools: {}, order: 0 } };
  hooks.disparar(controles);

  const herr = controles.lagunak.tools[ID_BOTON];
  assert.ok(herr, "el botón está en el grupo lagunak (record)");
  assert.equal(herr.name, ID_BOTON);
});

test("un jugador no recibe el botón (solo-GM)", () => {
  globalThis.game = { user: { isGM: false } };
  const hooks = dobleHooks();
  registrarVisorSistema3D(hooks);

  const controles = [{ name: "lagunak", tools: [] }];
  hooks.disparar(controles);

  const grupo = controles.find((g) => g.name === "lagunak");
  assert.equal(grupo.tools.find((t) => t.name === ID_BOTON), undefined, "sin botón para jugador");
});

// --- Tests del ciclo de vida V1 con render diferido (apertura y reapertura) ---

test("el iframe se monta tras el render diferido de Application V1, en apertura y reapertura", async (t) => {
  const originales = {
    Application: globalThis.Application,
    game: globalThis.game,
    document: globalThis.document,
    foundry: globalThis.foundry,
  };
  t.after(() => Object.assign(globalThis, originales));

  globalThis.game = { user: { isGM: true } };
  const contenidos = [];
  globalThis.Application = crearApplicationV1Diferida(contenidos);
  // ApplicationV2 SÍ está disponible en el anfitrión (v13), pero esta
  // instancia sigue siendo V1 puro: no debe llamarse render({force:true}).
  globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
  let llamadasCreateElement = 0;
  globalThis.document = {
    createElement: (tag) => {
      llamadasCreateElement += 1;
      return { tagName: tag, style: {} };
    },
  };

  const mod = await import(`../scripts/visor-3d-sistema-app.mjs?visor-lifecycle=${Math.random()}`);

  // Primera apertura: el render es diferido, así que justo después de
  // onClick() el iframe todavía no existe.
  mod.herramientaVisor3D.onClick();
  assert.equal(contenidos.length, 0, "el render V1 es asíncrono: nada debe montarse todavía");
  await vaciarMicrotareas();

  assert.equal(contenidos.length, 1);
  assert.equal(contenidos[0].hijos.length, 1, "el iframe se monta tras el render diferido");
  assert.equal(contenidos[0].hijos[0].tagName, "iframe");
  assert.equal(contenidos[0].dataset.ek3d, "1");
  assert.equal(llamadasCreateElement, 1);

  // Reapertura: la instancia se reutiliza (perezosa), pero Foundry vuelve a
  // llamar a render/_render con un `.window-content` NUEVO, y el iframe
  // tiene que volver a aparecer ahí.
  mod.herramientaVisor3D.onClick();
  await vaciarMicrotareas();

  assert.equal(contenidos.length, 2, "la reapertura dispara un segundo render");
  assert.equal(contenidos[1].hijos.length, 1, "el iframe también se monta en la reapertura");
  assert.equal(contenidos[1].hijos[0].tagName, "iframe");
  assert.equal(llamadasCreateElement, 2);
});

// --- Tests de datos (sistema de ejemplo) ---

test("aplanarSistema incluye la estrella, los planetas y las lunas", () => {
  const planos = aplanarSistema(SISTEMA_EJEMPLO);
  // Argia: estrella + 3 planetas; Bihotz tiene 1 luna -> 5 en total.
  assert.equal(planos.length, 5);
  const ids = planos.map((p) => p.cuerpo.id);
  assert.deepEqual([...new Set(ids)].sort(), ids.sort(), "ids únicos");
  assert.ok(ids.includes("argia-a") && ids.includes("argia-b") && ids.includes("argia-b1"));
});

test("aplanarSistema marca el padre de cada luna", () => {
  const planos = aplanarSistema(SISTEMA_EJEMPLO);
  const ilaz = planos.find((p) => p.cuerpo.id === "argia-b1");
  assert.equal(ilaz.padre, "argia-b", "la luna cuelga de su planeta");
  const estrella = planos.find((p) => p.cuerpo.tipo === "estrella");
  assert.equal(estrella.padre, null, "la estrella no tiene padre");
});

test("aplanarSistema con sistema sin lunas no añade nada extra", () => {
  const sistema = {
    id: "x",
    nombre: "X",
    cuerpos: [
      { id: "s", tipo: "estrella", orbita: {} },
      { id: "p", tipo: "planeta", orbita: {} },
    ],
  };
  assert.equal(aplanarSistema(sistema).length, 2);
});

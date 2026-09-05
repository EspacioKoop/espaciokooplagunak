// Pruebas de convocatoria-wiring (#832): el botón engancha `convocar`.
//
// Sin librería de mocking: game/Hooks/ui/foundry son objetos planos declarados
// antes de importar el módulo.

let hooksRegistrados = [];
globalThis.Hooks = {
  on(ev, cb) { hooksRegistrados.push([ev, cb]); },
  callAll(ev, carga) { (globalThis.__callAll ?? []).push([ev, carga]); },
};
globalThis.ui = undefined;
globalThis.game = { user: { isGM: true } };

/** Ejecuta algo con el rol del usuario cambiado y lo devuelve al terminar. */
async function comoUsuario(isGM, fn) {
  const antes = globalThis.game.user.isGM;
  globalThis.game.user.isGM = isGM;
  try { return await fn(); } finally { globalThis.game.user.isGM = antes; }
}

const { addConvocarControl, registrarConvocatoriaUI, estanciasDisponibles, convocarDesdeVentana }
  = await import("../scripts/convocatoria-wiring.mjs");

import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { convocar } from "../scripts/convocatoria-estancia.mjs";
import test from "node:test";
import assert from "node:assert/strict";

test("addConvocarControl añade el botón lagunak-convocar al grupo propio", () => {
  const controls = [{ name: "lagunak", tools: [] }];
  const ok = addConvocarControl(controls);
  assert.equal(ok, true);
  const tool = controls[0].tools.find((t) => t.name === "lagunak-convocar");
  assert.ok(tool, "falta el control lagunak-convocar");
  assert.equal(tool.title, "LAGUNAK.Convocatoria.Titulo");
});

test("registrarConvocatoriaUI configura el módulo para el botón y la ventana", () => {
  registrarConvocatoriaUI("espaciokoop-lagunak");
  // El botón se añade desde el hook de la barra de main, no con un hook propio:
  // así no se duplica el callback de getSceneControlButtons.
  const controls = [{ name: "lagunak", tools: [] }];
  const ok = addConvocarControl(controls);
  assert.equal(ok, true);
  const tool = controls[0].tools.find((t) => t.name === "lagunak-convocar");
  assert.ok(tool, "falta el control lagunak-convocar");
  assert.equal(tool.title, "LAGUNAK.Convocatoria.Titulo");
});

test("estanciasDisponibles refleja el catálogo de andar", async () => {
  const estancias = await estanciasDisponibles();
  assert.ok(Array.isArray(estancias) && estancias.length > 0);
  assert.ok(estancias.every((e) => CATALOGO_ANDAR.tiene(e.id)));
});

test("convocarDesdeVentana convoca de verdad cuando quien llama ES GM", async () => {
  globalThis.__callAll = [];
  const id = CATALOGO_ANDAR.ids[0];
  const posicion = await comoUsuario(true, () => convocarDesdeVentana(id));
  assert.ok(posicion, "un GM sí puede convocar");
  assert.deepEqual(posicion, convocar(id, "GM"));
  assert.equal(globalThis.__callAll.length, 1);
  assert.equal(globalThis.__callAll[0][0], "lagunakConvocarResuelve");
  assert.equal(globalThis.__callAll[0][1].id, id);
  assert.deepEqual(globalThis.__callAll[0][1].posicion, posicion);
});

test("un no-GM no convoca aunque llame a la función directamente", async () => {
  // El botón se oculta al construir la barra, pero eso es presentación: la
  // autorización tiene que estar en la ejecución (#237). Antes se pasaba el
  // literal "GM" a `convocar`, así que esta llamada devolvía una posición.
  globalThis.__callAll = [];
  const id = CATALOGO_ANDAR.ids[0];
  const posicion = await comoUsuario(false, () => convocarDesdeVentana(id));
  assert.equal(posicion, null);
  assert.deepEqual(globalThis.__callAll, [],
    "un hook operativo emitido es una orden: no se emite si la convocatoria no procede");
});

test("perder el rol GM con la ventana abierta corta la convocatoria", async () => {
  // La ventana ya está construida (el botón se pintó siendo GM) y el usuario
  // deja de ser GM antes de pulsar. Es el mismo camino, con el rol degradado.
  globalThis.__callAll = [];
  const id = CATALOGO_ANDAR.ids[0];
  assert.ok(await comoUsuario(true, () => convocarDesdeVentana(id)));
  globalThis.__callAll = [];
  assert.equal(await comoUsuario(false, () => convocarDesdeVentana(id)), null);
  assert.deepEqual(globalThis.__callAll, []);
});

test("una estancia que el catálogo no conoce no emite hook ni posición", async () => {
  globalThis.__callAll = [];
  assert.equal(await comoUsuario(true, () => convocarDesdeVentana("no-existe")), null);
  assert.deepEqual(globalThis.__callAll, []);
});

// --- La plantilla recibe la LISTA, no una promesa ----------------------------
// `estanciasDisponibles()` es async, así que `{ estancias: estanciasDisponibles() }`
// entregaba una Promise a `{{#each estancias}}` y la ventana abría vacía. Se
// prueba en las dos rutas (v11 clásica y moderna) y a lo largo del ciclo
// abrir → renderizar → cerrar → reabrir, que es donde vive la ventana perezosa.

const { abrirConvocatoria, cerrarConvocatoria }
  = await import("../scripts/convocatoria-wiring.mjs");

/** Base común: `render()` resuelve el contexto igual que haría Foundry. */
function baseVentana(obtenerContexto) {
  return class {
    constructor() { this.rendered = false; this.contexto = null; }
    async render() {
      this.rendered = true;
      this.contexto = await obtenerContexto(this);
      contextosPintados.push(this.contexto);
      return this;
    }
    close() { this.rendered = false; }
  };
}

let contextosPintados = [];

function montarV1() {
  globalThis.foundry = {};
  globalThis.Application = baseVentana((v) => v.getData());
  Object.defineProperty(globalThis.Application, "defaultOptions", { value: {}, configurable: true });
}

function montarV2() {
  const Base = baseVentana((v) => v._prepareContext());
  globalThis.Application = undefined;
  globalThis.foundry = {
    applications: { api: { ApplicationV2: Base, HandlebarsApplicationMixin: (C) => C } },
  };
}

for (const [nombre, montar] of [["v11 clásica", montarV1], ["moderna (ApplicationV2)", montarV2]]) {
  test(`la ventana ${nombre} pinta la lista resuelta al abrir, cerrar y reabrir`, async () => {
    montar();
    registrarConvocatoriaUI("espaciokoop-lagunak");
    const esperadas = await estanciasDisponibles();

    for (const vuelta of ["abrir", "reabrir"]) {
      contextosPintados = [];
      abrirConvocatoria();
      // `render()` es async; se espera a que el contexto esté pintado.
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(contextosPintados.length, 1, `${vuelta}: la ventana no renderizó`);
      const ctx = contextosPintados[0];
      assert.ok(!(ctx.estancias instanceof Promise),
        `${vuelta}: la plantilla recibió una Promise en vez de la lista`);
      assert.ok(Array.isArray(ctx.estancias));
      assert.deepEqual(ctx.estancias, esperadas);
      cerrarConvocatoria();
    }
  });
}

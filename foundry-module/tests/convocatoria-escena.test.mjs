// Tests de la difusión de la convocatoria (#832): el transporte, no la regla.
// La regla de quién puede convocar y dónde se aterriza es de
// `convocatoria-estancia.test.mjs`; aquí se prueba cómo viaja.

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  AJUSTE_CONVOCATORIA,
  destinosConvocables,
  publicarConvocatoria,
  registrarAjusteConvocatoria,
  registrarEscuchaConvocatoria,
} from "../scripts/convocatoria-escena.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";

const MODULO = "espaciokoop-lagunak";

/** Doble mínimo de `game.settings`: registrar, leer y escribir. */
function ajustesFalsos() {
  const valores = new Map();
  return {
    registrados: [],
    escrituras: [],
    register(modulo, clave, opciones) {
      this.registrados.push({ modulo, clave, opciones });
      valores.set(`${modulo}.${clave}`, opciones.default);
    },
    get: (modulo, clave) => valores.get(`${modulo}.${clave}`) ?? null,
    async set(modulo, clave, valor) {
      valores.set(`${modulo}.${clave}`, valor);
      this.escrituras.push({ clave, valor });
      return valor;
    },
  };
}

/** Doble mínimo de `Hooks`, con disparo manual. */
function hooksFalsos() {
  const escuchas = new Map();
  return {
    on(evento, fn) {
      escuchas.set(fn, evento);
    },
    off(evento, fn) {
      if (escuchas.get(fn) === evento) escuchas.delete(fn);
    },
    disparar(evento, ...args) {
      for (const [fn, suyo] of escuchas) if (suyo === evento) fn(...args);
    },
    get cuantas() {
      return escuchas.size;
    },
  };
}

describe("destinosConvocables", () => {
  it("son las estancias sin puertas, y no una lista escrita al lado", () => {
    const derivados = destinosConvocables();
    const sinPuertas = CATALOGO_ANDAR.ids.filter((id) => CATALOGO_ANDAR.obtener(id).puertas.length === 0);
    assert.deepEqual([...derivados], sinPuertas);
  });

  it("no ofrece un sitio al que ya se llega andando", () => {
    // La cantina tiene puertas: convocar allí quitaría el paseo sin dar nada.
    assert.ok(!destinosConvocables().includes("cantina"));
  });

  it("acepta otro catálogo, para no atarse al de la nave real", () => {
    const catalogo = {
      ids: ["con", "sin"],
      obtener: (id) => ({ puertas: id === "con" ? [{}] : [] }),
    };
    assert.deepEqual([...destinosConvocables(catalogo)], ["sin"]);
  });
});

describe("registrarAjusteConvocatoria", () => {
  it("registra un ajuste de MUNDO, que es lo que impide falsificar la llamada", () => {
    const ajustes = ajustesFalsos();
    registrarAjusteConvocatoria(MODULO, ajustes);
    const registrado = ajustes.registrados.at(0);
    assert.equal(registrado.clave, AJUSTE_CONVOCATORIA);
    assert.equal(registrado.opciones.scope, "world");
  });

  it("no nace con ninguna convocatoria vigente", () => {
    const ajustes = ajustesFalsos();
    registrarAjusteConvocatoria(MODULO, ajustes);
    assert.equal(ajustes.get(MODULO, AJUSTE_CONVOCATORIA), null);
  });
});

describe("publicarConvocatoria", () => {
  it("publica la estancia y el punto de llegada que resolvió `convocar`", async () => {
    const ajustes = ajustesFalsos();
    registrarAjusteConvocatoria(MODULO, ajustes);
    const publicado = await publicarConvocatoria({
      moduleId: MODULO,
      idEstancia: "playa",
      rol: "GM",
      ajustes,
    });
    assert.equal(publicado.estancia, "playa");
    for (const campo of ["x", "z", "yaw"]) assert.equal(typeof publicado[campo], "number");
    assert.equal(ajustes.get(MODULO, AJUSTE_CONVOCATORIA).estancia, "playa");
  });

  it("no escribe nada si quien convoca no es GM", async () => {
    const ajustes = ajustesFalsos();
    registrarAjusteConvocatoria(MODULO, ajustes);
    const publicado = await publicarConvocatoria({
      moduleId: MODULO,
      idEstancia: "playa",
      rol: "jugador",
      ajustes,
    });
    assert.equal(publicado, null);
    assert.equal(ajustes.escrituras.length, 0);
  });

  it("no escribe nada si la estancia no existe", async () => {
    const ajustes = ajustesFalsos();
    registrarAjusteConvocatoria(MODULO, ajustes);
    const publicado = await publicarConvocatoria({
      moduleId: MODULO,
      idEstancia: "no-existe",
      rol: "GM",
      ajustes,
    });
    assert.equal(publicado, null);
    assert.equal(ajustes.escrituras.length, 0);
  });

  it("cambia de sello al repetir destino, para que la segunda llamada no se pierda", async () => {
    const ajustes = ajustesFalsos();
    registrarAjusteConvocatoria(MODULO, ajustes);
    let reloj = 1000;
    const opciones = { moduleId: MODULO, idEstancia: "museo", rol: "GM", ajustes, ahora: () => (reloj += 1) };
    const primera = await publicarConvocatoria(opciones);
    const segunda = await publicarConvocatoria(opciones);
    assert.equal(primera.estancia, segunda.estancia);
    assert.notEqual(primera.sello, segunda.sello);
  });
});

describe("registrarEscuchaConvocatoria", () => {
  it("avisa con el destino cuando cambia SU ajuste", () => {
    const hooks = hooksFalsos();
    const recibidos = [];
    registrarEscuchaConvocatoria(MODULO, { hooks, alConvocar: (d) => recibidos.push(d) });
    hooks.disparar("updateSetting", {
      key: `${MODULO}.${AJUSTE_CONVOCATORIA}`,
      value: { estancia: "playa", x: 1, z: 2, yaw: 0, sello: 7 },
    });
    assert.deepEqual(recibidos.map((d) => d.estancia), ["playa"]);
  });

  it("ignora el cambio de otro ajuste del mismo módulo", () => {
    const hooks = hooksFalsos();
    const recibidos = [];
    registrarEscuchaConvocatoria(MODULO, { hooks, alConvocar: (d) => recibidos.push(d) });
    hooks.disparar("updateSetting", { key: `${MODULO}.nivelAlertaNave`, value: { nivel: "roja" } });
    assert.equal(recibidos.length, 0);
  });

  it("ignora un valor sin estancia en vez de convocar a la nada", () => {
    const hooks = hooksFalsos();
    const recibidos = [];
    registrarEscuchaConvocatoria(MODULO, { hooks, alConvocar: (d) => recibidos.push(d) });
    for (const value of [null, {}, { estancia: "" }]) {
      hooks.disparar("updateSetting", { key: `${MODULO}.${AJUSTE_CONVOCATORIA}`, value });
    }
    assert.equal(recibidos.length, 0);
  });

  it("devuelve una función que desregistra la escucha", () => {
    const hooks = hooksFalsos();
    const recibidos = [];
    const soltar = registrarEscuchaConvocatoria(MODULO, { hooks, alConvocar: (d) => recibidos.push(d) });
    soltar();
    assert.equal(hooks.cuantas, 0);
    hooks.disparar("updateSetting", {
      key: `${MODULO}.${AJUSTE_CONVOCATORIA}`,
      value: { estancia: "playa", x: 1, z: 2, yaw: 0, sello: 8 },
    });
    assert.equal(recibidos.length, 0);
  });
});

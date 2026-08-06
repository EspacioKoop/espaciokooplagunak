import assert from "node:assert/strict";
import test from "node:test";

import {
  AJUSTE_ALARMA_CRUZADA,
  aplicarAvisoAlarmaCruzada,
  normalizarAlarmaCruzada,
  publicarAlarmaCruzada,
  registrarEscuchaAlarmaCruzada,
} from "../scripts/alarma-cruzada-escena.mjs";

const MODULO = "espaciokoop-lagunak";

function nave({ calorReactor = 0, potenciaFrontshield = 1, potenciaRearshield = 1 } = {}) {
  return {
    systems: {
      reactor: { heat: calorReactor },
      frontshield: { power: potenciaFrontshield },
      rearshield: { power: potenciaRearshield },
    },
  };
}

function ajustesFalsos(inicial = { activa: false, datos: null }) {
  let valor = inicial;
  const escrituras = [];
  return {
    escrituras,
    get: () => valor,
    set: async (_modulo, _clave, nuevo) => {
      valor = nuevo;
      escrituras.push(nuevo);
    },
  };
}

function bodyFalso() {
  const hijos = [];
  return {
    classList: { add: () => {}, remove: () => {}, [Symbol.iterator]: () => [][Symbol.iterator]() },
    hijos,
    ownerDocument: {
      createElement: () => {
        const atributos = {};
        const nodo = {
          atributos,
          textContent: "",
          className: "",
          setAttribute: (k, v) => { atributos[k] = v; },
          getAttribute: (k) => atributos[k],
          remove: () => {
            const i = hijos.indexOf(nodo);
            if (i >= 0) hijos.splice(i, 1);
          },
        };
        return nodo;
      },
    },
    appendChild: (nodo) => hijos.push(nodo),
    querySelector: (sel) =>
      sel === "#lagunak-alarma-cruzada-aviso" ? hijos.find((h) => h.id === "lagunak-alarma-cruzada-aviso") ?? null : null,
  };
}

const i18nFalso = {
  localize: (clave) => clave,
  format: (clave, datos) => `${clave}${datos ? ` ${JSON.stringify(datos)}` : ""}`,
};

// ---- publicarAlarmaCruzada ------------------------------------------------

test("solo el GM publica la alarma cruzada", async () => {
  const ajustes = ajustesFalsos();
  const activa = await publicarAlarmaCruzada({
    moduleId: MODULO,
    nave: nave({ calorReactor: 0.9, potenciaFrontshield: 0.4 }),
    ajustes,
    esGM: false,
  });
  assert.equal(activa, false);
  assert.deepEqual(ajustes.escrituras, []);
});

test("no se reescribe el ajuste si el estado activo/inactivo no cambió", async () => {
  const ajustes = ajustesFalsos({ activa: false, datos: null });
  await publicarAlarmaCruzada({
    moduleId: MODULO,
    nave: nave({ calorReactor: 0.3 }),
    ajustes,
    esGM: true,
  });
  assert.deepEqual(ajustes.escrituras, []);
});

test("al entrar en correlación se publica activa con sus datos, y se anuncia por hook", async () => {
  const ajustes = ajustesFalsos({ activa: false, datos: null });
  const avisos = [];
  const activa = await publicarAlarmaCruzada({
    moduleId: MODULO,
    nave: nave({ calorReactor: 0.9, potenciaFrontshield: 0.4 }),
    ajustes,
    esGM: true,
    hooks: { callAll: (...args) => avisos.push(args) },
  });
  assert.equal(activa, true);
  assert.equal(ajustes.escrituras.length, 1);
  assert.equal(ajustes.escrituras[0].activa, true);
  assert.equal(ajustes.escrituras[0].datos.calorReactorPct, 90);
  assert.equal(avisos[0][0], "lagunakAlarmaCruzada");
  assert.equal(avisos[0][1], true);
});

test("al salir de correlación se publica inactiva y los datos se limpian", async () => {
  const ajustes = ajustesFalsos({ activa: true, datos: { calorReactorPct: 90 } });
  const activa = await publicarAlarmaCruzada({
    moduleId: MODULO,
    nave: nave({ calorReactor: 0.5, potenciaFrontshield: 1 }),
    ajustes,
    esGM: true,
  });
  assert.equal(activa, false);
  assert.equal(ajustes.escrituras.length, 1);
  assert.deepEqual(ajustes.escrituras[0], { activa: false, datos: null });
});

// ---- normalizarAlarmaCruzada ----------------------------------------------

test("normalizarAlarmaCruzada tolera basura sin reventar", () => {
  assert.deepEqual(normalizarAlarmaCruzada(undefined), { activa: false, datos: null });
  assert.deepEqual(normalizarAlarmaCruzada({}), { activa: false, datos: null });
  assert.deepEqual(normalizarAlarmaCruzada({ activa: true, datos: { x: 1 } }), { activa: true, datos: { x: 1 } });
});

// ---- aplicarAvisoAlarmaCruzada: variante por puesto -----------------------

test("ingeniería ve la causa, armas ve el efecto, para la misma alarma activa", () => {
  const valor = { activa: true, datos: { calorReactorPct: 90, potenciaEscudoPct: 40, sistemaEscudo: "frontshield" } };

  const bodyIng = bodyFalso();
  aplicarAvisoAlarmaCruzada(valor, { body: bodyIng, i18n: i18nFalso, puesto: "engineering" });
  assert.match(bodyIng.hijos[0].textContent, /Causa\.Titulo/);

  const bodyArmas = bodyFalso();
  aplicarAvisoAlarmaCruzada(valor, { body: bodyArmas, i18n: i18nFalso, puesto: "weapons" });
  assert.match(bodyArmas.hijos[0].textContent, /Efecto\.Titulo/);
});

test("un puesto ajeno no pinta nada, aunque la alarma esté activa", () => {
  const valor = { activa: true, datos: { calorReactorPct: 90 } };
  const body = bodyFalso();
  const resultado = aplicarAvisoAlarmaCruzada(valor, { body, i18n: i18nFalso, puesto: "navigation" });
  assert.equal(resultado, null);
  assert.equal(body.hijos.length, 0);
});

test("la alarma inactiva no deja rastro, y retira el aviso si lo hubiera", () => {
  const body = bodyFalso();
  aplicarAvisoAlarmaCruzada({ activa: true, datos: {} }, { body, i18n: i18nFalso, puesto: "engineering" });
  assert.equal(body.hijos.length, 1);
  aplicarAvisoAlarmaCruzada({ activa: false, datos: null }, { body, i18n: i18nFalso, puesto: "engineering" });
  assert.equal(body.hijos.length, 0);
});

test("el aviso reutiliza su nodo entre repintados en vez de recrearlo", () => {
  const body = bodyFalso();
  aplicarAvisoAlarmaCruzada(
    { activa: true, datos: { calorReactorPct: 82 } },
    { body, i18n: i18nFalso, puesto: "engineering" },
  );
  const primero = body.hijos[0];
  aplicarAvisoAlarmaCruzada(
    { activa: true, datos: { calorReactorPct: 95 } },
    { body, i18n: i18nFalso, puesto: "engineering" },
  );
  assert.equal(body.hijos.length, 1);
  assert.equal(body.hijos[0], primero);
});

test("el sistema de escudo se localiza en el texto formateado, no se deja en crudo", () => {
  const body = bodyFalso();
  const localizador = {
    localize: (clave) => (clave === "LAGUNAK.Sistemas.frontshield" ? "Escudo delantero" : clave),
    format: (clave, datos) => JSON.stringify(datos ?? {}),
  };
  aplicarAvisoAlarmaCruzada(
    { activa: true, datos: { sistemaEscudo: "frontshield", potenciaEscudoPct: 40 } },
    { body, i18n: localizador, puesto: "weapons" },
  );
  assert.doesNotMatch(body.hijos[0].textContent, /frontshield/);
  assert.match(body.hijos[0].textContent, /Escudo delantero/);
});

// ---- registrarEscuchaAlarmaCruzada: puesto dinámico y ambos hooks --------

test("la escucha pinta el estado vigente al entrar, según el puesto resuelto en ese momento", () => {
  const body = bodyFalso();
  const hooks = { on: () => {}, off: () => {} };
  registrarEscuchaAlarmaCruzada(MODULO, {
    hooks,
    ajustes: ajustesFalsos({ activa: true, datos: { calorReactorPct: 88 } }),
    body,
    i18n: i18nFalso,
    resolverPuesto: () => "engineering",
  });
  assert.equal(body.hijos.length, 1);
  assert.match(body.hijos[0].textContent, /Causa\.Titulo/);
});

test("un cambio del ajuste ajeno no repinta nada", () => {
  const body = bodyFalso();
  const manejadores = [];
  const hooks = {
    on: (evento, fn) => manejadores.push([evento, fn]),
    off: () => {},
  };
  registrarEscuchaAlarmaCruzada(MODULO, {
    hooks,
    ajustes: ajustesFalsos({ activa: false, datos: null }),
    body,
    i18n: i18nFalso,
    resolverPuesto: () => "engineering",
  });
  const [, alCambiarAjuste] = manejadores.find(([evento]) => evento === "updateSetting");
  alCambiarAjuste({ key: "otro-modulo.loQueSea", value: { activa: true, datos: {} } });
  assert.equal(body.hijos.length, 0);
});

test("un relevo de puesto propio repinta con el puesto nuevo, sin esperar a que cambie la alarma", () => {
  const body = bodyFalso();
  const manejadores = [];
  const hooks = {
    on: (evento, fn) => manejadores.push([evento, fn]),
    off: () => {},
  };
  let puestoActual = "navigation";
  registrarEscuchaAlarmaCruzada(MODULO, {
    hooks,
    ajustes: ajustesFalsos({ activa: true, datos: { potenciaEscudoPct: 30 } }),
    body,
    i18n: i18nFalso,
    resolverPuesto: () => puestoActual,
    game: { user: { id: "usuario-1" } },
  });
  assert.equal(body.hijos.length, 0, "navigation no ve la alarma");

  puestoActual = "weapons";
  const [, alCambiarUsuario] = manejadores.find(([evento]) => evento === "updateUser");
  alCambiarUsuario({ id: "usuario-1" });
  assert.equal(body.hijos.length, 1, "tras el relevo, weapons sí la ve");
  assert.match(body.hijos[0].textContent, /Efecto\.Titulo/);
});

test("el cambio de OTRO usuario no dispara un repintado", () => {
  const body = bodyFalso();
  const manejadores = [];
  const hooks = {
    on: (evento, fn) => manejadores.push([evento, fn]),
    off: () => {},
  };
  let llamadas = 0;
  registrarEscuchaAlarmaCruzada(MODULO, {
    hooks,
    ajustes: ajustesFalsos({ activa: true, datos: {} }),
    body,
    i18n: i18nFalso,
    resolverPuesto: () => {
      llamadas += 1;
      return "engineering";
    },
    game: { user: { id: "usuario-1" } },
  });
  const llamadasTrasEntrar = llamadas;
  const [, alCambiarUsuario] = manejadores.find(([evento]) => evento === "updateUser");
  alCambiarUsuario({ id: "usuario-ajeno" });
  assert.equal(llamadas, llamadasTrasEntrar, "no se repinta por un usuario que no es el propio");
});

test("desregistrar quita ambos manejadores", () => {
  const manejadores = [];
  const hooks = {
    on: (evento, fn) => manejadores.push([evento, fn]),
    off: (evento, fn) => {
      const i = manejadores.findIndex(([e, f]) => e === evento && f === fn);
      if (i >= 0) manejadores.splice(i, 1);
    },
  };
  const desregistrar = registrarEscuchaAlarmaCruzada(MODULO, {
    hooks,
    ajustes: ajustesFalsos(),
    body: bodyFalso(),
    i18n: i18nFalso,
  });
  assert.equal(manejadores.length, 2);
  desregistrar();
  assert.equal(manejadores.length, 0);
});

test("el ajuste registrado usa la misma clave que la publicación y la escucha", () => {
  assert.equal(AJUSTE_ALARMA_CRUZADA, "alarmaCruzadaReactorEscudos");
});

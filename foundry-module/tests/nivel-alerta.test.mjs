import assert from "node:assert/strict";
import test from "node:test";

import { NIVELES, motivosDeAlerta, nivelDeAlerta } from "../scripts/nivel-alerta.mjs";
import {
  AJUSTE_NIVEL_ALERTA,
  aplicarNivelAlBody,
  publicarNivelAlerta,
  registrarEscuchaAlerta,
} from "../scripts/alerta-escena.mjs";

const MODULO = "espaciokoop-lagunak";

function nave({ hull = 100, energy = 100, systems = {} } = {}) {
  return { hull, hull_max: 100, energy, energy_max: 100, systems };
}

// ---- Lógica pura del nivel -------------------------------------------------

test("una nave intacta está en verde", () => {
  assert.equal(nivelDeAlerta(nave()), "verde");
});

test("el casco y la energía escalan el nivel", () => {
  assert.equal(nivelDeAlerta(nave({ hull: 60 })), "amarilla");
  assert.equal(nivelDeAlerta(nave({ hull: 25 })), "roja");
  assert.equal(nivelDeAlerta(nave({ energy: 30 })), "amarilla");
  assert.equal(nivelDeAlerta(nave({ energy: 5 })), "roja");
});

test("un sistema caído es amarilla; dos son roja aunque el casco aguante", () => {
  const uno = nave({ systems: { reactor: { health: 0 } } });
  const dos = nave({ systems: { reactor: { health: 0 }, maniobra: { health: -0.2 } } });
  assert.equal(nivelDeAlerta(uno), "amarilla");
  assert.equal(nivelDeAlerta(dos), "roja");
});

test("la histéresis evita el parpadeo en el borde del umbral", () => {
  // 32 % de casco: por encima del umbral de entrada a roja (30 %) pero por
  // debajo del de salida (40 %). Desde verde no escala; desde roja no baja.
  const limite = nave({ hull: 32 });
  assert.equal(nivelDeAlerta(limite, "verde"), "amarilla");
  assert.equal(nivelDeAlerta(limite, "roja"), "roja");
});

test("hace falta recuperarse de verdad para volver a verde", () => {
  assert.equal(nivelDeAlerta(nave({ hull: 75 }), "amarilla"), "amarilla");
  assert.equal(nivelDeAlerta(nave({ hull: 85 }), "amarilla"), "verde");
});

test("sin datos utilizables no se inventa una alarma", () => {
  assert.equal(nivelDeAlerta(null), "verde");
  assert.equal(nivelDeAlerta(undefined), "verde");
  assert.equal(nivelDeAlerta({ hull: 10, hull_max: 0 }), "verde");
  assert.equal(nivelDeAlerta(nave(), "nivel_inventado"), "verde");
});

test("el nivel devuelto siempre es uno de los conocidos", () => {
  for (const hull of [100, 80, 50, 30, 10, 0]) {
    assert.ok(NIVELES.includes(nivelDeAlerta(nave({ hull }))));
  }
});

test("los motivos explican el nivel en vez de dejar un color suelto", () => {
  assert.deepEqual(motivosDeAlerta(nave(), "verde"), []);
  assert.deepEqual(motivosDeAlerta(nave({ hull: 25 }), "roja"), ["LAGUNAK.Alerta.Motivo.Casco"]);
  assert.deepEqual(
    motivosDeAlerta(nave({ hull: 25, energy: 5, systems: { reactor: { health: 0 } } }), "roja"),
    [
      "LAGUNAK.Alerta.Motivo.Casco",
      "LAGUNAK.Alerta.Motivo.Energia",
      "LAGUNAK.Alerta.Motivo.Sistemas",
    ],
  );
});

// ---- Publicación y aplicación ----------------------------------------------

function ajustesFalsos(inicial = "verde") {
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

function bodyFalso(clases = []) {
  const set = new Set(clases);
  return {
    classList: {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      [Symbol.iterator]: () => set[Symbol.iterator](),
    },
    clases: set,
  };
}

test("solo el GM publica el nivel", async () => {
  const ajustes = ajustesFalsos();
  const nivel = await publicarNivelAlerta({
    moduleId: MODULO,
    nave: nave({ hull: 10 }),
    ajustes,
    esGM: false,
  });
  assert.equal(nivel, "verde");
  assert.deepEqual(ajustes.escrituras, []);
});

test("no se reescribe el ajuste si el nivel no cambió", async () => {
  const ajustes = ajustesFalsos("roja");
  await publicarNivelAlerta({ moduleId: MODULO, nave: nave({ hull: 10 }), ajustes, esGM: true });
  assert.deepEqual(ajustes.escrituras, []);
});

test("un cambio de nivel se publica y se anuncia por hook", async () => {
  const ajustes = ajustesFalsos("verde");
  const avisos = [];
  const nivel = await publicarNivelAlerta({
    moduleId: MODULO,
    nave: nave({ hull: 10 }),
    ajustes,
    esGM: true,
    hooks: { callAll: (...args) => avisos.push(args) },
  });
  assert.equal(nivel, "roja");
  assert.deepEqual(ajustes.escrituras, ["roja"]);
  assert.deepEqual(avisos, [["lagunakNivelAlerta", "roja", "verde"]]);
});

test("el body lleva la clase del nivel, y verde no deja rastro", () => {
  const body = bodyFalso();
  assert.equal(aplicarNivelAlBody("roja", body), "roja");
  assert.ok(body.clases.has("lagunak-alerta-roja"));

  aplicarNivelAlBody("amarilla", body);
  assert.ok(body.clases.has("lagunak-alerta-amarilla"));
  assert.ok(!body.clases.has("lagunak-alerta-roja"), "no se acumulan niveles");

  assert.equal(aplicarNivelAlBody("verde", body), null);
  assert.equal([...body.clases].filter((c) => c.startsWith("lagunak-alerta-")).length, 0);
});

test("la escucha aplica el nivel vigente al entrar y en cada cambio", () => {
  const body = bodyFalso();
  const manejadores = [];
  const hooks = {
    on: (evento, fn) => manejadores.push([evento, fn]),
    off: (evento, fn) => {
      const i = manejadores.findIndex(([e, f]) => e === evento && f === fn);
      if (i >= 0) manejadores.splice(i, 1);
    },
  };
  const desregistrar = registrarEscuchaAlerta(MODULO, {
    hooks,
    ajustes: ajustesFalsos("amarilla"),
    body,
  });
  // Un jugador que entra tarde ve la alerta en curso, sin esperar al GM.
  assert.ok(body.clases.has("lagunak-alerta-amarilla"));

  const [, alCambiar] = manejadores[0];
  alCambiar({ key: `${MODULO}.${AJUSTE_NIVEL_ALERTA}`, value: "roja" });
  assert.ok(body.clases.has("lagunak-alerta-roja"));

  // Un ajuste ajeno no toca la pantalla.
  alCambiar({ key: "otro-modulo.loQueSea", value: "verde" });
  assert.ok(body.clases.has("lagunak-alerta-roja"));

  desregistrar();
  assert.equal(manejadores.length, 0);
});

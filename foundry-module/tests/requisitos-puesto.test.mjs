import assert from "node:assert/strict";
import test from "node:test";

import {
  CARACTERISTICAS,
  MINIMO_POR_DEFECTO,
  REQUISITOS_POR_DEFECTO,
  REQUISITO_ERRORES,
  caracteristicasDeActor,
  cumpleRequisito,
  normalizarRequisitos,
  puestosDisponibles,
} from "../scripts/requisitos-puesto.mjs";
import {
  STATIONS,
  STATION_ASSIGNMENT_ERRORS,
  assignStation,
  stationRows,
} from "../scripts/station-assignment.mjs";

const ficha = (parcial) =>
  Object.fromEntries(CARACTERISTICAS.map((c) => [c, parcial[c] ?? 10]));

const activo = (extra = {}) => ({ activo: true, ...extra });

test("APAGADO no cambia nada: es la garantía de quien no quiere esta regla", () => {
  // Lo más importante del ajuste. Una mesa que no lo active no debe notar que
  // existe, ni siquiera con una ficha de un punto de fuerza.
  for (const puesto of STATIONS) {
    const veredicto = cumpleRequisito({
      puesto,
      caracteristicas: ficha({ str: 3, dex: 3, con: 3, int: 3, wis: 3, cha: 3 }),
      requisitos: { activo: false },
    });
    assert.equal(veredicto.ok, true, `${puesto} debería estar libre con la regla apagada`);
  }
  // Y sin ficha ninguna tampoco estorba.
  assert.equal(cumpleRequisito({ puesto: "weapons", caracteristicas: null }).ok, true);
});

test("basta UNA de las características del puesto, no todas", () => {
  // Un puesto no tiene una única forma de llevarse: las armas se sirven con
  // puntería o con fuerza bruta, y exigir las dos obligaría a construir la ficha
  // contra la idea del personaje.
  const soloFuerte = ficha({ str: 16, dex: 8 });
  const soloAgil = ficha({ str: 8, dex: 16 });
  assert.equal(cumpleRequisito({ puesto: "weapons", caracteristicas: soloFuerte, requisitos: activo() }).ok, true);
  assert.equal(cumpleRequisito({ puesto: "weapons", caracteristicas: soloAgil, requisitos: activo() }).ok, true);
});

test("por debajo del mínimo se cierra, y se dice cuánto falta", () => {
  // Una puerta que no explica su motivo se vive como un fallo del módulo.
  const flojo = ficha({ int: 11, wis: 9 });
  const veredicto = cumpleRequisito({ puesto: "engineering", caracteristicas: flojo, requisitos: activo() });
  assert.equal(veredicto.ok, false);
  assert.equal(veredicto.codigo, REQUISITO_ERRORES.PUNTUACION_BAJA);
  assert.equal(veredicto.minimo, MINIMO_POR_DEFECTO);
  assert.deepEqual(veredicto.exigidas, [...REQUISITOS_POR_DEFECTO.engineering]);
  assert.deepEqual(veredicto.mejor, { clave: "int", valor: 11 }, "dice cuál era su mejor baza");
});

test("sin ficha se bloquea, y es una elección, no un descuido", () => {
  // Dejar pasar convertiría el ajuste en una mentira: bastaría con no asignarse
  // personaje para saltárselo. El GM sigue pudiendo sentar a quien quiera, así
  // que nadie se queda encerrado.
  const veredicto = cumpleRequisito({ puesto: "sensors", caracteristicas: null, requisitos: activo() });
  assert.equal(veredicto.ok, false);
  assert.equal(veredicto.codigo, REQUISITO_ERRORES.SIN_FICHA);
});

test("levantarse del puesto siempre se puede", () => {
  // Quedarse atrapado en un puesto por no cumplir el requisito para salir sería
  // absurdo, y es el tipo de bucle que aparece al aplicar la regla sin mirar.
  assert.equal(cumpleRequisito({ puesto: null, caracteristicas: null, requisitos: activo() }).ok, true);
  assert.equal(cumpleRequisito({ puesto: "", caracteristicas: null, requisitos: activo() }).ok, true);
});

test("el GM está exento: una mesa mal configurada no se queda atascada", () => {
  const nadie = ficha({ str: 3, dex: 3, con: 3, int: 3, wis: 3, cha: 3 });
  const comoGM = puestosDisponibles({ caracteristicas: nadie, requisitos: activo(), esGM: true });
  assert.ok(comoGM.every((p) => p.ok && p.exento), "el GM puede recolocar a cualquiera");
  const comoJugador = puestosDisponibles({ caracteristicas: nadie, requisitos: activo(), esGM: false });
  assert.ok(comoJugador.every((p) => !p.ok), "y un jugador con esa ficha, a ninguno");
});

test("una tabla con erratas acota en vez de dejar la tripulación sin sentarse", () => {
  const roto = normalizarRequisitos({
    activo: "sí",
    minimo: 999,
    puestos: { engineering: ["magia", "int"], weapons: [], sensors: "no-es-lista" },
  });
  assert.equal(roto.activo, true, "cualquier valor con verdad activa");
  assert.equal(roto.minimo, MINIMO_POR_DEFECTO, "un mínimo imposible cae en el de serie");
  assert.deepEqual(roto.puestos.engineering, ["int"], "se descarta lo que no es una característica");
  assert.deepEqual(roto.puestos.weapons, [], "una lista vacía es un puesto que no pide nada");
  assert.deepEqual(roto.puestos.sensors, [...REQUISITOS_POR_DEFECTO.sensors]);
  // Un puesto sin exigencias no bloquea a nadie.
  assert.equal(cumpleRequisito({ puesto: "weapons", caracteristicas: null, requisitos: roto }).ok, true);
});

test("las características salen de la ficha, y ausencia no es cero", () => {
  const actor = { system: { abilities: { int: { value: 14 }, wis: { value: 8 } } } };
  assert.deepEqual(caracteristicasDeActor(actor), { int: 14, wis: 8 });
  // Sin ficha es null, no un objeto de ceros: son cosas distintas, igual que en
  // las barras de estado.
  for (const vacio of [null, undefined, {}, { system: {} }, { system: { abilities: {} } }]) {
    assert.equal(caracteristicasDeActor(vacio), null);
  }
});

// ---- Integración con la asignación -----------------------------------------

const usuario = (id, isGM = false) => {
  const flags = {};
  return {
    id,
    isGM,
    flags,
    getFlag: (mod, key) => flags[`${mod}.${key}`],
    setFlag: async (mod, key, v) => { flags[`${mod}.${key}`] = v; },
    unsetFlag: async (mod, key) => { delete flags[`${mod}.${key}`]; },
  };
};

test("assignStation rechaza el puesto que no se cumple, con su motivo", async () => {
  const jugador = usuario("p1");
  await assert.rejects(
    () =>
      assignStation({
        actor: jugador,
        target: jugador,
        station: "engineering",
        moduleId: "m",
        requisitos: activo(),
        caracteristicas: ficha({ int: 8, wis: 8 }),
      }),
    (error) => {
      assert.equal(error.code, STATION_ASSIGNMENT_ERRORS.REQUISITO);
      assert.equal(error.veredicto.codigo, REQUISITO_ERRORES.PUNTUACION_BAJA);
      return true;
    },
  );
  assert.equal(jugador.getFlag("m", "station"), undefined, "no se ha escrito el flag");
});

test("assignStation deja pasar a quien cumple, y al GM siempre", async () => {
  const jugador = usuario("p1");
  await assignStation({
    actor: jugador,
    target: jugador,
    station: "engineering",
    moduleId: "m",
    requisitos: activo(),
    caracteristicas: ficha({ int: 15 }),
  });
  assert.equal(jugador.getFlag("m", "station"), "engineering");

  const gm = usuario("gm", true);
  const pupilo = usuario("p2");
  await assignStation({
    actor: gm,
    target: pupilo,
    station: "weapons",
    moduleId: "m",
    requisitos: activo(),
    caracteristicas: ficha({ str: 3, dex: 3 }),
  });
  assert.equal(pupilo.getFlag("m", "station"), "weapons", "el GM sienta a quien quiere");
});

test("la lista marca el puesto cerrado y lo explica, sin hacerlo desaparecer", () => {
  // Si la opción desapareciera, parecería que el módulo se ha comido un puesto.
  const jugador = usuario("p1");
  const i18n = {
    localize: (k) => k,
    format: (k, datos) => `${k}:${datos.caracteristicas}:${datos.minimo}`,
  };
  const filas = stationRows({
    users: [jugador],
    actor: jugador,
    moduleId: "m",
    i18n,
    requisitos: activo(),
    caracteristicasDe: () => ficha({ int: 8, wis: 8, dex: 18 }),
  });
  const opciones = Object.fromEntries(filas[0].stations.map((o) => [o.value, o]));
  assert.equal(opciones.engineering.disabled, true, "ingeniería cerrada");
  assert.match(opciones.engineering.motivo, /PuntuacionBaja/, "y con su motivo");
  assert.equal(opciones.weapons.disabled, false, "armas abierta por destreza");
  assert.equal(opciones.engineering.label, "LAGUNAK.Puestos.engineering", "sigue listada");
  assert.equal(opciones[""].disabled, undefined, "«sin asignar» nunca se cierra");
});

test("el puesto que YA se ocupa no se cierra aunque cambien los requisitos", () => {
  // Si el GM sube el mínimo con gente sentada, la lista tiene que poder seguir
  // mostrando dónde está cada cual.
  const jugador = usuario("p1");
  jugador.flags["m.station"] = "engineering";
  const filas = stationRows({
    users: [jugador],
    actor: jugador,
    moduleId: "m",
    i18n: { localize: (k) => k, format: (k) => k },
    requisitos: activo({ minimo: 20 }),
    caracteristicasDe: () => ficha({ int: 8 }),
  });
  const suyo = filas[0].stations.find((o) => o.value === "engineering");
  assert.equal(suyo.disabled, false);
  assert.equal(suyo.selected, true);
});

test("con la regla apagada la lista no trae ni motivos ni opciones cerradas", () => {
  const jugador = usuario("p1");
  const filas = stationRows({
    users: [jugador],
    actor: jugador,
    moduleId: "m",
    i18n: { localize: (k) => k, format: (k) => k },
    requisitos: { activo: false },
    caracteristicasDe: () => null,
  });
  for (const opcion of filas[0].stations) {
    assert.ok(!opcion.disabled, `${opcion.value} no debería estar cerrada`);
    assert.equal(opcion.motivo ?? null, null);
  }
});

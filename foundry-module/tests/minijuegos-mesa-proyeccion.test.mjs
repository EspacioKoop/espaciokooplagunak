import assert from "node:assert/strict";
import test from "node:test";

import { diffProyeccion, proyectarMesa } from "../scripts/minijuegos/mesa-proyeccion.mjs";

test("mesa vacía: sin comunitarias y sin resultado no proyecta nada", () => {
  const proyeccion = proyectarMesa({ id: "m1", comunitarias: [], resultado: null });
  assert.deepEqual(proyeccion.cartas, []);
});

test("comunitarias a mitad de mano: cada una con su slot estable", () => {
  const proyeccion = proyectarMesa({ id: "m1", comunitarias: ["As", "Kd", "Qc"], resultado: null });
  assert.deepEqual(proyeccion.cartas, [
    { id: "m1:comunitaria:0", codigo: "As", slot: 0, faceUp: true, origen: "comunitaria" },
    { id: "m1:comunitaria:1", codigo: "Kd", slot: 1, faceUp: true, origen: "comunitaria" },
    { id: "m1:comunitaria:2", codigo: "Qc", slot: 2, faceUp: true, origen: "comunitaria" },
  ]);
});

test("showdown: las manos reveladas se proyectan por jugador", () => {
  const publico = {
    id: "m1",
    comunitarias: ["As", "Kd", "Qc", "Jh", "Ts"],
    resultado: {
      tipo: "showdown",
      manos: {
        u1: { cartas: ["9c", "9d"], mano: "Trío de 9" },
        u2: { cartas: ["2h", "3h"], mano: "Carta alta" },
      },
    },
  };
  const proyeccion = proyectarMesa(publico);
  const reveladas = proyeccion.cartas.filter((c) => c.origen === "revelada");
  assert.deepEqual(reveladas, [
    { id: "m1:revelada:u1:0", codigo: "9c", slot: 0, faceUp: true, origen: "revelada", userId: "u1" },
    { id: "m1:revelada:u1:1", codigo: "9d", slot: 1, faceUp: true, origen: "revelada", userId: "u1" },
    { id: "m1:revelada:u2:0", codigo: "2h", slot: 0, faceUp: true, origen: "revelada", userId: "u2" },
    { id: "m1:revelada:u2:1", codigo: "3h", slot: 1, faceUp: true, origen: "revelada", userId: "u2" },
  ]);
  assert.equal(proyeccion.cartas.filter((c) => c.origen === "comunitaria").length, 5);
});

test("un jugador retirado nunca aparece en `resultado.manos`, así que nunca se proyecta", () => {
  // `showdown()` en poker-motor.mjs solo mete en `manosReveladas` a quien
  // sigue en mano; un retirado no entra. Esta prueba no depende de esa
  // garantía del motor: si algún día un `resultado.manos` llegase con un
  // retirado colgado, este módulo lo proyectaría igual, porque su contrato
  // es leer lo que el `publico` diga que es público — la garantía de que un
  // retirado no aparece ahí vive en poker-motor.mjs, no aquí.
  const publico = { id: "m1", comunitarias: [], resultado: { manos: {} } };
  assert.deepEqual(proyectarMesa(publico).cartas, []);
});

test("mano siguiente: la proyección se reinicia sola (sin código de limpieza dedicado)", () => {
  const conResultado = proyectarMesa({
    id: "m1",
    comunitarias: ["As", "Kd"],
    resultado: { manos: { u1: { cartas: ["9c", "9d"] } } },
  });
  assert.ok(conResultado.cartas.length > 0);
  const manoNueva = proyectarMesa({ id: "m1", comunitarias: [], resultado: null });
  assert.deepEqual(manoNueva.cartas, []);
});

test("invariante: nunca lee tuMano/manos aunque vengan colgados en el publico", () => {
  const publicoConSecretos = {
    id: "m1",
    comunitarias: ["As"],
    resultado: null,
    // Estas dos claves solo existen en `vistaPrivada`, nunca en
    // `vistaPublica` — si llegasen aquí por error (p. ej. un cableado que
    // pasara la vista privada por descuido), la proyección no debe poder
    // filtrarlas: ni una lee `manos` ni `tuMano`.
    tuMano: ["Ah", "Ad"],
    manos: { u1: ["Ah", "Ad"], u2: ["2c", "2d"] },
  };
  const proyeccion = proyectarMesa(publicoConSecretos);
  assert.deepEqual(proyeccion.cartas, [
    { id: "m1:comunitaria:0", codigo: "As", slot: 0, faceUp: true, origen: "comunitaria" },
  ]);
  const codigosVisibles = proyeccion.cartas.map((c) => c.codigo);
  assert.ok(!codigosVisibles.includes("Ah"));
  assert.ok(!codigosVisibles.includes("Ad"));
  assert.ok(!codigosVisibles.includes("2c"));
});

test("ids no dependen del valor de carta: redealear el mismo slot es identidad estable", () => {
  const p1 = proyectarMesa({ id: "m1", comunitarias: ["As"], resultado: null });
  const p2 = proyectarMesa({ id: "m1", comunitarias: ["Kd"], resultado: null });
  assert.equal(p1.cartas[0].id, p2.cartas[0].id);
});

test("diffProyeccion: no-op cuando nada cambió", () => {
  const proyeccion = proyectarMesa({ id: "m1", comunitarias: ["As", "Kd"], resultado: null });
  const { crear, actualizar, eliminar } = diffProyeccion(proyeccion, proyeccion);
  assert.deepEqual(crear, []);
  assert.deepEqual(actualizar, []);
  assert.deepEqual(eliminar, []);
});

test("diffProyeccion: crear, actualizar y eliminar por id, sin depender del orden", () => {
  const anterior = proyectarMesa({ id: "m1", comunitarias: ["As", "Kd"], resultado: null });
  // Nueva proyección: la comunitaria 0 cambia de código (actualiza), la 1
  // desaparece (elimina) y aparece una 2 (crea). Se construye a mano y en
  // orden distinto para probar que el diff no depende del orden de entrada.
  const nueva = {
    cartas: [
      { id: "m1:comunitaria:2", codigo: "Qc", slot: 2, faceUp: true, origen: "comunitaria" },
      { id: "m1:comunitaria:0", codigo: "Th", slot: 0, faceUp: true, origen: "comunitaria" },
    ],
  };
  const { crear, actualizar, eliminar } = diffProyeccion(anterior, nueva);
  assert.deepEqual(
    crear.map((c) => c.id),
    ["m1:comunitaria:2"],
  );
  assert.deepEqual(
    actualizar.map((c) => c.id),
    ["m1:comunitaria:0"],
  );
  assert.deepEqual(eliminar, ["m1:comunitaria:1"]);
});

test("diffProyeccion: mesa cerrada (proyección vacía) elimina todo lo previo", () => {
  const anterior = proyectarMesa({
    id: "m1",
    comunitarias: ["As", "Kd", "Qc"],
    resultado: { manos: { u1: { cartas: ["9c", "9d"] } } },
  });
  const { crear, actualizar, eliminar } = diffProyeccion(anterior, { cartas: [] });
  assert.deepEqual(crear, []);
  assert.deepEqual(actualizar, []);
  assert.equal(eliminar.length, anterior.cartas.length);
});

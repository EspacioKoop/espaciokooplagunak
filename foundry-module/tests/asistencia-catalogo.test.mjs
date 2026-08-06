import assert from "node:assert/strict";
import test from "node:test";

import { CATALOGO_BASE, TAREAS_BASE, crearCatalogo } from "../scripts/asistencia/catalogo.mjs";
import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import { CLASES_ENFOQUE, MODOS, modoDeTarea } from "../scripts/asistencia/enfoques.mjs";
import { PARAMETRO_POR_ACCION } from "../scripts/asistencia/propuesta.mjs";
import { STATION_ACTIONS } from "../scripts/station-actions.mjs";
import { abrir, crearSesion } from "../scripts/asistencia/sesion.mjs";

test("el catálogo base se valida al importarlo, no en mitad de una crisis", () => {
  // `crearCatalogo()` corre `validarTarea` sobre cada entrada, así que el propio
  // import es la comprobación. Esta prueba solo fija que sigue siendo así.
  assert.ok(CATALOGO_BASE.tareas.length >= 3);
  for (const tarea of CATALOGO_BASE.tareas) {
    assert.ok(tarea.id, "toda tarea validada conserva su id");
    assert.ok(tarea.enfoques.length > 0);
    assert.ok(Object.isFrozen(tarea));
  }
});

test("una tarea que propone una orden la propone dentro de la matriz de autoridad", () => {
  // La regla dura del diseño: ayudar no puede hacer NADA que el puesto asistido
  // no pudiera pedir por sí mismo. Si esta prueba falla, el catálogo está
  // pidiendo autoridad nueva por la puerta de atrás.
  for (const tarea of CATALOGO_BASE.tareas) {
    if (!tarea.accionPropuesta) continue;
    const permitidas = STATION_ACTIONS[tarea.puestoAsistido] ?? [];
    assert.ok(
      permitidas.includes(tarea.accionPropuesta),
      `${tarea.id} propone ${tarea.accionPropuesta}, que ${tarea.puestoAsistido} no puede emitir`,
    );
    // Y sobre un parámetro con margen: sin él, «éxito» y «crítico» darían la
    // misma orden y el grado de éxito sería decorado.
    assert.ok(PARAMETRO_POR_ACCION[tarea.accionPropuesta], `${tarea.id} propone una acción sin margen`);
  }
});

test("sensores sale narrativa, y eso no es una tarea a medio hacer", () => {
  const sensores = CATALOGO_BASE.buscar("afinar-contacto-dudoso");
  assert.equal(sensores.puestoAsistido, "sensors");
  assert.equal(modoDeTarea(sensores), MODOS.NARRATIVO);
  // El reductor la rechaza a propósito: su fruto lo adjudica el GM en la mesa,
  // no una orden al puente que sensores no está autorizado a emitir.
  const resultado = abrir({ estado: crearSesion(), tarea: sensores, asistenteId: "a", nonce: "n" });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.error, "modo-narrativo");
});

test("el conjuro de ingeniería entra sin tirada, con banda fija y pagando", () => {
  // Clase (c): no hay a quién atacar, así que o entra sin tirada o no entra.
  const tarea = CATALOGO_BASE.buscar("estabilizar-sistema-caliente");
  const conjuro = tarea.enfoques.find((e) => e.id === "reparar-conjuro");
  assert.equal(conjuro.clase, CLASES_ENFOQUE.SIN_TIRADA);
  assert.equal(conjuro.bandaFija, BANDAS.EXITO);
  assert.notEqual(conjuro.bandaFija, BANDAS.CRITICO, "pagar un espacio no compra el tramo alto");
  assert.ok(conjuro.coste, "y gasta recurso de la ficha de verdad");

  // El que no gasta nada es el que siempre está: sin él, una tarea entera
  // quedaría detrás del permiso de recursos del GM.
  assert.ok(tarea.enfoques.some((e) => !e.coste));
});

test("bordar-maniobra y estabilizar-sistema-caliente usan minijuegos de destreza distintos (#500)", () => {
  // El repertorio se amplió justo para que no todas las tareas se jugaran
  // igual sin dnd5e; si esta prueba falla, el catálogo dejó de ejercitar el
  // repertorio completo.
  assert.equal(CATALOGO_BASE.buscar("bordar-maniobra").minijuegoDestreza, "secuencia");
  assert.equal(CATALOGO_BASE.buscar("estabilizar-sistema-caliente").minijuegoDestreza, "precision");
  assert.equal(CATALOGO_BASE.buscar("afinar-contacto-dudoso").minijuegoDestreza, undefined);
});

test("buscar una tarea que nadie declaró devuelve null en vez de reventar", () => {
  // El relevo ya sabe responder TAREA_DESCONOCIDA; un catálogo que lanza
  // convertiría una petición inventada en un error de consola del GM.
  assert.equal(CATALOGO_BASE.buscar("no-existe"), null);
  assert.equal(CATALOGO_BASE.buscar(undefined), null);
});

test("una mesa puede traer sus tareas sin que el motor sepa que hay más de un catálogo", () => {
  const mia = {
    id: "recalibrar-a-mano",
    puestoAsistido: "engineering",
    accionPropuesta: "set_system_power",
    enfoques: [{ id: "a-ojo", clase: CLASES_ENFOQUE.PRUEBA, cd: 12 }],
  };
  const catalogo = crearCatalogo([...TAREAS_BASE, mia]);
  assert.equal(catalogo.buscar("recalibrar-a-mano").id, "recalibrar-a-mano");
  assert.equal(catalogo.buscar("estabilizar-sistema-caliente").id, "estabilizar-sistema-caliente");
  assert.equal(catalogo.paraPuesto("engineering").length, 2);
  // Y el base no se entera de que alguien construyó otro.
  assert.equal(CATALOGO_BASE.buscar("recalibrar-a-mano"), null);
});

test("dos tareas con el mismo id se rechazan al construir, no se pisan en silencio", () => {
  const duplicada = { ...TAREAS_BASE[0] };
  assert.throws(() => crearCatalogo([...TAREAS_BASE, duplicada]), /mismo id/);
});

test("una tarea rota se cae al construir el catálogo, no al intentar ayudar", () => {
  assert.throws(() =>
    crearCatalogo([{ id: "sin-cd", puestoAsistido: "engineering", accionPropuesta: "set_system_coolant",
      enfoques: [{ id: "x", clase: CLASES_ENFOQUE.PRUEBA }] }]),
  );
});

test("paraPuesto lista lo que se le puede ofrecer a quien quiere echar una mano", () => {
  assert.deepEqual(
    CATALOGO_BASE.paraPuesto("navigation").map((t) => t.id),
    ["bordar-maniobra"],
  );
  // Un puesto sin tareas declaradas no es un error: es que hoy no hay forma de
  // ayudarle, y la interfaz tiene que poder decirlo sin romperse.
  assert.deepEqual(CATALOGO_BASE.paraPuesto("communications"), []);
});

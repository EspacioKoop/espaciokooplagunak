import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import { CLASES_ENFOQUE } from "../scripts/asistencia/enfoques.mjs";
import {
  SESION_ERRORES,
  abrir,
  asistenciasDe,
  consumir,
  crearSesion,
  podar,
  resolver,
} from "../scripts/asistencia/sesion.mjs";
import { TIERS } from "../scripts/asistencia/propuesta.mjs";
import { buildStationOrder } from "../scripts/station-order-relay.mjs";

const T0 = 1_000_000;
const VIGENCIA = 120_000;

/** La rebanada mínima del diseño: ingeniería, refrigerante, enfoque de clase (a). */
const TAREA = Object.freeze({
  id: "estabilizar-sistema-caliente",
  puestoAsistido: "engineering",
  accionPropuesta: "set_system_coolant",
  enfoques: Object.freeze([
    Object.freeze({ id: "herramientas", clase: CLASES_ENFOQUE.PRUEBA, cd: 13 }),
    Object.freeze({ id: "conjuro", clase: CLASES_ENFOQUE.PRUEBA, cd: 10, coste: { espacio: 1 } }),
  ]),
});

const abrirUno = (estado, extra = {}) =>
  abrir({ estado, tarea: TAREA, asistenteId: "ayudante-1", nonce: "n1", ahora: T0, ...extra });

test("abrir reserva el hueco y ofrece el rango de éxito antes de tirar", () => {
  const { ok, oferta, reserva, estado } = abrirUno(crearSesion(), { tieneFicha: true, modificadores: { herramientas: 5 } });
  assert.equal(ok, true);
  assert.equal(oferta.via, "habilidad");
  // El enfoque con coste no se ofrece si el GM no abrió esa vía.
  assert.deepEqual(
    oferta.enfoques.map((e) => e.enfoque.id),
    ["herramientas"],
  );
  const rango = oferta.enfoques[0].rango;
  assert.equal(rango.via, "probabilidad");
  assert.ok(rango.favorable > 0 && rango.favorable < 1);
  assert.equal(reserva.puestoAsistido, "engineering");
  assert.equal(estado.reservas.length, 1);
});

test("sin ficha la oferta se degrada al reto de destreza, no se cae", () => {
  const { ok, oferta } = abrirUno(crearSesion(), { tieneFicha: false });
  assert.equal(ok, true);
  assert.equal(oferta.via, "destreza");
  assert.deepEqual(oferta.enfoques, []);
});

test("el GM puede abrir la vía de los enfoques con coste", () => {
  const { oferta } = abrirUno(crearSesion(), { tieneFicha: true, gmPermiteRecursos: true });
  assert.deepEqual(
    oferta.enfoques.map((e) => e.enfoque.id),
    ["herramientas", "conjuro"],
  );
});

test("una tarea narrativa no entra en el reductor: su fruto lo adjudica el GM", () => {
  const narrativa = { ...TAREA, puestoAsistido: "relay", accionPropuesta: null };
  const resultado = abrir({ estado: crearSesion(), tarea: narrativa, asistenteId: "a", nonce: "n" });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.error, SESION_ERRORES.MODO_NARRATIVO);
});

test("el presupuesto se cobra en la APERTURA, antes de que nadie gaste recursos", () => {
  const primera = abrirUno(crearSesion(), { tieneFicha: true });
  const segunda = abrir({
    estado: primera.estado,
    tarea: TAREA,
    asistenteId: "ayudante-2",
    nonce: "n2",
    ahora: T0,
    tieneFicha: true,
  });
  assert.equal(segunda.ok, false);
  assert.equal(segunda.error, SESION_ERRORES.PRESUPUESTO_AGOTADO);
  assert.equal(segunda.estado.reservas.length, 1);
});

test("el mismo ayudante no abre dos retos sobre el mismo puesto", () => {
  const primera = abrirUno(crearSesion());
  const otra = abrirUno(primera.estado, { nonce: "n2" });
  assert.equal(otra.ok, false);
  assert.equal(otra.error, SESION_ERRORES.YA_ASISTE);
});

test("dos puestos no comparten nonce: la segunda apertura se rechaza sin tocar la primera", () => {
  // El nonce identifica la asistencia hasta que se consume. Si se admitiera
  // repetido, `resolver({ nonce })` resolvía una reserva y borraba las dos: la
  // otra perdía su hueco sin haber sido resuelta.
  const ingenieria = abrirUno(crearSesion());
  const navegacion = abrir({
    estado: ingenieria.estado,
    tarea: { ...TAREA, id: "trazar-rumbo", puestoAsistido: "navigation", accionPropuesta: "set_impulse" },
    asistenteId: "ayudante-2",
    nonce: "n1",
    ahora: T0,
  });
  assert.equal(navegacion.ok, false);
  assert.equal(navegacion.error, SESION_ERRORES.NONCE_REPETIDO);
  assert.deepEqual(navegacion.estado.reservas, ingenieria.estado.reservas);

  // Y la reserva original resuelve como si nada hubiera pasado.
  const resuelta = resolver({ estado: navegacion.estado, nonce: "n1", banda: BANDAS.EXITO, ahora: T0 });
  assert.equal(resuelta.ok, true);
  assert.equal(resuelta.estado.reservas.length, 0);
  assert.equal(resuelta.estado.propuestas.length, 1);
  assert.equal(resuelta.estado.propuestas[0].puestoAsistido, "engineering");
});

test("un nonce ya consumido no se puede reabrir: su coste ya se cobró", () => {
  const abierta = abrirUno(crearSesion());
  const resuelta = resolver({ estado: abierta.estado, nonce: "n1", banda: BANDAS.EXITO, ahora: T0 });
  const gastada = consumir({
    estado: resuelta.estado,
    nonce: "n1",
    emisorId: "ingeniero",
    emisorPuesto: "engineering",
    accion: TAREA.accionPropuesta,
    params: { system: "reactor", level: 10 },
    base: 0,
    ahora: T0,
  });
  assert.equal(gastada.ok, true);
  const rebote = abrirUno(gastada.estado, { asistenteId: "ayudante-3" });
  assert.equal(rebote.ok, false);
  assert.equal(rebote.error, SESION_ERRORES.NONCE_REPETIDO);
});

test("una propuesta viva sigue ocupando el hueco del puesto", () => {
  const abierta = abrirUno(crearSesion());
  const resuelta = resolver({ estado: abierta.estado, nonce: "n1", banda: BANDAS.EXITO, ahora: T0 });
  const otro = abrir({
    estado: resuelta.estado,
    tarea: TAREA,
    asistenteId: "ayudante-2",
    nonce: "n2",
    ahora: T0,
  });
  assert.equal(otro.ok, false);
  assert.equal(otro.error, SESION_ERRORES.PRESUPUESTO_AGOTADO);
});

test("la reserva caduca sola y libera el puesto", () => {
  const abierta = abrirUno(crearSesion());
  const despues = T0 + VIGENCIA + 1;
  const otro = abrir({
    estado: abierta.estado,
    tarea: TAREA,
    asistenteId: "ayudante-2",
    nonce: "n2",
    ahora: despues,
  });
  assert.equal(otro.ok, true);
  assert.equal(otro.estado.reservas.length, 1);
});

test("un fallo libera el hueco y no deja token", () => {
  const abierta = abrirUno(crearSesion());
  const resuelta = resolver({ estado: abierta.estado, nonce: "n1", banda: BANDAS.FALLO, ahora: T0 });
  assert.equal(resuelta.ok, false);
  assert.equal(resuelta.error, SESION_ERRORES.BANDA_SIN_FRUTO);
  assert.deepEqual(resuelta.estado.reservas, []);
  assert.deepEqual(resuelta.estado.propuestas, []);
});

test("resolver dos veces la misma reserva no duplica la propuesta", () => {
  const abierta = abrirUno(crearSesion());
  const primera = resolver({ estado: abierta.estado, nonce: "n1", banda: BANDAS.EXITO, ahora: T0 });
  const segunda = resolver({ estado: primera.estado, nonce: "n1", banda: BANDAS.CRITICO, ahora: T0 });
  assert.equal(segunda.ok, false);
  assert.equal(segunda.error, SESION_ERRORES.RESERVA_DESCONOCIDA);
  assert.equal(segunda.estado.propuestas.length, 1);
  assert.equal(segunda.estado.propuestas[0].banda, BANDAS.EXITO);
});

test("los dos caminos de resolución producen la misma propuesta con la misma banda", () => {
  const porTirada = resolver({
    estado: abrirUno(crearSesion(), { tieneFicha: true }).estado,
    nonce: "n1",
    banda: BANDAS.EXITO,
    ahora: T0,
  });
  const porDestreza = resolver({
    estado: abrirUno(crearSesion(), { tieneFicha: false }).estado,
    nonce: "n1",
    banda: BANDAS.EXITO,
    ahora: T0,
  });
  assert.deepEqual(porTirada.propuesta, porDestreza.propuesta);
});

test("el titular gasta la propuesta y sale una orden suya, acotada por el tier", () => {
  const abierta = abrirUno(crearSesion());
  const resuelta = resolver({ estado: abierta.estado, nonce: "n1", banda: BANDAS.EXITO, ahora: T0 });
  const gastada = consumir({
    estado: resuelta.estado,
    nonce: "n1",
    emisorId: "ingeniero",
    emisorPuesto: "engineering",
    accion: TAREA.accionPropuesta,
    params: { system: "reactor", level: 10 },
    base: 0,
    ahora: T0,
  });
  assert.equal(gastada.ok, true);
  assert.equal(gastada.orden.action, "set_system_coolant");
  // Éxito = tier bajo: la mitad del trayecto pedido, nunca por encima del máximo.
  assert.equal(gastada.orden.params.level, 5);
  assert.equal(gastada.credito.asistenteId, "ayudante-1");
  assert.equal(gastada.credito.emisorId, "ingeniero");
  assert.equal(gastada.credito.tier, TIERS.BAJO);
  // La orden es una orden normal del puesto: pasa por el mismo relé que las suyas.
  assert.deepEqual(buildStationOrder({ ...gastada.orden, nonce: "orden-1" }), {
    action: "set_system_coolant",
    params: { system: "reactor", level: 5 },
    nonce: "orden-1",
  });
  assert.deepEqual(gastada.estado.propuestas, []);
  assert.deepEqual([...gastada.estado.consumidos], ["n1"]);
});

test("el crítico sube de tier, no de rango", () => {
  const abierta = abrirUno(crearSesion());
  const resuelta = resolver({ estado: abierta.estado, nonce: "n1", banda: BANDAS.CRITICO, ahora: T0 });
  const gastada = consumir({
    estado: resuelta.estado,
    nonce: "n1",
    emisorId: "ingeniero",
    emisorPuesto: "engineering",
    accion: TAREA.accionPropuesta,
    params: { system: "reactor", level: 99 },
    base: 0,
    ahora: T0,
  });
  assert.equal(gastada.ok, true);
  // 99 se recorta al máximo autorizado del contrato del puente, no lo desborda.
  assert.equal(gastada.orden.params.level, 10);
});

test("quien no es el titular no cobra la ayuda, aunque la propuesta esté viva", () => {
  const resuelta = resolver({
    estado: abrirUno(crearSesion()).estado,
    nonce: "n1",
    banda: BANDAS.EXITO,
    ahora: T0,
  });
  const intruso = consumir({
    estado: resuelta.estado,
    nonce: "n1",
    emisorId: "artillero",
    emisorPuesto: "weapons",
    accion: TAREA.accionPropuesta,
    params: { system: "reactor", level: 10 },
    base: 0,
    ahora: T0,
  });
  assert.equal(intruso.ok, false);
  assert.equal(intruso.error, SESION_ERRORES.NO_ES_TITULAR);
  assert.equal(intruso.estado.propuestas.length, 1);
});

test("una propuesta gastada no vuelve a servir", () => {
  const resuelta = resolver({
    estado: abrirUno(crearSesion()).estado,
    nonce: "n1",
    banda: BANDAS.EXITO,
    ahora: T0,
  });
  const params = { system: "reactor", level: 10 };
  const primera = consumir({
    estado: resuelta.estado,
    nonce: "n1",
    emisorId: "ingeniero",
    emisorPuesto: "engineering",
    accion: TAREA.accionPropuesta,
    params,
    base: 0,
    ahora: T0,
  });
  const segunda = consumir({
    estado: primera.estado,
    nonce: "n1",
    emisorId: "ingeniero",
    emisorPuesto: "engineering",
    accion: TAREA.accionPropuesta,
    params,
    base: 0,
    ahora: T0,
  });
  assert.equal(segunda.ok, false);
  assert.equal(segunda.error, SESION_ERRORES.YA_CONSUMIDA);
});

test("una propuesta caducada no se gasta", () => {
  const resuelta = resolver({
    estado: abrirUno(crearSesion()).estado,
    nonce: "n1",
    banda: BANDAS.EXITO,
    ahora: T0,
  });
  const tarde = consumir({
    estado: resuelta.estado,
    nonce: "n1",
    emisorId: "ingeniero",
    emisorPuesto: "engineering",
    accion: TAREA.accionPropuesta,
    params: { system: "reactor", level: 10 },
    base: 0,
    ahora: T0 + VIGENCIA + 1,
  });
  assert.equal(tarde.ok, false);
  assert.equal(tarde.error, SESION_ERRORES.CADUCADA);
});

test("podar no cambia el estado si no hay nada caducado", () => {
  const { estado } = abrirUno(crearSesion());
  assert.equal(podar(estado, T0), estado);
});

test("asistenciasDe cuenta lo vivo de un puesto y nada del vecino", () => {
  const abierta = abrirUno(crearSesion());
  const enCurso = asistenciasDe(abierta.estado, "engineering", T0);
  assert.equal(enCurso.reservas.length, 1);
  assert.equal(enCurso.propuestas.length, 0);
  assert.deepEqual(asistenciasDe(abierta.estado, "weapons", T0).reservas, []);
  assert.deepEqual(asistenciasDe(abierta.estado, "engineering", T0 + VIGENCIA + 1).reservas, []);
});

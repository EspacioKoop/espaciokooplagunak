import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import { CLASES_ENFOQUE } from "../scripts/asistencia/enfoques.mjs";
import {
  SESION_ERRORES,
  abrir,
  asistenciasDe,
  cerrarCrisisMando,
  consumir,
  crearSesion,
  declararOrdenMando,
  estadoMando,
  iniciarCrisisMando,
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

test("con habilidad declarada y ficha real, el modificador sale de la ficha (#500)", () => {
  const tareaConHabilidad = {
    ...TAREA,
    enfoques: [{ id: "herramientas", clase: CLASES_ENFOQUE.PRUEBA, cd: 13, habilidad: "tool:tinker" }],
  };
  const ficha = { tools: { tinker: { total: 6 } } };
  const { oferta } = abrir({
    estado: crearSesion(),
    tarea: tareaConHabilidad,
    asistenteId: "ayudante-1",
    nonce: "n1",
    ahora: T0,
    tieneFicha: true,
    ficha,
  });
  assert.equal(oferta.enfoques[0].rango.modificador, 6);
});

test("un override explícito en `modificadores` gana a la ficha, no al revés", () => {
  const tareaConHabilidad = {
    ...TAREA,
    enfoques: [{ id: "herramientas", clase: CLASES_ENFOQUE.PRUEBA, cd: 13, habilidad: "tool:tinker" }],
  };
  const ficha = { tools: { tinker: { total: 6 } } };
  const { oferta } = abrir({
    estado: crearSesion(),
    tarea: tareaConHabilidad,
    asistenteId: "ayudante-1",
    nonce: "n1",
    ahora: T0,
    tieneFicha: true,
    ficha,
    modificadores: { herramientas: 99 },
  });
  assert.equal(oferta.enfoques[0].rango.modificador, 99);
});

test("sin `habilidad` declarada, o sin ficha, el modificador sigue siendo 0 como siempre", () => {
  // Compatibilidad: una tarea escrita antes de #500 no cambia de comportamiento
  // por el mero hecho de que ahora exista una ficha real.
  const { oferta: sinHabilidad } = abrirUno(crearSesion(), { tieneFicha: true, ficha: { tools: { tinker: { total: 9 } } } });
  assert.equal(sinHabilidad.enfoques[0].rango.modificador, 0);

  const tareaConHabilidad = {
    ...TAREA,
    enfoques: [{ id: "herramientas", clase: CLASES_ENFOQUE.PRUEBA, cd: 13, habilidad: "tool:tinker" }],
  };
  const { oferta: sinFicha } = abrir({
    estado: crearSesion(),
    tarea: tareaConHabilidad,
    asistenteId: "ayudante-1",
    nonce: "n1",
    ahora: T0,
    tieneFicha: true,
    ficha: null,
  });
  assert.equal(sinFicha.enfoques[0].rango.modificador, 0);
});

test("sin ficha la oferta se degrada al reto de destreza, no se cae", () => {
  const { ok, oferta } = abrirUno(crearSesion(), { tieneFicha: false });
  assert.equal(ok, true);
  assert.equal(oferta.via, "destreza");
  assert.deepEqual(oferta.enfoques, []);
  // Sin declarar minijuegoDestreza en la tarea, se asume temporización: es
  // compatibilidad hacia atrás con las tareas escritas antes de #500.
  assert.equal(oferta.minijuegoDestreza, "temporizacion");
});

test("la oferta lleva el minijuego de destreza que declaró la tarea (#500)", () => {
  const tareaSecuencia = { ...TAREA, minijuegoDestreza: "secuencia" };
  const { ok, oferta } = abrir({
    estado: crearSesion(),
    tarea: tareaSecuencia,
    asistenteId: "ayudante-1",
    nonce: "n1",
    ahora: T0,
    tieneFicha: false,
  });
  assert.equal(ok, true);
  assert.equal(oferta.minijuegoDestreza, "secuencia");
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

test("las órdenes de mando nacen con la crisis, son dos y mueren al cerrarla", () => {
  const vacia = crearSesion();
  assert.deepEqual(estadoMando(vacia), {
    crisisActiva: false,
    disponibles: 0,
    ventajaActiva: null,
  });

  const abierta = iniciarCrisisMando(vacia);
  assert.deepEqual(estadoMando(abierta), {
    crisisActiva: true,
    disponibles: 2,
    ventajaActiva: null,
  });

  const declarada = declararOrdenMando({
    estado: abierta,
    puestoAsistido: "engineering",
    nonce: "mando-1",
  });
  assert.equal(declarada.ok, true);
  assert.deepEqual(estadoMando(declarada.estado), {
    crisisActiva: true,
    disponibles: 1,
    ventajaActiva: { puestoAsistido: "engineering" },
  });

  const cerrada = cerrarCrisisMando(declarada.estado);
  assert.deepEqual(estadoMando(cerrada), {
    crisisActiva: false,
    disponibles: 0,
    ventajaActiva: null,
  });
});

test("la orden mejora y consume atómicamente solo la próxima asistencia del puesto elegido", () => {
  const crisis = iniciarCrisisMando(crearSesion());
  const mandada = declararOrdenMando({
    estado: crisis,
    puestoAsistido: "navigation",
    nonce: "mando-1",
  });

  const ingenieria = abrirUno(mandada.estado, { nonce: "ayuda-ingenieria" });
  const falloAjeno = resolver({
    estado: ingenieria.estado,
    nonce: "ayuda-ingenieria",
    banda: BANDAS.FALLO,
    ahora: T0,
  });
  assert.equal(falloAjeno.ok, false, "una orden para navegación no mejora ingeniería");
  assert.equal(estadoMando(falloAjeno.estado).ventajaActiva?.puestoAsistido, "navigation");

  const tareaNavegacion = {
    ...TAREA,
    id: "bordar-maniobra",
    puestoAsistido: "navigation",
    accionPropuesta: "set_impulse",
  };
  const navegacion = abrir({
    estado: falloAjeno.estado,
    tarea: tareaNavegacion,
    asistenteId: "ayudante-2",
    nonce: "ayuda-navegacion",
    ahora: T0,
  });
  const mejorada = resolver({
    estado: navegacion.estado,
    nonce: "ayuda-navegacion",
    banda: BANDAS.FALLO,
    ahora: T0,
  });
  assert.equal(mejorada.ok, true, "fallo sube a éxito y produce propuesta");
  assert.equal(mejorada.propuesta.banda, BANDAS.EXITO);
  assert.deepEqual(estadoMando(mejorada.estado), {
    crisisActiva: true,
    disponibles: 1,
    ventajaActiva: null,
  });

  const repetida = resolver({
    estado: mejorada.estado,
    nonce: "ayuda-navegacion",
    banda: BANDAS.FALLO,
    ahora: T0,
  });
  assert.equal(repetida.ok, false);
  assert.equal(repetida.error, SESION_ERRORES.RESERVA_DESCONOCIDA);
  assert.equal(estadoMando(repetida.estado).ventajaActiva, null, "el reintento no resucita la orden");
});

test("una crisis no admite acumulación, repetición ni gasto por encima del presupuesto", () => {
  const crisis = iniciarCrisisMando(crearSesion(), 1);
  const primera = declararOrdenMando({
    estado: crisis,
    puestoAsistido: "engineering",
    nonce: "mando-1",
  });

  const repetida = declararOrdenMando({
    estado: primera.estado,
    puestoAsistido: "engineering",
    nonce: "mando-1",
  });
  assert.equal(repetida.error, SESION_ERRORES.ORDEN_MANDO_REPETIDA);
  assert.equal(repetida.estado, primera.estado, "repetir el evento no vuelve a cobrar");

  const acumulada = declararOrdenMando({
    estado: primera.estado,
    puestoAsistido: "navigation",
    nonce: "mando-2",
  });
  assert.equal(acumulada.error, SESION_ERRORES.ORDEN_MANDO_PENDIENTE);

  const abierta = abrirUno(primera.estado);
  const consumida = resolver({ estado: abierta.estado, nonce: "n1", banda: BANDAS.EXITO, ahora: T0 });
  const agotada = declararOrdenMando({
    estado: consumida.estado,
    puestoAsistido: "engineering",
    nonce: "mando-2",
  });
  assert.equal(agotada.error, SESION_ERRORES.ORDENES_AGOTADAS);
  assert.equal(estadoMando(agotada.estado).disponibles, 0);
});

test("repetir la apertura no repone órdenes durante la misma crisis", () => {
  const abierta = iniciarCrisisMando(crearSesion(), 1);
  const declarada = declararOrdenMando({
    estado: abierta,
    puestoAsistido: "engineering",
    nonce: "mando-idempotente",
  });
  const repetida = iniciarCrisisMando(declarada.estado, 99);
  assert.equal(repetida, declarada.estado);
  assert.deepEqual(estadoMando(repetida), {
    crisisActiva: true,
    disponibles: 0,
    ventajaActiva: { puestoAsistido: "engineering" },
  });
});

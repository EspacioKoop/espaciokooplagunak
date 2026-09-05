// Pruebas de la costura entre la asistencia (#309) y el relé de órdenes (#237).
//
// Lo que se defiende aquí no son las reglas —eso ya lo cubren las pruebas de
// bandas, propuesta y sesión— sino las tres promesas del cableado: la ayuda
// nunca emite por su cuenta, la identidad no se declara nunca, y una ayuda que
// falla no bloquea la orden del titular.

import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import { CLASES_ENFOQUE } from "../scripts/asistencia/enfoques.mjs";
import {
  SESION_ERRORES,
  crearSesion,
  estadoMando,
  iniciarCrisisMando,
} from "../scripts/asistencia/sesion.mjs";
import { PROPUESTA_ERRORES } from "../scripts/asistencia/propuesta.mjs";
import {
  ASISTENCIA_FLAG,
  CAMPO_ASISTENCIA,
  RELEVO_AVISOS,
  RELEVO_ERRORES,
  construirPeticionConsultaMando,
  construirPeticionOrdenMando,
  construirPeticionAsistencia,
  despacharCambioDeAsistencia,
  despacharPeticion,
  extraerPeticionDeCambio,
  prepararOrdenAsistida,
} from "../scripts/asistencia/relevo.mjs";

const MODULO = "lagunak";
const T0 = 1_000_000;
const VIGENCIA = 120_000;

// La rebanada mínima del diseño: ingeniería, refrigerante, enfoque de clase (a).
const TAREA = Object.freeze({
  id: "estabilizar-sistema-caliente",
  puestoAsistido: "engineering",
  accionPropuesta: "set_system_coolant",
  enfoques: Object.freeze([
    Object.freeze({ id: "herramientas", clase: CLASES_ENFOQUE.PRUEBA, cd: 13 }),
  ]),
});

const buscarTarea = (id) => (id === TAREA.id ? TAREA : null);

const cambioCon = (peticion) => ({
  changes: { flags: { [MODULO]: { [ASISTENCIA_FLAG]: peticion } } },
  userDoc: { id: "ayudante-1", flags: { [MODULO]: { [ASISTENCIA_FLAG]: peticion } } },
  moduleId: MODULO,
});

// Sesión con una propuesta viva de ayudante-1 para ingeniería.
function conPropuesta(banda = BANDAS.EXITO) {
  const abierta = despacharPeticion({
    estado: crearSesion(),
    asistenteId: "ayudante-1",
    peticion: construirPeticionAsistencia({ tipo: "abrir", tareaId: TAREA.id, nonce: "n1" }),
    buscarTarea,
    ahora: T0,
    opcionesApertura: { tieneFicha: true, vigenciaMs: VIGENCIA },
  });
  assert.equal(abierta.ok, true);
  const resuelta = despacharPeticion({
    estado: abierta.estado,
    asistenteId: "ayudante-1",
    peticion: construirPeticionAsistencia({ tipo: "resolver", nonce: "n1", banda }),
    buscarTarea,
    ahora: T0 + 1_000,
  });
  assert.equal(resuelta.ok, true, resuelta.error);
  return resuelta.estado;
}

// --- Lado asistente --------------------------------------------------------

test("la petición no declara identidad: solo tipo, tarea y nonce", () => {
  const peticion = construirPeticionAsistencia({ tipo: "abrir", tareaId: TAREA.id, nonce: "n1" });
  assert.deepEqual(Object.keys(peticion).sort(), ["banda", "enfoqueId", "nonce", "tareaId", "tipo"]);
  assert.equal("asistenteId" in peticion, false);
  assert.equal("userId" in peticion, false);
});

test("una petición sin lo imprescindible no se construye a medias", () => {
  assert.throws(() => construirPeticionAsistencia({ tipo: "ayudar", nonce: "n1" }), TypeError);
  assert.throws(() => construirPeticionAsistencia({ tipo: "abrir", tareaId: TAREA.id }), TypeError);
  assert.throws(() => construirPeticionAsistencia({ tipo: "abrir", nonce: "n1" }), TypeError);
});

test("la petición se lee del User ya actualizado, no del diferencial a medias", () => {
  const completa = construirPeticionAsistencia({ tipo: "resolver", nonce: "n1", banda: BANDAS.EXITO });
  // Foundry entrega solo lo que cambió: aquí, la banda. El documento tiene el resto.
  const extraida = extraerPeticionDeCambio({
    changes: { flags: { [MODULO]: { [ASISTENCIA_FLAG]: { banda: BANDAS.EXITO } } } },
    userDoc: { id: "ayudante-1", flags: { [MODULO]: { [ASISTENCIA_FLAG]: completa } } },
    moduleId: MODULO,
  });
  assert.deepEqual(extraida, completa);
});

test("un cambio ajeno a nuestro flag no es una petición", () => {
  assert.equal(
    extraerPeticionDeCambio({
      changes: { flags: { [MODULO]: { otraCosa: { tipo: "abrir", nonce: "n1" } } } },
      userDoc: { id: "u1", flags: {} },
      moduleId: MODULO,
    }),
    null,
  );
  assert.equal(extraerPeticionDeCambio({ changes: { name: "Ana" }, userDoc: {}, moduleId: MODULO }), null);
  // Y una petición con un tipo inventado tampoco entra.
  assert.equal(extraerPeticionDeCambio(cambioCon({ tipo: "emitir", nonce: "n1" })), null);
});

// --- Lado GM ---------------------------------------------------------------

test("el asistente es el del documento, nunca el que declare la petición", () => {
  const peticion = { ...construirPeticionAsistencia({ tipo: "abrir", tareaId: TAREA.id, nonce: "n1" }), asistenteId: "otro" };
  const salida = despacharCambioDeAsistencia({
    estado: crearSesion(),
    ...cambioCon(peticion),
    buscarTarea,
    ahora: T0,
  });
  assert.equal(salida.ok, true);
  assert.equal(salida.reserva.asistenteId, "ayudante-1");
});

test("la matriz de puestos puede negar la ayuda antes de que nadie tire", () => {
  const salida = despacharPeticion({
    estado: crearSesion(),
    asistenteId: "ayudante-1",
    peticion: construirPeticionAsistencia({ tipo: "abrir", tareaId: TAREA.id, nonce: "n1" }),
    buscarTarea,
    puedeAsistir: () => false,
    ahora: T0,
  });
  assert.equal(salida.ok, false);
  assert.equal(salida.error, RELEVO_ERRORES.NO_PUEDE_ASISTIR);
  assert.deepEqual(salida.estado.reservas, []);
});

test("una tarea que nadie declaró no abre reserva", () => {
  const salida = despacharPeticion({
    estado: crearSesion(),
    asistenteId: "ayudante-1",
    peticion: construirPeticionAsistencia({ tipo: "abrir", tareaId: "inventada", nonce: "n1" }),
    buscarTarea,
    ahora: T0,
  });
  assert.equal(salida.ok, false);
  assert.equal(salida.error, RELEVO_ERRORES.TAREA_DESCONOCIDA);
});

test("nadie resuelve la reserva de otro", () => {
  const abierta = despacharPeticion({
    estado: crearSesion(),
    asistenteId: "ayudante-1",
    peticion: construirPeticionAsistencia({ tipo: "abrir", tareaId: TAREA.id, nonce: "n1" }),
    buscarTarea,
    ahora: T0,
    opcionesApertura: { tieneFicha: true },
  });
  const robo = despacharPeticion({
    estado: abierta.estado,
    asistenteId: "listillo",
    peticion: construirPeticionAsistencia({ tipo: "resolver", nonce: "n1", banda: BANDAS.CRITICO }),
    buscarTarea,
    ahora: T0 + 1_000,
  });
  assert.equal(robo.ok, false);
  assert.equal(robo.error, RELEVO_ERRORES.NO_ES_SU_RESERVA);
  // Y la reserva del legítimo sigue en pie, sin gastar.
  assert.equal(robo.estado.reservas.length, 1);
});

test("solo el GM primario despacha, o dos coordinadores gastarían el mismo hueco", () => {
  const peticion = construirPeticionAsistencia({ tipo: "abrir", tareaId: TAREA.id, nonce: "n1" });
  assert.equal(
    despacharCambioDeAsistencia({
      estado: crearSesion(),
      ...cambioCon(peticion),
      buscarTarea,
      canHandle: () => false,
      ahora: T0,
    }),
    null,
  );
});

// --- Donde se cobra: la orden del titular ----------------------------------

test("una orden sin asistencia pasa tal cual, y sin tocar la sesión", () => {
  const estado = conPropuesta();
  const salida = prepararOrdenAsistida({
    estado,
    userId: "ingeniera",
    orden: { action: "set_system_coolant", params: { system: "reactor", level: 6 }, nonce: "o1" },
    resolverPuesto: () => "engineering",
    ahora: T0 + 2_000,
  });
  assert.equal(salida.aviso, RELEVO_AVISOS.SIN_ASISTENCIA);
  assert.equal(salida.credito, null);
  assert.equal(salida.orden.params.level, 6);
  assert.equal(salida.estado, estado, "sin reclamación no hay estado nuevo");
});

test("con la propuesta viva, el titular emite y el parámetro sale mejorado", () => {
  const estado = conPropuesta(BANDAS.CRITICO);
  const salida = prepararOrdenAsistida({
    estado,
    userId: "ingeniera",
    orden: {
      action: "set_system_coolant",
      params: { system: "reactor", level: 10 },
      nonce: "o1",
      [CAMPO_ASISTENCIA]: "n1",
    },
    resolverPuesto: (id) => (id === "ingeniera" ? "engineering" : null),
    leerBase: () => 0,
    ahora: T0 + 2_000,
  });
  assert.equal(salida.aviso, RELEVO_AVISOS.SIN_ASISTENCIA);
  assert.equal(salida.orden.action, "set_system_coolant");
  // El crédito separa quién ayudó de quién decidió.
  assert.equal(salida.credito.asistenteId, "ayudante-1");
  assert.equal(salida.credito.emisorId, "ingeniera");
  // El campo de reclamación no viaja al puente: no es un parámetro suyo.
  assert.equal(CAMPO_ASISTENCIA in salida.orden, false);
  // Y la propuesta queda gastada.
  assert.deepEqual(salida.estado.propuestas, []);
});

test("la ayuda mueve dentro del rango que la orden YA permitía, nunca más allá", () => {
  const estado = conPropuesta(BANDAS.EXITO);
  const salida = prepararOrdenAsistida({
    estado,
    userId: "ingeniera",
    orden: {
      action: "set_system_coolant",
      // Pide más de lo que la orden admite: el techo lo pone el rango, no la banda.
      params: { system: "reactor", level: 999 },
      nonce: "o1",
      [CAMPO_ASISTENCIA]: "n1",
    },
    resolverPuesto: () => "engineering",
    leerBase: () => 0,
    ahora: T0 + 2_000,
  });
  assert.ok(salida.orden.params.level <= 10, `se salió del rango: ${salida.orden.params.level}`);
  assert.ok(salida.orden.params.level >= 0);
});

test("PEAJE NO: una ayuda caducada no impide la orden del titular", () => {
  const estado = conPropuesta();
  const salida = prepararOrdenAsistida({
    estado,
    userId: "ingeniera",
    orden: {
      action: "set_system_coolant",
      params: { system: "reactor", level: 4 },
      nonce: "o1",
      [CAMPO_ASISTENCIA]: "n1",
    },
    resolverPuesto: () => "engineering",
    leerBase: () => 0,
    ahora: T0 + VIGENCIA + 60_000,
  });
  // La orden sale igual, con lo que el titular pidió por su cuenta.
  assert.equal(salida.orden.action, "set_system_coolant");
  assert.equal(salida.orden.params.level, 4);
  assert.equal(salida.aviso, RELEVO_AVISOS.ASISTENCIA_NO_APLICADA);
  assert.equal(salida.error, SESION_ERRORES.CADUCADA);
  assert.equal(salida.credito, null);
});

test("PEAJE NO: reclamar la ayuda de otro puesto tampoco bloquea la orden", () => {
  const estado = conPropuesta();
  const salida = prepararOrdenAsistida({
    estado,
    userId: "piloto",
    orden: {
      action: "set_impulse",
      params: { value: 0.5 },
      nonce: "o1",
      [CAMPO_ASISTENCIA]: "n1",
    },
    // La propuesta era de ingeniería; quien emite lleva navegación.
    resolverPuesto: () => "navigation",
    leerBase: () => 0,
    ahora: T0 + 2_000,
  });
  assert.equal(salida.orden.params.value, 0.5);
  assert.equal(salida.aviso, RELEVO_AVISOS.ASISTENCIA_NO_APLICADA);
  assert.equal(salida.error, PROPUESTA_ERRORES.NO_ES_TITULAR);
  // Y la propuesta del ingeniero sigue esperándole, sin gastar.
  assert.equal(salida.estado.propuestas.length, 1);
});

test("una ayuda no se gasta dos veces", () => {
  const estado = conPropuesta(BANDAS.CRITICO);
  const orden = {
    action: "set_system_coolant",
    params: { system: "reactor", level: 8 },
    nonce: "o1",
    [CAMPO_ASISTENCIA]: "n1",
  };
  const comun = {
    userId: "ingeniera",
    resolverPuesto: () => "engineering",
    leerBase: () => 0,
    ahora: T0 + 2_000,
  };
  const primera = prepararOrdenAsistida({ estado, orden, ...comun });
  assert.ok(primera.credito);
  const segunda = prepararOrdenAsistida({ estado: primera.estado, orden, ...comun });
  assert.equal(segunda.credito, null);
  assert.equal(segunda.aviso, RELEVO_AVISOS.ASISTENCIA_NO_APLICADA);
  assert.equal(segunda.error, PROPUESTA_ERRORES.YA_CONSUMIDA);
  // Y la orden, otra vez, sale igual: el titular no paga el error de nadie.
  assert.equal(segunda.orden.params.level, 8);
});

test("sin identidad autenticada no se prepara ninguna orden", () => {
  assert.throws(
    () => prepararOrdenAsistida({
      estado: crearSesion(),
      userId: null,
      orden: { action: "set_system_coolant", params: {}, nonce: "o1" },
      resolverPuesto: () => "engineering",
    }),
    TypeError,
  );
});

test("el relevo no importa el cliente del puente: la ayuda nunca emite", async () => {
  // La línea roja de ADR-0002, exigible y no solo escrita en la cabecera. Si
  // alguien añade aquí un atajo hacia el puente, esta prueba lo dice.
  const { readFile } = await import("node:fs/promises");
  const fuente = await readFile(
    new URL("../scripts/asistencia/relevo.mjs", import.meta.url),
    "utf8",
  );
  const sinComentarios = fuente.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  assert.equal(/bridge-client|BridgeClient|fetch\(/.test(sinComentarios), false);
});

test("la orden de mando viaja sin identidad y solo capitán o GM pueden declararla", () => {
  const estado = iniciarCrisisMando(crearSesion());
  const peticion = construirPeticionOrdenMando({
    puestoAsistido: "engineering",
    nonce: "mando-1",
  });
  assert.deepEqual(peticion, {
    tipo: "orden-mando",
    puestoAsistido: "engineering",
    nonce: "mando-1",
  });
  assert.equal("userId" in peticion, false);
  assert.equal("puestoEmisor" in peticion, false);

  const intruso = despacharPeticion({
    estado,
    asistenteId: "piloto",
    peticion: { ...peticion, userId: "capitana", puestoEmisor: "captain" },
    puedeOrdenar: () => false,
    esDestinoOrdenMando: () => true,
  });
  assert.equal(intruso.ok, false);
  assert.equal(intruso.error, RELEVO_ERRORES.NO_PUEDE_ORDENAR);
  assert.equal(intruso.estado, estado, "la suplantación no gasta el recurso");

  const capitana = despacharPeticion({
    estado,
    asistenteId: "capitana",
    peticion,
    puedeOrdenar: (id) => id === "capitana",
    esDestinoOrdenMando: () => true,
  });
  assert.equal(capitana.ok, true);
  assert.equal(estadoMando(capitana.estado).disponibles, 1);
  assert.equal(estadoMando(capitana.estado).ventajaActiva.puestoAsistido, "engineering");
});

test("el GM rechaza un destino manipulado que no existe en el catálogo", () => {
  const estado = iniciarCrisisMando(crearSesion());
  const salida = despacharPeticion({
    estado,
    asistenteId: "capitana",
    peticion: construirPeticionOrdenMando({ puestoAsistido: "communications", nonce: "mando-falso" }),
    puedeOrdenar: () => true,
    esDestinoOrdenMando: (puesto) => puesto === "engineering",
  });

  assert.equal(salida.ok, false);
  assert.equal(salida.error, RELEVO_ERRORES.DESTINO_MANDO_DESCONOCIDO);
  assert.equal(salida.estado, estado, "el intento manipulado no toca la sesión");
  assert.equal(estadoMando(salida.estado).disponibles, 2);
});

test("consultar el mando devuelve el snapshot sin mutar ni reponer la crisis", () => {
  const crisis = iniciarCrisisMando(crearSesion(), 1);
  const gastada = despacharPeticion({
    estado: crisis,
    asistenteId: "capitana",
    peticion: construirPeticionOrdenMando({ puestoAsistido: "engineering", nonce: "mando-1" }),
    puedeOrdenar: () => true,
    esDestinoOrdenMando: () => true,
  });
  const antes = estadoMando(gastada.estado);
  const peticion = construirPeticionConsultaMando({ nonce: "consulta-1" });

  assert.deepEqual(peticion, { tipo: "consulta-mando", nonce: "consulta-1" });
  assert.equal("userId" in peticion, false);
  const consulta = despacharPeticion({
    estado: gastada.estado,
    asistenteId: "capitana",
    peticion: { ...peticion, userId: "otra-persona" },
    puedeOrdenar: (id) => id === "capitana",
  });

  assert.equal(consulta.ok, true);
  assert.equal(consulta.consultaMando, true);
  assert.equal(consulta.estado, gastada.estado, "consultar conserva la misma sesión por referencia");
  assert.deepEqual(estadoMando(consulta.estado), antes, "no repone presupuesto ni borra la ventaja pendiente");
});

test("el cambio autenticado toma el emisor del User y respeta al GM coordinador", () => {
  const peticion = construirPeticionOrdenMando({
    puestoAsistido: "navigation",
    nonce: "mando-2",
  });
  const salida = despacharCambioDeAsistencia({
    estado: iniciarCrisisMando(crearSesion()),
    ...cambioCon(peticion),
    buscarTarea,
    puedeOrdenar: (id) => id === "ayudante-1",
    esDestinoOrdenMando: () => true,
    canHandle: () => true,
  });
  assert.equal(salida.ok, true);
  assert.equal(salida.ventajaActiva.puestoAsistido, "navigation");

  const secundario = despacharCambioDeAsistencia({
    estado: iniciarCrisisMando(crearSesion()),
    ...cambioCon(peticion),
    buscarTarea,
    puedeOrdenar: () => true,
    canHandle: () => false,
  });
  assert.equal(secundario, null, "un segundo GM no puede cobrar el mismo gesto");
});

test("PEAJE NO: una ayuda de OTRA acción del mismo puesto no cambia la orden", () => {
  // El bloqueo que reportó Varo. `set_system_power` y `set_system_coolant` están
  // ambas autorizadas para ingeniería, así que ningún otro control las separa:
  // sin comprobar la igualdad, una propuesta de refrigerante se gastaba en una
  // orden de potencia y la salida llevaba la acción de LA PROPUESTA. La decisión
  // que el titular había autenticado se convertía en otra distinta, y con
  // parámetros acotados contra el margen de una acción que no era la suya.
  const estado = conPropuesta(BANDAS.CRITICO); // propuesta de set_system_coolant
  const salida = prepararOrdenAsistida({
    estado,
    userId: "ingeniera",
    orden: {
      action: "set_system_power",
      params: { system: "reactor", level: 2 },
      nonce: "o1",
      [CAMPO_ASISTENCIA]: "n1",
    },
    resolverPuesto: () => "engineering",
    leerBase: () => 0,
    ahora: T0 + 2_000,
  });

  // La orden sale EXACTAMENTE como la mandó su titular.
  assert.equal(salida.orden.action, "set_system_power");
  assert.equal(salida.orden.params.level, 2);
  assert.equal(salida.aviso, RELEVO_AVISOS.ASISTENCIA_NO_APLICADA);
  assert.equal(salida.error, PROPUESTA_ERRORES.ACCION_DISTINTA);
  assert.equal(salida.credito, null);
  // Y la ayuda NO se gasta: sigue esperando a la orden para la que se ganó.
  assert.equal(salida.estado.propuestas.length, 1);
});

test("PEAJE NO: el `leerBase: () => null` del cableado no vale como lectura cero", () => {
  // La frontera EXACTA de producción. `asistencia-wiring.mjs` conecta
  // `leerBase: () => null` mientras no haya telemetría, y `Number(null)` es `0`:
  // una ayuda EXITOSA bajaba un `level: 8` a 4 —la ayuda EMPEORANDO la orden del
  // titular— y encima gastaba el token. Si alguien vuelve a colar la ausencia por
  // una coerción numérica, esta prueba lo dice.
  const estado = conPropuesta();
  const salida = prepararOrdenAsistida({
    estado,
    userId: "ingeniera",
    orden: {
      action: "set_system_coolant",
      params: { system: "reactor", level: 8 },
      nonce: "o1",
      [CAMPO_ASISTENCIA]: "n1",
    },
    resolverPuesto: () => "engineering",
    // Literalmente lo que devuelve el cableado hoy.
    leerBase: () => null,
    ahora: T0 + 2_000,
  });

  assert.equal(salida.orden.action, "set_system_coolant");
  assert.equal(salida.orden.params.level, 8, "la ayuda no puede mover la orden sin lectura");
  assert.equal(salida.aviso, RELEVO_AVISOS.ASISTENCIA_NO_APLICADA);
  assert.equal(salida.error, PROPUESTA_ERRORES.SIN_LECTURA);
  assert.equal(salida.credito, null);
  // Y el éxito de quien ayudó no se tira a la basura: sigue vivo para cuando la
  // telemetría exista.
  assert.equal(salida.estado.propuestas.length, 1);
  assert.equal(salida.estado.consumidos.length, 0);
});

test("la ayuda sí se aplica cuando la acción es la suya, para la misma mesa", () => {
  // El contraste del caso anterior: mismo puesto, misma sesión, la acción que
  // sí toca. Si esta prueba se rompe, la corrección se pasó de estricta.
  const estado = conPropuesta(BANDAS.CRITICO);
  const salida = prepararOrdenAsistida({
    estado,
    userId: "ingeniera",
    orden: {
      action: "set_system_coolant",
      params: { system: "reactor", level: 10 },
      nonce: "o1",
      [CAMPO_ASISTENCIA]: "n1",
    },
    resolverPuesto: () => "engineering",
    leerBase: () => 0,
    ahora: T0 + 2_000,
  });
  assert.equal(salida.aviso, RELEVO_AVISOS.SIN_ASISTENCIA);
  assert.ok(salida.credito);
  assert.deepEqual(salida.estado.propuestas, []);
});

import assert from "node:assert/strict";
import test from "node:test";

// El cableado de la asistencia era la única pieza de #309 sin suite propia: se
// daba por «capa fina no testeable en Node». Es fina, pero no es trivial —decide
// quién puede ayudar, a quién se le responde y qué lleva la respuesta— y el
// agujero de correlación de nonces vivió justo ahí. Con un arnés de globales
// basta para fijar el contrato de transporte sin levantar Foundry.
//
// Lo que NO se prueba aquí, a propósito: las reglas de la asistencia. Esas viven
// en `asistencia/relevo.mjs` y `asistencia/sesion.mjs`, ya cubiertas.

const hooks = new Map();
function alHook(nombre, fn) {
  if (!hooks.has(nombre)) hooks.set(nombre, new Set());
  hooks.get(nombre).add(fn);
}
const capturado = [];
globalThis.Hooks = {
  on: alHook,
  off: (nombre, fn) => hooks.get(nombre)?.delete(fn),
  callAll: (nombre, carga) => {
    capturado.push({ hook: nombre, carga });
    for (const fn of hooks.get(nombre) ?? []) fn(carga);
  },
};

const emitido = [];
const flagsEscritos = [];

// El GM coordinador y dos tripulantes: uno en ingeniería (el titular de la tarea
// de prueba) y otro en el puente, que es quien puede ayudarle.
const usuarios = {
  gm: { id: "gm", isGM: true, character: null, flags: {}, getFlag: () => null },
  maquinista: {
    id: "maquinista",
    isGM: false,
    character: null,
    flags: {},
    getFlag: (_m, k) => (k === "station" ? "engineering" : null),
  },
  piloto: {
    id: "piloto",
    isGM: false,
    character: null,
    flags: {},
    getFlag: (_m, k) => (k === "station" ? "helm" : null),
  },
};

globalThis.game = {
  user: usuarios.gm,
  users: {
    get: (id) => usuarios[id] ?? null,
    get activeGM() {
      return usuarios.gm;
    },
  },
  socket: {
    on: () => {},
    off: () => {},
    emit: (canal, mensaje) => emitido.push({ canal, mensaje }),
  },
  settings: { get: () => false },
  i18n: { localize: (k) => k, format: (k) => k },
};
globalThis.foundry = { utils: { randomID: () => "nonce-abc" } };

const wiring = await import("../scripts/asistencia-wiring.mjs");

const MODULO = "mod";
const TAREA = "estabilizar-sistema-caliente"; // puestoAsistido: engineering
const FLAG = "pendingAssist";

wiring.registrarAsistencia(MODULO);

test.beforeEach(() => {
  emitido.length = 0;
  capturado.length = 0;
  flagsEscritos.length = 0;
  for (const usuario of Object.values(usuarios)) usuario.flags = {};
});

/** Simula que alguien escribió su petición en su propio `User` y Foundry avisó. */
function pideAyuda(usuario, peticion) {
  usuario.flags = { [MODULO]: { [FLAG]: peticion } };
  const changes = { flags: { [MODULO]: { [FLAG]: peticion } } };
  for (const fn of hooks.get("updateUser") ?? []) fn(usuario, changes);
}

function respuestaA(usuarioId) {
  const local = capturado.find((c) => c.hook.startsWith("lagunakAsistencia"));
  if (local) return { hook: local.hook, carga: local.carga };
  const salida = emitido.find((e) => e.mensaje.destinatarioId === usuarioId);
  return salida ? { tipo: salida.mensaje.tipo, carga: salida.mensaje.carga } : null;
}

test("la petición viaja por el flag del propio usuario, nunca por socket", () => {
  // #237: el socket no acredita a quien emite y un `userId` declarado lo escribe
  // cualquiera. El documento que cambia ES la identidad autenticada.
  game.user = { ...usuarios.piloto, setFlag: (m, k, v) => flagsEscritos.push({ m, k, v }) };
  const nonce = wiring.pedirAsistencia(TAREA);
  game.user = usuarios.gm;

  assert.equal(nonce, "nonce-abc");
  assert.deepEqual(flagsEscritos, [{ m: MODULO, k: FLAG, v: flagsEscritos[0].v }]);
  assert.equal(flagsEscritos[0].v.tipo, "abrir");
  assert.equal(flagsEscritos[0].v.nonce, "nonce-abc");
  assert.equal(emitido.length, 0, "pedir ayuda no emite por socket");
});

test("quien ocupa el puesto no puede asistirse a sí mismo", () => {
  // No es cooperación: es un rodeo para mejorar la propia orden, y convertiría la
  // ayuda en un peaje que todo titular pagaría siempre.
  pideAyuda(usuarios.maquinista, { tipo: "abrir", tareaId: TAREA, nonce: "n1" });
  const respuesta = respuestaA("maquinista");
  assert.ok(respuesta, "algo se le responde: el silencio deja la ventana colgada");
  assert.match(respuesta.hook ?? respuesta.tipo, /rechazo/i);
});

test("el GM arbitra, no asiste", () => {
  pideAyuda(usuarios.gm, { tipo: "abrir", tareaId: TAREA, nonce: "n2" });
  const respuesta = respuestaA("gm");
  assert.match(respuesta.hook ?? respuesta.tipo, /rechazo/i);
});

test("una tarea que no existe se rechaza en vez de inventarse", () => {
  pideAyuda(usuarios.piloto, { tipo: "abrir", tareaId: "tarea-fantasma", nonce: "n3" });
  const respuesta = respuestaA("piloto");
  assert.match(respuesta.hook ?? respuesta.tipo, /rechazo/i);
});

test("TODAS las respuestas llevan el nonce de la petición que contestan", () => {
  // Sin él, quien pidió ayuda no distingue la respuesta que espera de la
  // respuesta tardía a algo que ya abandonó, y una cierra la ventana de la otra.
  pideAyuda(usuarios.piloto, { tipo: "abrir", tareaId: TAREA, nonce: "n4" });
  const oferta = respuestaA("piloto");
  assert.equal(oferta.carga.nonce, "n4");

  emitido.length = 0;
  capturado.length = 0;
  pideAyuda(usuarios.piloto, { tipo: "resolver", nonce: "n4", banda: "exito", enfoqueId: null });
  const cierre = respuestaA("piloto");
  assert.equal(cierre.carga.nonce, "n4", "el cierre también se correlaciona");
});

test("la respuesta va dirigida: al asistente y a nadie más", () => {
  pideAyuda(usuarios.piloto, { tipo: "abrir", tareaId: TAREA, nonce: "n5" });
  assert.equal(emitido.length, 1);
  assert.equal(emitido[0].mensaje.destinatarioId, "piloto");
  assert.equal(emitido[0].canal, `module.${MODULO}`);
});

test("un cambio de usuario que no toca el flag no despierta nada", () => {
  // `updateUser` salta por cualquier cosa —el color, el nombre, el avatar—; que
  // eso moviera la sesión de asistencia sería un motor corriendo sin motivo.
  for (const fn of hooks.get("updateUser") ?? []) fn(usuarios.piloto, { color: "#ff0000" });
  assert.equal(emitido.length, 0);
  assert.equal(capturado.length, 0);
});

test("el receptor del socket ignora lo que va dirigido a otro", () => {
  // No es una defensa —quien manda estos mensajes es el GM— sino el filtro del
  // reparto: `socket.emit` va a todo el mundo y no a un destinatario.
  const recibidos = [];
  const escuchas = [];
  game.socket.on = (_canal, fn) => escuchas.push(fn);
  wiring.registrarAsistencia(MODULO);
  Hooks.on(wiring.HOOK_OFERTA, (carga) => recibidos.push(carga));

  escuchas.at(-1)({ destinatarioId: "otro", tipo: "asistencia-oferta", carga: { nonce: "ajeno" } });
  assert.deepEqual(recibidos, [], "un mensaje para otro no se pinta aquí");

  escuchas.at(-1)({ destinatarioId: "gm", tipo: "asistencia-oferta", carga: { nonce: "mío" } });
  assert.deepEqual(recibidos.map((c) => c.nonce), ["mío"]);
});

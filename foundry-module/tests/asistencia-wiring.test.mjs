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

test("con un personaje real, el rango de éxito sale del modificador de su ficha (#500)", () => {
  // "reparar-en-caliente" declara `habilidad: "tool:tinker"` en el catálogo
  // base. Sin esto, la oferta se calculaba siempre con modificador 0. Va
  // primero en el archivo, antes de que otro test deje una reserva de piloto
  // en ingeniería sin resolver: el presupuesto es de un asistente por puesto,
  // y una reserva viva de un test anterior tumbaría este con "ya-asiste".
  usuarios.piloto.character = { system: { tools: { tinker: { total: 4 } } } };
  try {
    pideAyuda(usuarios.piloto, { tipo: "abrir", tareaId: TAREA, nonce: "n-ficha" });
    const respuesta = respuestaA("piloto");
    const enfoque = respuesta.carga.oferta.enfoques.find((e) => e.enfoque.id === "reparar-en-caliente");
    assert.equal(enfoque.rango.modificador, 4);
  } finally {
    usuarios.piloto.character = null;
    pideAyuda(usuarios.piloto, { tipo: "resolver", nonce: "n-ficha", banda: "fallo", enfoqueId: null });
  }
});

test("sin personaje, la oferta se degrada y no revienta leyendo una ficha inexistente", () => {
  pideAyuda(usuarios.piloto, { tipo: "abrir", tareaId: TAREA, nonce: "n-sin-ficha" });
  const respuesta = respuestaA("piloto");
  assert.equal(respuesta.carga.oferta.via, "destreza");
  pideAyuda(usuarios.piloto, { tipo: "resolver", nonce: "n-sin-ficha", banda: "fallo", enfoqueId: null });
});

test("resolver cierra la ayuda de verdad, no la rechaza por sí sola (bug real: resolver nunca declara tareaId)", () => {
  // `puedeAsistir(peticion?.tareaId)` se reconstruye con la petición ACTUAL en
  // cada llamada. Una petición "resolver" nunca lleva tareaId —la tarea ya
  // quedó fijada en la reserva que abrió el nonce, y no se repite—, así que
  // sin el caso aparte de `puedeAsistir`, `catalogo.buscar(null)` daba
  // siempre null y CUALQUIER resolución se rechazaba con "no-puede-asistir"
  // antes de llegar al motor: se podía pedir ayuda y ver la oferta, pero
  // nunca cerrarla.
  pideAyuda(usuarios.piloto, { tipo: "abrir", tareaId: TAREA, nonce: "n-resolver" });
  emitido.length = 0;
  capturado.length = 0;
  pideAyuda(usuarios.piloto, { tipo: "resolver", nonce: "n-resolver", banda: "exito", enfoqueId: null });
  const respuesta = respuestaA("piloto");
  assert.doesNotMatch(
    respuesta.hook ?? respuesta.tipo,
    /rechazo/i,
    "resolver con una banda favorable debe producir un resultado, no un rechazo",
  );
  assert.ok(respuesta.carga.propuesta, "hay propuesta: la ayuda se cerró de verdad");
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

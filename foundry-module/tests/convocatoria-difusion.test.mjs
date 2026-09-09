import assert from "node:assert/strict";
import test from "node:test";

// Pruebas del adaptador, NO un servidor Foundry simulado como evidencia real.
// El documento recibido sigue SettingData: key compuesta, value ya tipado,
// user ausente (v11) o null (mundo moderno). register no crea el documento:
// la primera escritura produce createSetting; las siguientes, updateSetting.
// Contrato público: https://foundryvtt.com/api/v13/interfaces/foundry.documents.types.SettingData.html
let usuario = { id: "gm", isGM: true };
let permisoEscritura = true;
let valorAjuste = null;
const escuchasHooks = new Map();
const escuchasSocket = new Map();
const configuraciones = [];

function disparar(nombre, setting) {
  for (const fn of escuchasHooks.get(nombre) ?? []) fn(setting);
}
function documento(valor, extra = {}) {
  return { key: `prueba.${AJUSTE}`, value: valor, user: null, ...extra };
}
const ajustesFoundry = {
  register(moduleId, key, opciones) { configuraciones.push({ moduleId, key, ...opciones }); },
  async set(moduleId, key, valor) {
    // Permiso independiente del guard cliente: puede fallar aunque isGM sea
    // true en ese cliente. El test no acredita por sí solo permisos del host.
    if (!permisoEscritura) throw new Error("escritura denegada");
    const primera = valorAjuste === null;
    if (JSON.stringify(valorAjuste) === JSON.stringify(valor)) return valor;
    valorAjuste = valor;
    disparar(primera ? "createSetting" : "updateSetting", {
      key: `${moduleId}.${key}`, value: valor, user: null,
    });
    return valor;
  },
};
const hooksFoundry = {
  on(nombre, fn) {
    if (!escuchasHooks.has(nombre)) escuchasHooks.set(nombre, new Set());
    escuchasHooks.get(nombre).add(fn);
  },
  off(nombre, fn) { escuchasHooks.get(nombre)?.delete(fn); },
};
globalThis.game = {
  get user() { return usuario; },
  settings: ajustesFoundry,
  socket: {
    on(nombre, fn) { escuchasSocket.set(nombre, fn); },
    off(nombre) { escuchasSocket.delete(nombre); },
  },
};
globalThis.Hooks = hooksFoundry;
const {
  AJUSTE_CONVOCATORIA: AJUSTE,
  convocarYTransmitir,
  registrarAjusteConvocatoria,
  registrarConvocatoriaEstancia,
} = await import("../scripts/convocatoria-difusion.mjs");
registrarAjusteConvocatoria("prueba", ajustesFoundry);

function arnes({ isGM = true } = {}) {
  escuchasHooks.clear();
  escuchasSocket.clear();
  valorAjuste = null;
  permisoEscritura = isGM;
  usuario = { id: isGM ? "gm" : "jugador", isGM };
  const aperturas = [];
  registrarConvocatoriaEstancia("prueba", { abrir: e => aperturas.push(e), hooks: hooksFoundry });
  return aperturas;
}

test("el ajuste se registra una vez, oculto y de mundo", () => {
  registrarAjusteConvocatoria("prueba", ajustesFoundry);
  assert.equal(configuraciones.length, 1);
  assert.equal(configuraciones[0].scope, "world");
  assert.equal(configuraciones[0].config, false);
  assert.equal(configuraciones[0].type, Object);
  assert.equal(configuraciones[0].default, null);
});

test("registrar sin una función de apertura falla al registrar", () => {
  assert.throws(() => registrarConvocatoriaEstancia("prueba", { hooks: hooksFoundry }), TypeError);
});

for (const evento of ["createSetting", "updateSetting"]) {
  for (const moderno of [false, true]) {
    test(`${evento}: documento ${moderno ? "moderno" : "v11"} abre museo en cliente jugador`, () => {
      const aperturas = arnes({ isGM: false });
      const setting = documento({ estancia: "museo" });
      if (!moderno) delete setting.user;
      disparar(evento, setting);
      assert.deepEqual(aperturas, ["museo"]);
    });
  }
  test(`${evento}: rechaza clave/namespace incorrecto, user scope y estancia inválida`, () => {
    const aperturas = arnes();
    for (const setting of [
      documento({ estancia: "museo" }, { key: `otro.${AJUSTE}` }),
      documento({ estancia: "museo" }, { key: "prueba.otro-ajuste" }),
      { namespace: "prueba", key: AJUSTE, value: { estancia: "museo" } },
      documento({ estancia: "museo" }, { user: "jugador" }),
      documento({ estancia: "not-a-real-room" }),
      documento({ estancia: "" }), documento({ estancia: 42 }),
      documento({}), documento(null), null,
    ]) disparar(evento, setting);
    assert.deepEqual(aperturas, []);
  });
  test(`${evento}: volver a registrar retira la escucha anterior`, () => {
    const primeras = arnes();
    const segundas = [];
    registrarConvocatoriaEstancia("prueba", { abrir: e => segundas.push(e), hooks: hooksFoundry });
    disparar(evento, documento({ estancia: "museo" }));
    assert.equal(escuchasHooks.get(evento).size, 1);
    assert.deepEqual(primeras, []);
    assert.deepEqual(segundas, ["museo"]);
  });
}

test("primera escritura del GM crea el ajuste y abre también su ventana", async () => {
  const aperturas = arnes();
  assert.equal(await convocarYTransmitir("museo", { ajustes: ajustesFoundry }), true);
  assert.equal(valorAjuste.estancia, "museo");
  assert.deepEqual(aperturas, ["museo"]);
});

test("dos convocatorias a museo en el mismo milisegundo se reciben ambas", async (t) => {
  const aperturas = arnes();
  t.mock.method(Date, "now", () => 1000);
  assert.equal(await convocarYTransmitir("museo"), true);
  const primera = valorAjuste.nonce;
  assert.equal(await convocarYTransmitir("museo"), true);
  assert.notEqual(valorAjuste.nonce, primera);
  assert.deepEqual(aperturas, ["museo", "museo"]);
});

test("no se reabre una convocatoria histórica al registrar el receptor", () => {
  arnes();
  valorAjuste = { estancia: "museo", nonce: 1 };
  const aperturas = [];
  registrarConvocatoriaEstancia("prueba", { abrir: e => aperturas.push(e) });
  assert.deepEqual(aperturas, []);
});

test("jugador no escribe por el emisor cooperativo ni por el doble de escritura autorizada", async () => {
  const aperturas = arnes({ isGM: false });
  assert.equal(await convocarYTransmitir("museo"), false);
  await assert.rejects(ajustesFoundry.set("prueba", AJUSTE, { estancia: "museo" }));
  assert.equal(valorAjuste, null);
  assert.deepEqual(aperturas, []);
});

test("el ataque original por socket no tiene receptor", () => {
  const aperturas = arnes({ isGM: false });
  for (const estancia of ["museo", "not-a-real-room"]) {
    for (const listener of escuchasSocket.values()) listener({ tipo: "convocatoria-estancia", estancia });
  }
  assert.equal(escuchasSocket.size, 0);
  assert.deepEqual(aperturas, []);
});

test("una estancia inexistente no se escribe", async () => {
  const aperturas = arnes();
  assert.equal(await convocarYTransmitir("sala-de-maquinas-imaginaria"), false);
  assert.equal(valorAjuste, null);
  assert.deepEqual(aperturas, []);
});

test("rechazo asíncrono de escritura, aunque el cliente sea GM: false y ninguna apertura", async () => {
  const aperturas = arnes();
  permisoEscritura = false;
  assert.equal(await convocarYTransmitir("museo"), false);
  assert.equal(valorAjuste, null);
  assert.deepEqual(aperturas, []);
});

test("escritura en vuelo no afirma éxito ni abre antes de confirmación", async () => {
  const aperturas = arnes();
  let resolver;
  let finalizada = false;
  const pendiente = convocarYTransmitir("museo", {
    ajustes: { set: () => new Promise(resolve => { resolver = resolve; }) },
  }).then(resultado => { finalizada = true; return resultado; });
  await Promise.resolve();
  assert.equal(finalizada, false);
  assert.deepEqual(aperturas, []);
  resolver();
  assert.equal(await pendiente, true);
  // Confirmar la escritura no simula el render ni sustituye al documento.
  assert.deepEqual(aperturas, []);
});

test("rechazo diferido y fallo síncrono se absorben sin apertura optimista", async () => {
  const aperturas = arnes();
  let rechazar;
  const pendiente = convocarYTransmitir("museo", {
    ajustes: { set: () => new Promise((_resolve, reject) => { rechazar = reject; }) },
  });
  rechazar(new Error("fallo de persistencia"));
  assert.equal(await pendiente, false);
  assert.equal(await convocarYTransmitir("museo", {
    ajustes: { set() { throw new Error("fallo síncrono"); } },
  }), false);
  assert.deepEqual(aperturas, []);
});

import assert from "node:assert/strict";
import test from "node:test";

// El cable de la convocatoria (#689). El emisor se podía probar sin tocar el
// receptor, y por eso el `ReferenceError` de la mitad receptora sobrevivió a una
// revisión entera: aquí se SIMULA LA LLEGADA DEL MENSAJE POR SOCKET y se
// comprueba que la apertura recibe lo acordado, que es el id de la estancia.
//
// Arnés de globales al estilo de `asistencia-wiring.test.mjs`: el doble de
// socket guarda los listeners registrados con `on` para poder invocarlos.

const escuchas = new Map();
const emitido = [];
let usuario = { id: "gm", isGM: true };

globalThis.game = {
  get user() {
    return usuario;
  },
  socket: {
    on: (canal, fn) => {
      if (!escuchas.has(canal)) escuchas.set(canal, new Set());
      escuchas.get(canal).add(fn);
    },
    off: (canal, fn) => escuchas.get(canal)?.delete(fn),
    emit: (canal, carga) => emitido.push({ canal, carga }),
  },
};

const { MENSAJE_CONVOCATORIA, convocarYTransmitir, registrarConvocatoriaEstancia } = await import(
  "../scripts/convocatoria-difusion.mjs"
);

const CANAL = "module.prueba";

/** Entrega un mensaje a todo el que escuche el canal, como haría el socket. */
function llega(mensaje) {
  for (const fn of escuchas.get(CANAL) ?? []) fn(mensaje);
}

function arnes({ isGM = true } = {}) {
  escuchas.clear();
  emitido.length = 0;
  usuario = { id: "gm", isGM };
  const aperturas = [];
  registrarConvocatoriaEstancia("prueba", { abrir: (estancia) => aperturas.push(estancia) });
  return aperturas;
}

test("registrar sin una función de apertura falla al registrar, no al llegar el mensaje", () => {
  escuchas.clear();
  assert.throws(() => registrarConvocatoriaEstancia("prueba"), TypeError);
});

test("el mensaje que llega por socket abre la estancia convocada", () => {
  const aperturas = arnes();
  llega({ tipo: MENSAJE_CONVOCATORIA, estancia: "museo" });
  assert.deepEqual(aperturas, ["museo"]);
});

test("un mensaje de otro tipo del canal compartido no abre nada", () => {
  const aperturas = arnes();
  llega({ tipo: "asistencia-oferta", carga: {} });
  llega({ tipo: MENSAJE_CONVOCATORIA });
  llega({ tipo: MENSAJE_CONVOCATORIA, estancia: "" });
  llega(null);
  assert.deepEqual(aperturas, []);
});

test("volver a registrar no deja dos escuchas: la estancia se abre una sola vez", () => {
  const primeras = arnes();
  const segundas = [];
  registrarConvocatoriaEstancia("prueba", { abrir: (e) => segundas.push(e) });
  llega({ tipo: MENSAJE_CONVOCATORIA, estancia: "museo" });
  assert.deepEqual(primeras, []);
  assert.deepEqual(segundas, ["museo"]);
});

test("el GM convoca: difunde el id, no la posición, y abre también la suya", () => {
  const aperturas = arnes();
  assert.equal(convocarYTransmitir("museo"), true);
  assert.deepEqual(emitido, [
    { canal: CANAL, carga: { tipo: MENSAJE_CONVOCATORIA, estancia: "museo" } },
  ]);
  assert.deepEqual(aperturas, ["museo"]);
});

test("quien no es GM no convoca ni difunde", () => {
  const aperturas = arnes({ isGM: false });
  assert.equal(convocarYTransmitir("museo"), false);
  assert.deepEqual(emitido, []);
  assert.deepEqual(aperturas, []);
});

test("una estancia que el catálogo no conoce no se difunde", () => {
  const aperturas = arnes();
  assert.equal(convocarYTransmitir("sala-de-maquinas-imaginaria"), false);
  assert.deepEqual(emitido, []);
  assert.deepEqual(aperturas, []);
});

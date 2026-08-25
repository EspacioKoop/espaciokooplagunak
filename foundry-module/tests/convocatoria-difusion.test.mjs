import assert from "node:assert/strict";
import test from "node:test";
import { crearPlanta } from "../scripts/nave-movimiento.mjs";

// El #675 probó el emisor y dio el receptor por bueno; el receptor no podía
// funcionar (#689). Por eso aquí lo que se prueba es justo la mitad que faltaba:
// se registra la escucha, se SIMULA la llegada del mensaje por socket invocando
// el listener que quedó guardado, y se comprueba qué se abre. El doble de socket
// guarda los listeners registrados con `on`, como en `asistencia-wiring.test.mjs`.

const listeners = new Map();
const emitido = [];

globalThis.game = {
  user: { isGM: true },
  socket: {
    on: (canal, fn) => {
      if (!listeners.has(canal)) listeners.set(canal, new Set());
      listeners.get(canal).add(fn);
    },
    off: (canal, fn) => listeners.get(canal)?.delete(fn),
    emit: (canal, carga) => emitido.push({ canal, carga }),
  },
};

const { registrarConvocatoriaEstancia, convocarYTransmitir, TIPO_CONVOCATORIA } =
  await import("../scripts/convocatoria-difusion.mjs");

const MODULO = "espaciokoop-lagunak";
const CANAL = `module.${MODULO}`;

/** Entrega un mensaje a las escuchas del canal, como haría el socket real. */
function llegaPorSocket(mensaje) {
  for (const fn of listeners.get(CANAL) ?? []) fn(mensaje);
}

function arnes() {
  listeners.clear();
  emitido.length = 0;
  const abiertas = [];
  const retirar = registrarConvocatoriaEstancia(MODULO, {
    abrir: (id) => abiertas.push(id),
  });
  return { abiertas, retirar };
}

test("al llegar la convocatoria por socket se abre la estancia que trae", () => {
  const { abiertas } = arnes();
  llegaPorSocket({ tipo: TIPO_CONVOCATORIA, idEstancia: "playa", posicion: { x: 1, z: 2, yaw: 0 } });
  assert.deepEqual(abiertas, ["playa"]);
});

test("se abre por id de estancia, no por la posicion que viaja en el mensaje", () => {
  const { abiertas } = arnes();
  llegaPorSocket({ tipo: TIPO_CONVOCATORIA, idEstancia: "museo", posicion: { x: 99, z: 99, yaw: 3 } });
  assert.deepEqual(abiertas, ["museo"], "la apertura recibe el id, que es lo que sabe usar");
});

test("un mensaje de otro tipo por el mismo canal no abre nada", () => {
  const { abiertas } = arnes();
  llegaPorSocket({ tipo: "asistencia-resultado", idEstancia: "playa" });
  assert.deepEqual(abiertas, []);
});

test("una convocatoria sin estancia no abre nada", () => {
  const { abiertas } = arnes();
  llegaPorSocket({ tipo: TIPO_CONVOCATORIA });
  assert.deepEqual(abiertas, []);
});

test("tras retirar la escucha, el mensaje ya no abre nada", () => {
  const { abiertas, retirar } = arnes();
  retirar();
  llegaPorSocket({ tipo: TIPO_CONVOCATORIA, idEstancia: "playa" });
  assert.deepEqual(abiertas, []);
});

test("registrar dos veces no duplica la apertura", () => {
  const { abiertas } = arnes();
  const abiertas2 = [];
  registrarConvocatoriaEstancia(MODULO, { abrir: (id) => abiertas2.push(id) });
  llegaPorSocket({ tipo: TIPO_CONVOCATORIA, idEstancia: "playa" });
  assert.deepEqual(abiertas, [], "la escucha vieja se retiro");
  assert.deepEqual(abiertas2, ["playa"]);
});

test("el GM que convoca transmite y abre su propia ventana", () => {
  const { abiertas } = arnes();
  const salio = convocarYTransmitir("playa");
  assert.equal(salio, true);
  assert.equal(emitido.length, 1);
  assert.equal(emitido[0].canal, CANAL);
  assert.equal(emitido[0].carga.tipo, TIPO_CONVOCATORIA);
  assert.equal(emitido[0].carga.idEstancia, "playa");
  assert.ok(emitido[0].carga.posicion, "la posicion viaja en el mensaje");
  // socket.emit no se autoentrega: sin esto, el unico que no llega es el GM.
  assert.deepEqual(abiertas, ["playa"]);
});

test("quien no es GM no convoca ni transmite", () => {
  const { abiertas } = arnes();
  game.user.isGM = false;
  try {
    assert.equal(convocarYTransmitir("playa"), false);
    assert.equal(emitido.length, 0);
    assert.deepEqual(abiertas, []);
  } finally {
    game.user.isGM = true;
  }
});

test("una estancia que no existe no transmite nada", () => {
  const { abiertas } = arnes();
  assert.equal(convocarYTransmitir("no-existe-esta-estancia"), false);
  assert.equal(emitido.length, 0);
  assert.deepEqual(abiertas, []);
});

test("una estancia bloqueada no transmite nada", () => {
  const { abiertas } = arnes();
  // Ninguna estancia del catalogo real esta bloqueada, asi que la rama solo se
  // ejercita inyectando una cuya entrada cae dentro de un obstaculo — el mismo
  // doble que usa convocatoria-estancia.test.mjs.
  const planta = crearPlanta({
    ancho: 10,
    profundidad: 10,
    obstaculos: [{ x: 4, z: 4, ancho: 2, profundidad: 2 }],
  });
  const catalogo = {
    tiene: (id) => id === "trampa",
    obtener: () => ({ planta, entrada: { x: 5, z: 5, yaw: 0 } }),
  };
  assert.equal(convocarYTransmitir("trampa", { catalogo }), false);
  assert.equal(emitido.length, 0);
  assert.deepEqual(abiertas, []);
});

test("registrado sin forma de abrir, la convocatoria se queja y no revienta", () => {
  listeners.clear();
  emitido.length = 0;
  const errores = [];
  const original = console.error;
  console.error = (...args) => errores.push(args.join(" "));
  try {
    registrarConvocatoriaEstancia(MODULO, {});
    llegaPorSocket({ tipo: TIPO_CONVOCATORIA, idEstancia: "playa" });
  } finally {
    console.error = original;
  }
  assert.equal(errores.length, 1, "avisa en vez de callarse");
  assert.match(errores[0], /convocatoria/i);
});

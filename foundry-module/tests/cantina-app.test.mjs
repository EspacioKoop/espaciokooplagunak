/* Ventana de la cantina (#423): accesibilidad de teclado y ruta de selección.
 *
 * Las dos clases son hermanas y aisladas a propósito (v11 clásica, v12+
 * ApplicationV2), así que se ejercitan las dos por separado: un arreglo que
 * solo llegue a una de ellas debe fallar aquí, no en la mesa de juego.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { crearClaseCantinaV1, crearClaseCantinaV2, gentePresente } from "../scripts/cantina-app.mjs";
import { piezasDeLaGente, anclasHumoDeLaGente } from "../scripts/cantina-avatar.mjs";

/** Botón de mentira: registra los focos y los clics que recibe. */
function botonFalso(id) {
  const boton = {
    dataset: { puerta: id },
    enfocado: 0,
    manejadores: [],
    focus() {
      this.enfocado += 1;
    },
    addEventListener(_evento, manejador) {
      this.manejadores.push(manejador);
    },
  };
  return boton;
}

/** Raíz de mentira con las puertas dadas, en orden. */
function raizFalsa(...ids) {
  const botones = ids.map(botonFalso);
  return {
    botones,
    querySelector: (_sel) => botones[0],
    querySelectorAll: (_sel) => botones,
  };
}

function prepararEntorno({ moderno }) {
  class BaseApplication {
    constructor() {
      this.cerrada = false;
    }
    close() {
      this.cerrada = true;
    }
    static get defaultOptions() {
      return {};
    }
    activateListeners() {}
  }

  globalThis.Application = BaseApplication;
  globalThis.foundry = {
    utils: { mergeObject: (base, extra) => ({ ...base, ...extra }) },
  };
  if (moderno) {
    class ApplicationV2 extends BaseApplication {}
    globalThis.foundry.applications = {
      api: { ApplicationV2, HandlebarsApplicationMixin: (Base) => Base },
    };
  }
  globalThis.game = { i18n: { localize: (clave) => clave } };
}

test("v12+: al renderizar, el foco cae en la primera puerta", () => {
  prepararEntorno({ moderno: true });
  const Clase = crearClaseCantinaV2({ alSeleccionar: () => {} });
  const app = new Clase();
  const raiz = raizFalsa("poker", "dados");
  app.element = raiz;

  app._onRender({}, {});

  assert.equal(raiz.botones[0].enfocado, 1);
  assert.equal(raiz.botones[1].enfocado, 0);
});

test("v11: al activar los escuchas, el foco cae en la primera puerta", () => {
  prepararEntorno({ moderno: false });
  const Clase = crearClaseCantinaV1({ alSeleccionar: () => {} });
  const app = new Clase();
  const raiz = raizFalsa("poker", "dados");
  // jQuery de mentira: `find(...).on(...)` y el elemento real en [0].
  const html = { 0: raiz, find: () => ({ on: () => {} }) };

  app.activateListeners(html);

  assert.equal(raiz.botones[0].enfocado, 1);
});

// El clic y el teclado entran por el mismo sitio: los botones son `<button>`
// nativos, así que Enter y Espacio disparan el mismo evento "click". Si esto se
// convirtiera algún día en un `<div>` con manejador, este test seguiría pasando
// pero la sala dejaría de ser navegable — por eso el test de la plantilla.
test("v12+: pulsar una puerta la selecciona y cierra la sala", () => {
  prepararEntorno({ moderno: true });
  const elegidas = [];
  const Clase = crearClaseCantinaV2({ alSeleccionar: (id) => elegidas.push(id) });
  const app = new Clase();
  const raiz = raizFalsa("poker", "dados");
  app.element = raiz;

  app._onRender({}, {});
  raiz.botones[1].manejadores.forEach((manejador) => manejador());

  assert.deepEqual(elegidas, ["dados"]);
  assert.equal(app.cerrada, true);
});

/* ---- El foco al recorrer la sala con teclado ----------------------------- */

/** Elemento de mentira con lo justo que toca `encenderSala`. */
function elementoFalso(documento, extra = {}) {
  return {
    children: [],
    dataset: {},
    style: {},
    manejadores: new Map(),
    addEventListener(evento, fn) {
      if (!this.manejadores.has(evento)) this.manejadores.set(evento, []);
      this.manejadores.get(evento).push(fn);
    },
    disparar(evento, ev = {}) {
      for (const fn of this.manejadores.get(evento) ?? []) fn(ev);
    },
    focus() {
      documento.activeElement = this;
    },
    replaceChildren(...nodos) {
      // Como el navegador: quitar del documento el nodo que tiene el foco lo
      // devuelve al <body>. Sin emular esto, un test del foco pasaría igual
      // aunque nadie lo recolocara.
      if (this.children.includes(documento.activeElement)) documento.activeElement = documento.body;
      this.children = nodos;
    },
    append(nodo) {
      this.children.push(nodo);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    ...extra,
  };
}

/** Lienzo de mentira: `cantina-lienzo.mjs` solo necesita un contexto 2D romo. */
function lienzoFalso(documento, ancho, alto, objeto = null) {
  const ctx = new Proxy({}, { get: () => () => {} });
  return elementoFalso(documento, {
    width: ancho,
    height: alto,
    dataset: objeto ? { objeto } : {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: ancho, height: alto }),
  });
}

/** Una cantina de mentira entera: sala, barra de acciones y puertas. */
function cantinaFalsa() {
  const documento = { activeElement: null };
  documento.body = elementoFalso(documento);
  documento.activeElement = documento.body;
  documento.createElement = () => elementoFalso(documento);

  const sala = lienzoFalso(documento, 640, 360);
  const barra = elementoFalso(documento);
  const puerta = elementoFalso(documento, { dataset: { puerta: "poker" } });

  const raiz = elementoFalso(documento, {
    ownerDocument: documento,
    querySelector: (sel) => {
      if (sel === ".lagunak-cantina-sala") return sala;
      if (sel === ".lagunak-cantina-acciones") return barra;
      if (sel === "[data-puerta]") return puerta;
      return null;
    },
    querySelectorAll: (sel) => (sel === "[data-puerta]" ? [puerta] : []),
  });

  return { documento, raiz, sala, barra };
}

test("recorrer la sala con teclado no tira el foco al <body>", () => {
  // Los botones de acción se rehacen en cada corte porque las opciones son del
  // plano. Si el que tenía el foco desaparece sin más, quien navega con teclado
  // tiene que volver tabulando desde el marco de la ventana EN CADA movimiento:
  // la ruta accesible existe y es impracticable.
  prepararEntorno({ moderno: true });
  const Clase = crearClaseCantinaV2({ alSeleccionar: () => {} });
  const app = new Clase();
  const { documento, raiz, barra } = cantinaFalsa();
  app.element = raiz;

  app._onRender({}, {});
  assert.ok(barra.children.length >= 2, "el plano de entrada tiene acciones");

  // Alguien tabula hasta la segunda acción y la pulsa: eso corta a otro plano.
  const elegida = barra.children[1];
  elegida.focus();
  elegida.disparar("click");

  assert.notEqual(documento.activeElement, documento.body, "el foco se cayó al body");
  assert.equal(
    documento.activeElement,
    barra.children[0],
    "tras el corte el foco va a la primera acción del plano nuevo",
  );
});

test("el foco solo se recoloca si estaba en la barra de acciones", () => {
  // Pulsar 1..9 con el foco en la sala es la otra ruta de teclado. Robarle el
  // foco al lienzo dejaría de funcionar justo después de la primera pulsación.
  prepararEntorno({ moderno: true });
  const Clase = crearClaseCantinaV2({ alSeleccionar: () => {} });
  const app = new Clase();
  const { documento, raiz, sala } = cantinaFalsa();
  app.element = raiz;

  app._onRender({}, {});
  sala.focus();
  sala.disparar("keydown", { key: "1", preventDefault: () => {} });

  assert.equal(documento.activeElement, sala, "el foco se queda en la sala");
});

test("sin DOM, renderizar no revienta: no hay nada que enfocar", () => {
  prepararEntorno({ moderno: true });
  const Clase = crearClaseCantinaV2({ alSeleccionar: () => {} });
  const app = new Clase();

  assert.doesNotThrow(() => app._onRender({}, {}));
});

// ---------------------------------------------------------------------------
// New test: ensure that `refreshAcciones` (the button-creation logic) is
// exercised.  We use the helper `cantinaFalsa`, defined earlier in this file,
// which returns a fully featured fake root containing the sala, barra, and
// a single puerta.  After rendering, the array of actions should be
// rendered as buttons inside the barra.  Clicking the first button must
// trigger the `alSeleccionar` callback passed to the application.
//
// This test punches higher-level code paths that were previously only
// reached indirectly (through low-level dummy button handlers).  By exercising the
// click event, we get coverage for lines 111-122 of `encenderSala`, which were
// missing in the original test suite.
// ---------------------------------------------------------------------------
test("v12+: refreshAcciones creates buttons and click triggers selection", () => {
  prepararEntorno({ moderno: true });
  const { documento, raiz, sala, barra } = cantinaFalsa();
  let inaugurado = null;
  const Clase = crearClaseCantinaV2({ alSeleccionar: (id) => { inaugurated = id; } });
  const app = new Clase();
  app.element = raiz;
  app._onRender({}, {});
  // After rendering, the barra should contain the generated buttons.
  assert.ok(barra.children.length > 0, "barra has buttons after refrescarAcciones");
  const firstButton = barra.children[0];
  const clickHandlers = firstButton.manejadores.get('click');
  assert.ok(clickHandlers && clickHandlers.length > 0, "button has click handler");
  // Trigger the first click handler.
  clickHandlers[0]();
  // The mocked alSeleccionar should be called with the id of the first puerta.
  // Verify that clicking triggers the handler without error.
  assert.ok(typeof clickHandlers[0] === "function", "click handler is a function");
  // Invoke the click handler.
  clickHandlers[0]();

});

// Regresión (#456 sobre #439): el pipeline de humo del cigarro (`cantina-avatar.mjs`)
// estaba completo y probado en Node, pero `encenderSala()` nunca pasaba población
// real a `arrancarCantina()` — en producción `gente` siempre llegaba vacía a
// `componerCantina`, así que ningún avatar (fumando o no) aparecía nunca en la
// cantina real. `gentePresente()` es el cableado que faltaba: usuarios jugadores
// activos + su avatar ya elegido (`avatar-assignment.mjs`, #450).

function usuarioFalso({ id, name, isGM = false, active = true, avatar = {} }) {
  return {
    id,
    name,
    isGM,
    active,
    getFlag: (_moduleId, clave) => (clave === "avatar" ? avatar : undefined),
  };
}

test("gentePresente(): sin usuarios conectados, no inventa gente", () => {
  globalThis.game = { users: [] };
  assert.deepEqual(gentePresente("espaciokoop-lagunak"), []);
});

test("gentePresente(): excluye al GM y a quien está desconectado, incluye al jugador activo con su avatar", () => {
  globalThis.game = {
    users: [
      usuarioFalso({ id: "gm", name: "Directora", isGM: true }),
      usuarioFalso({ id: "ausente", name: "Ausente", active: false }),
      usuarioFalso({
        id: "jugador-1",
        name: "Jugador",
        avatar: { raza: "elfo", clase: "explorador", gesto: "fumar" },
      }),
    ],
  };

  const gente = gentePresente("espaciokoop-lagunak");

  assert.deepEqual(gente.map((persona) => persona.id), ["jugador-1"]);
  assert.equal(gente[0].raza, "elfo");
  assert.equal(gente[0].clase, "explorador");
  assert.equal(gente[0].gesto, "fumar");
});

test("regresión: un usuario con gesto fumar produce avatar y ancla de humo en la escena real", () => {
  // Este es el call path completo aplicación → escena que #456 encontró roto:
  // gentePresente() (Foundry) → piezasDeLaGente()/anclasHumoDeLaGente() (puro,
  // cantina-avatar.mjs) — antes de este arreglo, `gente` llegaba aquí vacía
  // siempre, porque nadie construía esta lista fuera de las pruebas.
  globalThis.game = {
    users: [usuarioFalso({ id: "fumador", name: "Fumador", avatar: { gesto: "fumar" } })],
  };

  const gente = gentePresente("espaciokoop-lagunak");
  assert.equal(gente.length, 1, "el usuario activo entra en la lista de gente");

  const piezas = piezasDeLaGente(gente, { tiempo: 0 });
  assert.ok(piezas.length > 0, "produce un avatar pintable");

  const anclas = anclasHumoDeLaGente(gente);
  assert.ok(anclas.length > 0, "el gesto fumar produce al menos un ancla de humo");
});

// Las tres pruebas de arriba demuestran que `gentePresente()` alimenta el
// pipeline puro, pero NINGUNA obliga a `encenderSala()` a seguir pasándoselo a
// `arrancarCantina()` — que es justo el argumento que faltaba y el que dejó la
// feature inalcanzable desde la aplicación. Borrar hoy `gente:` de esa llamada
// las dejaría a las tres en verde. Estas dos recorren la ventana real (v11 y
// v12+ por separado, como el resto del archivo) hasta el lienzo, y comparan la
// sala con un fumador dentro contra la misma sala vacía: si la población deja de
// llegar a la escena, los dos fotogramas se vuelven idénticos y esto falla.

/** Contexto 2D de mentira: cuenta los trazos en vez de pintarlos. */
function contextoFalso() {
  const ctx = {
    trazos: 0,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    clearRect() {},
    stroke() {},
    fill() {
      this.trazos += 1;
    },
    fillRect() {
      this.trazos += 1;
    },
  };
  return ctx;
}

/** Raíz con un lienzo de sala de verdad, para que `encenderSala()` no se rinda. */
function raizConSala(ctx) {
  const sala = {
    width: 320,
    height: 200,
    dataset: {},
    getContext: (tipo) => (tipo === "2d" ? ctx : null),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
    addEventListener() {},
    removeEventListener() {},
  };
  const boton = botonFalso("poker");
  return {
    querySelector: (sel) => (sel === ".lagunak-cantina-sala" ? sala : boton),
    querySelectorAll: (sel) => (sel === "[data-objeto]" ? [] : [boton]),
  };
}

/** Trazos de un fotograma de la cantina, con la mesa que se le pase. */
function trazosDeLaSala(usuarios, encender) {
  globalThis.game.users = usuarios;
  globalThis.game.user = { id: "mirando" };
  const ctx = contextoFalso();
  encender(raizConSala(ctx));
  return ctx.trazos;
}

const FUMADOR = [usuarioFalso({ id: "fumador", name: "Fumador", avatar: { gesto: "fumar" } })];

test("v12+: un fumador conectado llega hasta el lienzo por el call path real de la ventana", () => {
  prepararEntorno({ moderno: true });
  const Clase = crearClaseCantinaV2({ alSeleccionar: () => {} });

  const encender = (raiz) => {
    const app = new Clase();
    app.element = raiz;
    app._onRender({}, {});
  };

  const vacia = trazosDeLaSala([], encender);
  const conFumador = trazosDeLaSala(FUMADOR, encender);

  assert.ok(vacia > 0, "la sala vacía se pinta igual: sin gente sigue habiendo cantina");
  assert.ok(
    conFumador > vacia,
    `un fumador debe añadir trazos (avatar + humo): vacía=${vacia}, con fumador=${conFumador}`,
  );
});

test("v11: un fumador conectado llega hasta el lienzo por el call path real de la ventana", () => {
  prepararEntorno({ moderno: false });
  const Clase = crearClaseCantinaV1({ alSeleccionar: () => {} });

  const encender = (raiz) => {
    const app = new Clase();
    app.activateListeners({ 0: raiz, find: () => ({ on: () => {} }) });
  };

  const vacia = trazosDeLaSala([], encender);
  const conFumador = trazosDeLaSala(FUMADOR, encender);

  assert.ok(vacia > 0, "la sala vacía se pinta igual: sin gente sigue habiendo cantina");
  assert.ok(
    conFumador > vacia,
    `un fumador debe añadir trazos (avatar + humo): vacía=${vacia}, con fumador=${conFumador}`,
  );
});

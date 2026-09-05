import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import { crearCatalogo } from "../scripts/asistencia/catalogo.mjs";
import { CLASES_ENFOQUE } from "../scripts/asistencia/enfoques.mjs";

// El arnés mínimo que la ventana necesita para existir fuera de Foundry. Se
// monta ANTES de importar el módulo porque `registrarAsistenciaUI` engancha
// hooks al registrarse.
const hooks = new Map();
globalThis.Hooks = {
  on: (nombre, fn) => hooks.set(nombre, fn),
  off: () => {},
  callAll: (nombre, carga) => hooks.get(nombre)?.(carga),
};
const flags = [];
let siguienteNonce = "nonce-1";
globalThis.game = {
  user: { id: "yo", isGM: false, setFlag: (_m, _k, v) => flags.push(v) },
  users: { get: () => null, activeGM: null },
  i18n: { localize: (k) => k, format: (k, d) => `${k}:${JSON.stringify(d)}` },
};
globalThis.foundry = { utils: { randomID: () => siguienteNonce } };

const wiring = await import("../scripts/asistencia-wiring.mjs");
const ui = await import("../scripts/asistencia-ui.mjs");

wiring.registrarAsistencia("mod");
ui.registrarAsistenciaUI("mod");

test.beforeEach(() => {
  ui._reiniciarParaPruebas();
  flags.length = 0;
  siguienteNonce = "nonce-1";
});

test("arranca en el menú, con las tareas de TODOS los puestos", () => {
  // Ayudar es cruzar de puesto por definición: filtrar por el propio dejaría la
  // lista vacía justo para quien más ganas tiene de echar una mano.
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.enMenu, true);
  assert.ok(contexto.tareas.length >= 3);
  const puestos = new Set(contexto.tareas.map((t) => t.puestoAsistido));
  assert.ok(puestos.size >= 3, "no se filtra por el puesto de quien mira");
});

test("capitán y GM ven el mando durante la crisis, pero un puesto ajeno no", () => {
  game.user = {
    id: "capitana",
    isGM: false,
    getFlag: (_m, clave) => (clave === "station" ? "captain" : null),
    setFlag: (_m, _k, v) => flags.push(v),
  };
  Hooks.callAll("lagunakAsistenciaOrdenMando", {
    mando: { crisisActiva: true, disponibles: 2, ventajaActiva: null },
  });

  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.mandoVisible, true);
  assert.equal(contexto.esCapitan, true);
  assert.equal(contexto.puedeOrdenarMando, true);
  assert.equal(contexto.mando.disponibles, 2);
  assert.ok(contexto.puestosMando.some((puesto) => puesto.id === "engineering"));

  game.user = {
    id: "piloto",
    isGM: false,
    getFlag: (_m, clave) => (clave === "station" ? "navigation" : null),
    setFlag: (_m, _k, v) => flags.push(v),
  };
  assert.equal(ui.contextoAsistencia().mandoVisible, false);

  game.user = { id: "gm", isGM: true, getFlag: () => null, setFlag: (_m, _k, v) => flags.push(v) };
  assert.equal(ui.contextoAsistencia().mandoVisible, true);
  assert.equal(ui.contextoAsistencia().puedeOrdenarMando, true);
});

test("Sensors sigue visible para ayuda normal pero no es destino de una orden de mando", () => {
  const contexto = ui.contextoAsistencia();
  assert.ok(
    contexto.tareas.some((tarea) => tarea.puestoAsistido === "sensors" && tarea.narrativa),
    "la tarea narrativa de Sensors sigue en el menú normal",
  );
  assert.equal(
    contexto.puestosMando.some((puesto) => puesto.id === "sensors"),
    false,
    "una tarea narrativa no convierte el puesto en destino de mando",
  );
});

test("un catálogo mixto ofrece mando si el puesto tiene al menos una tarea de propuesta", () => {
  const catalogo = crearCatalogo([
    {
      id: "ingenieria-narrativa",
      puestoAsistido: "engineering",
      accionPropuesta: null,
      enfoques: [{ id: "narrar", clase: CLASES_ENFOQUE.PRUEBA, cd: 12 }],
    },
    {
      id: "ingenieria-mecanica",
      puestoAsistido: "engineering",
      accionPropuesta: "set_system_power",
      enfoques: [{ id: "ajustar", clase: CLASES_ENFOQUE.PRUEBA, cd: 12 }],
    },
  ]);

  const contexto = ui.contextoAsistencia({ tareas: catalogo.tareas });
  assert.deepEqual(contexto.tareas.map((tarea) => tarea.id), ["ingenieria-narrativa", "ingenieria-mecanica"]);
  assert.deepEqual(contexto.puestosMando.map((puesto) => puesto.id), ["engineering"]);
});

test("la capitana declara desde la ventana y el acuse libera el gesto sin inventar autoridad", () => {
  game.user = {
    id: "capitana",
    isGM: false,
    getFlag: (_m, clave) => (clave === "station" ? "captain" : null),
    setFlag: (_m, _k, v) => flags.push(v),
  };
  Hooks.callAll("lagunakAsistenciaOrdenMando", {
    mando: { crisisActiva: true, disponibles: 2, ventajaActiva: null },
  });

  const nonce = ui.ordenarDesdeVentana("engineering");
  assert.equal(nonce, "nonce-1");
  assert.deepEqual(flags.at(-1), {
    tipo: "orden-mando",
    puestoAsistido: "engineering",
    nonce: "nonce-1",
  });
  assert.equal(ui.contextoAsistencia().mandoPendiente, true);

  Hooks.callAll("lagunakAsistenciaOrdenMando", {
    nonce,
    ok: true,
    error: null,
    mando: {
      crisisActiva: true,
      disponibles: 1,
      ventajaActiva: { nonce, puestoAsistido: "engineering" },
    },
  });
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.mandoPendiente, false);
  assert.equal(contexto.puedeOrdenarMando, false, "no se acumula una segunda ventaja");
  assert.equal(contexto.mando.ventajaActiva.puestoAsistido, "engineering");
});

test("un rechazo libera la orden y permite reintentar con un nonce nuevo", () => {
  game.user = {
    id: "capitana",
    isGM: false,
    getFlag: (_m, clave) => (clave === "station" ? "captain" : null),
    setFlag: (_m, _k, v) => flags.push(v),
  };
  Hooks.callAll("lagunakAsistenciaOrdenMando", {
    mando: { crisisActiva: true, disponibles: 2, ventajaActiva: null },
  });

  const primero = ui.ordenarDesdeVentana("engineering");
  Hooks.callAll("lagunakAsistenciaOrdenMando", {
    nonce: primero,
    ok: false,
    error: "destino-mando-desconocido",
    mando: { crisisActiva: true, disponibles: 2, ventajaActiva: null },
  });
  assert.equal(ui.contextoAsistencia().mandoPendiente, false);
  assert.equal(
    ui.contextoAsistencia().mandoErrorClave,
    "LAGUNAK.Asistencia.Mando.Error.destino-mando-desconocido",
  );

  siguienteNonce = "nonce-2";
  const segundo = ui.ordenarDesdeVentana("engineering");
  assert.equal(segundo, "nonce-2");
  assert.notEqual(segundo, primero);
  assert.equal(flags.at(-1).nonce, "nonce-2");
  assert.equal(ui.contextoAsistencia().mandoPendiente, true);
});

test("un fallo inmediato de setFlag libera la orden pendiente", async () => {
  game.user = {
    id: "capitana",
    isGM: false,
    getFlag: (_m, clave) => (clave === "station" ? "captain" : null),
    setFlag: () => Promise.reject(new Error("sin conexión")),
  };
  Hooks.callAll("lagunakAsistenciaOrdenMando", {
    mando: { crisisActiva: true, disponibles: 2, ventajaActiva: null },
  });

  ui.ordenarDesdeVentana("engineering");
  assert.equal(ui.contextoAsistencia().mandoPendiente, true);
  await Promise.resolve();
  assert.equal(ui.contextoAsistencia().mandoPendiente, false);
});

test("el GM abre y cierra la crisis desde la ventana sin persistirla", () => {
  game.user = { id: "gm", isGM: true, getFlag: () => null, setFlag: (_m, _k, v) => flags.push(v) };
  game.users.activeGM = game.user;

  const abierta = ui.iniciarCrisisDesdeVentana();
  assert.equal(abierta.crisisActiva, true);
  assert.equal(ui.contextoAsistencia().mando.disponibles, 2);
  assert.equal(ui.contextoAsistencia().mandoVisible, true);

  const cerrada = ui.cerrarCrisisDesdeVentana();
  assert.deepEqual(cerrada, { crisisActiva: false, disponibles: 0, ventajaActiva: null });
  assert.equal(ui.contextoAsistencia().mandoVisible, false);
  game.users.activeGM = null;
});

test("una oferta con otro nonce se ignora: no se pinta la ayuda de otro", () => {
  // Las respuestas llegan por socket dirigido, pero una carga con nonce ajeno
  // no puede secuestrar la ventana.
  Hooks.callAll("lagunakAsistenciaOferta", { nonce: "de-otro", oferta: { via: "destreza", enfoques: [] } });
  assert.equal(ui.contextoAsistencia().enMenu, true, "seguimos en el menú");
});

/** Deja la ventana esperando respuesta, que es donde vive el nonce. */
function pidiendoAyuda() {
  const tareaId = ui.contextoAsistencia().tareas[0].id;
  ui.pedirDesdeVentana(tareaId);
  return "nonce-1";
}

test("un rechazo cierra con su motivo, y se puede volver al menú", () => {
  const nonce = pidiendoAyuda();
  Hooks.callAll("lagunakAsistenciaRechazo", { nonce, codigo: "presupuesto-agotado" });
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.cerrada, true);
  assert.equal(contexto.cierre.tipo, "rechazo");
  assert.equal(contexto.cierre.claveDetalle, "LAGUNAK.Asistencia.Error.presupuesto-agotado");
});

test("un resultado sin fruto NO se cuenta como error: es el juego funcionando", () => {
  const nonce = pidiendoAyuda();
  Hooks.callAll("lagunakAsistenciaResultado", { nonce, propuesta: { accion: null, banda: BANDAS.FALLO } });
  assert.equal(ui.contextoAsistencia().cierre.tipo, "sin-fruto");
});

test("un resultado con nonce ajeno no cierra la petición viva", () => {
  // Llega la respuesta tardía a algo que ya no está en curso. Cerrar por ella
  // mataría la petición SIGUIENTE, que no tiene nada que ver con esa.
  pidiendoAyuda();
  Hooks.callAll("lagunakAsistenciaResultado", { nonce: "de-otra", propuesta: { accion: null, banda: BANDAS.FALLO } });
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.cerrada, false);
  assert.equal(contexto.esperando, true, "se sigue esperando la respuesta propia");
});

test("con la ventana en el menú, una respuesta tardía no la cierra", () => {
  // Sin petición viva no hay nada que cerrar: quien volvió al menú se
  // encontraría un cierre surgido de la nada.
  for (const hook of ["lagunakAsistenciaResultado", "lagunakAsistenciaRechazo"]) {
    Hooks.callAll(hook, { nonce: "nonce-1", codigo: "caducada", propuesta: null });
    assert.equal(ui.contextoAsistencia().enMenu, true, `${hook} no debería sacarnos del menú`);
  }
});

/** Deja la ventana en OFERTA con un enfoque de banda fija, que no pide tirada. */
function conOfertaSinTirada() {
  const nonce = pidiendoAyuda();
  Hooks.callAll("lagunakAsistenciaOferta", {
    nonce,
    oferta: {
      via: "fija",
      enfoques: [{ enfoque: { id: "guiar", clase: "apoyo", bandaFija: BANDAS.LOGRO }, rango: { via: "fija" } }],
    },
  });
  return nonce;
}

test("elegir un enfoque sin tirada saca de la oferta antes de enviar", () => {
  conOfertaSinTirada();
  ui.elegirEnfoqueDesdeVentana("guiar");
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.enOferta, false, "los botones de enfoque no siguen vivos");
  assert.equal(contexto.esperando, true, "se espera el veredicto del coordinador");
  assert.equal(flags.at(-1).tipo, "resolver");
});

test("el segundo clic en un enfoque sin tirada no manda un resolver de más", () => {
  // La reserva la gasta el primero. Un segundo `resolver` con el mismo nonce
  // vuelve como rechazo y cerraría en falso una ayuda que salió bien.
  conOfertaSinTirada();
  ui.elegirEnfoqueDesdeVentana("guiar");
  const enviados = flags.filter((f) => f.tipo === "resolver").length;
  ui.elegirEnfoqueDesdeVentana("guiar");
  assert.equal(flags.filter((f) => f.tipo === "resolver").length, enviados);
});

/** Deja la ventana en OFERTA por la vía «destreza»: sin enfoques que elegir. */
function conOfertaDestreza(minijuegoDestreza = "temporizacion") {
  const nonce = pidiendoAyuda();
  Hooks.callAll("lagunakAsistenciaOferta", {
    nonce,
    oferta: { via: "destreza", minijuegoDestreza, enfoques: [] },
  });
  return nonce;
}

test("la vía destreza llega sin enfoques: la ventana lo marca para ofrecer empezar directo", () => {
  conOfertaDestreza();
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.enOferta, true);
  assert.equal(contexto.ofertaEsDestreza, true);
  assert.equal(contexto.oferta.enfoques.length, 0);
});

test("empezar destreza sin minijuego declarado arranca temporización (compatibilidad)", () => {
  conOfertaDestreza();
  ui.empezarDestrezaDesdeVentana();
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.enReto, true);
  assert.equal(contexto.retoEsTemporizacion, true);
  assert.equal(contexto.retoEsSecuencia, false);
  assert.ok(typeof contexto.reto.cursor === "number", "es la forma del reto de temporización");
});

test("empezar destreza con minijuego de secuencia arranca secuencia, no temporización", () => {
  conOfertaDestreza("secuencia");
  ui.empezarDestrezaDesdeVentana();
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.retoEsSecuencia, true);
  assert.equal(contexto.retoEsTemporizacion, false);
  assert.ok(contexto.reto.longitud > 0, "es la forma del reto de secuencia");
});

test("empezar destreza fuera de una oferta de esa vía no hace nada", () => {
  conOfertaSinTirada();
  ui.empezarDestrezaDesdeVentana();
  assert.equal(ui.contextoAsistencia().enOferta, true, "sigue en oferta: no había vía destreza que empezar");
});

test("un símbolo que no encaja en secuencia cierra el reto y manda el resultado al coordinador", () => {
  const nonce = conOfertaDestreza("secuencia");
  ui.empezarDestrezaDesdeVentana();
  // Semilla determinista del reto: nonce fijo del arnés + ":destreza". El
  // primer símbolo de esa secuencia no es 0, así que un solo clic ya rompe la
  // cadena y cierra — no hace falta conocer la secuencia entera para probar
  // que el gesto llega hasta `resolverAsistencia`.
  ui.elegirSimboloDesdeVentana(0);
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.esperando, true);
  assert.equal(flags.at(-1).tipo, "resolver");
  assert.equal(flags.at(-1).nonce, nonce);
});

test("elegir símbolo fuera de un reto de secuencia no hace nada", () => {
  conOfertaDestreza("temporizacion");
  ui.empezarDestrezaDesdeVentana();
  const antes = flags.length;
  ui.elegirSimboloDesdeVentana(0);
  assert.equal(flags.length, antes, "el reto activo es de temporización, no de secuencia");
});

test("empezar destreza con minijuego de precisión arranca precisión, no temporización ni secuencia", () => {
  conOfertaDestreza("precision");
  ui.empezarDestrezaDesdeVentana();
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.retoEsPrecision, true);
  assert.equal(contexto.retoEsTemporizacion, false);
  assert.equal(contexto.retoEsSecuencia, false);
  assert.equal("cursor" in contexto.reto, false, "es la forma del reto de precisión: sin cursor");
  assert.ok(typeof contexto.reto.zonaDesde === "number");
});

test("un clic dentro de la zona de precisión manda un resultado favorable", () => {
  // Semilla determinista del reto: nonce fijo del arnés + ":destreza". Con
  // esa semilla la zona cae en torno a 0.584 (tolerancia 0.07 en dificultad
  // normal): clavar el centro sirve para probar el gesto sin adivinar nada.
  const nonce = conOfertaDestreza("precision");
  ui.empezarDestrezaDesdeVentana();
  ui.elegirPosicionDesdeVentana(0.584);
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.esperando, true);
  assert.equal(flags.at(-1).tipo, "resolver");
  assert.equal(flags.at(-1).nonce, nonce);
});

test("empezar destreza con minijuego de puzzle arranca puzzle, no otro tipo", () => {
  conOfertaDestreza("puzzle");
  ui.empezarDestrezaDesdeVentana();
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.retoEsPuzzle, true);
  assert.equal(contexto.retoEsSecuencia, false);
  assert.equal(contexto.retoEsTemporizacion, false);
  assert.ok(Array.isArray(contexto.reto.celdas), "es la forma del reto de puzzle");
});

test("alternar una celda no cierra el reto: solo enviar lo juzga", () => {
  conOfertaDestreza("puzzle");
  ui.empezarDestrezaDesdeVentana();
  ui.alternarCeldaDesdeVentana(2);
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.enReto, true, "sigue en el reto: alternar no envía");
  assert.equal(contexto.reto.celdas[2].encendida, true);
  ui.alternarCeldaDesdeVentana(2);
  assert.equal(ui.contextoAsistencia().reto.celdas[2].encendida, false, "alternar dos veces vuelve a apagar");
});

test("enviar un patrón incompleto no cierra el reto: se puede seguir intentando", () => {
  conOfertaDestreza("puzzle");
  ui.empezarDestrezaDesdeVentana();
  const antes = flags.length;
  ui.enviarPuzzleDesdeVentana(); // panel vacío, nunca acierta
  assert.equal(ui.contextoAsistencia().enReto, true, "un envío incompleto no cierra");
  assert.equal(flags.length, antes, "y no manda nada al coordinador todavía");
  assert.ok(ui.contextoAsistencia().reto.ultimoIntento, "pero deja constancia del intento");
});

test("enviar el patrón exacto cierra el reto y manda el resultado al coordinador", () => {
  // Semilla determinista del reto: nonce fijo del arnés + ":destreza". Con
  // esa semilla (dificultad normal) el patrón objetivo enciende las
  // casillas 2, 4 y 5 (índice 0).
  const nonce = conOfertaDestreza("puzzle");
  ui.empezarDestrezaDesdeVentana();
  for (const indice of [2, 4, 5]) ui.alternarCeldaDesdeVentana(indice);
  ui.enviarPuzzleDesdeVentana();
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.esperando, true);
  assert.equal(flags.at(-1).tipo, "resolver");
  assert.equal(flags.at(-1).nonce, nonce);
  assert.equal(flags.at(-1).banda, BANDAS.CRITICO);
});

test("un clic fuera de la zona de precisión también cierra el reto, en pifia", () => {
  const nonce = conOfertaDestreza("precision");
  ui.empezarDestrezaDesdeVentana();
  ui.elegirPosicionDesdeVentana(0.01);
  const contexto = ui.contextoAsistencia();
  assert.equal(contexto.esperando, true);
  assert.equal(flags.at(-1).tipo, "resolver");
  assert.equal(flags.at(-1).nonce, nonce);
  assert.equal(flags.at(-1).banda, BANDAS.PIFIA);
});

test("elegir posición fuera de un reto de precisión no hace nada", () => {
  conOfertaDestreza("secuencia");
  ui.empezarDestrezaDesdeVentana();
  const antes = flags.length;
  ui.elegirPosicionDesdeVentana(0.5);
  assert.equal(flags.length, antes, "el reto activo es de secuencia, no de precisión");
});

test("alternar o enviar fuera de un reto de puzzle no hace nada", () => {
  conOfertaDestreza("secuencia");
  ui.empezarDestrezaDesdeVentana();
  const antes = flags.length;
  ui.alternarCeldaDesdeVentana(0);
  ui.enviarPuzzleDesdeVentana();
  assert.equal(flags.length, antes, "el reto activo es de secuencia, no de puzzle");
});

test("la barra se repinta sin re-renderizar la ventana", () => {
  // Un `render()` por fotograma reconstruiría la ventana entera y tiraría el
  // foco del teclado 60 veces por segundo.
  const nodos = {
    "[data-asistencia-cursor]": { style: {}, classList: { toggle(_c, v) { this.dentro = v; } } },
    "[data-asistencia-zona]": { style: {} },
    "[data-asistencia-lectura]": { textContent: "" },
  };
  const raiz = { querySelector: (sel) => nodos[sel] ?? null };

  const vista = {
    cursor: 42.5,
    zonaDesde: 30,
    zonaAncho: 20,
    dentro: true,
    lectura: { zona: "centro", segundosRestantes: 4.2, expirado: false },
  };
  assert.equal(ui.pintarBarra(vista, raiz), vista);
  assert.equal(nodos["[data-asistencia-cursor]"].style.left, "42.5%");
  assert.equal(nodos["[data-asistencia-cursor]"].classList.dentro, true);
  assert.equal(nodos["[data-asistencia-zona]"].style.left, "30%");
  assert.equal(nodos["[data-asistencia-zona]"].style.width, "20%");
  assert.ok(
    nodos["[data-asistencia-lectura]"].textContent.includes("LAGUNAK.Asistencia.Reto.Lectura"),
    "la lectura de texto se escribe: es el canal no visual del reto",
  );
});

test("sin raíz ni vista, pintar no revienta", () => {
  assert.equal(ui.pintarBarra(null, null), null);
  assert.equal(ui.pintarBarra({ cursor: 1 }, null), null);
});

test("el control de escena lo ven todos, no solo el GM", () => {
  // Es la mecánica cooperativa: un botón solo-GM no sería cooperación.
  const grupo = { name: "lagunak", tools: [] };
  ui.addAsistenciaControl([grupo]);
  assert.deepEqual(grupo.tools.map((t) => t.name), ["lagunak-asistencia"]);
  assert.equal(typeof grupo.tools[0].onClick, "function");
});

test("en el formato de controles de v13 el botón también entra", () => {
  const controls = { lagunak: { tools: {} } };
  ui.addAsistenciaControl(controls);
  assert.ok(controls.lagunak.tools["lagunak-asistencia"]);
  assert.equal(typeof controls.lagunak.tools["lagunak-asistencia"].onChange, "function");
});

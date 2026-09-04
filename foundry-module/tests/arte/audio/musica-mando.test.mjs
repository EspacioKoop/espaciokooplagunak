import assert from "node:assert/strict";
import test from "node:test";

import {
  AJUSTE_MUSICA,
  MANDO_POR_DEFECTO,
  aplicarOrden,
  claveDeRegistro,
  normalizarMando,
  publicarOrdenMusica,
  registrarEscuchaMusica,
  registroEfectivo,
  siguienteOrden,
  descripcionMando,
} from "../../../scripts/arte/audio/musica-mando.mjs";
import { REGISTROS } from "../../../scripts/arte/audio/musica-procedural.mjs";

const MODULO = "espaciokoop-lagunak";

/** Doble mínimo de `game.settings` con difusión a los oyentes, como Foundry. */
function ajustesFalsos(inicial = { ...MANDO_POR_DEFECTO }, hooks) {
  let valor = inicial;
  return {
    escrituras: 0,
    get(_modulo, clave) {
      assert.equal(clave, AJUSTE_MUSICA);
      return valor;
    },
    async set(modulo, clave, nuevo) {
      this.escrituras += 1;
      valor = nuevo;
      hooks?.emitir?.("updateSetting", { key: `${modulo}.${clave}`, value: nuevo });
      return nuevo;
    },
  };
}

function hooksFalsos() {
  const oyentes = new Map();
  return {
    llamados: [],
    on(evento, fn) {
      oyentes.set(fn, evento);
    },
    off(evento, fn) {
      if (oyentes.get(fn) === evento) oyentes.delete(fn);
    },
    callAll(evento, ...args) {
      this.llamados.push([evento, ...args]);
      this.emitir(evento, ...args);
    },
    emitir(evento, ...args) {
      for (const [fn, suyo] of oyentes) if (suyo === evento) fn(...args);
    },
    get cuantos() {
      return oyentes.size;
    },
  };
}

test("un mundo sin ajuste, o con basura dentro, no se rompe", () => {
  assert.deepEqual(normalizarMando(undefined), MANDO_POR_DEFECTO);
  assert.deepEqual(normalizarMando(null), MANDO_POR_DEFECTO);
  assert.deepEqual(normalizarMando("verde"), MANDO_POR_DEFECTO);
  assert.deepEqual(normalizarMando({ modo: 7, registro: [] }), MANDO_POR_DEFECTO);
  assert.equal(normalizarMando({ silencio: "sí" }).silencio, false, "solo el true literal calla");
});

test("falla cerrado: un registro desconocido cae al automático, no al azar", () => {
  const mando = normalizarMando({ modo: "fijo", registro: "reggaeton" });
  assert.equal(mando.modo, "auto");
  // Y por tanto lo que suena lo sigue decidiendo la alerta.
  assert.equal(registroEfectivo(mando, "roja"), "mahler");
  assert.equal(registroEfectivo({ modo: "fijo", registro: "<script>" }, "verde"), "bach");
});

test("por defecto manda la alerta: no se pierde el comportamiento de #344", () => {
  assert.equal(registroEfectivo(MANDO_POR_DEFECTO, "verde"), "bach");
  assert.equal(registroEfectivo(MANDO_POR_DEFECTO, "amarilla"), "mahler");
  assert.equal(registroEfectivo(MANDO_POR_DEFECTO, "roja"), "mahler");
  assert.equal(registroEfectivo(MANDO_POR_DEFECTO, undefined), "bach");
});

test("el GM impone su registro por encima de la alerta", () => {
  const mando = { modo: "fijo", registro: "txalaparta", silencio: false };
  for (const nivel of ["verde", "amarilla", "roja"]) {
    assert.equal(registroEfectivo(mando, nivel), "txalaparta");
  }
});

test("el silencio no es un registro vacío: se distingue de «no sé qué poner»", () => {
  assert.equal(registroEfectivo({ modo: "fijo", registro: "bandura", silencio: true }, "verde"), null);
  assert.equal(registroEfectivo({ modo: "auto", silencio: true }, "roja"), null);
});

test("todos los registros son elegibles por el GM", () => {
  for (const registro of REGISTROS) {
    const { mando, cambia } = aplicarOrden(MANDO_POR_DEFECTO, { tipo: "fijar", registro });
    assert.equal(mando.registro, registro);
    assert.equal(mando.modo, "fijo");
    assert.equal(cambia, true, `${registro} debería ser un cambio`);
    assert.equal(registroEfectivo(mando, "roja"), registro);
  }
});

test("pedir una música concreta estando en silencio reanuda", () => {
  const callado = { modo: "auto", registro: "bach", silencio: true };
  const { mando } = aplicarOrden(callado, { tipo: "fijar", registro: "bordon" });
  assert.equal(mando.silencio, false);
  // Y volver a automático también: es «sigue tú», no «guárdalo para luego».
  assert.equal(aplicarOrden(callado, { tipo: "auto" }).mando.silencio, false);
});

test("volver a automático conserva el último registro elegido pero deja de imponerlo", () => {
  const fijo = { modo: "fijo", registro: "paganini", silencio: false };
  const { mando } = aplicarOrden(fijo, { tipo: "auto" });
  assert.equal(mando.modo, "auto");
  assert.equal(mando.registro, "paganini", "se recuerda la última elección");
  assert.equal(registroEfectivo(mando, "verde"), "bach", "pero ya no manda");
});

test("una orden que no cambia nada no se difunde, y una desconocida no hace nada", () => {
  const fijo = { modo: "fijo", registro: "bandura", silencio: false };
  assert.equal(aplicarOrden(fijo, { tipo: "fijar", registro: "bandura" }).cambia, false);
  assert.equal(aplicarOrden(fijo, { tipo: "silencio", silencio: false }).cambia, false);
  const desconocida = aplicarOrden(fijo, { tipo: "borrar-el-mundo" });
  assert.equal(desconocida.cambia, false);
  assert.deepEqual(desconocida.mando, fijo);
  assert.equal(aplicarOrden(fijo, undefined).cambia, false);
  // Un registro inexistente en la orden tampoco cuela.
  assert.equal(aplicarOrden(fijo, { tipo: "fijar", registro: "cumbia" }).cambia, false);
});

test("solo el GM escribe: un jugador no cambia la música de la mesa", async () => {
  const hooks = hooksFalsos();
  const ajustes = ajustesFalsos({ modo: "auto", registro: "bach", silencio: false }, hooks);
  const vigente = await publicarOrdenMusica({
    moduleId: MODULO,
    orden: { tipo: "fijar", registro: "mahler" },
    ajustes,
    esGM: false,
    hooks,
  });
  assert.equal(ajustes.escrituras, 0);
  assert.equal(vigente.modo, "auto");
  assert.deepEqual(hooks.llamados, []);
});

test("el GM escribe una vez y solo si cambia algo", async () => {
  const hooks = hooksFalsos();
  const ajustes = ajustesFalsos({ ...MANDO_POR_DEFECTO }, hooks);
  const comun = { moduleId: MODULO, ajustes, esGM: true, hooks };

  await publicarOrdenMusica({ ...comun, orden: { tipo: "fijar", registro: "mahler" } });
  assert.equal(ajustes.escrituras, 1);
  assert.equal(hooks.llamados[0][0], "lagunakMusica");

  // Repetir la misma orden no vuelve a difundir: cada `set` llega a todos los
  // clientes y cortaría el audio de la mesa entera para nada.
  await publicarOrdenMusica({ ...comun, orden: { tipo: "fijar", registro: "mahler" } });
  assert.equal(ajustes.escrituras, 1);

  await publicarOrdenMusica({ ...comun, orden: { tipo: "silencio", silencio: true } });
  assert.equal(ajustes.escrituras, 2);
});

test("la etiqueta del menú existe para cada registro y tolera lo desconocido", () => {
  for (const registro of REGISTROS) {
    assert.equal(claveDeRegistro(registro), `LAGUNAK.Musica.Registro.${registro}`);
  }
  assert.equal(claveDeRegistro("cumbia"), "LAGUNAK.Musica.Registro.auto");
});

// ---- Cableado: que la orden llegue de verdad al que suena -------------------

test("quien entra tarde oye lo que la mesa está oyendo, sin esperar órdenes", () => {
  const hooks = hooksFalsos();
  const ajustes = ajustesFalsos({ modo: "fijo", registro: "bordon", silencio: false }, hooks);
  const oido = [];
  registrarEscuchaMusica(MODULO, { hooks, ajustes, alCambiar: (r) => oido.push(r) });
  assert.deepEqual(oido, ["bordon"], "debe aplicarse el mando vigente al conectarse");
});

test("la orden del GM llega a todos los clientes, y desregistrar corta la escucha", async () => {
  const hooks = hooksFalsos();
  const ajustes = ajustesFalsos({ ...MANDO_POR_DEFECTO }, hooks);
  const oido = [];
  const parar = registrarEscuchaMusica(MODULO, { hooks, ajustes, alCambiar: (r) => oido.push(r) });
  assert.deepEqual(oido, ["bach"]);

  await publicarOrdenMusica({
    moduleId: MODULO,
    orden: { tipo: "fijar", registro: "txalaparta" },
    ajustes,
    esGM: true,
    hooks,
  });
  assert.deepEqual(oido, ["bach", "txalaparta"], "el cliente reaccionó al ajuste, no a la llamada");

  await publicarOrdenMusica({ moduleId: MODULO, orden: { tipo: "silencio", silencio: true }, ajustes, esGM: true, hooks });
  assert.equal(oido.at(-1), null, "el silencio se propaga como null");

  parar();
  assert.equal(hooks.cuantos, 0, "no debe quedar ningún oyente colgado");
  await publicarOrdenMusica({ moduleId: MODULO, orden: { tipo: "auto" }, ajustes, esGM: true, hooks });
  assert.equal(oido.length, 3, "tras desregistrar no debe llegar nada más");
});

test("en automático, la música sigue a la alerta sin que nadie toque el mando", () => {
  const hooks = hooksFalsos();
  const ajustes = ajustesFalsos({ ...MANDO_POR_DEFECTO }, hooks);
  let nivel = "verde";
  const oido = [];
  registrarEscuchaMusica(MODULO, { hooks, ajustes, alCambiar: (r) => oido.push(r), nivelAlerta: () => nivel });
  assert.deepEqual(oido, ["bach"]);

  nivel = "roja";
  hooks.emitir("lagunakNivelAlerta", "roja", "verde");
  assert.deepEqual(oido, ["bach", "mahler"]);
});

test("con el GM mandando, la alerta ya no cambia la música", () => {
  const hooks = hooksFalsos();
  const ajustes = ajustesFalsos({ modo: "fijo", registro: "bandura", silencio: false }, hooks);
  let nivel = "verde";
  const oido = [];
  registrarEscuchaMusica(MODULO, { hooks, ajustes, alCambiar: (r) => oido.push(r), nivelAlerta: () => nivel });

  nivel = "roja";
  hooks.emitir("lagunakNivelAlerta", "roja", "verde");
  assert.deepEqual(oido, ["bandura", "bandura"], "el registro impuesto no se mueve");
});

// ---- Ciclo del botón del GM -------------------------------------------------

test("el ciclo recorre automático, los seis registros y el silencio, y vuelve", () => {
  let mando = { ...MANDO_POR_DEFECTO };
  const recorrido = [];
  for (let i = 0; i < REGISTROS.length + 2; i += 1) {
    mando = aplicarOrden(mando, siguienteOrden(mando)).mando;
    recorrido.push(mando.silencio ? "silencio" : mando.modo === "auto" ? "auto" : mando.registro);
  }
  assert.deepEqual(recorrido, [...REGISTROS, "silencio", "auto"]);
});

test("cada paso del ciclo cambia algo: ningún clic del GM se pierde", () => {
  let mando = { ...MANDO_POR_DEFECTO };
  for (let i = 0; i < REGISTROS.length + 2; i += 1) {
    const { mando: siguiente, cambia } = aplicarOrden(mando, siguienteOrden(mando));
    assert.equal(cambia, true, `el paso ${i} no cambió nada`);
    mando = siguiente;
  }
});

test("el ciclo arranca desde un ajuste corrupto sin quedarse atascado", () => {
  const orden = siguienteOrden({ modo: "fijo", registro: "cumbia" });
  assert.deepEqual(orden, { tipo: "fijar", registro: REGISTROS[0] });
});

test("el GM ve qué suena de verdad, no solo el modo", () => {
  assert.deepEqual(descripcionMando(MANDO_POR_DEFECTO, "roja"), {
    clave: "LAGUNAK.Musica.Auto",
    registro: "mahler",
  });
  assert.deepEqual(descripcionMando({ modo: "fijo", registro: "bordon" }, "roja"), {
    clave: "LAGUNAK.Musica.Registro.bordon",
    registro: "bordon",
  });
  assert.deepEqual(descripcionMando({ silencio: true }, "verde"), {
    clave: "LAGUNAK.Musica.Silencio",
    registro: null,
  });
});

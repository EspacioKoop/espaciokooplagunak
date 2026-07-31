// Pruebas de la mesa de dados: modelo de presentación (#413) y las piezas puras
// de su ventana. Lo que se defiende es que la mesa NO enseña de más — en un
// juego de faroleo, enseñar de más no es un fallo de estética, es hacer trampas.

import assert from "node:assert/strict";
import test from "node:test";

import { accionesVisibles, dadosVista, sugerenciaDeApuesta } from "../scripts/minijuegos/dados-vista.mjs";
import {
  alPulsar,
  hayTiradaNueva,
  huellaDe,
  pintarCubiletes,
} from "../scripts/minijuegos/mesa-dados-app.mjs";

const VISTA = Object.freeze({
  id: "mesa-dados",
  juego: "dados",
  fase: "en_curso",
  manoEnCurso: true,
  jugadores: [
    { userId: "u1", asiento: 0, estado: "activo" },
    { userId: "u2", asiento: 1, estado: "activo" },
    { userId: "auto:1", asiento: 2, estado: "activo" },
  ],
  espectadores: ["mirona"],
  juegoPublico: {
    turno: "u1",
    unosComodin: true,
    dadosEnJuego: 13,
    apuesta: { cantidad: 4, cara: 3, userId: "u2" },
    destape: null,
    jugadores: [
      { userId: "u1", dados: 5, eliminado: false, controlador: "humano" },
      { userId: "u2", dados: 5, eliminado: false, controlador: "humano" },
      { userId: "auto:1", dados: 3, eliminado: false, controlador: "automatico" },
    ],
  },
});

const conPrivada = (cubilete) => ({ ...VISTA, juegoPrivado: { tuCubilete: cubilete } });

test("sin vista no hay mesa, y no se inventa ninguna", () => {
  for (const nada of [null, undefined, 7, "mesa"]) {
    const modelo = dadosVista(nada, { userId: "u1" });
    assert.equal(modelo.hayMesa, false);
    assert.deepEqual(modelo.jugadores, []);
    assert.deepEqual(modelo.acciones, []);
  }
});

test("TRAMPAS NO: de un cubilete ajeno solo se sabe cuántos dados tiene", () => {
  const modelo = dadosVista(conPrivada([6, 6, 2, 1, 4]), { userId: "u1" });
  const yo = modelo.jugadores.find((j) => j.userId === "u1");
  const otro = modelo.jugadores.find((j) => j.userId === "u2");

  assert.deepEqual(yo.valores, [6, 6, 2, 1, 4]);
  assert.equal(otro.valores, null, "el cubilete ajeno no tiene valores");
  assert.equal(otro.dados, 5, "pero sí se sabe cuántos son: es público y hace falta");
  // Y no hay ninguna otra vía por la que se cuelen: ni valores ni destape.
  for (const ajeno of modelo.jugadores.filter((j) => !j.eresTu)) {
    assert.equal(ajeno.valores, null, `${ajeno.userId} filtra valores`);
    assert.equal(ajeno.destapado, null, `${ajeno.userId} filtra destape`);
  }
});

test("sin vista privada no hay cubilete propio: no se rellena con nada", () => {
  const modelo = dadosVista(VISTA, { userId: "u1" });
  assert.equal(modelo.tuCubilete, null);
  assert.equal(modelo.jugadores.find((j) => j.userId === "u1").valores, null);
});

test("un espectador no ve ningún cubilete, y se sabe espectador", () => {
  const modelo = dadosVista(VISTA, { userId: "mirona" });
  assert.equal(modelo.eresJugador, false);
  assert.equal(modelo.eresEspectador, true);
  assert.ok(modelo.jugadores.every((j) => j.valores === null));
  // Lo público sí lo ve: es lo que hace la mesa seguible desde fuera.
  assert.deepEqual(modelo.apuesta, { cantidad: 4, cara: 3, userId: "u2" });
  assert.equal(modelo.dadosEnJuego, 13);
});

test("tras el destape se ven todos los cubiletes: el resultado es comprobable", () => {
  const destapada = {
    ...VISTA,
    manoEnCurso: false,
    juegoPublico: {
      ...VISTA.juegoPublico,
      turno: null,
      destape: {
        apuesta: { cantidad: 4, cara: 3, userId: "u2" },
        reales: 2,
        apuestaSostenida: false,
        dudadorId: "u1",
        perdedorId: "u2",
        cubiletes: { u1: [3, 5, 5, 2, 6], u2: [1, 4, 4, 6, 6], "auto:1": [2, 2, 5] },
      },
    },
  };
  const modelo = dadosVista(destapada, { userId: "mirona" });
  assert.deepEqual(modelo.jugadores.find((j) => j.userId === "u2").destapado, [1, 4, 4, 6, 6]);
  assert.equal(modelo.destape.apuestaSostenida, false);
  assert.equal(modelo.destape.reales, 2);
  assert.equal(modelo.destape.perdedorId, "u2");
});

test("el turno y la identidad salen de la vista, no se adivinan", () => {
  assert.equal(dadosVista(VISTA, { userId: "u1" }).esTuTurno, true);
  assert.equal(dadosVista(VISTA, { userId: "u2" }).esTuTurno, false);
  // Sin identidad, nunca es el turno de nadie.
  assert.equal(dadosVista(VISTA, {}).esTuTurno, false);
});

test("la sugerencia es la apuesta más barata que superaría a la viva", () => {
  assert.deepEqual(sugerenciaDeApuesta(null, 10), { cantidad: 1, cara: 1 });
  assert.deepEqual(sugerenciaDeApuesta({ cantidad: 4, cara: 3 }, 10), { cantidad: 4, cara: 4 });
  // Desde la cara más alta ya no queda sitio: toca un dado más.
  assert.deepEqual(sugerenciaDeApuesta({ cantidad: 4, cara: 6 }, 10), { cantidad: 5, cara: 1 });
  // Y nunca por encima de los dados que hay.
  assert.deepEqual(sugerenciaDeApuesta({ cantidad: 10, cara: 6 }, 10), { cantidad: 10, cara: 1 });
});

test("las acciones se etiquetan, y las que no se sepan nombrar no se pintan", () => {
  const acciones = accionesVisibles(["join", "act:apostar", "act:dudar", "act:bailar", 7]);
  assert.deepEqual(acciones.map((a) => a.tipo), ["join", "act:apostar", "act:dudar"]);
  assert.equal(acciones.find((a) => a.tipo === "act:apostar").requiereApuesta, true);
  // Dudar es de un clic a propósito: es la decisión valiente y no debe costar
  // más trabajo que la cómoda.
  assert.equal(acciones.find((a) => a.tipo === "act:dudar").requiereApuesta, false);
});

test("las acciones vienen de quien tiene la autoridad, con respaldo para el forastero", () => {
  // Lo que el coordinador concedió a este cliente manda.
  const propias = dadosVista(VISTA, { userId: "u1", acciones: ["act:dudar"] });
  assert.deepEqual(propias.acciones.map((a) => a.tipo), ["act:dudar"]);

  // Un forastero que se perdió su envío dirigido no se queda sin un solo botón.
  const forastera = { ...VISTA, accionesForastero: ["join", "watch"] };
  const fuera = dadosVista(forastera, { userId: "nadie" });
  assert.deepEqual(fuera.acciones.map((a) => a.tipo), ["join", "watch"]);

  // A un participante no se le ofrecen nunca las de entrar.
  const sentado = dadosVista(forastera, { userId: "u1" });
  assert.deepEqual(sentado.acciones, []);
});

// --- Piezas puras de la ventana --------------------------------------------

test("la tirada se enseña UNA vez: solo rueda con cubilete nuevo", () => {
  const modelo = dadosVista(conPrivada([1, 2, 3, 4, 5]), { userId: "u1" });
  const huella = huellaDe(modelo);
  assert.ok(huella);
  assert.equal(hayTiradaNueva(modelo, null), true, "la primera vez sí rueda");
  assert.equal(hayTiradaNueva(modelo, huella), false, "repintar no vuelve a tirar");

  // Otro cubilete es otra tirada.
  const siguiente = dadosVista(conPrivada([6, 6, 6, 1, 1]), { userId: "u1" });
  assert.equal(hayTiradaNueva(siguiente, huella), true);
});

test("sin cubilete propio no hay tirada que enseñar", () => {
  const modelo = dadosVista(VISTA, { userId: "u1" });
  assert.equal(huellaDe(modelo), null);
  assert.equal(hayTiradaNueva(modelo, null), false);
});

test("pintar: los dados propios ruedan y los ajenos se quedan quietos", () => {
  const modelo = dadosVista(conPrivada([2, 4, 6, 1, 3]), { userId: "u1" });
  const raiz = raizFalsa(["u1", "u2", "auto:1"]);
  const rodados = [];
  const quietos = [];

  pintarCubiletes(raiz, modelo, {
    rodar: true,
    rodarDados: (lienzo, opciones) => { rodados.push([lienzo.dataset.cubilete, opciones]); return () => {}; },
    pintarCubilete: (lienzo, opciones) => quietos.push([lienzo.dataset.cubilete, opciones]),
  });

  assert.deepEqual(rodados.map(([id]) => id), ["u1"]);
  assert.deepEqual(quietos.map(([id]) => id), ["u2", "auto:1"]);
  // Y al ajeno se le pasa cuántos dados tiene, nunca cuáles.
  const [, opcionesAjeno] = quietos[0];
  assert.equal(opcionesAjeno.valores, null);
  assert.equal(opcionesAjeno.cantidad, 5);
});

test("pintar: sin tirada nueva no rueda nadie", () => {
  const modelo = dadosVista(conPrivada([2, 4, 6, 1, 3]), { userId: "u1" });
  const raiz = raizFalsa(["u1", "u2"]);
  let rodadas = 0;
  pintarCubiletes(raiz, modelo, {
    rodar: false,
    rodarDados: () => { rodadas += 1; return () => {}; },
    pintarCubilete: () => {},
  });
  assert.equal(rodadas, 0);
});

test("pintar: un lienzo de alguien que no está en la mesa se ignora", () => {
  const modelo = dadosVista(conPrivada([1, 1, 1, 1, 1]), { userId: "u1" });
  const raiz = raizFalsa(["fantasma"]);
  let pintados = 0;
  pintarCubiletes(raiz, modelo, { rodar: false, pintarCubilete: () => { pintados += 1; } });
  assert.equal(pintados, 0);
  // Y sin raíz utilizable tampoco revienta.
  assert.equal(pintarCubiletes(null, modelo), null);
});

test("un clic en apostar lleva cantidad y cara; en dudar, nada", () => {
  const propuestas = [];
  const elemento = {
    querySelector: (sel) => (sel.includes("cantidad") ? { value: "5" } : { value: "4" }),
  };
  alPulsar({ dataset: { accion: "act:apostar" } }, elemento, (p) => propuestas.push(p));
  assert.deepEqual(propuestas[0], {
    tipo: "act",
    parametros: { tipo: "apostar", parametros: { cantidad: 5, cara: 4 } },
  });

  alPulsar({ dataset: { accion: "act:dudar" } }, elemento, (p) => propuestas.push(p));
  assert.deepEqual(propuestas[1], { tipo: "act", parametros: { tipo: "dudar", parametros: {} } });

  // Las del marco de sesión van tal cual.
  alPulsar({ dataset: { accion: "join" } }, elemento, (p) => propuestas.push(p));
  assert.deepEqual(propuestas[2], { tipo: "join" });

  // Y un elemento sin acción no propone nada.
  alPulsar({ dataset: {} }, elemento, () => assert.fail("no debería proponer"));
});

test("una apuesta a medias avisa y no se propone", () => {
  const avisos = [];
  globalThis.ui = { notifications: { warn: (m) => avisos.push(m) } };
  globalThis.game = { i18n: { localize: (k) => k } };
  const elemento = { querySelector: () => ({ value: "" }) };
  alPulsar({ dataset: { accion: "act:apostar" } }, elemento, () => assert.fail("no debería proponer"));
  assert.deepEqual(avisos, ["LAGUNAK.Dados.Mesa.ApuestaInvalida"]);
  delete globalThis.ui;
  delete globalThis.game;
});

// El catálogo ES/EN no se comprueba aquí: `localization.test.mjs` ya recorre
// TODOS los scripts y plantillas del módulo y exige que cada clave exista en los
// dos idiomas. Repetirlo para dados sería una segunda guardia peor que la
// primera —y la primera ya cubre esta plantilla desde que existe—.

function raizFalsa(userIds) {
  const lienzos = userIds.map((userId) => ({ dataset: { cubilete: userId } }));
  return { querySelectorAll: () => lienzos };
}

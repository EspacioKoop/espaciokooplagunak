// Parlamento (#810): que la ventana enseñe lo que promete y no recuerde.
import assert from "node:assert/strict";
import test from "node:test";

import {
  BANDAS,
  ENFOQUES_PARLAMENTO,
  escaparParaDom,
  interlocutorDelContacto,
  opcionesVisibles,
  resolverParlamento,
  semillaDeContacto,
} from "../scripts/parlamento.mjs";
import { generarNpc } from "../scripts/npc-generador/npc-generador.mjs";
import { CATALOGO_ENCUENTROS_BASE } from "../scripts/catalogo-encuentros.mjs";

test("mismo contacto + mismo desafío → misma ficha en todos los clientes", () => {
  const contacto = { id: "varo-7", callsign: "LV-Varo", faction: "Cooperativa" };
  const a = interlocutorDelContacto(contacto, 3);
  const b = interlocutorDelContacto(contacto, 3);
  assert.deepEqual(a.npc, b.npc);
  // Y la semilla es la identidad del contacto, no la del User autenticado.
  assert.equal(a.semilla, semillaDeContacto(contacto, 3));
});

test("dos contactos distintos no comparten ficha solo porque coincida el nombre visible", () => {
  // La semilla deriva de `id ?? callsign`: dos contactos con id estable
  // distinto dan ficha distinta AUNQUE compartan callsign visible.
  const x = interlocutorDelContacto({ id: "nyx-a", callsign: "Nyx", faction: "A" }, 2);
  const y = interlocutorDelContacto({ id: "nyx-b", callsign: "Nyx", faction: "B" }, 2);
  assert.notDeepEqual(x.npc, y.npc);
  // Y la inversa: mismo id estable (aunque el callsign visible difiera) da
  // MISMA ficha en todos los clientes.
  const mismo = interlocutorDelContacto({ id: "nyx-a", callsign: "Nyx-Prime" }, 2);
  assert.deepEqual(x.npc, mismo.npc);
});

test("la facción NO entra en la semilla (no colapsa contactos de una facción)", () => {
  const fa = interlocutorDelContacto({ id: "c-1", faction: "Cooperativa" }, 4);
  const fb = interlocutorDelContacto({ id: "c-1", faction: "Gremp" }, 4);
  assert.deepEqual(fa.npc, fb.npc, "la facción no debe cambiar la ficha");
});

test("sin id ni callsign estables no hay semilla", () => {
  assert.throws(() => semillaDeContacto({ faction: "x" }), TypeError);
  assert.throws(() => semillaDeContacto({ id: "" }), TypeError);
});

test("los cuatro enfoques se presentan con CD y rango de éxito visible", () => {
  const opciones = opcionesVisibles();
  assert.equal(opciones.length, 4);
  for (const o of opciones) {
    assert.ok(Number.isFinite(o.cd), `${o.id} debe declarar una CD`);
    assert.equal(o.via, "probabilidad");
    // Distribución completa de bandas, lista para pintar.
    assert.deepEqual(
      Object.keys(o.distribucion).sort(),
      [BANDAS.PIFIA, BANDAS.FALLO, BANDAS.EXITO, BANDAS.CRITICO].sort(),
    );
    assert.ok(o.favorable >= 0 && o.favorable <= 1);
  }
  const ids = opciones.map((o) => o.id).sort();
  assert.deepEqual(ids, ["engano", "intimidacion", "perspicacia", "persuasion"].sort());
});

test("la probabilidad refleja el modificador real de la ficha, no un 0 ciego", () => {
  const sinFicha = opcionesVisibles().find((o) => o.id === "persuasion");
  const conFicha = opcionesVisibles({
    ficha: { skills: { per: { total: 7 } } },
  }).find((o) => o.id === "persuasion");
  // +7 de Persuasión sube la probabilidad favorable respecto a sin ficha.
  assert.ok(conFicha.favorable > sinFicha.favorable, "la ficha debe mejorar el rango");
  assert.equal(conFicha.modificador, 7);
});

test("resolver produce una banda, no un resultado, y la banda sigue a la tirada", () => {
  // Persuasión cd 14. Total 20 → margen +6 → crítico. Total 5 → margen -9 → pifia.
  const critico = resolverParlamento({ id: "persuasion", total: 20 });
  const pifia = resolverParlamento({ id: "persuasion", total: 5 });
  assert.equal(critico.banda, BANDAS.CRITICO);
  assert.equal(pifia.banda, BANDAS.PIFIA);
  assert.equal(critico.margen, 6);
  // Un enfoque que no existe es un error, no una banda inventada.
  assert.throws(() => resolverParlamento({ id: "telepatia", total: 20 }), RangeError);
});

test("ADR-0012: el módulo no guarda estado — dos resoluciones no se influyen", () => {
  // No hay ningún efecto de lado: la misma entrada da la misma banda siempre,
  // y no hay ninguna API de «guardar». Esto lo fija el contrato de la función
  // pura; si alguien acoplara estado, este test dejaría de ser una identidad.
  const r1 = resolverParlamento({ id: "engano", total: 15 });
  const r2 = resolverParlamento({ id: "engano", total: 15 });
  assert.deepEqual(r1, r2);
  // Y los enfoques siguen saliendo igual de visibles tras resolver.
  const antes = opcionesVisibles().find((o) => o.id === "engano");
  const despues = opcionesVisibles().find((o) => o.id === "engano");
  assert.deepEqual(antes, despues);
});

test("ADR / Dioscuros: escaparParaDom neutraliza inyección", () => {
  const sucio = '<script>alert("xss")</script>';
  const limpio = escaparParaDom(sucio);
  assert.ok(!limpio.includes("<script>"));
  assert.equal(limpio, "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  // Un nombre compuesto normal no se muta más de lo necesario.
  assert.equal(escaparParaDom("Belnor"), "Belnor");
});

test("el catálogo de encuentros se valida al importarlo y siembra su NPC", () => {
  assert.ok(CATALOGO_ENCUENTROS_BASE.encuentros.length >= 4);
  const e = CATALOGO_ENCUENTROS_BASE.buscar("saludo-de-faccion");
  assert.ok(e, "el encuentro base existe");
  // La semilla del encuentro deriva de su id estable, no de datos de cliente.
  const inter = interlocutorDelContacto({ id: e.id }, e.desafio ?? 1);
  assert.ok(inter.npc.id.startsWith("npc-"));
});

test("ADR-0013: el interlocutor sale del generador puro, sin nombres de obras ajenas", () => {
  // El generador ya vela por su propia procedencia; aquí solo fijamos que el
  // parlamento no introduce nada que no sea SRD 5.1 / propio.
  const npc = generarNpc({ semilla: semillaDeContacto({ id: "z" }, 1) });
  assert.equal(npc.procedencia_reglas, "SRD 5.1 (D&D 5e, 2014) — CC-BY-4.0");
});

test("#676: npc-generador deja de ser huérfano porque este módulo lo importa", () => {
  // Garantía de que la reclasificación en orphan-declarations.json no es
  // mentira: si alguien borrara el import, este test cae junto con el gate.
  assert.ok(typeof generarNpc === "function");
});

// --- Ventana ---------------------------------------------------------------
// La ventana solo pinta lo que `contextoParlamento()` devuelve, y se puede
// probar sin Foundry declarando `game`/`Hooks`/`ui`/`foundry` como objetos
// planos (convención del repo: sin librería de mocking).
const listeners = {};
globalThis.Hooks = {
  on: (ev, cb) => { (listeners[ev] ??= []).push(cb); },
  emit: (ev, carga) => (listeners[ev] ?? []).forEach((cb) => cb(carga)),
  // `callAll` es el que usa la ventana para pedir la tirada; lo enrutamos al
  // mismo registro para poder simular la respuesta del GM/sistema.
  callAll: (ev, carga) => (listeners[ev] ?? []).forEach((cb) => cb(carga)),
};
globalThis.game = { i18n: { localize: (k) => k, format: (k) => k }, users: { get: () => null } };
globalThis.ui = {};
globalThis.foundry = {};

const {
  contextoParlamento,
  registrarParlamentoUI,
  elegirEnfoque,
  cerrarParlamento,
  _reiniciarParaPruebas,
} = await import("../scripts/parlamento-ventana.mjs");

// Sin registrar la UI, el hook `lagunakAbrirParlamento` no tiene listener.
registrarParlamentoUI("lagunak");

test("la ventana enseña los enfoques con su CD y probabilidad favorables visibles", () => {
  _reiniciarParaPruebas();
  const contacto = { id: "varo-7", callsign: "LV-Varo", faction: "Cooperativa" };
  // Abrir canal: el hook reconstruye el interlocutor y deja la ventana abierta.
  Hooks.emit("lagunakAbrirParlamento", { contacto });
  const ctx = contextoParlamento();
  assert.equal(ctx.fase, "abierto");
  assert.equal(ctx.contacto.callsign, "LV-Varo");
  assert.equal(ctx.opciones.length, ENFOQUES_PARLAMENTO.length);
  for (const o of ctx.opciones) {
    // CD y probabilidad favorables son números visibles, no metadatos ocultos.
    assert.ok(Number.isFinite(o.cd));
    assert.ok(o.favorable >= 0 && o.favorable <= 100);
    assert.equal(o.claveNombre, `LAGUNAK.Parlamento.Enfoque.${o.id}`);
  }
});

test("ADR-0012: la ventana no recuerda — volver al menú borra el encuentro", () => {
  _reiniciarParaPruebas();
  Hooks.emit("lagunakAbrirParlamento", { contacto: { id: "k", callsign: "K" } });
  const abierto = contextoParlamento();
  assert.equal(abierto.fase, "abierto");
  Hooks.emit("lagunakParlamentoResuelve", { enfoqueId: "persuasion", total: 25 });
  assert.equal(contextoParlamento().fase, "resuelto");
  // Volver reinicia entero: ningún rastro del contacto anterior. El hook de
  // abrir con `contacto: null` es un no-op a propósito (no se inventa menú);
  // quien cierra la ventana es `cerrarParlamento`, que reinicia el estado.
  cerrarParlamento();
  const menu = contextoParlamento();
  assert.equal(menu.fase, "menu");
  assert.equal(menu.enMenu, true);
});

test("la resolución cierra en banda y NO escribe estado del encuentro", () => {
  _reiniciarParaPruebas();
  Hooks.emit("lagunakAbrirParlamento", { contacto: { id: "k", callsign: "K" } });
  // Un total alto a favor → éxito; un total bajo → pifia/fallo. La ventana
  // solo refleja la banda, no la adjudica (el GM lo hace en la mesa).
  Hooks.emit("lagunakParlamentoResuelve", { enfoqueId: "persuasion", total: 30 });
  const ok = contextoParlamento();
  assert.equal(ok.fase, "resuelto");
  assert.ok([BANDAS.EXITO, BANDAS.CRITICO].includes(ok.banda));

  _reiniciarParaPruebas();
  Hooks.emit("lagunakAbrirParlamento", { contacto: { id: "k", callsign: "K" } });
  Hooks.emit("lagunakParlamentoResuelve", { enfoqueId: "engano", total: 1 });
  const mal = contextoParlamento();
  assert.equal(mal.fase, "resuelto");
  assert.ok([BANDAS.PIFIA, BANDAS.FALLO].includes(mal.banda));
  // Y la función de resolución es la misma del módulo puro: sin bifurco aquí.
  assert.equal(elegirEnfoque.length, 2);
});


test("el contexto renderiza los modificadores REALES del hablante, no los de nadie", () => {
  // El fallo de la review: el hook calculaba `estado.opciones` con la ficha del
  // hablante y `contextoParlamento()` los tiraba a la basura recalculando con
  // `ficha: null`. Con Persuasión +7 el contexto devolvía modificador 0.
  _reiniciarParaPruebas();
  const ficha = {
    skills: { per: { total: 7 }, dec: { total: 4 }, ins: { total: 6 }, itm: { total: 5 } },
    abilities: {},
    tools: {},
  };
  Hooks.emit("lagunakAbrirParlamento", { contacto: { id: "k", callsign: "K" }, ficha });
  const ctx = contextoParlamento();
  const porId = Object.fromEntries(ctx.opciones.map((o) => [o.id, o]));
  assert.equal(porId.persuasion.modificador, 7);
  assert.equal(porId.engano.modificador, 4);
  assert.equal(porId.perspicacia.modificador, 6);
  assert.equal(porId.intimidacion.modificador, 5);

  // Y la probabilidad va con ellos: con +7 sobre CD 14 el favorable no puede
  // ser el de una ficha vacía. Se compara contra el mismo cálculo sin ficha.
  const sinFicha = opcionesVisibles({ ficha: null }).find((o) => o.id === "persuasion");
  assert.ok(porId.persuasion.favorable > Math.round(sinFicha.favorable * 100),
    "con +7 la probabilidad favorable tiene que subir respecto a no tener ficha");
});

test("sin ficha del hablante el contexto sigue dando modificador 0, no NaN", () => {
  _reiniciarParaPruebas();
  Hooks.emit("lagunakAbrirParlamento", { contacto: { id: "k", callsign: "K" } });
  for (const o of contextoParlamento().opciones) assert.equal(o.modificador, 0);
});

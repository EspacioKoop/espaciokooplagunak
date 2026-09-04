// El motor de NPC (#676): que la ficha salga bien y salga IGUAL.
import assert from "node:assert/strict";
import test from "node:test";

import {
  DESAFIO_MAX,
  competencia,
  danoRecibido,
  efectividad,
  generarNpc,
  modificador,
  repartirAcciones,
} from "../../scripts/npc-generador/npc-generador.mjs";
import { ARQUETIPOS, ELEMENTOS, LINEAS, NATURALEZAS } from "../../scripts/npc-generador/npc-tablas.mjs";

test("modificador sigue la fórmula del SRD", () => {
  // floor((valor - 10) / 2), incluido el lado negativo, que es donde una
  // división entera mal redondeada se equivoca.
  assert.equal(modificador(10), 0);
  assert.equal(modificador(11), 0);
  assert.equal(modificador(12), 1);
  assert.equal(modificador(9), -1);
  assert.equal(modificador(1), -5);
  assert.equal(modificador(30), 10);
});

test("competencia reproduce la tabla del SRD en sus escalones", () => {
  // La fórmula existe para no copiar veintiún filas a mano; esta prueba
  // comprueba justo los bordes, que es donde se rompería.
  for (const vd of [0, 1, 4]) assert.equal(competencia(vd), 2);
  for (const vd of [5, 8]) assert.equal(competencia(vd), 3);
  for (const vd of [9, 12]) assert.equal(competencia(vd), 4);
  for (const vd of [13, 16]) assert.equal(competencia(vd), 5);
  for (const vd of [17, 20]) assert.equal(competencia(vd), 6);
});

test("la misma semilla da exactamente el mismo NPC", () => {
  const a = generarNpc({ semilla: "estibacion-3", desafio: 7 });
  const b = generarNpc({ semilla: "estibacion-3", desafio: 7 });
  assert.deepEqual(a, b);
});

test("semillas distintas dan NPC distintos", () => {
  const a = generarNpc({ semilla: "a", desafio: 7 });
  const b = generarNpc({ semilla: "b", desafio: 7 });
  assert.notDeepEqual(a, b);
});

test("el mismo NPC con otro desafío no es el mismo NPC", () => {
  const a = generarNpc({ semilla: "igual", desafio: 1 });
  const b = generarNpc({ semilla: "igual", desafio: 12 });
  assert.notEqual(a.id, b.id);
  assert.ok(b.puntos_de_golpe > a.puntos_de_golpe);
});

test("sin semilla no genera: no hay NPC anónimo por descuido", () => {
  assert.throws(() => generarNpc(), TypeError);
  assert.throws(() => generarNpc({ semilla: "" }), TypeError);
});

test("un desafío fuera de rango es un error, no un NPC raro", () => {
  assert.throws(() => generarNpc({ semilla: "x", desafio: -1 }), RangeError);
  assert.throws(() => generarNpc({ semilla: "x", desafio: 99 }), RangeError);
});

test("todo NPC tiene AL MENOS una debilidad", () => {
  // Sin hueco no hay nada que leer y la capa de afinidades sobra. Es la
  // garantía del generador, así que se comprueba sobre muchas semillas y no
  // sobre una afortunada.
  for (let i = 0; i < 500; i += 1) {
    const npc = generarNpc({ semilla: `hueco-${i}`, desafio: i % 21 });
    assert.ok(Object.values(npc.afinidades).includes("debil"),
              `el NPC de la semilla hueco-${i} no tiene ninguna debilidad`);
  }
});

test("la ficha es coherente en todo el rango de desafío", () => {
  const arquetipos = new Set(ARQUETIPOS.map((a) => a.id));
  const lineas = new Set(LINEAS.map((l) => l.id));
  for (let vd = 0; vd <= DESAFIO_MAX; vd += 1) {
    const npc = generarNpc({ semilla: `barrido-${vd}`, desafio: vd });
    assert.ok(arquetipos.has(npc.arquetipo));
    assert.ok(lineas.has(npc.linea));
    assert.ok(NATURALEZAS.includes(npc.naturaleza));
    assert.ok(npc.puntos_de_golpe >= 1, "los PG nunca bajan de 1");
    assert.equal(npc.competencia, competencia(vd));
    for (const valor of Object.values(npc.atributos)) {
      assert.ok(valor >= 1 && valor <= 30, "el SRD acota entre 1 y 30");
    }
    for (const elemento of ELEMENTOS) {
      assert.ok(npc.afinidades[elemento.id], `falta afinidad de ${elemento.id}`);
    }
  }
});

test("la etapa la manda el desafío, no el azar", () => {
  // Una criatura más crecida no puede ser menos peligrosa que su forma previa.
  assert.equal(generarNpc({ semilla: "e", desafio: 1 }).etapa, 0);
  assert.equal(generarNpc({ semilla: "e", desafio: 4 }).etapa, 1);
  assert.equal(generarNpc({ semilla: "e", desafio: 9 }).etapa, 2);
});

test("la última etapa no evoluciona a ninguna parte", () => {
  const npc = generarNpc({ semilla: "final", desafio: 20 });
  assert.equal(npc.evolucionaA, null);
});

test("la matriz de efectividad se deriva y no se inventa", () => {
  for (const elemento of ELEMENTOS) {
    assert.equal(efectividad(elemento.id, elemento.fuerte), 2);
    assert.equal(efectividad(elemento.id, elemento.debil), 0.5);
    for (const nat of NATURALEZAS) {
      if (nat !== elemento.fuerte && nat !== elemento.debil) {
        assert.equal(efectividad(elemento.id, nat), 1);
      }
    }
  }
});

test("un elemento o una naturaleza desconocidos fallan en vez de valer 1", () => {
  // Devolver 1 por lo desconocido convertiría una errata en un NPC inmune a
  // nada y a nadie le saltaría ninguna alarma.
  assert.throws(() => efectividad("no-existe", "biotico"), RangeError);
  assert.throws(() => efectividad("termico", "no-existe"), RangeError);
});

test("absorber y repeler dan daño negativo, que es su razón de ser", () => {
  const npc = generarNpc({ semilla: "afin", desafio: 5 });
  const conAfinidad = (grado) => ({ ...npc, afinidades: { ...npc.afinidades, termico: grado } });
  assert.ok(danoRecibido(10, "termico", conAfinidad("absorbe")) < 0);
  assert.ok(danoRecibido(10, "termico", conAfinidad("repele")) < 0);
  assert.equal(danoRecibido(10, "termico", conAfinidad("nulo")), 0);
  const debil = danoRecibido(10, "termico", conAfinidad("debil"));
  const neutro = danoRecibido(10, "termico", conAfinidad("neutral"));
  assert.ok(debil > neutro);
});

test("el reparto de acciones llena los cuatro cajones del HUD", () => {
  for (const arquetipo of ARQUETIPOS) {
    assert.equal(arquetipo.acciones.length, 3,
                 `${arquetipo.id}: el reparto espera ofensiva, utilidad y defensiva`);
  }
  const npc = generarNpc({ semilla: "hud", desafio: 3 });
  const reparto = repartirAcciones(npc);
  for (const cajon of ["accion", "adicional", "reaccion", "movimiento"]) {
    assert.ok(Array.isArray(reparto[cajon]) && reparto[cajon].length > 0,
              `el cajón ${cajon} quedó vacío`);
  }
});

test("el motor no toca Math.random", async () => {
  // El contrato de los minijuegos (#308) lo prohíbe y aquí vale igual: si el
  // motor sorteara por su cuenta, la semilla dejaría de mandar.
  const original = Math.random;
  Math.random = () => { throw new Error("el motor llamó a Math.random"); };
  try {
    for (let i = 0; i < 50; i += 1) generarNpc({ semilla: i, desafio: i % 21 });
  } finally {
    Math.random = original;
  }
});

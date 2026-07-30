import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import {
  DIFICULTADES,
  crearReto,
  estadoEn,
  lecturaAccesible,
  posicionEn,
  resolverExpiracion,
  resolverPulsacion,
} from "../scripts/asistencia/temporizacion.mjs";

/** Busca el instante en que el cursor pasa más cerca del objetivo. */
const mejorInstante = (reto, hastaMs = 3000, paso = 1) => {
  let mejor = { t: 0, d: Infinity };
  for (let t = 0; t <= hastaMs; t += paso) {
    const d = Math.abs(posicionEn(reto, t) - reto.objetivo);
    if (d < mejor.d) mejor = { t, d };
  }
  return mejor.t;
};

test("la misma semilla da el mismo reto (contrato determinista de #308)", () => {
  const a = crearReto({ semilla: "asistencia-42" });
  const b = crearReto({ semilla: "asistencia-42" });
  assert.deepEqual(a, b);
  const otro = crearReto({ semilla: "asistencia-43" });
  assert.notEqual(otro.objetivo, a.objetivo);
});

test("el motor no usa Math.random ni el reloj: el tiempo entra como parámetro", () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error("el motor no puede llamar a Math.random()");
  };
  try {
    const reto = crearReto({ semilla: "sin-azar-global" });
    assert.equal(typeof estadoEn(reto, 500).posicion, "number");
    assert.equal(typeof resolverPulsacion(reto, 500).precision, "number");
  } finally {
    Math.random = original;
  }
});

test("el cursor barre de ida y vuelta sin salirse ni saltar", () => {
  const reto = crearReto({ semilla: "barrido", inicioMs: 1000 });
  let anterior = posicionEn(reto, 1000);
  for (let t = 1001; t <= 1000 + reto.periodoMs * 2; t += 5) {
    const pos = posicionEn(reto, t);
    assert.ok(pos >= 0 && pos <= 1, `posición fuera de la franja: ${pos}`);
    // Sin discontinuidades: un salto delataría un barrido en diente de sierra,
    // que se juega distinto (y peor).
    assert.ok(Math.abs(pos - anterior) < 0.05, `salto en t=${t}`);
    anterior = pos;
  }
});

test("clavarlo en el centro es crítico; rozar el borde de la zona, no", () => {
  const reto = crearReto({ semilla: "centro", dificultad: "facil" });
  const t = mejorInstante(reto);
  const clavado = resolverPulsacion(reto, t);
  assert.equal(clavado.dentro, true);
  assert.ok(clavado.precision > 0.98);
  assert.equal(clavado.banda, BANDAS.CRITICO);

  // Y rozar el borde de la zona cuenta como entrar, pero no como bordarlo.
  let tBorde = null;
  for (let t = 0; t < 3000 && tBorde === null; t += 1) {
    const d = Math.abs(posicionEn(reto, t) - reto.objetivo);
    if (d > reto.tolerancia * 0.9 && d <= reto.tolerancia) tBorde = t;
  }
  assert.notEqual(tBorde, null);
  const rozado = resolverPulsacion(reto, tBorde);
  assert.equal(rozado.dentro, true);
  assert.notEqual(rozado.banda, BANDAS.CRITICO);
});

test("fuera de la zona no se «casi acierta»: precisión 0 y pifia", () => {
  const reto = crearReto({ semilla: "fuera", dificultad: "dificil" });
  // Un instante cuya posición está claramente lejos del objetivo.
  let tLejos = null;
  for (let t = 0; t < 3000 && tLejos === null; t += 1) {
    if (Math.abs(posicionEn(reto, t) - reto.objetivo) > reto.tolerancia * 3) tLejos = t;
  }
  assert.notEqual(tLejos, null);
  const fallo = resolverPulsacion(reto, tLejos);
  assert.equal(fallo.dentro, false);
  assert.equal(fallo.precision, 0);
  assert.equal(fallo.banda, BANDAS.PIFIA);
});

test("la dificultad estrecha la zona: el mismo acierto vale menos", () => {
  const facil = crearReto({ semilla: "misma", dificultad: "facil" });
  const dificil = crearReto({ semilla: "misma", dificultad: "dificil" });
  // Mismo objetivo (misma semilla), distinta tolerancia.
  assert.equal(facil.objetivo, dificil.objetivo);
  assert.ok(dificil.tolerancia < facil.tolerancia);
  assert.ok(DIFICULTADES.dificil.limiteMs < DIFICULTADES.facil.limiteMs);
});

test("el reto se cierra solo: pasado el límite no puntúa", () => {
  // Importa para el presupuesto de asistencia concurrente: una ayuda abierta
  // para siempre bloquearía el puesto sin que nadie hiciera nada.
  const reto = crearReto({ semilla: "limite", inicioMs: 500 });
  const tarde = resolverPulsacion(reto, 500 + reto.limiteMs + 1);
  assert.equal(tarde.expirado, true);
  assert.equal(tarde.precision, 0);
  assert.equal(tarde.banda, BANDAS.PIFIA);
  assert.equal(estadoEn(reto, 500 + reto.limiteMs).expirado, true);
  assert.equal(resolverExpiracion().banda, BANDAS.PIFIA);
});

test("hay lectura por TEXTO, no solo por color", () => {
  const reto = crearReto({ semilla: "accesible", dificultad: "facil" });
  const t = mejorInstante(reto);
  assert.equal(lecturaAccesible(reto, t).zona, "centro");
  const lejos = lecturaAccesible(reto, t + reto.periodoMs / 4);
  assert.ok(["cerca", "lejos", "dentro"].includes(lejos.zona));
  assert.equal(typeof lecturaAccesible(reto, t).segundosRestantes, "number");
});

test("produce las MISMAS bandas que la tirada: es lo que sostiene el balance", () => {
  // Sin esto, jugar sin dnd5e sería jugar a otra cosa.
  const reto = crearReto({ semilla: "bandas", dificultad: "normal" });
  const vistas = new Set();
  for (let t = 0; t <= reto.periodoMs; t += 1) vistas.add(resolverPulsacion(reto, t).banda);
  for (const banda of vistas) {
    assert.ok(Object.values(BANDAS).includes(banda), `banda desconocida: ${banda}`);
  }
  assert.ok(vistas.has(BANDAS.PIFIA) && vistas.has(BANDAS.CRITICO));
});

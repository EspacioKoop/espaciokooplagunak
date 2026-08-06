import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import {
  DIFICULTADES,
  crearReto,
  estadoEn,
  lecturaAccesible,
  resolverClic,
  resolverExpiracion,
} from "../scripts/asistencia/precision.mjs";

test("la misma semilla da la misma zona (contrato determinista de #308)", () => {
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
    assert.equal(typeof estadoEn(reto, 500).restanteMs, "number");
    assert.equal(typeof resolverClic(reto, 0.5, 500).precision, "number");
  } finally {
    Math.random = original;
  }
});

test("clavarlo en el centro es crítico; rozar el borde de la zona, no", () => {
  const reto = crearReto({ semilla: "centro", dificultad: "facil" });
  const clavado = resolverClic(reto, reto.objetivo, 0);
  assert.equal(clavado.dentro, true);
  assert.equal(clavado.precision, 1);
  assert.equal(clavado.banda, BANDAS.CRITICO);

  const rozado = resolverClic(reto, reto.objetivo + reto.tolerancia * 0.95, 0);
  assert.equal(rozado.dentro, true);
  assert.notEqual(rozado.banda, BANDAS.CRITICO);
});

test("fuera de la zona no se «casi acierta»: precisión 0 y pifia", () => {
  const reto = crearReto({ semilla: "fuera", dificultad: "dificil" });
  const lejos = resolverClic(reto, Math.min(1, reto.objetivo + reto.tolerancia * 3), 0);
  assert.equal(lejos.dentro, false);
  assert.equal(lejos.precision, 0);
  assert.equal(lejos.banda, BANDAS.PIFIA);
});

test("la dificultad estrecha la zona: el mismo clic vale menos", () => {
  const facil = crearReto({ semilla: "misma", dificultad: "facil" });
  const dificil = crearReto({ semilla: "misma", dificultad: "dificil" });
  assert.ok(dificil.tolerancia < facil.tolerancia);
  assert.ok(DIFICULTADES.dificil.limiteMs < DIFICULTADES.facil.limiteMs);
});

test("el reto se cierra solo: pasado el límite no puntúa", () => {
  const reto = crearReto({ semilla: "limite", inicioMs: 500 });
  const tarde = resolverClic(reto, reto.objetivo, 500 + reto.limiteMs + 1);
  assert.equal(tarde.expirado, true);
  assert.equal(tarde.precision, 0);
  assert.equal(tarde.banda, BANDAS.PIFIA);
  assert.equal(estadoEn(reto, 500 + reto.limiteMs).expirado, true);
  assert.equal(resolverExpiracion().banda, BANDAS.PIFIA);
});

test("hay lectura por TEXTO: cuenta atrás, no una posición que aún no existe", () => {
  const reto = crearReto({ semilla: "accesible", dificultad: "facil", inicioMs: 0 });
  const lectura = lecturaAccesible(reto, 1000);
  assert.equal(typeof lectura.segundosRestantes, "number");
  assert.equal(lectura.expirado, false);
  assert.equal(lecturaAccesible(reto, reto.finMs + 1).expirado, true);
});

test("un clic fuera de [0,1] se acota en vez de reventar o desbordar el rango", () => {
  const reto = crearReto({ semilla: "fuera-de-rango" });
  assert.equal(typeof resolverClic(reto, -0.5, 0).precision, "number");
  assert.equal(typeof resolverClic(reto, 1.8, 0).precision, "number");
});

test("produce las MISMAS bandas que la tirada: es lo que sostiene el balance", () => {
  const reto = crearReto({ semilla: "bandas", dificultad: "normal" });
  const centro = resolverClic(reto, reto.objetivo, 0);
  const lejos = resolverClic(reto, Math.max(0, reto.objetivo - reto.tolerancia * 3), 0);
  for (const resultado of [centro, lejos, resolverExpiracion()]) {
    assert.ok(Object.values(BANDAS).includes(resultado.banda), `banda desconocida: ${resultado.banda}`);
  }
  assert.equal(centro.banda, BANDAS.CRITICO);
  assert.equal(lejos.banda, BANDAS.PIFIA);
});

test("la zona cabe entera en la franja para toda semilla y dificultad", () => {
  for (const dificultad of Object.keys(DIFICULTADES)) {
    const tolerancia = DIFICULTADES[dificultad].tolerancia;
    for (let i = 0; i < 500; i += 1) {
      const reto = crearReto({ semilla: `barrido-${dificultad}-${i}`, dificultad });
      const inferior = reto.objetivo - tolerancia;
      const superior = reto.objetivo + tolerancia;
      assert.ok(inferior >= 0, `${dificultad}/${i}: borde inferior ${inferior} < 0`);
      assert.ok(superior <= 1, `${dificultad}/${i}: borde superior ${superior} > 1`);
      assert.equal(Math.round((superior - inferior) * 1e9) / 1e9, 2 * tolerancia);
    }
  }
});

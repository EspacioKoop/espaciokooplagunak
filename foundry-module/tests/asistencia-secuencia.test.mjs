import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import {
  DIFICULTADES,
  crearReto,
  estadoEn,
  lecturaAccesible,
  resolverExpiracion,
  resolverIntentos,
} from "../scripts/asistencia/secuencia.mjs";

test("la misma semilla da la misma secuencia (contrato determinista de #308)", () => {
  const a = crearReto({ semilla: "asistencia-42" });
  const b = crearReto({ semilla: "asistencia-42" });
  assert.deepEqual(a, b);
  const otro = crearReto({ semilla: "asistencia-43" });
  assert.notDeepEqual(otro.secuencia, a.secuencia);
});

test("el motor no usa Math.random ni el reloj: el tiempo entra como parámetro", () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error("el motor no puede llamar a Math.random()");
  };
  try {
    const reto = crearReto({ semilla: "sin-azar-global" });
    assert.equal(typeof estadoEn(reto, 500).fase, "string");
    assert.equal(typeof resolverIntentos(reto, [], 500).precision, "number");
  } finally {
    Math.random = original;
  }
});

test("la secuencia cabe en el alfabeto declarado, para toda semilla y dificultad", () => {
  for (const dificultad of Object.keys(DIFICULTADES)) {
    const { simbolos, longitud } = DIFICULTADES[dificultad];
    for (let i = 0; i < 200; i += 1) {
      const reto = crearReto({ semilla: `alfabeto-${dificultad}-${i}`, dificultad });
      assert.equal(reto.secuencia.length, longitud);
      for (const simbolo of reto.secuencia) {
        assert.ok(simbolo >= 0 && simbolo < simbolos, `símbolo fuera de rango: ${simbolo}`);
      }
    }
  }
});

test("en fase «muestra» el símbolo activo avanza uno a uno y respeta la secuencia", () => {
  const reto = crearReto({ semilla: "muestra", dificultad: "normal", inicioMs: 1000 });
  for (let i = 0; i < reto.secuencia.length; i += 1) {
    const t = reto.inicioMs + i * reto.duracionSimboloMs + 1;
    const estado = estadoEn(reto, t);
    assert.equal(estado.fase, "muestra");
    assert.equal(estado.simboloActivo, reto.secuencia[i]);
  }
  // Pasado el último símbolo, se entra en fase de entrada.
  assert.equal(estadoEn(reto, reto.finMuestraMs + 1).fase, "entrada");
});

test("completar la secuencia entera da banda favorable, con bono por rapidez", () => {
  const reto = crearReto({ semilla: "completa", dificultad: "facil" });
  const intentos = [...reto.secuencia];

  const rapido = resolverIntentos(reto, intentos, reto.finMuestraMs + 1);
  assert.equal(rapido.completado, true);
  assert.equal(rapido.banda, BANDAS.CRITICO);

  const alFilo = resolverIntentos(reto, intentos, reto.finEntradaMs);
  assert.equal(alFilo.completado, true);
  assert.ok(alFilo.precision < rapido.precision, "completar rápido debe valer más que apurar");
  assert.equal(alFilo.banda, BANDAS.EXITO);
});

test("un fallo corta la cadena ahí: no hay «casi acierto» tras el símbolo equivocado", () => {
  const reto = crearReto({ semilla: "fallo-temprano", dificultad: "normal" });
  const primerErroneo = (reto.secuencia[0] + 1) % reto.simbolos;
  const resultado = resolverIntentos(reto, [primerErroneo, reto.secuencia[1]], reto.finMuestraMs + 1);
  assert.equal(resultado.fallado, true);
  assert.equal(resultado.aciertos, 0);
  assert.equal(resultado.banda, BANDAS.PIFIA);
});

test("fallar casi al final vale más que fallar al principio, pero no iguala completarla", () => {
  const reto = crearReto({ semilla: "fallo-tardio", dificultad: "normal" });
  const longitud = reto.secuencia.length;
  const ultimoErroneo = (reto.secuencia[longitud - 1] + 1) % reto.simbolos;
  const intentos = [...reto.secuencia.slice(0, longitud - 1), ultimoErroneo];
  const resultado = resolverIntentos(reto, intentos, reto.finMuestraMs + 1);
  assert.equal(resultado.fallado, true);
  assert.equal(resultado.aciertos, longitud - 1);
  assert.ok(resultado.precision > 0);
  assert.ok(resultado.precision < 0.6, "un fallo, aunque tardío, no debe alcanzar éxito");
});

test("el reto se cierra solo: agotar el tiempo sin completar no puntúa como éxito", () => {
  const reto = crearReto({ semilla: "limite", dificultad: "dificil", inicioMs: 500 });
  const tarde = resolverIntentos(reto, [], reto.finEntradaMs + 1);
  assert.equal(tarde.expirado, true);
  assert.equal(tarde.precision, 0);
  assert.equal(tarde.banda, BANDAS.PIFIA);
  assert.equal(estadoEn(reto, reto.finEntradaMs).expirado, true);
  assert.equal(resolverExpiracion(reto).banda, BANDAS.PIFIA);
});

test("hay lectura por TEXTO, no solo por los símbolos parpadeando", () => {
  const reto = crearReto({ semilla: "accesible", dificultad: "facil" });
  const enMuestra = lecturaAccesible(reto, reto.inicioMs + 1);
  assert.equal(enMuestra.fase, "muestra");
  assert.equal(enMuestra.posicion, 1);
  assert.equal(enMuestra.deSecuencia, reto.secuencia.length);

  const enEntrada = lecturaAccesible(reto, reto.finMuestraMs + 1);
  assert.equal(enEntrada.fase, "entrada");
  assert.equal(typeof enEntrada.segundosRestantes, "number");
});

test("produce las MISMAS bandas que la tirada: es lo que sostiene el balance", () => {
  const reto = crearReto({ semilla: "bandas", dificultad: "normal" });
  const vistas = new Set([
    resolverIntentos(reto, [...reto.secuencia], reto.finMuestraMs + 1).banda,
    resolverIntentos(reto, [(reto.secuencia[0] + 1) % reto.simbolos], reto.finMuestraMs + 1).banda,
    resolverExpiracion(reto).banda,
  ]);
  for (const banda of vistas) {
    assert.ok(Object.values(BANDAS).includes(banda), `banda desconocida: ${banda}`);
  }
  assert.ok(vistas.has(BANDAS.PIFIA));
});

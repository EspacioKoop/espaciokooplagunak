import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import {
  DIFICULTADES,
  crearReto,
  estadoEn,
  lecturaAccesible,
  resolverEnvio,
  resolverExpiracion,
} from "../scripts/asistencia/puzzle.mjs";

const patronAcertado = (reto) => reto.patronObjetivo.map(Boolean);

test("la misma semilla da el mismo patrón (contrato determinista de #308)", () => {
  const a = crearReto({ semilla: "asistencia-42" });
  const b = crearReto({ semilla: "asistencia-42" });
  assert.deepEqual(a, b);
  const otro = crearReto({ semilla: "asistencia-43" });
  assert.notDeepEqual(otro.patronObjetivo, a.patronObjetivo);
});

test("el motor no usa Math.random ni el reloj: el tiempo entra como parámetro", () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error("el motor no puede llamar a Math.random()");
  };
  try {
    const reto = crearReto({ semilla: "sin-azar-global" });
    assert.equal(typeof estadoEn(reto, 500).restanteMs, "number");
    assert.equal(typeof resolverEnvio(reto, [], 500).precision, "number");
  } finally {
    Math.random = original;
  }
});

test("el patrón siempre tiene exactamente el número de encendidos que pide la dificultad", () => {
  for (const dificultad of Object.keys(DIFICULTADES)) {
    const { celdas, encendidos } = DIFICULTADES[dificultad];
    for (let i = 0; i < 200; i += 1) {
      const reto = crearReto({ semilla: `barrido-${dificultad}-${i}`, dificultad });
      assert.equal(reto.patronObjetivo.length, celdas);
      assert.equal(reto.patronObjetivo.filter(Boolean).length, encendidos);
    }
  }
});

test("acertar el patrón exacto da banda favorable, con bono por rapidez", () => {
  const reto = crearReto({ semilla: "exacto", dificultad: "facil" });
  const patron = patronAcertado(reto);

  const rapido = resolverEnvio(reto, patron, reto.inicioMs + 1);
  assert.equal(rapido.exacto, true);
  assert.equal(rapido.banda, BANDAS.CRITICO);

  const alFilo = resolverEnvio(reto, patron, reto.finMs);
  assert.equal(alFilo.exacto, true);
  assert.ok(alFilo.precision < rapido.precision, "completar rápido debe valer más que apurar");
  assert.equal(alFilo.banda, BANDAS.EXITO);
});

test("una casilla de más no es «casi acierto»: no cuenta como exacto", () => {
  const reto = crearReto({ semilla: "sobra-una", dificultad: "normal" });
  const patron = patronAcertado(reto);
  const primeraApagada = patron.findIndex((v) => !v);
  patron[primeraApagada] = true; // enciende una de más

  const resultado = resolverEnvio(reto, patron, reto.finMs);
  assert.equal(resultado.exacto, false);
  assert.equal(resultado.expirado, true);
  assert.ok(resultado.sobrantes >= 1);
});

test("encender al azar sin acertar nada no puntúa por chance: precisión 0", () => {
  const reto = crearReto({ semilla: "todo-apagado", dificultad: "normal" });
  // El panel vacío nunca acierta ninguna celda del objetivo (todas empiezan
  // apagadas): es el caso base de "no jugar".
  const resultado = resolverEnvio(reto, [], reto.finMs);
  assert.equal(resultado.aciertos, 0);
  assert.equal(resultado.precision, 0);
  assert.equal(resultado.banda, BANDAS.PIFIA);
});

test("acertar casi todo vale más que no acertar nada, pero no iguala el exacto", () => {
  const reto = crearReto({ semilla: "casi-todo", dificultad: "dificil" });
  const patron = patronAcertado(reto);
  const primeraEncendida = patron.findIndex((v) => v);
  patron[primeraEncendida] = false; // apaga una de las que sí tocaba

  const resultado = resolverEnvio(reto, patron, reto.finMs);
  assert.equal(resultado.exacto, false);
  assert.ok(resultado.precision > 0);
  assert.ok(resultado.precision < 0.6, "un patrón incompleto no debe alcanzar éxito");
});

test("el reto se cierra solo: agotar el tiempo sin acertar no puntúa como éxito", () => {
  const reto = crearReto({ semilla: "limite", dificultad: "dificil", inicioMs: 500 });
  const tarde = resolverEnvio(reto, [], reto.finMs + 1);
  assert.equal(tarde.expirado, true);
  assert.equal(tarde.precision, 0);
  assert.equal(tarde.banda, BANDAS.PIFIA);
  assert.equal(estadoEn(reto, reto.finMs).expirado, true);
  assert.equal(resolverExpiracion(reto).banda, BANDAS.PIFIA);
});

test("un envío antes del límite, incompleto, no se cierra todavía", () => {
  // A diferencia de temporización/precisión, el puzzle no se cierra por un
  // envío fallido salvo que el tiempo ya se haya agotado: se puede seguir
  // intentando dentro del límite.
  const reto = crearReto({ semilla: "reintento", dificultad: "normal", inicioMs: 0 });
  const resultado = resolverEnvio(reto, [], 100);
  assert.equal(resultado.cerrado, false);
  assert.equal(resultado.banda, null);
});

test("hay lectura por TEXTO: describe el mismo patrón que se ve, no menos", () => {
  const reto = crearReto({ semilla: "accesible", dificultad: "facil" });
  const lectura = lecturaAccesible(reto, 1000);
  assert.equal(lectura.total, reto.celdas);
  assert.equal(lectura.posiciones.length, reto.patronObjetivo.filter(Boolean).length);
  for (const posicion of lectura.posiciones) {
    assert.equal(reto.patronObjetivo[posicion - 1], true, `posición ${posicion} no estaba encendida`);
  }
  assert.equal(typeof lectura.segundosRestantes, "number");
  assert.equal(lecturaAccesible(reto, reto.finMs + 1).expirado, true);
});

test("produce las MISMAS bandas que la tirada: es lo que sostiene el balance", () => {
  const reto = crearReto({ semilla: "bandas", dificultad: "normal" });
  const vistas = new Set([
    resolverEnvio(reto, patronAcertado(reto), reto.inicioMs + 1).banda,
    resolverExpiracion(reto).banda,
  ]);
  for (const banda of vistas) {
    assert.ok(Object.values(BANDAS).includes(banda), `banda desconocida: ${banda}`);
  }
  assert.ok(vistas.has(BANDAS.PIFIA));
});

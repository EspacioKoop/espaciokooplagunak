import assert from "node:assert/strict";
import test from "node:test";

import {
  CLASIFICADOR,
  EDICIONES,
  FUENTES_2014,
  FUENTES_2024,
  MOTIVOS,
  crearClasificador,
  esDe2014,
} from "../scripts/contenido-externo/edicion.mjs";

// Todos los datos de estas pruebas son INVENTADOS. No hay ni un statblock real
// de WotC en el repositorio, ni lo habrá: el issue lo prohíbe explícitamente y
// un fixture copiado sería redistribución igual que un compendio.
const criatura2014 = { name: "Zarrapastro de vacío", system: { source: { book: "MM", rules: "2014" } } };
const criatura2024 = { name: "Zarrapastro revisado", system: { source: { book: "XMM", rules: "2024" } } };
const criaturaCasera = { name: "Bicho de la mesa", system: { source: { book: "Cuaderno de Eloy" } } };

test("fuente de 2014 → aceptada", () => {
  const veredicto = CLASIFICADOR.clasificar(criatura2014);
  assert.equal(veredicto.aceptado, true);
  assert.equal(veredicto.edicion, EDICIONES.D2014);
  assert.equal(veredicto.motivo, MOTIVOS.REGLAS_EXPLICITAS);
  assert.equal(esDe2014(criatura2014), true);
});

test("fuente de 2024 → rechazada", () => {
  const veredicto = CLASIFICADOR.clasificar(criatura2024);
  assert.equal(veredicto.aceptado, false);
  assert.equal(veredicto.edicion, EDICIONES.D2024);
  assert.equal(veredicto.motivo, MOTIVOS.REGLAS_2024);
});

test("fuente desconocida → rechazada, no se asume 2014", () => {
  const veredicto = CLASIFICADOR.clasificar(criaturaCasera);
  assert.equal(veredicto.aceptado, false);
  assert.equal(veredicto.edicion, EDICIONES.DESCONOCIDA);
  assert.equal(veredicto.motivo, MOTIVOS.FUENTE_DESCONOCIDA);
  // Y dice CUÁL era, que es lo que hace depurable el rechazo.
  assert.equal(veredicto.detalle, "Cuaderno de Eloy");
});

test("sin metadatos de procedencia → rechazado", () => {
  const veredicto = CLASIFICADOR.clasificar({ name: "Sin papeles", system: {} });
  assert.equal(veredicto.aceptado, false);
  assert.equal(veredicto.motivo, MOTIVOS.SIN_METADATOS);
});

test("lo que no es un documento tampoco cuela", () => {
  for (const basura of [null, undefined, 7, "MM", true]) {
    const veredicto = CLASIFICADOR.clasificar(basura);
    assert.equal(veredicto.aceptado, false, `${String(basura)} no debería clasificarse`);
    assert.equal(veredicto.motivo, MOTIVOS.ENTRADA_INVALIDA);
  }
});

test("sin declaración de reglas, la lista blanca decide", () => {
  const soloFuente = { name: "Cacharro viejo", system: { source: { book: "XGE" } } };
  const veredicto = CLASIFICADOR.clasificar(soloFuente);
  assert.equal(veredicto.aceptado, true);
  assert.equal(veredicto.motivo, MOTIVOS.FUENTE_EN_LISTA);
});

test("un libro de 2024 sin declaración de reglas se rechaza por la fuente", () => {
  const veredicto = CLASIFICADOR.clasificar({ name: "Nuevo", system: { source: { book: "XPHB" } } });
  assert.equal(veredicto.aceptado, false);
  assert.equal(veredicto.motivo, MOTIVOS.FUENTE_2024);
});

test("metadatos que se contradicen se resuelven EN CONTRA", () => {
  // Dice 2014 pero viene de un libro de 2024: no se confía en ninguno de los
  // dos. Falla cerrado también cuando la contradicción favorecería aceptar.
  const mentiroso = { name: "Ambiguo", system: { source: { book: "XPHB", rules: "2014" } } };
  const veredicto = CLASIFICADOR.clasificar(mentiroso);
  assert.equal(veredicto.aceptado, false);
  assert.equal(veredicto.motivo, MOTIVOS.FUENTE_2024);
});

test("una declaración de reglas que no sabemos leer NO cae a la fuente", () => {
  // El caso que rompía el fallo cerrado: reglas raras + libro blanco. Si la
  // declaración desconocida se ignorase, «PHB» aceptaría como 2014 algo que se
  // anuncia a sí mismo como una variante de 2024.
  const variante = { name: "Etiqueta nueva", system: { source: { rules: "2024-revised", book: "PHB" } } };
  const veredicto = CLASIFICADOR.clasificar(variante);
  assert.equal(veredicto.aceptado, false);
  assert.equal(veredicto.edicion, EDICIONES.DESCONOCIDA);
  assert.equal(veredicto.motivo, MOTIVOS.REGLAS_DESCONOCIDAS);
  // Y dice qué ponía, para poder ampliar el criterio a propósito.
  assert.equal(veredicto.detalle, "2024-revised");
  assert.equal(esDe2014(variante), false);
});

test("cualquier declaración de reglas ajena a 2014/2024 se descarta", () => {
  for (const rara of ["2024-revised", "5.5", "one", "2014-ish", "próximamente"]) {
    const veredicto = CLASIFICADOR.clasificar({ name: "x", system: { source: { rules: rara, book: "MM" } } });
    assert.equal(veredicto.aceptado, false, `«${rara}» no debería aceptarse`);
    assert.equal(veredicto.motivo, MOTIVOS.REGLAS_DESCONOCIDAS);
  }
});

test("la declaración de reglas se normaliza igual que la fuente", () => {
  // « 2014 » sigue siendo 2014: el fallo cerrado nuevo no puede volverse tan
  // estricto que rechace la misma declaración por venir con espacios.
  for (const variante of [" 2014 ", "2.014", "2-0-1-4"]) {
    const veredicto = CLASIFICADOR.clasificar({ name: "x", system: { source: { rules: variante, book: "MM" } } });
    assert.equal(veredicto.aceptado, true, `«${variante}» debería normalizar a 2014`);
    assert.equal(veredicto.motivo, MOTIVOS.REGLAS_EXPLICITAS);
  }
});

test("la fuente se compara sin importar espacios, guiones ni mayúsculas", () => {
  for (const variante of ["mm", " M.M ", "M-M"]) {
    const veredicto = CLASIFICADOR.clasificar({ name: "x", system: { source: { book: variante } } });
    assert.equal(veredicto.aceptado, true, `${variante} debería normalizar a MM`);
  }
});

test("`system.source` como cadena suelta también vale (mundos viejos)", () => {
  const veredicto = CLASIFICADOR.clasificar({ name: "x", system: { source: "TCE" } });
  assert.equal(veredicto.aceptado, true);
  assert.equal(veredicto.detalle, "TCE");
});

test("una pista de plutonium sirve como fuente, no como declaración de reglas", () => {
  const conFlag = { name: "x", flags: { plutonium: { source: "VGM" } } };
  assert.equal(CLASIFICADOR.clasificar(conFlag).motivo, MOTIVOS.FUENTE_EN_LISTA);

  const flagRara = { name: "y", flags: { plutonium: { source: "Homebrew de internet" } } };
  assert.equal(CLASIFICADOR.clasificar(flagRara).aceptado, false);
});

test("una mesa puede ampliar su lista blanca, pero no puede ampliar hacia 2024", () => {
  const propio = crearClasificador({ fuentes2014: ["MI-CAMPAÑA", "XPHB"] });
  assert.equal(propio.clasificar({ system: { source: { book: "MI-CAMPAÑA" } } }).aceptado, true);
  // Intentar colar un libro de 2024 por la lista blanca no funciona: la negra
  // gana siempre. Ampliar no puede aflojar el criterio sin querer.
  assert.equal(propio.clasificar({ system: { source: { book: "XPHB" } } }).aceptado, false);
  // Y ampliar nunca quita lo de serie.
  assert.equal(propio.clasificar({ system: { source: { book: "PHB" } } }).aceptado, true);
});

test("las dos listas no se solapan y el SRD propio está en la de 2014", () => {
  const blancas = new Set(FUENTES_2014);
  for (const negra of FUENTES_2024) {
    assert.equal(blancas.has(negra), false, `${negra} está en las dos listas`);
  }
  // El contenido propio del proyecto sale del SRD 5.1 (CC-BY-4.0); si dejara de
  // estar aceptado, el módulo se filtraría a sí mismo.
  assert.equal(blancas.has("SRD"), true);
});

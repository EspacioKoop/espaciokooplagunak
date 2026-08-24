import assert from "node:assert/strict";
import test from "node:test";

import { anotarRelevo, derivarRelevo } from "../scripts/station-handover.mjs";

// ---- derivarRelevo: lógica pura --------------------------------------------

test("sin línea base conocida (undefined) no hay relevo que anunciar", () => {
  assert.equal(derivarRelevo({ userId: "u1", estacionAnterior: undefined, estacionNueva: "navigation" }), null);
});

test("sin cambio de puesto no hay relevo", () => {
  assert.equal(derivarRelevo({ userId: "u1", estacionAnterior: "navigation", estacionNueva: "navigation" }), null);
  assert.equal(derivarRelevo({ userId: "u1", estacionAnterior: null, estacionNueva: null }), null);
});

test("de un puesto a otro es un relevo, con ambos valores presentes", () => {
  assert.deepEqual(
    derivarRelevo({ userId: "u1", estacionAnterior: "navigation", estacionNueva: "weapons" }),
    { userId: "u1", estacionAnterior: "navigation", estacionNueva: "weapons" },
  );
});

test("dejar el puesto (a null) es un relevo: el puesto queda vacante", () => {
  assert.deepEqual(
    derivarRelevo({ userId: "u1", estacionAnterior: "engineering", estacionNueva: null }),
    { userId: "u1", estacionAnterior: "engineering", estacionNueva: null },
  );
});

test("asumir un puesto vacío (de null a uno) es un relevo, no solo un cambio entre dos puestos", () => {
  assert.deepEqual(
    derivarRelevo({ userId: "u1", estacionAnterior: null, estacionNueva: "sensors" }),
    { userId: "u1", estacionAnterior: null, estacionNueva: "sensors" },
  );
});

test("sin userId no hay relevo que atribuir a nadie", () => {
  assert.equal(derivarRelevo({ userId: null, estacionAnterior: "navigation", estacionNueva: "weapons" }), null);
  assert.equal(derivarRelevo({ estacionAnterior: "navigation", estacionNueva: "weapons" }), null);
});
// ---- anotarRelevo: escritor de bitácora, con game/JournalEntry mockeados --
function gameFalso({ isGM = true, nombreUsuario = "Jon" } = {}) {
  return {
    user: { isGM },
    i18n: {
      localize: (clave) => clave,
      format: (clave, datos) => `${clave}${datos ? ` ${JSON.stringify(datos)}` : ""}`,
    },
    users: { get: (id) => (id === "u1" ? { name: nombreUsuario } : undefined) },
    journal: { getName: () => undefined },
  };
}

function journalEntryFalso() {
  const paginas = [];
  const journal = {
    pages: paginas,
    createEmbeddedDocuments: async (_tipo, entradas) => {
      for (const entrada of entradas) {
        paginas.push({
          name: entrada.name,
          getFlag: (moduloId, clave) => entrada.flags?.[moduloId]?.[clave],
        });
      }
      return entradas;
    },
  };
  return { create: async () => journal, journalCreado: journal };
}

function uiFalso() {
  const avisos = [];
  return { avisos, notifications: { info: (msg) => avisos.push(msg) } };
}

// ------------------------------------------------------------------
// Helpers de prueba adicionales
function escapeHtmlTest(value) {
  return String(value).replace(/[&<>\"']/g, (character) => `&#${character.codePointAt(0)};`);
}

function localizeStationTest(station, i18n) {
  return station ? i18n.localize(`LAGUNAK.Puestos.${station}`) : i18n.localize("LAGUNAK.Puestos.SinAsignar");
}

// Tests originales continuacion

test("un relevo real se anota en la bitácora, visible para toda la mesa (no una notificación privada)", async () => {
  const game = gameFalso();
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  const relevo = { userId: "u1", estacionAnterior: "navigation", estacionNueva: "weapons" };
  const creado = await anotarRelevo({ relevo, nonce: "n1", sello: 1000, game, JournalEntry, ui });
  assert.equal(creado, true);
  const journal = await JournalEntry.create();
  assert.equal(journal.pages.length, 1);
  assert.match(journal.pages[0].name, /Traslada\.Titulo/);
  assert.deepEqual(ui.avisos, ["LAGUNAK.Relevo.Anotado"]);
});

// solo el GM anota; un jugador no escribe nada

test("solo el GM anota; un jugador no escribe nada", async () => {
  const game = gameFalso({ isGM: false });
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  const creado = await anotarRelevo({
    relevo: { userId: "u1", estacionAnterior: "navigation", estacionNueva: "weapons" },
    nonce: "n1",
    game,
    JournalEntry,
    ui,
  });
  assert.equal(creado, false);
  assert.deepEqual(ui.avisos, []);
});

// DERIVARRELEVO EDGE CASES

test("estacionNueva undefined se trata como null", () => {
  const res = derivarRelevo({ userId: "u1", estacionAnterior: "navigation", estacionNueva: undefined });
  assert.deepEqual(res, { userId: "u1", estacionAnterior: "navigation", estacionNueva: null });
});

test("estacionAnterior undefined siempre produce null, incluso con estacionNueva null", () => {
  const res = derivarRelevo({ userId: "u1", estacionAnterior: undefined, estacionNueva: null });
  assert.equal(res, null);
});

// ANOTARRELEVO ESCAPE SPECIAL CHARACTERS

test("usuario con caracteres especiales se escapa antes de usar", async () => {
  const game = gameFalso({ nombreUsuario: "Jon & <script>" });
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  const relevo = { userId: "u1", estacionAnterior: "navigation", estacionNueva: "weapons" };
  const creado = await anotarRelevo({ relevo, nonce: "special", sello: 100, game, JournalEntry, ui });
  assert.equal(creado, true);
  const journal = await JournalEntry.create();
  const pageName = journal.pages[0].name;
  assert.ok(pageName.includes("&#38;") && pageName.includes("&#60;"));
});

// Following tests continued

test("sin relevo (null) no escribe nada", async () => {
  const game = gameFalso();
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  const creado = await anotarRelevo({ relevo: null, nonce: "n1", game, JournalEntry, ui });
  assert.equal(creado, false);
});

// el mismo relevo

test("el mismo relevo (mismo sello y nonce) no se anota dos veces", async () => {
  const game = gameFalso();
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  const relevo = { userId: "u1", estacionAnterior: "navigation", estacionNueva: "weapons" };
  await anotarRelevo({ relevo, nonce: "n1", sello: 500, game, JournalEntry, ui });
  const segundaVez = await anotarRelevo({ relevo, nonce: "n1", sello: 500, game, JournalEntry, ui });
  assert.equal(segundaVez, false);
  const journal = await JournalEntry.create();
  assert.equal(journal.pages.length, 1, "no se duplica");
});

// same pair different time

test("el mismo par de puestos en OTRO momento (sello distinto) SÍ se anota: ida y vuelta son informativas", async () => {
  const game = gameFalso();
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  await anotarRelevo({
    relevo: { userId: "u1", estacionAnterior: "navigation", estacionNueva: "weapons" },
    nonce: "n1",
    sello: 1,
    game, JournalEntry, ui,
  });
  await anotarRelevo({
    relevo: { userId: "u1", estacionAnterior: "weapons", estacionNueva: "navigation" },
    nonce: "n1",
    sello: 2,
    game, JournalEntry, ui,
  });
  const journal = await JournalEntry.create();
  assert.equal(journal.pages.length, 2, "el va y viene deja dos entradas, no se pierde la primera");
});

// three variants

test("las tres variantes (asume/deja/traslada) usan claves i18n distintas", async () => {
  const game = gameFalso();
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  await anotarRelevo({
    relevo: { userId: "u1", estacionAnterior: null, estacionNueva: "sensors" },
    nonce: "n", sello: 1, game, JournalEntry, ui,
  });
  await anotarRelevo({
    relevo: { userId: "u1", estacionAnterior: "sensors", estacionNueva: null },
    nonce: "n", sello: 2, game, JournalEntry, ui,
  });
  await anotarRelevo({
    relevo: { userId: "u1", estacionAnterior: "sensors", estacionNueva: "weapons" },
    nonce: "n", sello: 3, game, JournalEntry, ui,
  });
  const journal = await JournalEntry.create();
  assert.match(journal.pages[0].name, /AsumePuesto\.Titulo/);
  assert.match(journal.pages[1].name, /DejaPuesto\.Titulo/);
  assert.match(journal.pages[2].name, /Traslada\.Titulo/);
});

// sigueVigente se respeta: una autorización caducada no escribe

test("sigueVigente se respeta: una autorización caducada no escribe", async () => {
  const game = gameFalso();
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  const creado = await anotarRelevo({
    relevo: { userId: "u1", estacionAnterior: "navigation", estacionNueva: "weapons" },
    nonce: "n1",
    game,
    JournalEntry,
    ui,
    sigueVigente: () => false,
  });
  assert.equal(creado, false);
  assert.deepEqual(ui.avisos, []);
});

// NEW TEST: ensure station names with special characters are escaped correctly

test("anotarRelevo properly escapes station names with special characters", async () => {
  const game = gameFalso();
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  const relevo = { userId: "u1", estacionAnterior: "<>&", estacionNueva: "\"'" };
  const creado = await anotarRelevo({ relevo, nonce: "special", sello: 100, game, JournalEntry, ui });
  assert.equal(creado, true);
  const journal = await JournalEntry.create();
  const pageName = journal.pages[0].name;
  // Check that special HTML entities are escaped
  assert.ok(pageName.includes("&#60;") && pageName.includes("&#38;") && pageName.includes("&#62;") && pageName.includes("&#34;") && pageName.includes("&#39;"));
});

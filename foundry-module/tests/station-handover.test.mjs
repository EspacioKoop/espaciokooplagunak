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

test("sin relevo (null) no escribe nada", async () => {
  const game = gameFalso();
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  const creado = await anotarRelevo({ relevo: null, nonce: "n1", game, JournalEntry, ui });
  assert.equal(creado, false);
});

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

// ---- Casos de borde de derivarRelevo -------------------------------------
//
// `undefined` y `null` NO significan lo mismo aquí, y esa es la razón de que
// estos tres casos existan: `estacionAnterior: undefined` es «no sabemos qué
// puesto tenía» (el mapa de puestos previos aún no lo había visto), mientras
// que `null` es «sabemos que no tenía ninguno». Confundirlos anotaría en la
// bitácora un relevo que nadie hizo, al arrancar la partida.

test("estacionNueva undefined se trata como null: dejar el puesto sí es un relevo", () => {
  assert.deepEqual(
    derivarRelevo({ userId: "u1", estacionAnterior: "navigation", estacionNueva: undefined }),
    { userId: "u1", estacionAnterior: "navigation", estacionNueva: null },
  );
});

test("estacionAnterior undefined nunca es relevo: no se sabía qué tenía, no que no tuviera", () => {
  assert.equal(derivarRelevo({ userId: "u1", estacionAnterior: undefined, estacionNueva: null }), null);
});

test("de ningún puesto a ningún puesto no hay nada que anotar", () => {
  assert.equal(derivarRelevo({ userId: "u1", estacionAnterior: null, estacionNueva: null }), null);
});

// ---- El nombre que entra en la bitácora se escapa ------------------------
//
// La página va al diario, que la mesa entera lee renderizada. Tanto el nombre
// de quien releva como los identificadores de puesto se escapan: el primero
// porque lo escribe una persona, y el segundo porque un puesto de un módulo de
// terceros no tiene por qué traer un id inocente.

test("el nombre de quien releva se escapa antes de entrar en la bitácora", async () => {
  const game = gameFalso({ nombreUsuario: "Jon & <script>" });
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  const creado = await anotarRelevo({
    relevo: { userId: "u1", estacionAnterior: "navigation", estacionNueva: "weapons" },
    nonce: "esc", sello: 100, game, JournalEntry, ui,
  });
  assert.equal(creado, true);
  const journal = await JournalEntry.create();
  const titulo = journal.pages[0].name;
  assert.ok(!titulo.includes("<script"), "no queda ninguna etiqueta interpretable");
  assert.ok(titulo.includes("&#38;") && titulo.includes("&#60;"));
});

test("los identificadores de puesto también se escapan", async () => {
  const game = gameFalso();
  const JournalEntry = journalEntryFalso();
  const ui = uiFalso();
  const creado = await anotarRelevo({
    relevo: { userId: "u1", estacionAnterior: "<>&", estacionNueva: "\"'" },
    nonce: "esc2", sello: 100, game, JournalEntry, ui,
  });
  assert.equal(creado, true);
  const titulo = (await JournalEntry.create()).pages[0].name;
  for (const entidad of ["&#60;", "&#62;", "&#38;", "&#34;", "&#39;"]) {
    assert.ok(titulo.includes(entidad), `falta ${entidad} en ${titulo}`);
  }
});

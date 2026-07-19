import assert from "node:assert/strict";
import test from "node:test";

import {
  UMBRAL_CASCO,
  UMBRAL_ENERGIA,
  anotarAlertas,
  derivarAlertas,
} from "../scripts/alertas-nave.mjs";

const sano = {
  hull: 100,
  hull_max: 100,
  energy: 1000,
  energy_max: 1000,
  systems: { impulse: { health: 1 }, warp: { health: 1 } },
};

function con(estado, cambios) {
  return { ...estado, ...cambios };
}

test("sin estado previo no hay flanco que detectar", () => {
  assert.deepEqual(derivarAlertas(null, sano), []);
});

test("dispara al cruzar el casco hacia abajo, una vez", () => {
  const bajo = con(sano, { hull: 30 }); // 30% < 40%
  const alertas = derivarAlertas(sano, bajo);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].clave, `casco-${Math.round(UMBRAL_CASCO * 100)}`);
  assert.equal(alertas[0].datos.valor, 30);
  // Ya por debajo en ambos estados: no vuelve a disparar (flanco, no nivel).
  assert.deepEqual(derivarAlertas(bajo, con(sano, { hull: 25 })), []);
});

test("no dispara si el casco se mantiene o sube", () => {
  assert.deepEqual(derivarAlertas(sano, con(sano, { hull: 90 })), []);
  assert.deepEqual(derivarAlertas(con(sano, { hull: 30 }), con(sano, { hull: 60 })), []);
});

test("energía crítica es un flanco independiente", () => {
  const bajo = con(sano, { energy: 100 }); // 10% < 15%
  const alertas = derivarAlertas(sano, bajo);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].clave, `energia-${Math.round(UMBRAL_ENERGIA * 100)}`);
});

test("un sistema que cae a 0 o menos genera una avería", () => {
  const roto = con(sano, { systems: { impulse: { health: 0 }, warp: { health: 1 } } });
  const alertas = derivarAlertas(sano, roto);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].clave, "sistema-impulse");
  assert.equal(alertas[0].severidad, "averia");
  // Ya roto → sin nuevo flanco.
  assert.deepEqual(derivarAlertas(roto, con(roto, { systems: { impulse: { health: -0.5 }, warp: { health: 1 } } })), []);
});

test("datos no numéricos o divisores nulos no inventan alertas", () => {
  assert.deepEqual(derivarAlertas(sano, con(sano, { hull: 30, hull_max: 0 })), []);
  assert.deepEqual(derivarAlertas(sano, con(sano, { energy: Number.NaN })), []);
  const sinPrevSistema = derivarAlertas(
    con(sano, { systems: {} }),
    con(sano, { systems: { impulse: { health: 0 } } }),
  );
  assert.deepEqual(sinPrevSistema, []); // sin salud previa no hay flanco
});

test("varios cruces a la vez se derivan juntos", () => {
  const critico = con(sano, {
    hull: 10,
    energy: 50,
    systems: { impulse: { health: 0 }, warp: { health: 1 } },
  });
  const claves = derivarAlertas(sano, critico).map((a) => a.clave).sort();
  assert.deepEqual(claves, ["casco-40", "energia-15", "sistema-impulse"]);
});

// --- escritor de Journal ---

function harness() {
  const pages = [];
  const created = [];
  const journal = {
    pages,
    async createEmbeddedDocuments(type, documents) {
      assert.equal(type, "JournalEntryPage");
      created.push(...documents);
      for (const document of documents) {
        pages.push({
          getFlag(namespace, key) {
            return document.flags?.[namespace]?.[key];
          },
        });
      }
    },
  };
  const notifications = [];
  return {
    created,
    notifications,
    _journal: journal,
    nonce: "484848",
    game: {
      user: { isGM: true },
      journal: { getName: () => journal },
      i18n: {
        localize: (key) => key,
        format: (key, data) => `${key}:${JSON.stringify(data)}`,
      },
    },
    JournalEntry: { create: async () => journal },
    ui: { notifications: { info: (message) => notifications.push(message) } },
  };
}

test("una alerta se anota una sola vez por sesión y umbral", async () => {
  const ctx = harness();
  const alertas = derivarAlertas(sano, con(sano, { hull: 10 }));
  assert.equal(await anotarAlertas({ ...ctx, alertas }), 1);
  // Otro cruce del mismo umbral en la misma sesión no duplica la entrada.
  assert.equal(await anotarAlertas({ ...ctx, alertas }), 0);
  assert.equal(ctx.created.length, 1);
  assert.equal(ctx.created[0].flags["espaciokoop-lagunak"].eventId, "alert-484848-casco-40");
  assert.equal(ctx.notifications.length, 1);
});

test("un jugador (no GM) nunca escribe alertas", async () => {
  const ctx = harness();
  ctx.game.user.isGM = false;
  const alertas = derivarAlertas(sano, con(sano, { hull: 10 }));
  assert.equal(await anotarAlertas({ ...ctx, alertas }), 0);
  assert.equal(ctx.created.length, 0);
});

test("el nombre del sistema se localiza y los datos se escapan", async () => {
  const ctx = harness();
  ctx.game.i18n.localize = (key) => (key === "LAGUNAK.Sistemas.impulse" ? "Impulso" : key);
  const alertas = derivarAlertas(sano, con(sano, { systems: { impulse: { health: 0 }, warp: { health: 1 } } }));
  await anotarAlertas({ ...ctx, alertas });
  assert.match(ctx.created[0].text.content, /Impulso/);
});

// --- caducidad de autorización asíncrona (revisión PR #207) ---

test("perder GM mientras se crea el Journal no escribe la página", async () => {
  const ctx = harness();
  // No hay Journal previo: forzamos la ruta que espera a JournalEntry.create().
  ctx.game.journal.getName = () => undefined;
  let liberar;
  const retenida = new Promise((resolve) => {
    liberar = resolve;
  });
  ctx.JournalEntry = {
    create: async () => {
      await retenida; // create queda pendiente hasta que lo liberemos
      return ctx._journal;
    },
  };
  const alertas = derivarAlertas(sano, con(sano, { hull: 10 }));
  const pendiente = anotarAlertas({ ...ctx, alertas });
  // El GM se degrada MIENTRAS create() sigue en vuelo.
  ctx.game.user.isGM = false;
  liberar();
  assert.equal(await pendiente, 0);
  assert.equal(ctx.created.length, 0);
});

test("revocar el acceso del puente durante la escritura corta la persistencia", async () => {
  const ctx = harness();
  let revocado = false;
  const alertas = derivarAlertas(sano, con(sano, {
    hull: 10,
    energy: 50,
    systems: { impulse: { health: 0 } },
  }));
  assert.ok(alertas.length >= 2); // necesitamos varias para revocar entre iteraciones
  // La primera escritura revoca el acceso; el guard debe cortar el resto.
  const createReal = ctx._journal.createEmbeddedDocuments.bind(ctx._journal);
  ctx._journal.createEmbeddedDocuments = async (type, documents) => {
    revocado = true;
    return createReal(type, documents);
  };
  const escritas = await anotarAlertas({
    ...ctx,
    alertas,
    sigueVigente: () => !revocado,
  });
  assert.equal(escritas, 1);
  assert.equal(ctx.created.length, 1);
});

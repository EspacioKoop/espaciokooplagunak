/**
 * Alertas de umbral de la nave (design note Kojima, fase 3): deriva avisos por
 * flanco descendente del `/v1/state` que el módulo ya recibe —casco bajo, energía
 * crítica, sistema inutilizado— y los escribe una sola vez en la bitácora,
 * reutilizando la disciplina de deduplicación de `event-journal.mjs`.
 *
 * Autoridad: la simulación es dueña del valor; este módulo SOLO traduce el cruce
 * de umbral a una consecuencia narrativa persistente. No escribe de vuelta a la
 * simulación ni acciona nada — informa; el GM decide y actúa con una orden de
 * lista blanca si quiere (docs/FOUNDRY.md, resolución de #125). No toca el
 * puente ni el escenario.
 *
 * `derivarAlertas` es lógica pura y tiene pruebas Node; el escritor de Journal
 * (`anotarAlertas`) se ejercita con un `game` mockeado, como el resto del módulo.
 */

import { localizeSystemName } from "./ship-view/ship-view.mjs";

const MODULE_ID = "espaciokoop-lagunak";

// Umbrales como fracción [0,1] del máximo. Son de presentación (avisos de mesa),
// no verdad de la nave: se ajustan aquí sin tocar puente ni simulación.
export const UMBRAL_CASCO = 0.4;
export const UMBRAL_ENERGIA = 0.15;
// Un sistema con salud <= 0 se considera inutilizado (convención de EmptyEpsilon).
export const UMBRAL_SISTEMA = 0.0;

/** Fracción segura value/max, o null si no es un número utilizable. */
function fraccion(value, max) {
  return Number.isFinite(value) && Number.isFinite(max) && max > 0 ? value / max : null;
}

// Flanco descendente: solo dispara al CRUZAR el umbral hacia abajo (prev por
// encima, actual por debajo), nunca cada tick mientras sigue por debajo.
function cruzaHaciaAbajo(prev, actual, umbral) {
  return prev !== null && actual !== null && prev >= umbral && actual < umbral;
}

/**
 * Deriva las alertas nuevas entre dos estados de `/v1/state`. Pura: sin red, sin
 * Foundry, sin ids ni tiempo. Con `estadoPrev` nulo (primer sondeo o reconexión)
 * no hay flanco que detectar y devuelve []. Cada alerta trae una `clave` estable
 * por tipo de cruce, que el escritor combina con el nonce de sesión.
 *
 * @returns {{clave:string, severidad:string, tituloKey:string, resumenKey:string, datos:object}[]}
 */
export function derivarAlertas(estadoPrev, estadoActual) {
  const prev = estadoPrev ?? null;
  const actual = estadoActual ?? null;
  if (!actual) return [];
  const alertas = [];

  if (cruzaHaciaAbajo(fraccion(prev?.hull, prev?.hull_max), fraccion(actual.hull, actual.hull_max), UMBRAL_CASCO)) {
    alertas.push({
      clave: `casco-${Math.round(UMBRAL_CASCO * 100)}`,
      severidad: "critica",
      tituloKey: "LAGUNAK.Alertas.Casco.Titulo",
      resumenKey: "LAGUNAK.Alertas.Casco.Resumen",
      datos: {
        porcentaje: Math.round(UMBRAL_CASCO * 100),
        valor: Math.round(actual.hull),
        max: Math.round(actual.hull_max),
      },
    });
  }

  if (cruzaHaciaAbajo(fraccion(prev?.energy, prev?.energy_max), fraccion(actual.energy, actual.energy_max), UMBRAL_ENERGIA)) {
    alertas.push({
      clave: `energia-${Math.round(UMBRAL_ENERGIA * 100)}`,
      severidad: "critica",
      tituloKey: "LAGUNAK.Alertas.Energia.Titulo",
      resumenKey: "LAGUNAK.Alertas.Energia.Resumen",
      datos: {
        porcentaje: Math.round(UMBRAL_ENERGIA * 100),
        valor: Math.round(actual.energy),
        max: Math.round(actual.energy_max),
      },
    });
  }

  const sistemasPrev = prev?.systems ?? {};
  for (const [nombre, sistema] of Object.entries(actual.systems ?? {})) {
    const saludActual = Number(sistema?.health);
    const saludPrev = Number(sistemasPrev[nombre]?.health);
    if (!Number.isFinite(saludActual) || !Number.isFinite(saludPrev)) continue;
    if (saludPrev > UMBRAL_SISTEMA && saludActual <= UMBRAL_SISTEMA) {
      alertas.push({
        clave: `sistema-${nombre}`,
        severidad: "averia",
        tituloKey: "LAGUNAK.Alertas.Sistema.Titulo",
        resumenKey: "LAGUNAK.Alertas.Sistema.Resumen",
        datos: { sistema: nombre },
      });
    }
  }

  return alertas;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => `&#${character.codePointAt(0)};`);
}

/**
 * Escribe las alertas derivadas en la bitácora, una sola vez por sesión y umbral.
 * El `eventId` = `alert-<nonce>-<clave>`: el nonce (aleatorio por sesión, como el
 * id de llegada del escenario) evita colisiones entre sesiones, y la clave estable
 * hace que un umbral que oscila no genere una entrada por cada rebote dentro de la
 * misma sesión. La deduplicación vive en flags de la página, no en memoria.
 *
 * `sigueVigente` es un guard de vigencia que se reevalúa tras CADA `await` y antes
 * de toda escritura: la autorización asíncrona puede caducar mientras esperamos a
 * `JournalEntry.create()` o a `createEmbeddedDocuments()` (el usuario pierde GM, o
 * el puente revoca el acceso). Sin este guard persistiríamos páginas como jugador
 * ya degradado. Por defecto solo comprueba `isGM`; el llamador pasa además su
 * `bridgeAccessRevoked` para cortar en cuanto se revoca la sesión.
 */
export async function anotarAlertas({
  alertas = [],
  nonce,
  game,
  JournalEntry,
  ui,
  sigueVigente = () => true,
}) {
  const vigente = () => Boolean(game.user?.isGM) && sigueVigente();
  if (!vigente() || alertas.length === 0) return 0;

  const journalName = game.i18n.localize("LAGUNAK.Diario.Nombre");
  const journal =
    game.journal.getName(journalName) ??
    (await JournalEntry.create({ name: journalName }));
  // La creación del Journal es un await: revalida antes de escribir nada en él.
  if (!vigente()) return 0;
  let created = 0;

  for (const alerta of alertas) {
    if (!vigente()) break;
    const eventId = `alert-${nonce}-${alerta.clave}`;
    const pages = Array.from(journal.pages ?? []);
    if (pages.some((page) => page.getFlag?.(MODULE_ID, "eventId") === eventId)) continue;

    const datos = { ...alerta.datos };
    if (typeof datos.sistema === "string") datos.sistema = localizeSystemName(datos.sistema, game.i18n);
    const seguros = Object.fromEntries(
      Object.entries(datos).map(([clave, valor]) => [clave, escapeHtml(valor)]),
    );

    const title = game.i18n.format(alerta.tituloKey, seguros);
    const content = `<p>${game.i18n.format(alerta.resumenKey, seguros)}</p>`;

    // Última barrera antes de la escritura persistente: la autorización pudo
    // caducar durante el await anterior o entre iteraciones del bucle.
    if (!vigente()) break;
    await journal.createEmbeddedDocuments("JournalEntryPage", [
      {
        type: "text",
        name: title,
        text: { content },
        flags: { [MODULE_ID]: { eventId, alertSeverity: alerta.severidad } },
      },
    ]);
    created += 1;
  }

  if (created > 0) ui.notifications.info(game.i18n.localize("LAGUNAK.Alertas.Anotadas"));
  return created;
}

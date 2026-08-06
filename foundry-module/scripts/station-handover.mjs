/**
 * Relevo de puesto (#483, frente 3 de #479): `station-assignment.mjs` ya
 * permite cambiar de puesto en cualquier momento (autoasignación mutable,
 * `docs/PERMISOS_PUESTO.md`), pero hasta ahora ningún cambio DURANTE una
 * sesión en curso quedaba anunciado — solo se veía en el propio panel de
 * quien lo hacía.
 *
 * `derivarRelevo` es lógica pura y tiene pruebas Node; el escritor de
 * Journal (`anotarRelevo`) se ejercita con un `game` mockeado, mismo patrón
 * que `alertas-nave.mjs`. La diferencia con aquel: un relevo no viene de
 * `/v1/state` (telemetría del puente), viene de un flag `station` del propio
 * `User` de Foundry — así que este módulo no se cuelga de
 * `processBridgeEvents`, tiene su propio escritor sobre el mismo Journal
 * compartido.
 *
 * MUY IMPORTANTE: "relevo" aquí es el TITULAR de un puesto (quién lo ocupa),
 * no la ayuda entre puestos de `asistencia/relevo.mjs` (#309) — nombre
 * distinto a propósito para no colisionar con ese concepto ya existente.
 */

const MODULE_ID = "espaciokoop-lagunak";

/**
 * Deriva el relevo entre dos lecturas del puesto de UN usuario. Pura: sin
 * Foundry, sin red, sin tiempo.
 *
 * `estacionAnterior` es `undefined` cuando no hay línea base conocida
 * todavía para ese usuario en esta sesión del GM (primera vez que se le ve,
 * o el GM acaba de conectar) — en ese caso no hay relevo que anunciar, solo
 * se establece la línea base. `null` significa "sin puesto asignado", que
 * SÍ es un valor comparable (alguien puede pasar de un puesto a ninguno, o
 * de ninguno a un puesto, y ambos son relevos reales).
 *
 * @returns {{userId: string, estacionAnterior: string|null, estacionNueva: string|null}|null}
 */
export function derivarRelevo({ userId, estacionAnterior, estacionNueva }) {
  if (!userId) return null;
  if (estacionAnterior === undefined) return null;
  const anterior = estacionAnterior ?? null;
  const nueva = estacionNueva ?? null;
  if (anterior === nueva) return null;
  return { userId, estacionAnterior: anterior, estacionNueva: nueva };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => `&#${character.codePointAt(0)};`);
}

// Misma clave que ya usa `station-workspaces.mjs`/`station-assignment.mjs`
// para nombrar un puesto en la UI — no se inventa una traducción nueva.
function localizeStation(station, i18n) {
  return station ? i18n.localize(`LAGUNAK.Puestos.${station}`) : i18n.localize("LAGUNAK.Puestos.SinAsignar");
}

/**
 * Escribe un relevo en la bitácora, visible para el resto de la tripulación
 * (mismo Journal compartido que `alertas-nave.mjs`/`event-journal.mjs`, no
 * una notificación privada de quien lo hace). `eventId` incluye `sello`
 * (por defecto la hora actual) porque, a diferencia de una alarma de
 * umbral, la MISMA pareja de puestos puede repetirse varias veces en una
 * sesión (alguien va y vuelve) y cada ocurrencia es información real.
 *
 * `sigueVigente` se reevalúa tras el único `await` de este escritor, mismo
 * guard de vigencia que el resto del módulo.
 */
export async function anotarRelevo({
  relevo,
  nonce,
  sello = Date.now(),
  game,
  JournalEntry,
  ui,
  sigueVigente = () => true,
}) {
  const vigente = () => Boolean(game.user?.isGM) && sigueVigente();
  if (!vigente() || !relevo) return false;

  const journalName = game.i18n.localize("LAGUNAK.Diario.Nombre");
  const journal =
    game.journal.getName(journalName) ?? (await JournalEntry.create({ name: journalName }));
  if (!vigente()) return false;

  const eventId = `relevo-${nonce}-${relevo.userId}-${sello}`;
  const pages = Array.from(journal.pages ?? []);
  if (pages.some((page) => page.getFlag?.(MODULE_ID, "eventId") === eventId)) return false;

  const usuario = escapeHtml(game.users?.get?.(relevo.userId)?.name ?? relevo.userId);
  const anterior = escapeHtml(localizeStation(relevo.estacionAnterior, game.i18n));
  const nueva = escapeHtml(localizeStation(relevo.estacionNueva, game.i18n));

  // Claves completas y literales a propósito (no compuestas por
  // concatenación): el test de paridad i18n (`localization.test.mjs`) rastrea
  // claves con una expresión regular sobre literales de cadena, y una clave
  // ensamblada en tiempo de ejecución (`${clave}.Titulo`) sería invisible
  // para ese rastreo — exactamente el mismo motivo por el que
  // `alertas-nave.mjs` guarda `tituloKey`/`resumenKey` completas.
  const [tituloKey, resumenKey] =
    relevo.estacionNueva === null
      ? ["LAGUNAK.Relevo.DejaPuesto.Titulo", "LAGUNAK.Relevo.DejaPuesto.Resumen"]
      : relevo.estacionAnterior === null
        ? ["LAGUNAK.Relevo.AsumePuesto.Titulo", "LAGUNAK.Relevo.AsumePuesto.Resumen"]
        : ["LAGUNAK.Relevo.Traslada.Titulo", "LAGUNAK.Relevo.Traslada.Resumen"];
  const datos = { usuario, anterior, nuevo: nueva };
  const title = game.i18n.format(tituloKey, datos);
  const content = `<p>${game.i18n.format(resumenKey, datos)}</p>`;

  if (!vigente()) return false;
  await journal.createEmbeddedDocuments("JournalEntryPage", [
    {
      type: "text",
      name: title,
      text: { content },
      flags: { [MODULE_ID]: { eventId } },
    },
  ]);
  ui.notifications.info(game.i18n.localize("LAGUNAK.Relevo.Anotado"));
  return true;
}

/**
 * Cableado Foundry: escucha `updateUser` y anota cada relevo real. Capa
 * fina y no testeable en Node (usa globales de Foundry) — toda la lógica
 * vive en `derivarRelevo`/`anotarRelevo`, ya cubiertos por pruebas. Solo el
 * GM primario mantiene la línea base y escribe, mismo criterio que
 * `registerStationOrders`.
 *
 * La línea base vive en memoria del cliente GM (`Map`), a propósito: es un
 * histórico de sesión, no dato de partida — un GM que recarga empieza una
 * línea base nueva y el primer valor de cada usuario no se anuncia (no se
 * inventa un relevo desde "no sé qué tenía antes").
 */
export function registrarRelevoPuestos(moduleId) {
  const puestoPrevio = new Map();
  const nonce = foundry.utils.randomID();

  const listener = async (userDoc, changes) => {
    if (game.user !== game.users?.activeGM) return;
    const tocaFlag =
      "station" in (changes?.flags?.[moduleId] ?? {}) || "-=station" in (changes?.flags?.[moduleId] ?? {});
    if (!tocaFlag) return;

    const userId = userDoc?.id;
    if (!userId) return;
    const estacionAnterior = puestoPrevio.has(userId) ? puestoPrevio.get(userId) : undefined;
    let estacionNueva = null;
    try {
      estacionNueva = userDoc.getFlag(moduleId, "station") ?? null;
    } catch {
      estacionNueva = null;
    }
    puestoPrevio.set(userId, estacionNueva);

    const relevo = derivarRelevo({ userId, estacionAnterior, estacionNueva });
    await anotarRelevo({
      relevo,
      nonce,
      game,
      JournalEntry,
      ui,
      sigueVigente: () => game.user === game.users?.activeGM,
    });
  };

  Hooks.on("updateUser", listener);
  return () => Hooks.off("updateUser", listener);
}

/* Proyección de una mesa de póker sobre el lienzo de la escena, como Tiles
 * (#458). Capa fina y acoplada a Foundry a propósito, sin test Node —igual
 * que `asistencia-wiring.mjs`/`minijuegos-wiring.mjs`—: toda la lógica de
 * qué se ve y cómo se diferencia vive en `minijuegos/mesa-proyeccion.mjs`
 * (puro, con test); toda la de qué arrastre es válido vive en
 * `minijuegos/mesa-arrastre.mjs` (puro, con test). Este archivo solo traduce
 * ambas a llamadas de `canvas.scene`.
 *
 * GM-ONLY: cada función exportada se resigna en el acto si quien la llama no
 * es el GM activo — un cliente sin autoridad no debe intentar
 * `createEmbeddedDocuments`, y Foundry además lo rechazaría server-side.
 *
 * NADA SE PERSISTE aparte del propio Tile. Las sesiones de `sesion-motor` son
 * memoria del GM efímera a propósito (#308); un registro paralelo
 * sesión↔Tile recrearía el problema de segunda fuente de verdad que #458
 * quiere evitar. El lado duradero del mapeo es el flag
 * `flags[MODULE_ID][FLAG_TILE_ID]` que cada Tile lleva encima: tras una
 * recarga del cliente GM, `sincronizarTilesMesa` reconcilia leyendo los
 * Tiles reales de la escena, no memoria.
 */

import { MODULE_ID } from "./lagunak-constantes.mjs";
import { cartaDataUri } from "./minijuegos/cartas-pixelart.mjs";
import { diffProyeccion, proyectarMesa } from "./minijuegos/mesa-proyeccion.mjs";

export const FLAG_TILE_ID = "mesaCartaId";

// Tamaño de una carta sobre el lienzo, en píxeles de escena. Mismo criterio
// que el resto del arte pixelart del módulo: una pieza de medida fija que se
// repite, no algo que escale con la mesa que la contiene.
const ANCHO_CARTA = 70;
const ALTO_CARTA = 98;

function esCoordinadorActivo() {
  return typeof game !== "undefined" && game.user?.isGM && game.user === game.users?.activeGM;
}

/** Todos los Tiles de la escena actual que pertenecen a esta mesa. */
function tilesDeMesa(sessionId) {
  const tiles = canvas?.scene?.tiles;
  if (!tiles) return [];
  return [...tiles].filter(
    (tile) =>
      tile.getFlag?.(MODULE_ID, FLAG_TILE_ID)?.startsWith(`${sessionId}:`) ||
      tile.flags?.[MODULE_ID]?.[FLAG_TILE_ID]?.startsWith?.(`${sessionId}:`),
  );
}

function datosTile(carta, posicion) {
  return {
    texture: { src: cartaDataUri(carta.codigo) },
    x: posicion?.x ?? 0,
    y: posicion?.y ?? 0,
    width: ANCHO_CARTA,
    height: ALTO_CARTA,
    flags: { [MODULE_ID]: { [FLAG_TILE_ID]: carta.id } },
  };
}

/**
 * Sincroniza los Tiles de una mesa con su proyección vigente. Se invoca
 * desde los mismos puntos donde `minijuegos-wiring.mjs` ya publica
 * `AJUSTE_SESION`, así que no introduce ningún bucle de sondeo nuevo.
 *
 * La limpieza de fin de mano/mesa no es código aparte: cuando la mano
 * termina, `comunitarias` se reinicia y `resultado` cambia, así que la
 * siguiente proyección ya produce el conjunto correcto y `diffProyeccion`
 * genera el `eliminar` que corresponde. Con la mesa cerrada
 * (`publico.fase === "terminada"` sin mano en curso, o mesa inexistente) se
 * fuerza una proyección vacía para no depender de que queden cartas que
 * diferenciar.
 *
 * @param {string} sessionId
 * @param {object|null} publico vista pública vigente, o null si la mesa ya
 *   no existe.
 * @param {{x:number,y:number}} [origen] esquina de la fila de comunitarias
 *   sobre el lienzo; el layout es responsabilidad de esta capa, nunca de
 *   `mesa-proyeccion.mjs`.
 */
export async function sincronizarTilesMesa(sessionId, publico, { origen = { x: 0, y: 0 } } = {}) {
  if (!esCoordinadorActivo() || !sessionId) return;
  const cerrada = !publico || (publico.fase === "terminada" && !publico.manoEnCurso);
  const proyeccion = cerrada ? { cartas: [] } : proyectarMesa(publico, sessionId);
  const existentes = tilesDeMesa(sessionId);
  const previa = {
    cartas: existentes
      .map((tile) => tile.getFlag?.(MODULE_ID, FLAG_TILE_ID) ?? tile.flags?.[MODULE_ID]?.[FLAG_TILE_ID])
      .filter(Boolean)
      .map((id) => ({ id })),
  };
  const { crear, eliminar } = diffProyeccion(previa, proyeccion);
  // `actualizar` (reposiciones) lo aplica `aplicarArrastreEnEscena`, que ya
  // conoce el destino real del arrastre; aquí solo se crea/borra por
  // aparición o desaparición de la carta en la proyección.

  if (crear.length > 0) {
    await canvas.scene.createEmbeddedDocuments(
      "Tile",
      crear.map((carta) =>
        datosTile(carta, { x: origen.x + carta.slot * (ANCHO_CARTA + 8), y: origen.y }),
      ),
    );
  }
  if (eliminar.length > 0) {
    const idsDoc = existentes
      .filter((tile) => {
        const id = tile.getFlag?.(MODULE_ID, FLAG_TILE_ID) ?? tile.flags?.[MODULE_ID]?.[FLAG_TILE_ID];
        return eliminar.includes(id);
      })
      .map((tile) => tile.id);
    if (idsDoc.length > 0) await canvas.scene.deleteEmbeddedDocuments("Tile", idsDoc);
  }
}

/**
 * Aplica un arrastre ya validado (ver `mesa-arrastre.resolverIntentoArrastre`,
 * llamado por quien invoca esto) moviendo el Tile correspondiente. No decide
 * si la carta es válida ni dónde puede caer — eso ya se resolvió antes de
 * llegar aquí; esta función solo traduce a `updateEmbeddedDocuments`.
 */
export async function aplicarArrastreEnEscena(sessionId, { carta, destino }) {
  if (!esCoordinadorActivo() || !carta || !destino) return;
  const tile = tilesDeMesa(sessionId).find((t) => {
    const id = t.getFlag?.(MODULE_ID, FLAG_TILE_ID) ?? t.flags?.[MODULE_ID]?.[FLAG_TILE_ID];
    return id === carta.id;
  });
  if (!tile) return;
  await canvas.scene.updateEmbeddedDocuments("Tile", [
    { _id: tile.id, x: destino.x, y: destino.y },
  ]);
}

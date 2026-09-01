// Proyección de mesa a escena (#458): qué cartas de una mesa de póker están
// visibles AHORA y podrían representarse como un objeto sobre el lienzo de
// Foundry. Puro, sin Foundry/DOM — recibe exactamente la vista pública que ya
// produce `vistaPublicaSesion`/`poker-motor.vistaPublica` (el `publico` que
// `estadoPublicoVigente()` calcula), nunca el estado interno del motor.
//
// LA REGLA QUE NO SE NEGOCIA: un Tile en el lienzo es visible para toda la
// mesa. No hay primitiva de Foundry que iguale la semántica de `vistaPrivada`
// para un objeto de escena, así que las cartas de mano ocultas NUNCA se
// proyectan. Solo se proyecta lo que ya es público:
//   - `comunitarias`: en cualquier fase (vacío antes del flop).
//   - `resultado.manos[userId].cartas`: solo existe tras el showdown, y solo
//     para quien llegó a él — un jugador retirado nunca entra en
//     `manosReveladas` (poker-motor.mjs, `showdown()`), así que nunca se
//     proyecta tampoco desde aquí. No hace falta filtrarlo dos veces.
//
// Por diseño, esta función solo lee `comunitarias` y `resultado` de su
// entrada: aunque el `publico` recibido llevase colgado por error `tuMano` o
// `manos` (que sí existen en `vistaPrivada`, nunca en `vistaPublica`), esas
// claves no se leen nunca y no pueden aparecer en la salida.

/**
 * @param {object} publico la vista pública de la mesa (`vistaPublicaSesion`
 *   o `poker-motor.vistaPublica`, indistintamente — ambas exponen
 *   `comunitarias` y `resultado` con la misma forma).
 * @param {string} [sessionId] identificador de mesa para componer ids
 *   estables; si se omite se usa `publico.id ?? "mesa"`.
 * @returns {{ cartas: Array<{id: string, codigo: string, slot: number,
 *   faceUp: true, origen: "comunitaria"|"revelada", userId?: string}> }}
 */
export function proyectarMesa(publico, sessionId) {
  const mesa = sessionId ?? publico?.id ?? "mesa";
  const cartas = [];

  const comunitarias = Array.isArray(publico?.comunitarias) ? publico.comunitarias : [];
  comunitarias.forEach((codigo, slot) => {
    if (typeof codigo !== "string") return;
    cartas.push({
      id: `${mesa}:comunitaria:${slot}`,
      codigo,
      slot,
      faceUp: true,
      origen: "comunitaria",
    });
  });

  const manos = publico?.resultado?.manos;
  if (manos && typeof manos === "object") {
    for (const [userId, mano] of Object.entries(manos)) {
      const cartasMano = Array.isArray(mano?.cartas) ? mano.cartas : [];
      cartasMano.forEach((codigo, slot) => {
        if (typeof codigo !== "string") return;
        cartas.push({
          id: `${mesa}:revelada:${userId}:${slot}`,
          codigo,
          slot,
          faceUp: true,
          origen: "revelada",
          userId,
        });
      });
    }
  }

  return { cartas };
}

/**
 * Diferencia dos proyecciones por `id`, sin depender del orden. Es lo que
 * evita recalcular "qué cambió" dentro de código acoplado a Foundry: quien
 * llama solo necesita traducir cada lista a la llamada de Tile que le
 * corresponde.
 *
 * @param {{cartas: Array}} anterior
 * @param {{cartas: Array}} nueva
 * @returns {{crear: Array, actualizar: Array, eliminar: Array<string>}}
 */
export function diffProyeccion(anterior, nueva) {
  const previas = new Map((anterior?.cartas ?? []).map((carta) => [carta.id, carta]));
  const siguientes = new Map((nueva?.cartas ?? []).map((carta) => [carta.id, carta]));

  const crear = [];
  const actualizar = [];
  for (const [id, carta] of siguientes) {
    const previa = previas.get(id);
    if (!previa) {
      crear.push(carta);
    } else if (!mismaCarta(previa, carta)) {
      actualizar.push(carta);
    }
  }

  const eliminar = [];
  for (const id of previas.keys()) {
    if (!siguientes.has(id)) eliminar.push(id);
  }

  return { crear, actualizar, eliminar };
}

function mismaCarta(a, b) {
  return (
    a.codigo === b.codigo &&
    a.slot === b.slot &&
    a.faceUp === b.faceUp &&
    a.origen === b.origen &&
    (a.userId ?? null) === (b.userId ?? null)
  );
}

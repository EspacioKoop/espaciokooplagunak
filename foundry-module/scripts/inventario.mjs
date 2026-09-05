// Inventario físico por personaje (#963/#964): quién lleva qué.
//
// Reductor puro, mismo patrón que `asistencia/sesion.mjs`: el estado ENTRA y
// SALE por parámetro, congelado, sin flags, sin reloj, sin Foundry. Quién lo
// persiste (Actor de dnd5e, #968) y quién lo pinta (#966) viven fuera.
//
// Vecino de #868/#892, no dependiente: coger o soltar un objeto no es una
// prueba de habilidad, así que este módulo no importa nada de
// `interaccion-3d/` y no tiene ni aproximación ni tirada ni banda.
//
// TRES CATEGORÍAS FIJAS PARA TODOS (`CATEGORIAS`), decisión de #963: nada de
// slots libres tipo Tetris. "Clave"/"favorito" NO es una cuarta categoría —
// es un flag sobre cualquier objeto, filtrable después por quien pinte la
// ventana (#966).
//
// El HOTBAR y los SLOTS DE EQUIPO son listas de REFERENCIAS a objetos que ya
// están en alguna categoría, nunca una copia ni un contenedor aparte: si el
// objeto se suelta (`quitar`), el hueco que apuntaba a él queda `null` en la
// misma operación — nunca un puntero colgante que alguien descubra al leer.
//
// Slots de equipo abstractos, sin una palabra de D&D: dos manos por separado
// (doble empuñadura incluida — #897/#962 ya declara `manoDerecha` y
// `manoIzquierda` como anclajes independientes), cabeza, cuerpo, pies, dos
// anillos, dos accesorios. Equipar es una transición de posesión, no una
// orden de puesto: no toca `station-order-relay.mjs` ni la matriz de #237.

export const CATEGORIAS = Object.freeze(["armas", "curacion", "objetos"]);

export const SLOTS_EQUIPO = Object.freeze([
  "manoDerecha",
  "manoIzquierda",
  "cabeza",
  "cuerpo",
  "pies",
  "anillo1",
  "anillo2",
  "accesorio1",
  "accesorio2",
]);

export const TAMANO_HOTBAR = 4;

/** Estado inicial. Vacío y congelado; todo lo demás sale de aquí.
 *
 * `limitePeso: null` desactiva TODA la lógica de peso, no solo la barra de la
 * ventana — `excedePeso` con `null` devuelve siempre `false`. Un número
 * distinto de cero y positivo la activa; cualquier otro valor (negativo, NaN,
 * una cadena) se trata como "sin límite" en vez de reventar con un ajuste mal
 * escrito. */
export function crearInventario({ limitePeso = null } = {}) {
  const limite = typeof limitePeso === "number" && Number.isFinite(limitePeso) && limitePeso > 0 ? limitePeso : null;
  return Object.freeze({
    limitePeso: limite,
    ...Object.fromEntries(CATEGORIAS.map((c) => [c, Object.freeze([])])),
    equipo: Object.freeze(Object.fromEntries(SLOTS_EQUIPO.map((s) => [s, null]))),
    hotbar: Object.freeze(new Array(TAMANO_HOTBAR).fill(null)),
  });
}

/** El objeto con ese id, en cualquier categoría, o `null`. */
export function objetoPorId(inventario, objetoId) {
  for (const categoria of CATEGORIAS) {
    const encontrado = inventario[categoria].find((o) => o.id === objetoId);
    if (encontrado) return encontrado;
  }
  return null;
}

/** En qué categoría vive un objeto, o `null` si no está en ninguna. */
function categoriaDe(inventario, objetoId) {
  for (const categoria of CATEGORIAS) {
    if (inventario[categoria].some((o) => o.id === objetoId)) return categoria;
  }
  return null;
}

/** Suma de `peso` de todo lo que hay en las tres categorías. Equipo y hotbar
 * son referencias a lo mismo, así que no se cuentan aparte — contarlos habría
 * hecho que equipar un arma la pesara el doble. Sin `limitePeso`, el peso
 * real se puede seguir consultando (para la ventana, si algún día lo pinta),
 * pero no bloquea nada. */
export function pesoActual(inventario) {
  let total = 0;
  for (const categoria of CATEGORIAS) {
    for (const objeto of inventario[categoria]) {
      total += Number.isFinite(objeto.peso) ? objeto.peso : 0;
    }
  }
  return total;
}

/** ¿Añadir `candidato` se pasaría del límite? Con `limitePeso: null`, siempre
 * `false` — es la comprobación que la puerta de #964 exige que nunca bloquee
 * nada cuando el límite está desactivado. */
export function excedePeso(inventario, candidato) {
  if (inventario.limitePeso == null) return false;
  const pesoCandidato = Number.isFinite(candidato?.peso) ? candidato.peso : 0;
  return pesoActual(inventario) + pesoCandidato > inventario.limitePeso;
}

/**
 * Añade `objeto` a `categoria`. Transición total: si la categoría no existe,
 * si el objeto ya está en el inventario (por `id`, en cualquier categoría —
 * no se puede estar en dos sitios a la vez), o si excede el peso, devuelve el
 * MISMO `inventario` sin cambios — quien llama distingue éxito de rechazo
 * comparando por referencia (`resultado === inventario`), sin excepciones
 * para un rechazo que es un resultado legítimo del juego, no un bug.
 */
export function agregar(inventario, objeto, categoria) {
  if (!CATEGORIAS.includes(categoria)) return inventario;
  if (typeof objeto?.id !== "string" || objeto.id === "") return inventario;
  if (categoriaDe(inventario, objeto.id)) return inventario;
  if (excedePeso(inventario, objeto)) return inventario;
  return Object.freeze({
    ...inventario,
    [categoria]: Object.freeze([...inventario[categoria], Object.freeze({ ...objeto, clave: Boolean(objeto.clave) })]),
  });
}

/**
 * Quita el objeto `objetoId` de `categoria`, y limpia cualquier slot de
 * equipo y hueco de hotbar que apuntara a él — la razón de ser de que equipo
 * y hotbar sean referencias y no copias: soltar un objeto no puede dejar una
 * mano fantasma o un hueco de acceso rápido que ya no lleva a ningún sitio.
 *
 * La `categoria` la DECLARA quien llama (contrato de #964) y NO se autodetecta:
 * autodetectar convierte «suelta la poción de la mochila» en «suelta lo que se
 * llame así, esté donde esté», que es la misma clase de error que un id
 * colgante. Una categoría desconocida —o una que no es la del objeto— deja el
 * inventario igual, igual que un id que no está en ningún lado.
 */
export function quitar(inventario, objetoId, categoria) {
  if (!CATEGORIAS.includes(categoria)) return inventario;
  if (!inventario[categoria].some((o) => o.id === objetoId)) return inventario;
  const equipoLimpio = Object.fromEntries(
    SLOTS_EQUIPO.map((slot) => [slot, inventario.equipo[slot] === objetoId ? null : inventario.equipo[slot]]),
  );
  const hotbarLimpio = inventario.hotbar.map((id) => (id === objetoId ? null : id));
  return Object.freeze({
    ...inventario,
    [categoria]: Object.freeze(inventario[categoria].filter((o) => o.id !== objetoId)),
    equipo: Object.freeze(equipoLimpio),
    hotbar: Object.freeze(hotbarLimpio),
  });
}

/** Marca o desmarca un objeto como clave/favorito, esté en la categoría que
 * esté. Un id desconocido deja el inventario igual — no es un error, es un
 * arrastre que llegó tarde o a un objeto que ya no está. */
export function marcarClave(inventario, objetoId, clave) {
  const categoria = categoriaDe(inventario, objetoId);
  if (!categoria) return inventario;
  return Object.freeze({
    ...inventario,
    [categoria]: Object.freeze(
      inventario[categoria].map((o) => (o.id === objetoId ? Object.freeze({ ...o, clave: Boolean(clave) }) : o)),
    ),
  });
}

/** Asigna (o limpia con `objetoId: null`) un hueco de acceso rápido, 0 a
 * `TAMANO_HOTBAR - 1`. El objeto debe existir ya en alguna categoría — un
 * hueco no puede apuntar a nada que no esté en la mochila. Índice fuera de
 * rango o id inexistente deja el inventario igual. */
export function asignarHotbar(inventario, slot, objetoId) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= TAMANO_HOTBAR) return inventario;
  if (objetoId !== null && !categoriaDe(inventario, objetoId)) return inventario;
  const hotbar = [...inventario.hotbar];
  hotbar[slot] = objetoId;
  return Object.freeze({ ...inventario, hotbar: Object.freeze(hotbar) });
}

/**
 * Equipa `objetoId` (que debe existir ya en alguna categoría) en `slot`. Un
 * slot ya ocupado se sobrescribe sin más — desequipar antes es cosa de quien
 * llama si le importa el objeto anterior, que sigue en su categoría de
 * origen tal cual (equipar no lo mueve de sitio, solo lo referencia).
 */
export function equipar(inventario, objetoId, slot) {
  if (!SLOTS_EQUIPO.includes(slot)) return inventario;
  if (!categoriaDe(inventario, objetoId)) return inventario;
  return Object.freeze({ ...inventario, equipo: Object.freeze({ ...inventario.equipo, [slot]: objetoId }) });
}

/** Vacía un slot de equipo. Un slot ya vacío o desconocido deja el inventario
 * igual. */
export function desequipar(inventario, slot) {
  if (!SLOTS_EQUIPO.includes(slot)) return inventario;
  if (inventario.equipo[slot] == null) return inventario;
  return Object.freeze({ ...inventario, equipo: Object.freeze({ ...inventario.equipo, [slot]: null }) });
}

/** Lectura pura: qué objeto (no solo el id) hay en un slot de equipo, o
 * `null`. No pasa por `station-order-relay.mjs` — equipar no es una orden de
 * puesto (#237). */
export function equipadoEn(inventario, slot) {
  if (!SLOTS_EQUIPO.includes(slot)) return null;
  const objetoId = inventario.equipo[slot];
  return objetoId ? objetoPorId(inventario, objetoId) : null;
}

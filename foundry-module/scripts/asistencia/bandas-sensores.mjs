// Bandas de resolución para lecturas de sensores (#809).
//
// Convierte una situación de contacto + modificador en una banda de incertidumbre.
// Es la pieza pura que deben compartir #809, #808 y #810: el mismo resolvedor
// para distinta ficción.
//
// Puro: ni Foundry, ni DOM, ni red.

/** Estados posibles de una lectura de sensores. */
export const ESTADO_LECTURA = Object.freeze({
  ECO: "eco",
  CANDIDATO: "candidato",
  IDENTIFICADO: "identificado",
});

/** Orden de peor a mejor; es el eje de comparación. */
export const ORDEN_ESTADOS = Object.freeze([
  ESTADO_LECTURA.ECO,
  ESTADO_LECTURA.CANDIDATO,
  ESTADO_LECTURA.IDENTIFICADO,
]);

/** Márgenes por defecto: eco amplio, afinado estrecho, identificado exacto. */
export const REJILLA_POR_DEFECTO = Object.freeze({
  [ESTADO_LECTURA.ECO]: { distancia: 1000, rumbo: 15 },
  [ESTADO_LECTURA.CANDIDATO]: { distancia: 100, rumbo: 5 },
  [ESTADO_LECTURA.IDENTIFICADO]: { distancia: 0, rumbo: 0 },
});

function numero(valor, nombre) {
  const n = Number(valor);
  if (!Number.isFinite(n)) throw new TypeError(`${nombre} debe ser un número`);
  return n;
}

function redondearA(valor, rejilla) {
  if (rejilla <= 0) return valor;
  return Math.round(valor / rejilla) * rejilla;
}

/**
 * Devuelve la rejilla de redondeo para un estado.
 *
 * @param {string} estado
 * @param {object} [rejillaPorDefecto=REJILLA_POR_DEFECTO]
 * @returns {{distancia: number, rumbo: number}}
 */
export function rejillaDe(estado, rejillaPorDefecto = REJILLA_POR_DEFECTO) {
  const rejilla = rejillaPorDefecto[estado];
  if (!rejilla) throw new TypeError(`estado de lectura desconocido: ${estado}`);
  return rejilla;
}

/**
 * Degrada una medida ya calculada (distancia/rumbo) usando la rejilla del
 * estado. El margen que devuelve es el de la rejilla, no el delta real, para
 * que la vista pueda escribir «≈X ±rejilla» sin mentir.
 *
 * @param {{distancia: number, rumbo: number}} medida
 * @param {string} estado
 * @returns {{distancia: number, rumbo: number, precisionDistancia: number, precisionRumbo: number}}
 */
export function degradarMedida({ distancia, rumbo }, estado) {
  const rejilla = rejillaDe(estado);
  return {
    distancia: redondearA(distancia, rejilla.distancia),
    rumbo: ((redondearA(rumbo, rejilla.rumbo) % 360) + 360) % 360,
    precisionDistancia: rejilla.distancia,
    precisionRumbo: rejilla.rumbo,
  };
}

/**
 * Afina una medida degradada un nivel, si el modificador alcanza.
 *
 * Solo sube un nivel por llamada: eco → candidato → identificado.
 * Un fracaso deja la medida exactamente como estaba (fail-forward).
 *
 * @param {{distancia: number, rumbo: number, precisionDistancia: number, precisionRumbo: number, estado: string}} medida
 * @param {number} modificador del ayudante
 * @param {number} cd dificultad
 * @returns {{medida: object, cambio: boolean}} `cambio` es true solo si subió
 *   de nivel; la `medida` siempre está poblada.
 */
export function afinarMedida(medida, modificador, cd) {
  const estadoInicial = String(medida?.estado ?? ESTADO_LECTURA.ECO);
  const indiceInicial = ORDEN_ESTADOS.indexOf(estadoInicial);
  if (indiceInicial < 0) throw new TypeError(`estado inválido: ${estadoInicial}`);
  if (indiceInicial >= ORDEN_ESTADOS.length - 1) {
    return { medida: { ...medida, estado: estadoInicial }, cambio: false };
  }
  const exito = Number(modificador) >= Number(cd);
  if (!exito) return { medida: { ...medida, estado: estadoInicial }, cambio: false };
  const nuevoEstado = ORDEN_ESTADOS[indiceInicial + 1];
  const rejilla = rejillaDe(nuevoEstado);
  return {
    medida: {
      distancia: redondearA(medida.distancia, rejilla.distancia),
      rumbo: ((redondearA(medida.rumbo, rejilla.rumbo) % 360) + 360) % 360,
      precisionDistancia: rejilla.distancia,
      precisionRumbo: rejilla.rumbo,
      estado: nuevoEstado,
    },
    cambio: true,
  };
}

/**
 * Aplica un afinado a un contacto ya degradado.
 *
 * No inventa identidad: solo cambia la resolución espacial y el `estado` de la
 * lectura. El llamador decide si muestra indicativo/facción según el nuevo
 * estado.
 *
 * @param {object} contacto entrada tal cual salió de `degradarContactos`
 * @param {number} modificador del ayudante
 * @param {number} cd dificultad
 * @returns {{contacto: object, cambio: boolean}}
 */
export function afinarContacto(contacto, modificador, cd) {
  const medicion = {
    distancia: Number(contacto?.distancia ?? 0),
    rumbo: Number(contacto?.rumboDeg ?? 0),
    precisionDistancia: Number(contacto?.precision ?? 0),
    precisionRumbo: Number(contacto?.rumboPrecision ?? 0),
    estado: String(contacto?.estado ?? contacto?.banda ?? ESTADO_LECTURA.ECO),
  };
  const { medida, cambio } = afinarMedida(medicion, modificador, cd);
  return {
    contacto: {
      ...contacto,
      distancia: medida.distancia,
      rumboDeg: medida.rumbo,
      precision: medida.precisionDistancia,
      rumboPrecision: medida.precisionRumbo,
      banda: medida.estado,
    },
    cambio,
  };
}

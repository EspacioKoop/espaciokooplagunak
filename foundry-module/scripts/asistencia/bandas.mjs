// Bandas de resultado de la asistencia entre puestos (#309).
//
// Es la pieza que unifica los dos caminos de resolución del diseño
// (docs/MINIJUEGOS_ASISTENCIA.md): una tirada de dnd5e y el minijuego de destreza
// de fallback producen LA MISMA banda, y solo la banda entra en el flujo. Así el
// balance y la autoridad no dependen del sistema de juego instalado.
//
// La banda NUNCA se lee sobre la tirada en bruto, sino sobre un «margen a favor
// del enfoque». Importa porque en una salvación quien tira es el objetivo y su
// éxito es el FRACASO del enfoque: aplicarle «total ≥ CD → éxito» invertiría el
// resultado y premiaría al ayudante justo cuando el objetivo resiste.
//
// Puro: ni Foundry, ni dnd5e, ni DOM. Los totales entran ya tirados.

/** Las cuatro bandas. Orden de peor a mejor; es el eje de todo el módulo. */
export const BANDAS = Object.freeze({
  PIFIA: "pifia",
  FALLO: "fallo",
  EXITO: "exito",
  CRITICO: "critico",
});

/** Lista ordenada (peor → mejor), útil para recorrer y para comparar tiers. */
export const BANDAS_ORDENADAS = Object.freeze([
  BANDAS.PIFIA,
  BANDAS.FALLO,
  BANDAS.EXITO,
  BANDAS.CRITICO,
]);

/**
 * Mejora una banda un único escalón. Las órdenes de mando (#808) actúan aquí,
 * antes de que exista propuesta, y nunca pueden crear una quinta banda ni
 * superar el crítico.
 */
export function subirBanda(banda) {
  const indice = BANDAS_ORDENADAS.indexOf(banda);
  if (indice < 0) throw new TypeError("banda desconocida");
  return BANDAS_ORDENADAS[Math.min(indice + 1, BANDAS_ORDENADAS.length - 1)];
}

/** Umbral de margen que separa éxito de éxito crítico (y fallo de pifia). */
export const MARGEN_CRITICO = 5;

function entero(valor, nombre) {
  const n = Number(valor);
  if (!Number.isFinite(n)) throw new TypeError(`${nombre} debe ser un número`);
  return Math.trunc(n);
}

/**
 * Margen de una prueba de habilidad o herramienta —clase (a)— y de un ataque de
 * conjuro —clase (b) por ataque—: cuánto se pasa el ayudante de la dificultad.
 */
export function margenContraObjetivo({ total, dificultad }) {
  return entero(total, "total") - entero(dificultad, "dificultad");
}

/**
 * Margen de un enfoque de clase (b) resuelto por SALVACIÓN. Tira el objetivo, no
 * el ayudante, así que el margen va invertido: una salvación alta deja margen
 * negativo. Igualar la CD ya es salvación superada en 5e, y por eso el margen 0
 * cae del lado del fallo (ver `bandaDesdeMargen` con `salvacion: true`).
 */
export function margenContraSalvacion({ cdSalvacion, totalSalvacion }) {
  return entero(cdSalvacion, "cdSalvacion") - entero(totalSalvacion, "totalSalvacion");
}

/**
 * Cuantiza un margen en banda.
 *
 * `salvacion` desplaza SOLO la frontera del cero, porque en 5e el empate lo gana
 * quien salva: con salvación, «éxito» exige margen > 0; sin ella, ≥ 0.
 */
export function bandaDesdeMargen({ margen, salvacion = false }) {
  const m = entero(margen, "margen");
  if (m <= -MARGEN_CRITICO) return BANDAS.PIFIA;
  if (m >= MARGEN_CRITICO) return BANDAS.CRITICO;
  if (salvacion) return m > 0 ? BANDAS.EXITO : BANDAS.FALLO;
  return m >= 0 ? BANDAS.EXITO : BANDAS.FALLO;
}

/**
 * Regla OPCIONAL de la casa: «1 natural → pifia / 20 natural → crítico» en
 * pruebas de característica. dnd5e (2014) reserva eso a las tiradas de ataque:
 * un 20 natural en Arcana no es éxito garantizado. Por eso está apagada de serie
 * y quien la encienda debe declararlo en la interfaz junto al rango de éxito,
 * porque cambia las probabilidades que el jugador está leyendo.
 */
export function aplicarReglaCasaNatural({ banda, natural, activa = false }) {
  if (!activa || natural == null) return banda;
  const n = entero(natural, "natural");
  if (n === 1) return BANDAS.PIFIA;
  if (n === 20) return BANDAS.CRITICO;
  return banda;
}

/**
 * Banda del minijuego de destreza de fallback (sin dnd5e o sin ficha). Recibe la
 * precisión lograda en [0, 1] y la traduce a las MISMAS bandas, para que el
 * mapeo banda→efecto sea uno solo. Los cortes son valores de mesa, sustituibles.
 */
export const CORTES_DESTREZA_POR_DEFECTO = Object.freeze({
  fallo: 0.25,
  exito: 0.6,
  critico: 0.9,
});

export function bandaDesdeDestreza({ precision, cortes = CORTES_DESTREZA_POR_DEFECTO }) {
  const p = Number(precision);
  if (!Number.isFinite(p)) throw new TypeError("precision debe ser un número");
  const acotada = Math.min(1, Math.max(0, p));
  if (acotada >= cortes.critico) return BANDAS.CRITICO;
  if (acotada >= cortes.exito) return BANDAS.EXITO;
  if (acotada >= cortes.fallo) return BANDAS.FALLO;
  return BANDAS.PIFIA;
}

/** ¿La banda da fruto? (éxito o crítico). Atajo legible para quien consuma esto. */
export function bandaEsFavorable(banda) {
  return banda === BANDAS.EXITO || banda === BANDAS.CRITICO;
}

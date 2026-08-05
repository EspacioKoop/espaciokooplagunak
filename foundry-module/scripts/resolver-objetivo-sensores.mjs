// Resuelve a qué objeto real corresponde la lectura degradada que un
// jugador de sensores seleccionó para escanear (#462).
//
// EL PROBLEMA: la orden de escaneo (`scan_object`) necesita el indicativo
// real del objetivo, pero un eco sin escanear no tiene indicativo en la
// lectura que ve el jugador (`contactos-degradados.mjs` lo deja en `null` a
// propósito — es la doctrina de sensores, no un descuido). El jugador solo
// puede señalar "el contacto a este rumbo y distancia aproximados", nunca su
// nombre.
//
// LA RESOLUCIÓN VIVE EN EL RELÉ DEL GM, no en el cliente del jugador. El GM
// es quien tiene acceso a `/v1/contacts` SIN degradar (indicativo y posición
// exactos de todo lo que hay en rango); el jugador nunca ve ese payload. Este
// módulo recibe ambos ya calculados —el crudo del GM y la lectura degradada
// que el jugador escogió— y busca, entre los candidatos, el que encaja dentro
// del margen que la propia degradación ya declaró (el redondeo de
// `contactos-degradados.mjs`). Puro: ni Foundry, ni red.

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Marcación absoluta 0-360, misma convención que `contactos-degradados.mjs`. */
function rumboRelativo(cx, cy, x, y) {
  const grados = (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
  return grados < 0 ? grados + 360 : grados;
}

/** Menor diferencia angular entre dos rumbos, siempre en [0, 180]. */
function diferenciaAngular(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * @param {{contacts?: Array}} contactsPayload el crudo de `/v1/contacts` que
 *   solo el GM puede leer.
 * @param {{x: number, y: number}} centro posición de la nave propia, del
 *   mismo sondeo (`/v1/state`) que usó el jugador para calcular su lectura.
 * @param {{distancia: number, rumboDeg: number, precision?: number,
 *   rumboPrecision?: number}} lectura la entrada degradada que el jugador
 *   seleccionó (`contactos-degradados.mjs`).
 * @returns {string|null} el indicativo real del contacto que encaja dentro
 *   del margen de esa lectura, o `null` si no hay ninguno — nunca se inventa
 *   un objetivo por descarte ni se elige "el más parecido si nada encaja".
 */
export function resolverObjetivoEscaneo({ contactsPayload, centro, lectura }) {
  const cx = numero(centro?.x);
  const cy = numero(centro?.y);
  const distancia = numero(lectura?.distancia);
  const rumboDeg = numero(lectura?.rumboDeg);
  if (cx === null || cy === null || distancia === null || rumboDeg === null) return null;

  // El margen es el de la rejilla con la que `contactos-degradados.mjs`
  // redondeó la lectura. Un mínimo de 1 evita que un margen de 0 (lectura
  // exacta, banda "corto" con rejilla fina) rechace por coma flotante al
  // propio contacto que generó la lectura.
  const margenDistancia = Math.max(numero(lectura?.precision) ?? 0, 1);
  const margenRumbo = Math.max(numero(lectura?.rumboPrecision) ?? 0, 1);

  const candidatos = Array.isArray(contactsPayload?.contacts) ? contactsPayload.contacts : [];
  let mejorIndicativo = null;
  let mejorPuntuacion = Infinity;
  for (const candidato of candidatos) {
    if (candidato?.is_player) continue;
    const indicativo = typeof candidato?.callsign === "string" ? candidato.callsign : null;
    const x = numero(candidato?.position?.x);
    const y = numero(candidato?.position?.y);
    if (!indicativo || x === null || y === null) continue;

    const distanciaReal = Math.hypot(x - cx, y - cy);
    const rumboReal = rumboRelativo(cx, cy, x, y);
    const deltaDistancia = Math.abs(distanciaReal - distancia);
    const deltaRumbo = diferenciaAngular(rumboReal, rumboDeg);
    if (deltaDistancia > margenDistancia || deltaRumbo > margenRumbo) continue;

    // El rumbo pesa más que la distancia en el desempate: dentro de la misma
    // ventana, dos contactos alineados en rumbo pero a distinta distancia se
    // confunden menos que dos contactos a la misma distancia en rumbos
    // distintos — dividir dos ecos por rumbo es lo que el margen del sensor
    // ya sabe hacer peor.
    const puntuacion = deltaDistancia + deltaRumbo * 10;
    if (puntuacion < mejorPuntuacion) {
      mejorPuntuacion = puntuacion;
      mejorIndicativo = indicativo;
    }
  }
  return mejorIndicativo;
}

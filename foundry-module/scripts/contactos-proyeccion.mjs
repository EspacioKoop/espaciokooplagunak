import { leerNumero } from "./lectura-puente.mjs";

// Proyección degradada de contactos para la tripulación (#331, paso 4).
//
// Qué resuelve. El GM ve callsign, facción y coordenadas exactas de todo lo que
// hay en el mapa. Difundir eso crudo a la tripulación regalaría el trabajo del
// puesto de Sensores: si todo se sabe siempre, no hay nada que averiguar. Este
// módulo traduce la verdad del GM a lo que la nave puede saber desde donde está.
//
// UN AVISO QUE HAY QUE LEER ANTES DE TOCAR ESTO. El plan de #331 hablaba de
// degradar «por distancia y por salud del sistema de sensores». La distancia
// existe; **el sistema de sensores no**. EmptyEpsilon tiene nueve sistemas
// —reactor, armas de haz, misiles, maniobra, impulso, warp, salto y los dos
// escudos (`src/components/shipsystem.h`)— y ninguno es de sensores, así que no
// hay ninguna salud que consultar. Por eso la calidad entra como PARÁMETRO con
// valor pleno por defecto: el día que haya de dónde sacarla —salud del reactor
// como aproximación, o que el puente publique los alcances de radar— se conecta
// aquí y no hay que tocar nada más. Inventarse hoy una salud de sensores sería
// escribir una regla de juego a partir de un dato que no existe.
//
// SIN AZAR. Un contacto no puede parpadear entre «identificado» y «traza» de un
// sondeo a otro: la lista bailaría y se leería como ruido de la interfaz en vez
// de como una lectura de la nave. Misma entrada, misma salida, siempre.
//
// NO SE INVENTAN DATOS. La incertidumbre se expresa quitando precisión —una
// marcación redondeada, una banda de distancia en vez de un número— y nunca
// falseando un valor. Un callsign equivocado sería peor que ningún callsign.
//
// Puro: ni Foundry, ni DOM, ni red.

/** Grados de conocimiento, de más a menos. */
export const NIVELES_CONTACTO = Object.freeze(["identificado", "detectado", "traza"]);

/**
 * Radios en unidades del juego. Salen de los alcances de radar de EmptyEpsilon
 * —corto alcance ~5000, largo ~30000— y son de PRESENTACIÓN: se ajustan aquí sin
 * tocar el puente ni la simulación, igual que los umbrales de `nivel-alerta.mjs`.
 */
export const RADIOS = Object.freeze({
  identificado: 5000,
  detectado: 15000,
  traza: 30000,
});

/** Cuánta precisión se conserva en cada nivel. */
const PRECISION = Object.freeze({
  identificado: Object.freeze({ marcacion: 1, distancia: 100 }),
  detectado: Object.freeze({ marcacion: 5, distancia: 500 }),
  traza: Object.freeze({ marcacion: 15, distancia: 5000 }),
});

const numero = leerNumero;

function redondearA(valor, paso) {
  return Math.round(valor / paso) * paso;
}

/**
 * Calidad de sensores acotada a [0,1]. Escala los tres radios: media calidad,
 * media distancia de identificación. Sin fuente todavía, así que por defecto es
 * plena y el comportamiento es el de una nave con los sensores intactos.
 */
export function calidadValida(calidad) {
  // Ausencia significa «no hay fuente de calidad», no «cero», y aquí la
  // diferencia es grave: cero deja la nave CIEGA. `leerNumero` ya distingue las
  // dos cosas; antes esto convertía con `Number()` y `Number(null)` es 0.
  const n = leerNumero(calidad);
  if (n === null) return 1;
  return Math.max(0, Math.min(1, n));
}

/** Marcación en grados desde la nave propia hacia un punto, 0 = norte. */
export function marcacion(origen, destino) {
  const dx = destino.x - origen.x;
  const dy = destino.y - origen.y;
  const grados = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (grados + 360) % 360;
}

/**
 * Nivel de conocimiento de un contacto a una distancia dada.
 * `null` significa fuera de alcance: no aparece, que NO es lo mismo que aparecer
 * como traza vacía. Un contacto que no se detecta no existe para la consola.
 */
export function nivelPorDistancia(distancia, calidad = 1) {
  const d = numero(distancia);
  if (d === null || d < 0) return null;
  const k = calidadValida(calidad);
  // Con la calidad a cero la nave está ciega: ni siquiera hay trazas.
  if (k === 0) return null;
  if (d <= RADIOS.identificado * k) return "identificado";
  if (d <= RADIOS.detectado * k) return "detectado";
  if (d <= RADIOS.traza * k) return "traza";
  return null;
}

/**
 * Proyecta UN contacto a lo que la tripulación puede saber de él.
 *
 * Devuelve `null` si está fuera de alcance. La nave propia también devuelve
 * `null`: ya se ve entera en la telemetría y listarse a uno mismo como contacto
 * es ruido.
 */
export function proyectarContacto(contacto, origen, calidad = 1) {
  if (!contacto || contacto.is_player) return null;
  const posicion = contacto.position;
  const x = numero(posicion?.x);
  const y = numero(posicion?.y);
  const ox = numero(origen?.x);
  const oy = numero(origen?.y);
  if (x === null || y === null || ox === null || oy === null) return null;

  const distancia = Math.hypot(x - ox, y - oy);
  const nivel = nivelPorDistancia(distancia, calidad);
  if (!nivel) return null;

  const precision = PRECISION[nivel];
  return {
    nivel,
    // El callsign solo con identificación positiva. En los otros niveles no se
    // aproxima: se omite. Un nombre equivocado es peor que ningún nombre.
    callsign: nivel === "identificado" ? String(contacto.callsign ?? "?") : null,
    // La facción se distingue antes que el nombre —un perfil de emisiones dice
    // «de los suyos» mucho antes que «el Kestrel»— pero no en una traza.
    faccion: nivel === "traza" ? null : contacto.faction ?? null,
    marcacion: redondearA(marcacion({ x: ox, y: oy }, { x, y }), precision.marcacion) % 360,
    distancia: redondearA(distancia, precision.distancia),
    // La posición exacta NO viaja salvo con identificación positiva: es lo que
    // permitiría a un cliente reconstruir el mapa completo del GM.
    position: nivel === "identificado" ? { x, y } : null,
  };
}

/**
 * Proyecta la lista completa, ordenada de más cerca a más lejos —que es el orden
 * en que le importan a quien vigila— y acotada.
 *
 * El tope existe porque esto viaja por socket en cada sondeo: una nube de
 * doscientos asteroides no debe convertir la telemetría en un chorro.
 */
export function proyectarContactos({ contacts = [], origen, calidad = 1, maximo = 12 } = {}) {
  const lista = (Array.isArray(contacts) ? contacts : [])
    .map((contacto) => proyectarContacto(contacto, origen, calidad))
    .filter(Boolean)
    .sort((a, b) => a.distancia - b.distancia);
  return lista.slice(0, Math.max(0, maximo));
}

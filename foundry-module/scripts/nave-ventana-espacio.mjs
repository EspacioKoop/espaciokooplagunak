// Lo que se ve por la ventana de una sala (#541).
//
// No es un cielo decorativo: es **otra vista del mismo espacio** que la nave
// tiene alrededor. La observación que lo desbloqueó es del QA: si la simulación
// ya genera ese espacio y lo vemos en el mapa, la ventana solo tiene que ser
// otra ventana a lo mismo.
//
// Por eso esto NO trae los skybox de EmptyEpsilon (16 MB de PNG que además
// romperían la regla de cero binarios del módulo): reusa `visor-piloto.mjs`, que
// ya sitúa los contactos degradados por marcación relativa y les da malla. La
// única diferencia es hacia dónde se mira.
//
// ## Autoridad: no abre ningún dato nuevo
//
// Se pinta la MISMA lectura degradada que el puente ya difunde a toda la
// tripulación (`contactos-degradados.mjs`), la que alimenta el visor del piloto.
// Un tripulante en la cantina ve por la ventana lo que ya podía saber; la ventana
// no es un sensor. Y como el visor, dibuja el margen: un eco de banda ancha sale
// como un bloque gordo y gris, no como una silueta afilada.
//
// ## Y no finge una lectura que no tiene
//
// Sin telemetría no se inventa un campo de estrellas «por si acaso»: se baja una
// PERSIANA. Es la decisión del QA y es la honesta — una ventana con estrellas
// quietas y sin contactos afirma «he mirado y no hay nada», que es un dato; una
// persiana cerrada solo dice que no hay vista.
//
// Puro: geometría y datos. Ni Foundry, ni DOM, ni red.

import { piezaDeContacto, situarContacto } from "./visor-piloto.mjs";
import { SECCION } from "./paleta.mjs";

/**
 * Marcación a la que mira cada muro, en grados respecto a la proa.
 *
 * Sale de la rejilla del interior nativo: `y` crece hacia POPA (ver `contacto`
 * en `nave-planta-phobos.mjs`) y la sala hereda ese eje como su `z`. Así que el
 * muro norte de una sala mira a la proa y el sur a la popa. Si esto se invirtiera,
 * la ventana enseñaría el sector girado respecto a lo que dice el rumbo — la peor
 * forma de equivocarse, la misma que evita `marcacionRelativa`.
 */
export const RUMBO_DEL_MURO = Object.freeze({
  norte: 0,
  este: 90,
  sur: 180,
  oeste: 270,
});

/** Vector unitario hacia fuera de cada muro, en coordenadas de sala (x, z). */
const HACIA_FUERA = Object.freeze({
  norte: [0, -1],
  este: [1, 0],
  sur: [0, 1],
  oeste: [-1, 0],
});

/** Color de la persiana. Del casco, porque una persiana es parte del casco. */
const COLOR_PERSIANA = SECCION.mamparo;
/** Lamas de la persiana: suficientes para leerse como persiana, no como reja. */
const LAMAS = 6;
const GRUESO_LAMA = 0.12;

/** A qué muro pertenece un rect de ventana, por el borde que toca. */
export function ladoDeVentana(rect, { ancho, profundidad }, tolerancia = 0.05) {
  if (rect.z <= tolerancia) return "norte";
  if (rect.z + rect.profundidad >= profundidad - tolerancia) return "sur";
  if (rect.x <= tolerancia) return "oeste";
  if (rect.x + rect.ancho >= ancho - tolerancia) return "este";
  return null;
}

/** Centro del hueco, en coordenadas de sala. */
function centroVentana(rect) {
  return [rect.x + rect.ancho / 2, rect.z + rect.profundidad / 2];
}

/**
 * Coloca un punto de la vista (lateral, profundidad) en coordenadas de sala.
 *
 * `lz` va hacia FUERA del muro y `lx` a la derecha de quien mira desde dentro.
 * El vector derecho se saca rotando el de salida, no se escribe por muro: escrito
 * a mano, un signo cambiado espeja el sector solo en dos de los cuatro muros, y
 * eso es de las cosas más difíciles de ver mirando una captura.
 */
function aSala(lado, centro, lx, lz) {
  const [ux, uz] = HACIA_FUERA[lado];
  const [rx, rz] = [-uz, ux];
  return [centro[0] + ux * lz + rx * lx, centro[1] + uz * lz + rz * lx];
}

/**
 * Piezas del espacio visible por una ventana, en coordenadas de sala.
 *
 * Se devuelven como el resto de piezas de la sala —`{malla, color}` con vértices
 * en coordenadas de sala— para que el pintor las ordene por profundidad junto a
 * los muros. Eso es lo que hace que el propio muro recorte la vista sin máscara:
 * un contacto lejano se pinta antes que el muro y solo asoma por el hueco.
 *
 * @param {object} entrada
 * @param {object} entrada.rect Hueco de la ventana.
 * @param {{ancho:number, profundidad:number}} entrada.sala
 * @param {object|null} entrada.sensores Lectura degradada, o `null` si no hay.
 * @param {number|null} entrada.rumboNave Rumbo propio en grados, o `null`.
 */
export function piezasDeVentana({ rect, sala, sensores, rumboNave }) {
  const lado = ladoDeVentana(rect, sala);
  if (!lado) return [];

  // Sin lectura, persiana. Nunca estrellas de relleno: ver la cabecera.
  if (!sensores || !Array.isArray(sensores.contactos) || rumboNave === null || rumboNave === undefined) {
    return persianaCerrada(rect, lado);
  }

  const centro = centroVentana(rect);
  // Se mira hacia fuera del muro: el rumbo propio efectivo es el de la nave más
  // el del muro, y así `situarContacto` devuelve ya el sector correcto.
  const rumboPropio = rumboNave + RUMBO_DEL_MURO[lado];
  // `alcance.largo`, que es la forma REAL que publica `degradarContactos` y la
  // que documenta `componerVisorPiloto`. La primera versión de esto leía un
  // `sensores.alcanceLargo` inexistente, y como `profundidadDe(d, undefined)`
  // devuelve null, se descartaban TODOS los contactos: la ventana se quedaba
  // vacía y sin persiana. Las pruebas no lo vieron porque sus fixtures inventaban
  // ese campo — ahora una de ellas construye el sobre con `sobreTelemetria` para
  // que no pueda volver a pasar.
  const alcanceLargo = sensores.alcance?.largo;

  const piezas = [];
  for (const contacto of sensores.contactos) {
    const sitio = situarContacto(contacto, { rumboPropio, alcanceLargo });
    if (!sitio) continue;
    const [lx, , lz] = sitio;
    // Detrás del observador no se pinta: sin esto un contacto a popa saldría por
    // la ventana de proa, que es exactamente la lectura falsa que hay que evitar.
    if (lz <= 0) continue;
    const { malla, color } = piezaDeContacto(contacto, { alcanceLargo });
    const [sx, sz] = aSala(lado, centro, lx, lz);
    piezas.push({ malla: trasladar(malla, [sx, 0, sz]), color });
  }
  return piezas;
}

/** Traslada una malla a un punto de la sala. */
function trasladar(malla, [dx, dy, dz]) {
  return { ...malla, vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]) };
}

/**
 * Persiana cerrada, pixelart: lamas horizontales que llenan el hueco.
 *
 * Se dibuja EN el plano del muro y no fuera, para que se lea como parte de la
 * sala y no como algo flotando ahí detrás.
 */
export function persianaCerrada(rect, lado) {
  const centro = centroVentana(rect);
  const largo = lado === "norte" || lado === "sur" ? rect.ancho : rect.profundidad;
  // Alto del hueco de ventana en la fábrica: alféizar 1.14, dintel 2.4.
  const y0 = 1.14;
  const y1 = 2.4;
  const paso = (y1 - y0) / LAMAS;

  const lamas = [];
  for (let i = 0; i < LAMAS; i += 1) {
    const cy = y0 + paso * (i + 0.5);
    const [sx, sz] = aSala(lado, centro, 0, 0);
    lamas.push({
      malla: cajaLama([sx, cy, sz], lado, largo, GRUESO_LAMA),
      color: COLOR_PERSIANA,
    });
  }
  return lamas;
}

/** Caja de una lama, orientada según el muro. */
function cajaLama([cx, cy, cz], lado, largo, grueso) {
  const alongX = lado === "norte" || lado === "sur";
  const hx = alongX ? largo / 2 : 0.06;
  const hz = alongX ? 0.06 : largo / 2;
  const hy = grueso / 2;
  const v = [
    [cx - hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz], [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz],
  ];
  return {
    vertices: v,
    caras: [
      [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4],
      [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4],
    ],
  };
}

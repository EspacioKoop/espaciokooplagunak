/**
 * Sincronización de posición entre jugadores al andar por la nave (#453).
 * El prototipo de #427/PR #444 es deliberadamente client-side: cada jugador
 * ve moverse su PROPIA cámara, pero nadie más lo ve. Esto añade el contrato
 * y la interpolación para que sí se vea — deliberadamente SIN el render del
 * avatar ajeno, ver el motivo al final de esta cabecera.
 *
 * Contrato de red (revisión externa de Odiseo en el issue): SOLO estados
 * discretos confirmados, nunca una animación ni una velocidad. Cada cliente
 * publica una muestra `{x, z, y, yaw, estancia, sello}` de vez en cuando
 * (`debeMuestrear` decide cuándo); cada receptor decide LOCALMENTE cómo
 * interpolar entre las dos últimas muestras que recibió de cada jugador —
 * nunca extrapola más allá de la última confirmada, mismo principio que
 * `ventana-nave.mjs` ya aplica al mapa vivo (`rotarMuestras`), replicado
 * aquí en vez de reutilizado porque los campos (x, z, y, yaw) no son el
 * {x, y} de un punto de mapa y forzar el mismo nombre habría sido más
 * confuso que diez líneas propias.
 *
 * Transporte: el flag del propio `User` de siempre (#237) — cada jugador
 * escribe SU PROPIO flag; cualquier otro cliente lo lee directamente al
 * recibir `updateUser`, sin relé del GM. Eso es distinto de
 * `telemetria-difusion.mjs` (que sí necesita un relé porque solo el GM tiene
 * el token del puente): la posición de un jugador ya la conoce el propio
 * jugador, y Foundry ya permite que cualquiera LEA el `User` de cualquier
 * otro (solo la escritura está restringida al propio documento). Un socket
 * no serviría identidad autenticada por sí solo — mismo motivo ya
 * documentado en `telemetria-difusion.mjs` para no usarlo.
 *
 * Deliberadamente FUERA de este módulo: pintar el avatar de otro jugador en
 * el lienzo. El motor `retro3d.mjs` proyecta la escena desde una única
 * cámara (`componerEscena`, con `componer(x, y, z, yaw)` resuelto por
 * estancia en `nave-catalogo-andar.mjs`); colocar un marcador ajeno con la
 * composición correcta por sala es su propio problema de render, mejor
 * resuelto —y verificado visualmente— en un PR aparte una vez que esta
 * sincronización de datos ya esté probada. Este módulo deja lista
 * `posicionesVisibles()` para que ese PR futuro solo tenga que pintar.
 */

const INTERVALO_MUESTREO_MS_DEFECTO = 150;
// Más corto que la ventana del mapa (4000ms, `ventana-nave.mjs`): ahí las
// muestras del puente llegan cada varios segundos; aquí se publican varias
// veces por segundo, así que la ventana de interpolación debe ser igual de
// corta o el movimiento se vería con retraso perceptible.
const VENTANA_MAX_MS_DEFECTO = 1000;
const OBSOLETO_MS_DEFECTO = 2000;

function finito(valor, porDefecto = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
}

/**
 * ¿Toca publicar una muestra ahora? Cruzar una puerta es un evento discreto
 * real y se publica siempre, sin throttle. Fuera de eso, solo cuando ha
 * pasado `intervaloMs` desde la última publicación — emitir cada fotograma
 * sería ruido de red constante mientras alguien anda.
 */
export function debeMuestrear({
  ahoraMs,
  ultimoSelloEnviado = null,
  cambioDeEstancia = false,
  intervaloMs = INTERVALO_MUESTREO_MS_DEFECTO,
}) {
  if (cambioDeEstancia) return true;
  if (ultimoSelloEnviado === null) return true;
  return finito(ahoraMs) - finito(ultimoSelloEnviado) >= intervaloMs;
}

/**
 * La muestra discreta que se publica: SOLO estado confirmado (posición,
 * altura de cámara, orientación, estancia), nunca velocidad ni intención.
 */
export function construirMuestra({ x, z, y = 0, yaw, estancia } = {}, ahoraMs) {
  return {
    x: finito(x),
    z: finito(z),
    y: finito(y),
    yaw: finito(yaw),
    estancia: typeof estancia === "string" ? estancia : null,
    sello: finito(ahoraMs, 0),
  };
}

// Interpolación angular por el camino más corto, normalizada a (-PI, PI].
function angulo(a, b, t) {
  const diferencia = (((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return a + diferencia * t;
}

/**
 * Programa la muestra nueva para interpolarse EN EL FUTURO cercano, mismo
 * truco que `rotarMuestras` de `ventana-nave.mjs`: el `sello` con el que se
 * programa no es el de origen, es "ahora + lo que tardó en llegar desde la
 * anterior" (acotado a `ventanaMaxMs`) — así dibujar siempre tiene un tramo
 * real que recorrer en vez de teletransportar al jugador a la última
 * posición conocida en cuanto llega.
 *
 * Sin historial previo (primera muestra de este jugador), no hay tramo que
 * recorrer: `prev` y `actual` son la misma muestra y se pinta de golpe en su
 * sitio — aparecer no es lo mismo que moverse.
 */
export function programarMuestra(anterior, muestra, ahoraMs, ventanaMaxMs = VENTANA_MAX_MS_DEFECTO) {
  if (!muestra) return anterior ?? null;
  const actualPrevia = anterior?.actual ?? null;
  const ventana = actualPrevia ? Math.min(Math.max(0, ahoraMs - actualPrevia.sello), ventanaMaxMs) : 0;
  const objetivo = { ...muestra, sello: ahoraMs + ventana };
  return { prev: actualPrevia ?? objetivo, actual: objetivo };
}

/**
 * Posición interpolada de un jugador en un instante dado. Sin `actual` no
 * hay nada que devolver; sin `prev` útil (primera muestra, o `actual` ya
 * alcanzado) se devuelve `actual` tal cual — nunca se extrapola más allá de
 * la última muestra confirmada.
 */
export function interpolarJugador(historial, ahoraMs) {
  const { prev, actual } = historial ?? {};
  if (!actual) return null;
  if (!prev || actual.sello <= prev.sello) {
    return { x: actual.x, z: actual.z, y: actual.y, yaw: actual.yaw, estancia: actual.estancia };
  }
  const t = Math.max(0, Math.min(1, (ahoraMs - prev.sello) / (actual.sello - prev.sello)));
  return {
    x: prev.x + (actual.x - prev.x) * t,
    z: prev.z + (actual.z - prev.z) * t,
    y: prev.y + (actual.y - prev.y) * t,
    yaw: angulo(prev.yaw, actual.yaw, t),
    estancia: actual.estancia,
  };
}

/**
 * Qué jugadores tocaría pintar AHORA: en la misma estancia que uno mismo, no
 * uno mismo, y con una muestra lo bastante reciente. Sin muestra fresca se
 * deja de mostrar en vez de congelarlo en su último sitio conocido para
 * siempre — un jugador sin lectura fresca no es información fiable de dónde
 * está, mismo principio que "nunca extrapola".
 *
 * `estadosPorUsuario` es un `Map<userId, {prev, actual}>` (la salida de ir
 * acumulando `programarMuestra` por cada `updateUser` recibido).
 */
export function posicionesVisibles(
  estadosPorUsuario,
  { estanciaPropia, miUserId, ahoraMs, obsoletoMs = OBSOLETO_MS_DEFECTO },
) {
  const visibles = [];
  for (const [userId, historial] of estadosPorUsuario ?? []) {
    if (userId === miUserId) continue;
    const actual = historial?.actual;
    if (!actual || actual.estancia !== estanciaPropia) continue;
    if (ahoraMs - actual.sello > obsoletoMs) continue;
    const posicion = interpolarJugador(historial, ahoraMs);
    if (posicion) visibles.push({ userId, ...posicion });
  }
  return visibles;
}

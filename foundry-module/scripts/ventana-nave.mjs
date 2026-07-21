/**
 * Lógica pura de la «ventana de la nave»: el mapa vivo con estética Neo Geo
 * (paleta saturada, blips pixelados) y sensación de mirar por la escotilla de
 * una nave pequeña, con un campo de estrellas de varias capas en parallax que
 * finge la profundidad (sin 3D real).
 *
 * ESM sin dependencias de Foundry ni del DOM: se importa desde el módulo
 * (navegador) y desde Node para las pruebas. Todo lo que toca el <canvas> vive
 * fuera de aquí; esto solo calcula posiciones, colores y desplazamientos.
 */

// Paleta arcade saturada tipo Neo Geo para las facciones.
export const PALETA_FACCIONES = [
  "#ff2e88", // magenta
  "#00e5ff", // cian
  "#ffb703", // ámbar
  "#38b000", // verde
  "#9d4edd", // púrpura
  "#ef233c", // rojo
  "#3a86ff", // azul
  "#f15bb5", // rosa
];
export const COLOR_JUGADOR = "#fdfffc"; // blanco cálido: la nave propia destaca
export const COLOR_NEUTRO = "#7d8597"; // gris azulado: objetos sin facción

/** Color determinista para una facción. El jugador y los objetos sin facción
 * tienen colores reservados; el resto se reparte por hash sobre la paleta. */
export function colorFaccion(faction, esJugador = false) {
  if (esJugador) return COLOR_JUGADOR;
  if (faction == null || faction === "") return COLOR_NEUTRO;
  let hash = 0;
  for (let i = 0; i < faction.length; i += 1) {
    hash = (hash * 31 + faction.codePointAt(i)) >>> 0;
  }
  return PALETA_FACCIONES[hash % PALETA_FACCIONES.length];
}

/** PRNG determinista (mulberry32): misma semilla, mismo campo de estrellas. */
export function rngSemilla(seed) {
  let a = seed >>> 0;
  return function siguiente() {
    a = Math.trunc(a);
    a = Math.trunc(a + 0x6d2b79f5);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Campo de estrellas por capas para el parallax. Las capas se ordenan de
 * lejana (factor pequeño, se mueve poco) a cercana (factor grande, se mueve
 * mucho): esa diferencia de velocidad es lo que finge la profundidad.
 *
 * @returns {{factor:number, estrellas:{x:number,y:number,r:number,brillo:number}[]}[]}
 */
export function crearCampoEstrellas(seed, { capas = 3, porCapa = 40, ancho = 320, alto = 320 } = {}) {
  const rng = rngSemilla(seed);
  const salida = [];
  for (let c = 0; c < capas; c += 1) {
    const factor = (c + 1) / capas; // 1/capas … 1
    const estrellas = [];
    for (let i = 0; i < porCapa; i += 1) {
      estrellas.push({
        x: rng() * ancho,
        y: rng() * alto,
        r: 0.5 + factor * 1.5, // las cercanas, más gordas
        brillo: 0.35 + factor * 0.65,
      });
    }
    salida.push({ factor, estrellas });
  }
  return salida;
}

/**
 * Desplazamiento en parallax de una capa según la posición del mundo (la nave).
 * Al moverse la nave, las estrellas se desplazan en sentido contrario, tanto
 * más cuanto más «cerca» está la capa. Se envuelve al tamaño del lienzo para
 * teselar sin costuras visibles.
 */
export function offsetParallax(factorCapa, centroMundo, escalaFondo, ancho, alto) {
  const bruto = (v, tam) => {
    const d = -(v * escalaFondo * factorCapa) % tam;
    return d < 0 ? d + tam : d; // siempre en [0, tam)
  };
  return {
    dx: bruto(centroMundo?.x ?? 0, ancho),
    dy: bruto(centroMundo?.y ?? 0, alto),
  };
}

/**
 * Proyecta los contactos al lienzo, centrados en la nave del jugador. Escala
 * `radioMundo` unidades de mundo al radio del visor. Con `headingDeg` rota el
 * mundo para que el morro de la nave apunte hacia arriba (sensación de cabina).
 *
 * @returns {{callsign:string,faction:(string|null),esJugador:boolean,
 *   x:number,y:number,distancia:number,dentro:boolean}[]}
 */
export function proyectarContactos({ contacts = [], centro, headingDeg = 0, radioMundo = 30000, ancho = 320, alto = 320 }) {
  const cx = ancho / 2;
  const cy = alto / 2;
  const radioVisor = Math.min(ancho, alto) / 2;
  const escala = radioVisor / radioMundo;
  const a = (-headingDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const ox = Number.isFinite(centro?.x) ? centro.x : 0;
  const oy = Number.isFinite(centro?.y) ? centro.y : 0;

  return normalizarContactosMapa(contacts).map((c) => {
    const relx = (c.position?.x ?? 0) - ox;
    const rely = (c.position?.y ?? 0) - oy;
    const rx = relx * cos - rely * sin;
    const ry = relx * sin + rely * cos;
    const distancia = Math.hypot(relx, rely);
    return {
      callsign: c.callsign ?? "?",
      faction: c.faction ?? null,
      tipo: c.type ?? null,
      clase: c.class ?? null,
      subclase: c.subclass ?? null,
      esJugador: Boolean(c.is_player),
      x: cx + rx * escala,
      y: cy + ry * escala,
      distancia,
      dentro: distancia * escala <= radioVisor,
    };
  });
}

/**
 * Proyecta el destino de la ruta (issue #175) con la misma proyección de
 * cabina que los contactos. Devuelve null si no hay destino utilizable
 * (sin nombre o sin posición: no se inventa nada). Cuando el destino queda
 * fuera del visor, `x`/`y` son el punto recortado al anillo de alcance en
 * su dirección real, y `dentro` es false — el pintor decide la marca.
 *
 * @param {{name:string, position:{x:number,y:number}}|null} destino
 * @returns {{nombre:string,x:number,y:number,distancia:number,dentro:boolean}|null}
 */
export function proyectarDestino({ destino, centro, headingDeg = 0, radioMundo = 30000, ancho = 320, alto = 320 }) {
  if (!destino || typeof destino.name !== "string" || destino.name === "") return null;
  const px = destino.position?.x;
  const py = destino.position?.y;
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

  const [p] = proyectarContactos({
    contacts: [{ callsign: destino.name, position: { x: px, y: py } }],
    centro, headingDeg, radioMundo, ancho, alto,
  });
  if (p.dentro) {
    return { nombre: destino.name, x: p.x, y: p.y, distancia: p.distancia, dentro: true };
  }
  // Fuera de alcance: recorta al anillo, conservando la dirección.
  const cx = ancho / 2;
  const cy = alto / 2;
  const radioVisor = Math.min(ancho, alto) / 2;
  const a = Math.atan2(p.y - cy, p.x - cx);
  return {
    nombre: destino.name,
    x: cx + Math.cos(a) * radioVisor,
    y: cy + Math.sin(a) * radioVisor,
    distancia: p.distancia,
    dentro: false,
  };
}

/**
 * Interpola el centro (posición de la nave propia) entre las dos últimas
 * muestras CONFIRMADAS del puente. `t` se acota a [0,1]: nunca se extrapola
 * más allá de la última muestra — el mapa es una vista de lo que el puente ha
 * dicho, no un simulador propio (docs/FOUNDRY.md). Con una sola muestra (o
 * timestamps degenerados) devuelve la actual tal cual.
 *
 * @param {{tMs:number,centro:{x:number,y:number}}|null} prev
 * @param {{tMs:number,centro:{x:number,y:number}}} actual
 * @param {number} tMs instante de dibujo (misma base de tiempo que las muestras)
 */
export function interpolarCentro(prev, actual, tMs) {
  if (!actual) return { x: 0, y: 0 };
  if (!prev || (actual.tMs <= prev.tMs)) return { ...actual.centro };
  const t = Math.min(1, Math.max(0, (tMs - prev.tMs) / (actual.tMs - prev.tMs)));
  return {
    x: prev.centro.x + (actual.centro.x - prev.centro.x) * t,
    y: prev.centro.y + (actual.centro.y - prev.centro.y) * t,
  };
}

/**
 * Interpola dos rumbos en grados por el camino angular corto (350°→10° cruza
 * por 0°, no da la vuelta por 180°). Resultado normalizado a [0, 360).
 */
export function interpolarAngulo(a, b, t) {
  const ta = Math.min(1, Math.max(0, t));
  let delta = (((b - a) % 360) + 540) % 360 - 180; // en (-180, 180]
  const bruto = a + delta * ta;
  return ((bruto % 360) + 360) % 360;
}

/**
 * Identidad pública utilizable entre sondeos. EmptyEpsilon no expone todavía
 * un ID técnico en `/v1/contacts`: la nave propia es inequívoca y un callsign
 * no vacío se combina con tipo/facción. Los contactos anónimos (`?`) no se
 * emparejan para evitar interpolar por error dos asteroides distintos.
 */
export function claveContacto(contacto) {
  if (contacto?.is_player) return "player";
  const callsign = typeof contacto?.callsign === "string" ? contacto.callsign.trim() : "";
  if (!callsign || callsign === "?") return null;
  return JSON.stringify([
    callsign,
    contacto?.type ?? null,
    contacto?.faction ?? null,
  ]);
}

/** Devuelve una copia numérica de la posición o null si el DTO no es usable. */
export function normalizarPosicionMapa(posicion) {
  if (!Number.isFinite(posicion?.x) || !Number.isFinite(posicion?.y)) return null;
  return { x: posicion.x, y: posicion.y };
}

/**
 * Frontera defensiva del mapa: una coordenada no finita no se convierte en
 * `(0,0)` porque eso inventaría una posición. El contacto se omite de esta
 * fotografía hasta que el puente entregue una muestra válida.
 */
export function normalizarContactosMapa(contactos = []) {
  if (!Array.isArray(contactos)) return [];
  return contactos.flatMap((contacto) => {
    const position = normalizarPosicionMapa(contacto?.position);
    return position ? [{ ...contacto, position }] : [];
  });
}

/**
 * Interpola únicamente contactos con identidad única en ambas muestras. Los
 * nuevos, desaparecidos, anónimos o duplicados se resuelven a la muestra
 * actual: sin residuos, NaN ni asociaciones visuales falsas.
 */
export function interpolarContactos(prev = [], actual = [], t = 1) {
  const factor = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 1));
  const prevValidos = normalizarContactosMapa(prev);
  const actualesValidos = normalizarContactosMapa(actual);
  const contar = (contactos) => {
    const cuentas = new Map();
    for (const contacto of contactos) {
      const clave = claveContacto(contacto);
      if (clave !== null) cuentas.set(clave, (cuentas.get(clave) ?? 0) + 1);
    }
    return cuentas;
  };
  const cuentasPrev = contar(prevValidos);
  const cuentasActual = contar(actualesValidos);
  const prevPorClave = new Map();
  for (const contacto of prevValidos) {
    const clave = claveContacto(contacto);
    if (clave !== null && cuentasPrev.get(clave) === 1) prevPorClave.set(clave, contacto);
  }

  return actualesValidos.map((contacto) => {
    const clave = claveContacto(contacto);
    const anterior = clave !== null && cuentasActual.get(clave) === 1
      ? prevPorClave.get(clave)
      : null;
    const xActual = contacto.position.x;
    const yActual = contacto.position.y;
    if (!anterior) return contacto;
    const xPrev = anterior.position.x;
    const yPrev = anterior.position.y;
    return {
      ...contacto,
      position: {
        x: xPrev + (xActual - xPrev) * factor,
        y: yPrev + (yActual - yPrev) * factor,
      },
    };
  });
}

/** Firma que excluye posición: permite actualizar muestras móviles sin que
 * Foundry reconstruya el canvas y el resto de la ventana en cada sondeo. */
export function firmaEstructuralContactos(contactos = []) {
  return JSON.stringify(contactos.map((contacto) => ({
    clave: claveContacto(contacto),
    callsign: contacto?.callsign ?? "?",
    faction: contacto?.faction ?? null,
    type: contacto?.type ?? null,
    is_player: Boolean(contacto?.is_player),
  })));
}

/** Throttle del bucle de dibujo: ¿toca pintar este tick de rAF a `fpsMax`?
 * El primer frame (sin dibujo previo) pinta siempre. */
export function debeDibujar(ultimoMs, ahoraMs, fpsMax = 30) {
  if (ultimoMs == null) return true;
  if (!Number.isFinite(ahoraMs) || !Number.isFinite(fpsMax) || fpsMax <= 0) return false;
  // rAF suele avanzar 16.666… ms. Una tolerancia submilisegundo evita que el
  // redondeo 16/17 ms descarte un tick y reduzca 60 Hz efectivos a ~40 FPS.
  return ahoraMs - ultimoMs >= Math.max(0, 1000 / fpsMax - 0.5);
}

/**
 * Rota las muestras del sondeo creando una VENTANA DE REPRODUCCIÓN. El dibujo
 * ocurre siempre en tiempos posteriores a la recepción, así que timestampear
 * la muestra nueva con "ahora" dejaría el tween clavado en t=1 (ningún frame
 * intermedio). En su lugar, al recibir una muestra el tween se programa hacia
 * delante: `prev` (la posición confirmada ANTERIOR) se ancla en `ahoraMs` y
 * `actual` (la recién confirmada) en `ahoraMs + ventana`, donde `ventana` es
 * el tiempo real transcurrido entre recepciones (acotado por `ventanaMaxMs`,
 * para que un hueco de backoff no produzca un tween de un minuto). Los frames
 * de ese intervalo interpolan 0→1 y después el clamp deja el mapa clavado en
 * la última muestra confirmada: se REPRODUCE movimiento ya confirmado con un
 * intervalo de retardo — nunca se extrapola.
 *
 * @param {object|null} muestraActual la muestra `actual` vigente (null si es la primera)
 * @param {{centro:{x:number,y:number}, rumboDeg:number, contactos?:object[]}} nueva datos confirmados del puente
 * @param {number} ahoraMs instante de recepción (misma base de tiempo que el dibujo)
 * @returns {{prev: object|null, actual: object}}
 */
export function rotarMuestras(muestraActual, nueva, ahoraMs, ventanaMaxMs = 4000) {
  const entrante = {
    centro: { x: nueva.centro?.x ?? 0, y: nueva.centro?.y ?? 0 },
    rumboDeg: nueva.rumboDeg ?? 0,
    recibidaMs: ahoraMs,
  };
  if (Array.isArray(nueva.contactos)) entrante.contactos = nueva.contactos;
  if (!muestraActual) {
    // Primera muestra: se pinta directa, sin tween (no hay "anterior").
    return { prev: null, actual: { ...entrante, tMs: ahoraMs } };
  }
  const transcurrido = ahoraMs - (muestraActual.recibidaMs ?? ahoraMs);
  const ventana = Math.min(Math.max(transcurrido, 0), ventanaMaxMs);
  return {
    prev: {
      tMs: ahoraMs,
      centro: muestraActual.centro,
      rumboDeg: muestraActual.rumboDeg,
      ...(Array.isArray(muestraActual.contactos) ? { contactos: muestraActual.contactos } : {}),
    },
    actual: { ...entrante, tMs: ahoraMs + ventana },
  };
}

/**
 * Compone el «frame» del mapa vivo: TODO lo que el pintor de canvas necesita,
 * calculado de forma pura y determinista (mismas entradas → mismo frame). El
 * movimiento propio se tweenea entre las dos últimas muestras del puente
 * (interpolarCentro/interpolarAngulo, sin extrapolación); los contactos con
 * identidad inequívoca comparten esa interpolación temporal. El `parpadeo`
 * retro de los blips sale de la fase temporal, no de estado mutable.
 *
 * @returns {{sinDatos:boolean, centro:{x,y}, rumboDeg:number,
 *   capas:{dx:number,dy:number,estrellas:object[]}[],
 *   blips:{callsign,faction,color,esJugador,x,y,distancia,dentro,parpadeo}[],
 *   destino:({nombre,x,y,distancia,dentro}|null)}}
 */
export function componerFrame({
  muestraPrev = null,
  muestraActual = null,
  contactos = [],
  destino = null,
  campo = [],
  tMs = 0,
  ancho = 320,
  alto = 320,
  radioMundo = 30000,
  escalaFondo = 0.05,
} = {}) {
  if (!muestraActual) {
    return { sinDatos: true, centro: { x: 0, y: 0 }, rumboDeg: 0, capas: [], blips: [], destino: null };
  }
  const centro = interpolarCentro(muestraPrev, muestraActual, tMs);
  const factorMuestra = muestraPrev && muestraActual.tMs > muestraPrev.tMs
    ? (tMs - muestraPrev.tMs) / (muestraActual.tMs - muestraPrev.tMs)
    : 1;
  const rumboDeg = muestraPrev && muestraActual.tMs > muestraPrev.tMs
    ? interpolarAngulo(
        muestraPrev.rumboDeg ?? 0,
        muestraActual.rumboDeg ?? 0,
        (tMs - muestraPrev.tMs) / (muestraActual.tMs - muestraPrev.tMs),
      )
    : ((muestraActual.rumboDeg ?? 0) % 360 + 360) % 360;

  const capas = campo.map((capa) => ({
    ...offsetParallax(capa.factor, centro, escalaFondo, ancho, alto),
    estrellas: capa.estrellas,
  }));

  const encendido = Math.floor(tMs / 300) % 2 === 0; // fase de parpadeo retro
  const contactosFrame = Array.isArray(muestraActual.contactos)
    ? interpolarContactos(muestraPrev?.contactos ?? [], muestraActual.contactos, factorMuestra)
    : contactos;
  const blips = proyectarContactos({
    contacts: contactosFrame, centro, headingDeg: rumboDeg, radioMundo, ancho, alto,
  }).map((p) => ({
    ...p,
    color: colorFaccion(p.faction, p.esJugador),
    parpadeo: p.esJugador ? true : encendido, // la nave propia no parpadea
  }));

  return {
    sinDatos: false,
    centro,
    rumboDeg,
    capas,
    blips,
    destino: proyectarDestino({ destino, centro, headingDeg: rumboDeg, radioMundo, ancho, alto }),
  };
}

/**
 * Rumbo desde el centro (nave propia) hacia una posición, en la convención de
 * EmptyEpsilon (0° = norte, sentido horario) — la misma fórmula
 * `deg(atan(dy, dx)) + 90` que usan los escenarios Lua. Resultado en [0, 360).
 */
export function rumboHacia(centro, posicion) {
  if (!normalizarPosicionMapa(centro) || !normalizarPosicionMapa(posicion)) return null;
  const dx = (posicion?.x ?? 0) - (centro?.x ?? 0);
  const dy = (posicion?.y ?? 0) - (centro?.y ?? 0);
  const grados = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return ((grados % 360) + 360) % 360;
}

/**
 * Detalle de un contacto seleccionado para el onboarding del mapa (issue
 * #126): nombre, tipo y facción si el DTO los trae, y distancia/rumbo
 * calculados desde la nave propia. Puro: las etiquetas i18n las pone la vista.
 *
 * @returns {{callsign:string, tipo:string|null, faccion:string|null,
 *   esJugador:boolean, color:string, distancia:(number|null), rumboDeg:(number|null)}}
 */
export function prepararDetalleContacto(contacto, centro) {
  const centroValido = normalizarPosicionMapa(centro);
  const posicionValida = normalizarPosicionMapa(contacto?.position);
  const dx = centroValido && posicionValida ? posicionValida.x - centroValido.x : null;
  const dy = centroValido && posicionValida ? posicionValida.y - centroValido.y : null;
  return {
    callsign: contacto.callsign ?? "?",
    tipo: contacto.type ?? null,
    faccion: contacto.faction ?? null,
    esJugador: Boolean(contacto.is_player),
    color: colorFaccion(contacto.faction ?? null, Boolean(contacto.is_player)),
    distancia: dx === null || dy === null ? null : Math.hypot(dx, dy),
    rumboDeg: centroValido && posicionValida ? rumboHacia(centroValido, posicionValida) : null,
  };
}

/**
 * Hit-test puro sobre los blips ya proyectados de un frame (issue #259): dado
 * un punto del canvas, devuelve el callsign del contacto dibujado más cercano
 * dentro de `tolerancia` píxeles, o null si no hay ninguno a esa distancia.
 * Los contactos fuera de alcance (`dentro: false`) se pintan recortados al
 * anillo, no en su posición real, así que no participan del hit-test: pinchar
 * ahí seleccionaría el objeto equivocado.
 *
 * @param {{callsign:string, x:number, y:number, dentro:boolean}[]} blips
 * @returns {string|null}
 */
export function contactoEnPunto(blips = [], x, y, tolerancia = 6) {
  let mejor = null;
  let mejorDist = Infinity;
  for (const blip of blips) {
    if (!blip.dentro) continue;
    const dist = Math.hypot(blip.x - x, blip.y - y);
    if (dist <= tolerancia && dist < mejorDist) {
      mejor = blip;
      mejorDist = dist;
    }
  }
  return mejor ? (mejor.callsign ?? "?") : null;
}

/**
 * Leyenda del mapa para una lista de contactos: la nave propia y una entrada
 * por facción presente (color determinista de colorFaccion), más los objetos
 * sin facción si los hay. Accesible: cada color va acompañado de su texto.
 *
 * @returns {{clave:string, color:string, faccion:string|null, esJugador:boolean}[]}
 */
export function leyendaContactos(contactos = []) {
  const entradas = [{ clave: "propia", color: COLOR_JUGADOR, faccion: null, esJugador: true }];
  const vistas = new Set();
  let hayNeutros = false;
  for (const c of contactos) {
    if (c.is_player) continue;
    const faccion = c.faction ?? null;
    if (faccion === null) {
      hayNeutros = true;
      continue;
    }
    if (vistas.has(faccion)) continue;
    vistas.add(faccion);
    entradas.push({ clave: `faccion:${faccion}`, color: colorFaccion(faccion), faccion, esJugador: false });
  }
  if (hayNeutros) {
    entradas.push({ clave: "neutro", color: COLOR_NEUTRO, faccion: null, esJugador: false });
  }
  return entradas;
}

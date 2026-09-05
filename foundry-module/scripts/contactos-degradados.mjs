// Contactos que la tripulación sí puede ver (#331, paso 3).
//
// El paso 1 abrió la telemetría de la nave y dejó los contactos cerrados a
// propósito: indicativo, facción y coordenadas exactas son lo que un sistema de
// sensores debería decidir cuánto revela, y difundirlos crudos regala el trabajo
// del puesto de ciencia. Esto los abre, pero degradados.
//
// SE DEGRADA EN EL ORIGEN, NO EN LA VISTA. Lo que el GM difunde va a un ajuste de
// mundo que toda la mesa puede leer, así que recortar al pintar no defendería
// nada: el dato crudo ya estaría en el cliente de cualquiera. Lo que no sale de
// aquí es lo único que de verdad no sale.
//
// LAS BANDAS SON EL RADAR DE LA NAVE, no dos constantes elegidas por mí.
// `long_range_radar` publica `short_range` y `long_range` y el puente los
// reenvía; sin esa lectura no se publica NINGÚN contacto —falla cerrada— porque
// no se puede saber hasta dónde llegan los sensores de esta nave y abrir de par
// en par «por si acaso» es exactamente lo que este módulo existe para no hacer.
// Las bandas gradúan SOLO la posición (cuánto se redondea distancia/rumbo); la
// identidad (indicativo, facción) la gradúa el escaneo real del juego
// (`scan_state`, #462) — ver la nota completa en `entrada()` más abajo.
//
// NO SE PUBLICAN COORDENADAS ABSOLUTAS, sino distancia y rumbo relativo. Dos
// motivos, y el segundo es el que manda:
//
//  1. La tripulación no recibe la posición de su propia nave —el sobre lleva lo
//     que las consolas enseñan—, así que unas coordenadas de mundo no le sirven
//     para nada: no tendría contra qué restarlas.
//  2. Y difundir la posición exacta de cada objeto del sector a un ajuste que
//     toda la mesa puede leer es justo la fuga que este módulo existe para
//     cerrar. Un puesto de sensores lee alcance y marcación; eso es lo que se
//     publica.
//
// La lectura degradada no miente porque el MARGEN viaja con el dato: distancia y
// rumbo van redondeados a la resolución de su banda y acompañados de cuánto vale
// ese redondeo. Un número fino sobre un dato grueso sí sería mentir; decir «a
// unos 20.000, por la proa, con este margen» no.
//
// Puro: ni Foundry, ni DOM, ni red.

/**
 * Resolución de cada banda: cuánto se redondea la distancia (unidades de mundo)
 * y el rumbo (grados). Un eco lejano se sabe grueso en las dos cosas, así que
 * publicarlo con un grado de precisión sería fingir una lectura que no se tiene.
 */
const REJILLA = Object.freeze({
  corto: { distancia: 10, rumbo: 1 },
  largo: { distancia: 1000, rumbo: 15 },
  propia: { distancia: 0, rumbo: 0 },
});

function numero(valor) {
  // Ausencia y tipos coercibles no son posiciones medidas (ni alcances).
  if (typeof valor !== "number" && (typeof valor !== "string" || valor.trim() === "")) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function redondearA(valor, rejilla) {
  return Math.round(valor / rejilla) * rejilla;
}

/**
 * Alcances utilizables, o `null`. Medio radar no es un radar: con un solo
 * alcance habría que completar el otro a ojo, y esa constante inventada es justo
 * lo que este módulo evita.
 */
export function alcancesDe(radar) {
  const corto = numero(radar?.short_range);
  const largo = numero(radar?.long_range);
  if (corto === null || largo === null) return null;
  if (!(corto > 0) || !(largo > 0)) return null;
  // Un radar con el corto por encima del largo no se corrige a la brava: se
  // rechaza. Adivinar cuál de los dos quiso decir el escenario sería inventar.
  if (corto > largo) return null;
  return { corto, largo };
}

/**
 * Degrada los contactos del GM a lo que la tripulación puede ver.
 *
 * @param {{contacts?: Array}|null} payload el crudo de `/v1/contacts`.
 * @param {{x: number, y: number}|null} centro posición de la nave propia.
 * @param {{short_range: number, long_range: number}|null} radar
 * @returns {{contactos: Array, alcance: object}|null} `null` cuando no se puede
 *   decidir qué se ve, que NO es lo mismo que «no se ve nada».
 */
export function degradarContactos(payload, centro, radar) {
  const alcances = alcancesDe(radar);
  const cx = numero(centro?.x);
  const cy = numero(centro?.y);
  if (!alcances || cx === null || cy === null) return null;

  const crudos = Array.isArray(payload?.contacts) ? payload.contacts : [];
  const contactos = [];
  for (const contacto of crudos) {
    const x = numero(contacto?.position?.x);
    const y = numero(contacto?.position?.y);
    // La nave propia se publica entera y sin mirar distancia: la tripulación
    // está dentro de ella. Sin posición legible no se publica, porque un
    // contacto sin sitio no es un contacto.
    if (contacto?.is_player) {
      if (x !== null && y !== null) {
        contactos.push(entrada(contacto, 0, 0, "propia"));
      }
      continue;
    }
    if (x === null || y === null) continue;

    const distancia = Math.hypot(x - cx, y - cy);
    const rumbo = rumboRelativo(cx, cy, x, y);
    // Más allá del alcance largo NO se publica, y tampoco se cuenta. Un total
    // que incluyera lo invisible diría «hay cuatro cosas ahí fuera», que es
    // precisamente el dato que el puesto de ciencia tiene que ganarse.
    if (distancia > alcances.largo) continue;

    const banda = distancia <= alcances.corto ? "corto" : "largo";
    contactos.push(entrada(contacto, distancia, rumbo, banda));
  }
  return { contactos, alcance: { corto: alcances.corto, largo: alcances.largo } };
}

/**
 * Una entrada ya degradada.
 *
 * La identidad (indicativo, facción) y la posición se degradan por DOS ejes
 * independientes (#462), no por el mismo:
 *
 * - `scan_state` es el escaneo REAL del juego (`ScanState`, ver
 *   `docs/SESION-PANTALLAS-NATIVAS.md`) para la facción de la nave propia, que
 *   el puente ya resuelve en `/v1/contacts`. Sin escaneo — "none" o "fof",
 *   identificación amigo/enemigo sin nombre — no hay indicativo ni facción que
 *   enseñar; con "simple" o "full" sí, sin importar la distancia: un objeto
 *   escaneado de cerca sigue identificado aunque luego se aleje.
 * - la banda de distancia (`corto`/`largo`) sigue siendo solo la RESOLUCIÓN de
 *   la posición (cuánto se redondea distancia y rumbo) — el alcance del radar,
 *   no el nivel de escaneo.
 *
 * Antes de #462 ambos ejes se aproximaban con uno solo (banda de distancia),
 * porque el puente no publicaba `scan_state`. `is_player` sigue siendo la
 * excepción: la nave propia se conoce entera sin haberse escaneado a sí misma.
 */
function entrada(contacto, distancia, rumbo, banda) {
  const scanState = typeof contacto?.scan_state === "string" ? contacto.scan_state : "none";
  const identificado = banda === "propia" || scanState === "simple" || scanState === "full";
  const rejilla = REJILLA[banda];
  return {
    banda,
    esJugador: banda === "propia",
    callsign: identificado && typeof contacto?.callsign === "string" ? contacto.callsign : null,
    faction: identificado && typeof contacto?.faction === "string" ? contacto.faction : null,
    distancia: rejilla.distancia > 0 ? redondearA(distancia, rejilla.distancia) : distancia,
    rumboDeg: rejilla.rumbo > 0 ? redondearA(rumbo, rejilla.rumbo) % 360 : rumbo,
    // Los márgenes viajan con el dato para que la vista los pueda enseñar. Sin
    // ellos, un número fino sobre una lectura gruesa sería mentir.
    precision: rejilla.distancia,
    rumboPrecision: rejilla.rumbo,
  };
}

/** Marcación absoluta 0-360, con 0 al norte del mundo, como el resto del módulo. */
function rumboRelativo(cx, cy, x, y) {
  const grados = (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
  return grados < 0 ? grados + 360 : grados;
}

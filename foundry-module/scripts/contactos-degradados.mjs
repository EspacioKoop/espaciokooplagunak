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
//
// Y la posición degradada no miente: se redondea a una rejilla y se publica la
// PRECISIÓN junto al punto, para que quien pinte pueda dibujar la incertidumbre
// en vez de un punto exacto que no lo es. Un punto fino sobre un dato grueso sí
// sería mentir; decir «está por aquí, con este margen» no.
//
// Puro: ni Foundry, ni DOM, ni red.

/** Rejilla de redondeo por banda, en unidades de mundo. */
const REJILLA = Object.freeze({ corto: 10, largo: 1000 });

function numero(valor) {
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
        contactos.push(entrada(contacto, x, y, "propia", 0));
      }
      continue;
    }
    if (x === null || y === null) continue;

    const distancia = Math.hypot(x - cx, y - cy);
    // Más allá del alcance largo NO se publica, y tampoco se cuenta. Un total
    // que incluyera lo invisible diría «hay cuatro cosas ahí fuera», que es
    // precisamente el dato que el puesto de ciencia tiene que ganarse.
    if (distancia > alcances.largo) continue;

    if (distancia <= alcances.corto) {
      contactos.push(entrada(contacto, x, y, "corto", REJILLA.corto));
    } else {
      contactos.push(entrada(contacto, x, y, "largo", REJILLA.largo));
    }
  }
  return { contactos, alcance: { corto: alcances.corto, largo: alcances.largo } };
}

/**
 * Una entrada ya degradada.
 *
 * En banda larga se va el indicativo y se va la facción: es un eco, y de un eco
 * no se sabe quién es. Se conserva `is_player` a false y nada más que la posición
 * gruesa con su margen.
 */
function entrada(contacto, x, y, banda, rejilla) {
  const identificado = banda !== "largo";
  return {
    banda,
    esJugador: banda === "propia",
    callsign: identificado && typeof contacto?.callsign === "string" ? contacto.callsign : null,
    faction: identificado && typeof contacto?.faction === "string" ? contacto.faction : null,
    position: {
      x: rejilla > 0 ? redondearA(x, rejilla) : x,
      y: rejilla > 0 ? redondearA(y, rejilla) : y,
    },
    // El margen viaja con el punto para que la vista pueda dibujar la
    // incertidumbre. Sin él, un punto fino sobre un dato grueso sería mentir.
    precision: rejilla,
  };
}

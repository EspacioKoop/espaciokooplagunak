// La lectura de sensores, tal y como se lee (#331, paso 3).
//
// El paso 3 abrió los contactos a la tripulación degradados por el alcance del
// radar, pero la consola solo enseñaba un recuento: el dato estaba ahí y no se
// veía. Esto lo convierte en filas legibles.
//
// LAS DOS FUENTES NO SE MEZCLAN. El GM lee su sondeo crudo —coordenadas exactas,
// que es lo que necesita para dirigir— y la tripulación lee lo degradado. No hay
// un formato común al que se «adapten» las dos: son lecturas distintas de cosas
// distintas, y fingir que son la misma tabla acabaría enseñándole a alguien un
// número que no le corresponde.
//
// EL MARGEN SE ESCRIBE, no se insinúa. Un eco a «20000» se lee como una medición;
// «≈20000 ±1000» se lee como lo que es. La consola no tiene por qué esconder que
// su sensor es tosco a esa distancia: esa es justamente la información con la que
// el puesto trabaja, y es lo que hace que acercarse sirva para algo.
//
// Puro: ni Foundry, ni DOM, ni red.

const MAXIMO_FILAS = 8;

function localizar(i18n, clave) {
  return i18n?.localize?.(clave) ?? clave;
}

function entero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Separador de miles: un espacio fino de no separación (U+202F). Se escribe con
 * el escape y no con el carácter literal a propósito — en el código fuente es
 * indistinguible de un espacio normal, y quien viniera a tocar esto acabaría
 * comparándolo con " " en una prueba que fallaría sin decir por qué.
 *
 * Es fino porque 20000 se lee mal y 20 000 se lee de un vistazo, y de no
 * separación porque una cifra partida entre dos líneas se lee como dos cifras.
 */
export const ESPACIO_FINO = "\u202f";

function conMiles(valor) {
  return String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, ESPACIO_FINO);
}

/**
 * Una medida con su margen. Sin margen no se escribe el `±`, que si no toda
 * lectura exacta parecería aproximada.
 */
function medida(valor, margen, unidad) {
  const base = `${conMiles(valor)}${unidad}`;
  if (!(margen > 0)) return base;
  return `≈${base} ±${conMiles(margen)}${unidad}`;
}

/**
 * Filas de la lectura degradada que recibe la tripulación.
 *
 * @param {{contactos: Array}|null} sensores lo difundido por el GM.
 * @param {object} i18n
 */
export function filasDegradadas(sensores, i18n) {
  const contactos = Array.isArray(sensores?.contactos) ? sensores.contactos : [];
  return contactos
    // La nave propia no es un contacto que seguir: la tripulación está dentro.
    .filter((contacto) => !contacto?.esJugador)
    .slice()
    // Lo más cercano primero: es el orden en el que importa.
    .sort((a, b) => Number(a?.distancia ?? 0) - Number(b?.distancia ?? 0))
    .slice(0, MAXIMO_FILAS)
    .map((contacto) => {
      // Eco = sin indicativo, no banda larga (#462): identidad y posición se
      // degradan por ejes independientes desde que el puente publica el
      // escaneo real (`scan_state`) — un contacto cercano sin escanear sigue
      // siendo un eco, y uno escaneado sigue identificado aunque se aleje.
      const eco = typeof contacto?.callsign !== "string";
      const distancia = entero(contacto?.distancia);
      const rumbo = entero(contacto?.rumboDeg);
      return {
        eco,
        // Un eco NO se llama «desconocido»: se llama eco. «Desconocido» suena a
        // que hay un nombre y no se ha averiguado; un eco es que el sensor solo
        // devuelve un retorno, y esa diferencia es el trabajo del puesto.
        callsign: eco ? localizar(i18n, "LAGUNAK.Espacios.Sensores.Eco") : String(contacto?.callsign ?? "?"),
        faction: eco
          ? localizar(i18n, "LAGUNAK.Espacios.Sensores.SinIdentificar")
          : String(contacto?.faction ?? localizar(i18n, "LAGUNAK.Facciones.SinFaccion")),
        // Sin lectura no se inventa un cero: se marca como no disponible, que es
        // distinto de «está encima de nosotros» o «va al norte».
        lectura: distancia === null || rumbo === null
          ? localizar(i18n, "LAGUNAK.Espacios.Sensores.SinLectura")
          : `${medida(distancia, entero(contacto?.precision) ?? 0, "")} · ${medida(
              rumbo,
              entero(contacto?.rumboPrecision) ?? 0,
              "°",
            )}`,
      };
    });
}

/** Filas del sondeo crudo del GM: coordenadas exactas, sin márgenes. */
export function filasCrudas(contactsPayload, i18n, localizarFaccion) {
  const contactos = Array.isArray(contactsPayload?.contacts) ? contactsPayload.contacts : [];
  return contactos
    .filter((entrada) => !entrada?.is_player)
    .slice(0, MAXIMO_FILAS)
    .map((entrada) => ({
      eco: false,
      callsign: String(entrada?.callsign ?? "?"),
      faction: entrada?.faction
        ? localizarFaccion(String(entrada.faction))
        : localizar(i18n, "LAGUNAK.Facciones.SinFaccion"),
      lectura: `${entero(entrada?.position?.x) ?? "—"}, ${entero(entrada?.position?.y) ?? "—"}`,
    }));
}

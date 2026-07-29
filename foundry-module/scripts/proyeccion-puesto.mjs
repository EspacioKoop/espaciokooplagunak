// Proyección del mismo frame por puesto (#331, paso 2).
//
// El paso 1 abrió la telemetría a la tripulación. Esto es lo siguiente que pedía
// el issue: una sola fuente —el frame que ya compone `ventana-nave.mjs`— y N
// lecturas de ella, una por puesto. Navegación mira vectores, ingeniería mira
// calor, sensores mira lo que no sabe identificar y comunicaciones mira quién
// es quién. Es la misma verdad; cambia qué se resalta y qué se aparta.
//
// LA REGLA, y es la que hace que esto no sea un filtro de Instagram: una
// proyección NO AÑADE NADA. Solo puede subrayar, atenuar o etiquetar con datos
// que el frame ya trae. Si el puente no publicó facción, comunicaciones no
// escribe «desconocida» —deja la etiqueta en null y el pintor no dibuja nada—,
// exactamente igual que el mapa no extrapola posiciones entre sondeos. Hay
// prueba de que quitando el énfasis se recupera el frame de entrada tal cual.
//
// Y no es un control de acceso. Lo que el GM no difunde no llega al frame; con
// la tripulación, `blips` viene vacío y las cuatro vistas se quedan vacías por
// sí solas. Atenuar no es ocultar: una vista que «esconde» algo que el cliente
// ya tiene no defiende nada. Quien decide qué sale del puente es el GM, y esa
// decisión vive en la difusión, no aquí.
//
// Puro: ni Foundry, ni DOM, ni red. El pintor solo consume la salida.

/** Los tres niveles. Más sería jerarquía inventada; menos, no se distingue. */
export const ENFASIS = Object.freeze(["alto", "normal", "tenue"]);

const PUESTOS = Object.freeze([
  "captain",
  "navigation",
  "engineering",
  "sensors",
  "communications",
  "weapons",
]);

/**
 * Proyecta un frame para un puesto.
 *
 * @param {object} frame el de `componerFrame`; se lee, no se toca.
 * @param {string|null} puesto
 * @param {{nave?: object, sistemas?: Array}} contexto lo que no está en el
 *   frame pero ya tiene la consola: la telemetría de la nave propia.
 * @returns {{puesto: string, blips: Array, destino: object|null,
 *   vector: object|null, anillos: Array, superposicion: object|null}}
 */
export function proyectarParaPuesto(frame, puesto, contexto = {}) {
  const clave = PUESTOS.includes(puesto) ? puesto : "captain";
  const blips = Array.isArray(frame?.blips) ? frame.blips : [];
  const destino = frame?.destino ?? null;

  return {
    puesto: clave,
    blips: blips.map((blip) => ({
      ...blip,
      enfasis: enfasisDe(clave, blip),
      etiqueta: etiquetaDe(clave, blip),
    })),
    // El destino no se atenúa nunca: es una decisión ya tomada por la mesa y
    // apagarla en la vista de otro puesto sería esconder una orden.
    destino: destino ? { ...destino, enfasis: clave === "navigation" ? "alto" : "normal" } : null,
    vector: clave === "navigation" ? vectorDe(contexto?.nave) : null,
    anillos: clave === "sensors" ? anillosDe(frame) : [],
    superposicion: clave === "engineering" ? superposicionTermica(contexto?.sistemas) : null,
  };
}

/**
 * Qué mira cada puesto de un contacto.
 *
 * - **sensores** vive de lo que no sabe: un contacto sin clase publicada sube a
 *   `alto` porque es justo su trabajo, y el resto se queda en normal.
 * - **comunicaciones** mira quién es: sube lo que tiene facción, que es lo
 *   único con lo que se puede hablar.
 * - **navegación** e **ingeniería** atenúan los contactos enteros. No es
 *   desprecio: es que su pantalla tiene otra cosa encima —el vector, el calor—
 *   y con los blips a plena intensidad no se leería.
 * - **capitán** y **armas** no tocan nada. El capitán necesita la foto sin
 *   editar, y una vista de armas que subraye blancos sola es una decisión de
 *   diseño que nadie ha tomado.
 */
function enfasisDe(puesto, blip) {
  if (blip?.esJugador) return "alto";
  switch (puesto) {
    case "sensors":
      return blip?.clase == null ? "alto" : "normal";
    case "communications":
      return blip?.faction ? "alto" : "tenue";
    case "navigation":
    case "engineering":
      return "tenue";
    default:
      return "normal";
  }
}

/**
 * La etiqueta es SOLO de comunicaciones, y solo con lo que hay.
 *
 * Sin indicativo no se escribe nada: un «?» sobre el mapa se lee como un dato
 * («hay algo sin identificar ahí») cuando en realidad significa que el puente
 * no publicó el campo. La ausencia de etiqueta ya es la ausencia de dato.
 */
function etiquetaDe(puesto, blip) {
  if (puesto !== "communications" || blip?.esJugador) return null;
  const indicativo = typeof blip?.callsign === "string" ? blip.callsign.trim() : "";
  if (indicativo === "" || indicativo === "?") return null;
  return blip?.faction ? `${indicativo} · ${blip.faction}` : indicativo;
}

/**
 * Vector de rumbo para navegación: adónde apunta el morro y cuánto se corre.
 *
 * En cabina el morro va SIEMPRE arriba —la proyección del frame ya rotó el
 * mundo—, así que el vector se dibuja hacia arriba y lo que informa es su
 * largo. Sin lectura de velocidad no hay vector: un vector de largo cero se
 * leería como «parada», y no saber a qué velocidad va no es ir a cero.
 */
function vectorDe(nave) {
  const velocidad = Number(nave?.velocity ?? nave?.speed);
  if (!Number.isFinite(velocidad)) return null;
  const maxima = Number(nave?.velocity_max ?? nave?.speed_max);
  const referencia = Number.isFinite(maxima) && maxima > 0 ? maxima : null;
  return {
    // Sin velocidad máxima publicada no se normaliza contra un número
    // inventado: se marca y el pintor dibuja un largo fijo.
    magnitud01: referencia === null ? null : Math.max(0, Math.min(1, velocidad / referencia)),
    velocidad,
  };
}

/**
 * Anillos de alcance para sensores. Salen de los propios contactos y no de una
 * escala inventada: el anillo exterior es el alcance del visor (que el frame ya
 * usa para decidir `dentro`) y el interior, su mitad. Dos anillos y no cinco
 * porque lo que aportan es escala, no precisión.
 */
function anillosDe(frame) {
  const hayAlcance = Array.isArray(frame?.blips) && frame.blips.length > 0;
  if (!hayAlcance) return [];
  return [
    { radio01: 0.5, tenue: true },
    { radio01: 1, tenue: false },
  ];
}

/**
 * Superposición térmica para ingeniería: el calor de cada sistema, ordenado de
 * más caliente a menos.
 *
 * Un sistema SIN lectura de calor no se pinta como frío —cero y «no se sabe» son
 * cosas distintas, la misma regla de #353— así que se aparta a una lista propia
 * en vez de colarse al final del orden como si estuviera a cero.
 */
function superposicionTermica(sistemas) {
  const filas = Array.isArray(sistemas) ? sistemas : [];
  const conLectura = filas.filter((fila) => Number.isFinite(fila?.heat));
  if (conLectura.length === 0 && filas.length === 0) return null;
  return {
    tipo: "calor",
    filas: conLectura
      .map((fila) => ({
        id: fila.id,
        nombre: fila.name,
        valor01: Math.max(0, Math.min(1, fila.heat / 100)),
        // El umbral es el mismo que ya usa la consola para el pico térmico: si
        // los dos sitios discrepasen, la superposición diría «caliente» donde la
        // ficha dice «normal» y nadie sabría cuál creer.
        critico: fila.heat > 80,
      }))
      .sort((a, b) => b.valor01 - a.valor01),
    sinLectura: filas.filter((fila) => !Number.isFinite(fila?.heat)).map((fila) => fila.id),
  };
}

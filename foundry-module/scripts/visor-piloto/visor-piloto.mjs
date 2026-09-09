// El visor del piloto (#362, última rebanada): lo que la nave tiene delante.
//
// ES LA PRIMERA SUPERFICIE 3D QUE INFORMA, y por eso llega la última. Las
// anteriores ambientan —el casco propio dice hacia dónde apuntas, la lámina dice
// qué forma tiene aquello, la cantina es un sitio— y ninguna era la única vía
// para un dato. Esta enseña lo que hay ahí fuera, así que hereda entera la regla
// de #362: la distancia y la marcación siguen en TEXTO, en la lista de
// contactos, y este visor es refuerzo. Si alguien apaga el 3D no pierde ni un
// número.
//
// LO QUE DIBUJA NO ES UNA LECTURA DE DISTANCIA. La profundidad de la escena está
// comprimida a propósito: un contacto a 28.000 y otro a 30.000 tienen que caber
// los dos en el cuadro y distinguirse, y a escala real el segundo sería el mismo
// píxel que el primero. La compresión es monótona —lo más cercano se ve más
// cerca, siempre— pero NO es proporcional, y por eso el número va aparte. Un
// visor que pareciera un telémetro y no lo fuera sería peor que no tenerlo.
//
// TODO PASA EN UN PLANO. La simulación es 2D: los contactos tienen `x` e `y` y
// no tienen altura. Repartirlos en vertical quedaría más bonito y sería inventar
// un dato que nadie ha medido, así que van todos a la altura del ojo y lo que
// los separa es la marcación, que es lo único que se sabe de verdad.
//
// EL MARGEN SE DIBUJA. Un eco de banda larga llega redondeado a 15° y sin
// identidad: se pinta como un bloque tan ANCHO como ese margen, en gris de «sin
// facción». Un eco lejano pintado con la misma silueta afilada que un contacto
// identificado sería exactamente la mentira que `contactos-degradados.mjs` evita
// en el origen; deshacerla al pintar no tendría ningún sentido.
//
// PSX y no GameCube, que es lo que el propio #362 propuso para esta superficie:
// esto se ve de reojo desde una cabina, sucio y diegético, mientras se pilota.
// Lo que se mira fijo —la lámina de reconocimiento— es lo que se ganó GameCube.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj, ni Math.random().
//
// Frontera de arte (#351): no declara ni un color. Todos entran de `paleta.mjs`.

import { PIXEL } from "../paleta.mjs";
import { componerEscena, fundirEscenas, mallaDesdeCasco, CASCO_POR_DEFECTO } from "../retro3d.mjs";
import { campoEstelar, proyectarEstrellas } from "../retro3d-estrellas.mjs";
import { colorFaccion } from "../ventana-nave.mjs";

/** Campo de visión del visor, en grados. Ancho como una luna delantera: lo que
 * importa aquí es cuánto sector cabe, no componer un cuadro. */
export const FOV = 62;

/** Dónde vive la banda de profundidad de la escena. Todo lo que se ve cae entre
 * estos dos, sea cual sea su distancia real: es la compresión que la cabecera
 * explica, escrita una vez y en un sitio. */
export const CERCA = 3.2;
export const LEJOS = 34;

/** Semilla del cielo. Fija y propia: dos pilotos de la misma mesa tienen que ver
 * el mismo vacío, y el de la cantina es otro sitio. */
export const SEMILLA_CIELO = 20362;

/**
 * Lleva una distancia de mundo a la profundidad de la escena.
 *
 * Raíz cuadrada y no lineal ni logarítmica. Lineal deja todo amontonado al
 * fondo, porque el alcance largo es dos órdenes de magnitud mayor que el corto y
 * la banda de cerca se queda vacía. Logarítmica hace lo contrario: exagera tanto
 * lo cercano que un contacto a 200 y otro a 2.000 parecen igual de encima. La
 * raíz reparte, y sobre todo conserva el orden, que es lo único que este visor
 * promete.
 *
 * Fuera de alcance se acota en vez de rechazarse: quien llama ya filtró por
 * radar, y un contacto justo en el borde no es un error.
 *
 * Una lectura ILEGIBLE, en cambio, devuelve `null` y no un sitio de respaldo.
 * Colocarla al fondo o delante son las dos mentiras posibles —«está lejísimos» y
 * «lo tienes encima»— y la segunda, en un visor de pilotaje, es peligrosa. Lo
 * que no se sabe dónde está no se dibuja.
 */
export function profundidadDe(distancia, alcanceLargo) {
  const d = numeroLegible(distancia);
  const largo = numeroLegible(alcanceLargo);
  if (d === null || largo === null || !(largo > 0)) return null;
  const t = Math.sqrt(Math.max(0, Math.min(1, d / largo)));
  return CERCA + t * (LEJOS - CERCA);
}

/**
 * Marcación de un contacto RELATIVA al morro, en radianes.
 *
 * Los contactos llegan con marcación absoluta —0 al norte del mundo, como todo
 * el módulo— y el piloto mira hacia donde apunta la nave. Sin esta resta el
 * visor enseñaría el sector girado respecto a lo que se ve por la ventana, que
 * es la peor forma posible de equivocarse en una cabina.
 */
export function marcacionRelativa(rumboContacto, rumboPropio) {
  // `Number(null)` es 0 y `Number("")` también, así que convertir a la brava
  // colocaría en la PROA a todo contacto sin marcación legible. Es justo el
  // fallo que este módulo no se puede permitir: inventar que algo está delante.
  const contacto = numeroLegible(rumboContacto);
  if (contacto === null) return null;
  // El rumbo propio sí puede faltar, y ahí no se descarta nada: se enseñan
  // marcaciones absolutas, que es peor que restarlas bien y mucho mejor que
  // restar un cero disfrazado de rumbo. La consola dice en texto si hay lectura.
  const propio = numeroLegible(rumboPropio) ?? 0;
  const relativa = contacto - propio;
  return ((relativa * Math.PI) / 180 + Math.PI * 4) % (Math.PI * 2);
}

/** Un número de verdad, o `null`. Lo que no es número no se convierte: se
 * rechaza, porque una conversión silenciosa aquí es un dato inventado. */
function numeroLegible(valor) {
  if (typeof valor !== "number") return null;
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Dónde cae un contacto en el mundo de la escena.
 *
 * La cámara está en el origen mirando a +z, que es el morro. Un contacto por la
 * proa (marcación 0) va delante; uno por estribor (90°) va a la derecha. `y` es
 * siempre 0 por lo que dice la cabecera: no hay altura que representar.
 */
export function situarContacto(contacto, { rumboPropio = 0, alcanceLargo } = {}) {
  const angulo = marcacionRelativa(contacto?.rumboDeg, rumboPropio);
  if (angulo === null) return null;
  const r = profundidadDe(contacto?.distancia, alcanceLargo);
  if (r === null) return null;
  return [Math.sin(angulo) * r, 0, Math.cos(angulo) * r];
}

/**
 * La malla de un contacto y su color, según lo que se sepa de él.
 *
 * Con identidad conocida —indicativo y facción, escaneo real del juego, no
 * cercanía (#462)— se dibuja una silueta de nave con su color, la misma que ya
 * usan el mapa vivo y la lámina. Sin identidad no se sabe ni quién es: se
 * dibuja un bloque ancho y gris, y el ancho es el margen de marcación
 * traducido a tamaño. Cuanto peor es la lectura, más gordo es el borrón, que
 * es lo honesto.
 */
export function piezaDeContacto(contacto, { alcanceLargo } = {}) {
  const eco = typeof contacto?.callsign !== "string";
  if (!eco) {
    return {
      malla: mallaDesdeCasco(CASCO_POR_DEFECTO),
      color: colorFaccion(contacto?.faction ?? null, false),
    };
  }
  // El margen en grados se lleva a media anchura por la distancia a la que va a
  // caer el bloque: un eco con 15° de margen a diez unidades es ancho de verdad.
  const margen = numeroLegible(contacto?.rumboPrecision);
  // Sin profundidad legible el contacto ni siquiera se colocará —`situarContacto`
  // lo descarta antes—, así que aquí basta con no reventar: el mínimo sirve.
  const r = profundidadDe(contacto?.distancia, alcanceLargo) ?? CERCA;
  const semiancho = margen !== null && margen > 0
    ? Math.max(0.35, Math.tan((margen * Math.PI) / 360) * r)
    : 0.35;
  return { malla: bloqueEco(semiancho), color: PIXEL.sinFaccion };
}

/**
 * El bloque de un eco: una caja tan ancha como su incertidumbre y deliberadamente
 * roma. No es una nave y no tiene que parecerlo — es «hay algo por ahí».
 */
function bloqueEco(semiancho) {
  const alto = 0.3;
  const fondo = 0.3;
  const vertices = [
    [-semiancho, -alto, -fondo],
    [semiancho, -alto, -fondo],
    [semiancho, alto, -fondo],
    [-semiancho, alto, -fondo],
    [-semiancho, -alto, fondo],
    [semiancho, -alto, fondo],
    [semiancho, alto, fondo],
    [-semiancho, alto, fondo],
  ];
  // Antihorarias vistas desde fuera, que es lo que `componerEscena` descarta.
  const caras = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 4, 7, 3],
    [1, 2, 6, 5],
    [3, 7, 6, 2],
    [0, 1, 5, 4],
  ];
  return { vertices, caras };
}

/**
 * Compone lo que el piloto tiene delante.
 *
 * @param {{contactos: Array, alcance?: {largo?: number}}|null} sensores la
 *   lectura degradada, tal como la publica `contactos-degradados.mjs`. `null`
 *   es «no hay sondeo», que NO es «no hay nada»: devuelve `null` y el visor se
 *   apaga en vez de enseñar un sector vacío que nadie ha comprobado (#353).
 * @param {object} opciones
 * @param {number} [opciones.rumboPropio] rumbo de la nave, para restar.
 * @returns {{ancho, alto, epoca, poligonos, estrellas}|null} misma forma que
 *   devuelve `componerEscena`, para que el pintor no distinga.
 */
export function componerVisorPiloto(sensores, opciones = {}) {
  if (!sensores || !Array.isArray(sensores.contactos)) return null;

  const {
    ancho = 192,
    alto = 108,
    epoca = "psx",
    fondo = null,
    rumboPropio = 0,
  } = opciones;
  const alcanceLargo = Number(sensores.alcance?.largo);

  const comun = { ancho, alto, epoca, fov: FOV, fondo, cerca: 1, lejos: LEJOS + 6 };

  const partes = [];
  for (const contacto of sensores.contactos) {
    // La nave propia no se dibuja: se está DENTRO de ella, y un contacto en el
    // origen sería una nave clavada en la cara del piloto.
    if (contacto?.banda === "propia" || contacto?.esJugador) continue;
    const posicion = situarContacto(contacto, { rumboPropio, alcanceLargo });
    if (!posicion) continue;
    const { malla, color } = piezaDeContacto(contacto, { alcanceLargo });
    partes.push(componerEscena(malla, { ...comun, color, posicion, yaw: 0, pitch: 0 }));
  }

  // Un solo orden de pintor global para todas las piezas (`fundirEscenas`,
  // #510): concatenar dos listas ya ordenadas da una lista incorrecta en cuanto
  // dos piezas se solapan, y hasta #510 cada consumidor repetía este mismo
  // fundido a mano.
  const { poligonos } = fundirEscenas(partes);

  // El cielo va detrás de todo y NO gira con el rumbo por ahora: son estrellas
  // fijas de fondo, no una lectura. Girarlas con el morro sugeriría que dicen
  // dónde estás, y no lo dicen.
  const estrellas = proyectarEstrellas(campoEstelar(SEMILLA_CIELO, { cantidad: 70 }), {
    ancho,
    alto,
    epoca,
    fov: FOV,
    yaw: 0,
    pitch: 0,
  });

  return {
    ancho,
    alto,
    epoca: partes[0]?.epoca ?? epoca,
    poligonos,
    estrellas,
    // Cuántos contactos han entrado en el cuadro. No es decoración: la vista lo
    // usa para no encender un visor que no tiene nada que enseñar, y las pruebas
    // para comprobar que un sondeo vacío no es lo mismo que no haber sondeado.
    dibujados: partes.length,
  };
}

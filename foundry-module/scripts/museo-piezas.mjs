// Las piezas del museo (#598): tres fichas, tres mallas, y el vínculo entre las
// dos mitades.
//
// TRES Y NO TREINTA, que es la disciplina que #590 midió y que funcionó: una
// pieza primero para saber lo que cuesta, y solo después el lote. Aquí el precio
// no es la conversión —esa ya está pagada, las dieciocho mallas están en el
// árbol— sino la CARTELA: escribir de cada pieza qué es exactamente lo que se
// está enseñando. Ese texto no lo genera ninguna herramienta.
//
// POR QUÉ ESTAS TRES. No son las tres más bonitas: son las tres que obligan a
// decir tres cosas distintas.
//
//   - **Venus de Milo** — no es el mármol del Louvre. Es el escaneo de un
//     VACIADO EN YESO que hay en Copenhague. Una copia de una copia, y la
//     cartela lo dice antes que nada.
//   - **Amasis II** — misma naturaleza, otra cultura y dos mil años antes: sirve
//     para que la sala no sea «tres griegas» y para que el mismo aviso de
//     vaciado se lea como norma de la casa y no como excepción.
//   - **León de Al-Lāt** — el caso duro. No es un escaneo de nada: alguien
//     esculpió cómo creía que era DESPUÉS de que el ISIL lo destruyera. Si la
//     cartela dijera «así era», el museo estaría mintiendo con una pieza que
//     nadie puede ir a comprobar.
//
// LA PROCEDENCIA NO SE INVENTA AQUÍ: sale de `docs/PROCEDENCIA_ASSETS.md` y de
// las `FICHAS` de `tools/convertir-estatua.mjs`, que es donde vive el dato. Una
// prueba compara las dos copias y falla si se separan — el mismo remedio que la
// planta del Phobos usa contra su `.lua` (#540). Copiar sin guarda es lo que
// convierte una licencia en un problema.
//
// Puro: datos y nada más.

import { FARAO_AMASIS } from "../data/mallas/farao-amasis.mjs";
import { LEON_AL_LAT } from "../data/mallas/leon-al-lat.mjs";
import { VENUS_DE_MILO } from "../data/mallas/venus-de-milo.mjs";
import { mallaCuadro } from "./nave-cuadro.mjs";

/**
 * De ID de pieza a geometría. Es el vínculo del que hablaba #598: el catálogo de
 * abajo solo dice `malla: "venus-de-milo"`, y quien monte la sala resuelve ese
 * nombre aquí. El validador comprueba que todo nombre esté en este registro, así
 * que una ficha sin malla no llega a la sala: falla antes.
 */
export const MALLAS_MUSEO = Object.freeze({
  "venus-de-milo": VENUS_DE_MILO,
  "farao-amasis": FARAO_AMASIS,
  "leon-al-lat": LEON_AL_LAT,
  // Cuadros (#836): pixelart `obra-propia` generado por el módulo, sin procedencia
  // externa. Cada uno es su propia malla (marco + plano del lienzo) y entra aquí
  // como una más, así que el validador del catálogo sigue intacto.
  "cuadro-1": mallaCuadro(83601),
  "cuadro-2": mallaCuadro(83602),
});

/** Dónde consta la licencia del lote del SMK: 186 ficheros bajo la misma
 *  plantilla `{{Licensed-PD-Art|PD-old-100-expired|Cc-zero}}`. Enlace a la
 *  categoría y no al fichero, porque es la categoría la que declara la
 *  dedicación CC0 del museo. */
const CATEGORIA_SMK = "https://commons.wikimedia.org/wiki/Category:3D_models_from_Statens_Museum_for_Kunst";

const PROCEDENCIA_SMK = Object.freeze({
  kind: "cc",
  source: "Statens Museum for Kunst (Copenhague), Kongelige Afstøbningssamling",
  license: "CC0 1.0 sobre el escaneo; la obra, dominio público",
  source_url: CATEGORIA_SMK,
});

export const CATALOGO_MUSEO = Object.freeze({
  formato: "espaciokoop-piezas",
  version: 1,
  piezas: Object.freeze([
    Object.freeze({
      id: "venus-de-milo",
      malla: "venus-de-milo",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Afrodita de Melos (Venus de Milo)",
        en: "Aphrodite of Melos (Venus de Milo)",
      }),
      cartela: Object.freeze({
        es: "Lo que hay delante no es el mármol del Louvre: es un vaciado en yeso"
          + " de la Colección Real de Vaciados de Copenhague, escaneado y cedido"
          + " al dominio público por su museo. Del original griego, esculpido"
          + " hacia el 130 a. C., esta copia conserva la pose y el paño; los"
          + " brazos ya faltaban cuando se hizo el molde.",
        en: "This is not the Louvre marble: it is a plaster cast from the Royal"
          + " Cast Collection in Copenhagen, scanned and released to the public"
          + " domain by its museum. Of the Greek original, carved around 130 BC,"
          + " this copy keeps the pose and the drapery; the arms were already"
          + " missing when the mould was taken.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "farao-amasis",
      malla: "farao-amasis",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Retrato del faraón Amasis II",
        en: "Portrait of pharaoh Amasis II",
      }),
      cartela: Object.freeze({
        es: "Amasis II reinó en Egipto entre el 570 y el 526 a. C., cuatro"
          + " siglos antes que la Afrodita de al lado. También esto es un"
          + " vaciado en yeso escaneado, no la piedra original: la misma norma"
          + " de la casa vale para las tres piezas de esta sala.",
        en: "Amasis II ruled Egypt between 570 and 526 BC, four centuries before"
          + " the Aphrodite next to it. This too is a scanned plaster cast, not"
          + " the original stone: the same house rule applies to all three"
          + " pieces in this room.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "leon-al-lat",
      malla: "leon-al-lat",
      naturaleza: "reconstruccion",
      nombre: Object.freeze({
        es: "León de Al-Lāt, de Palmira",
        en: "Lion of Al-Lāt, from Palmyra",
      }),
      cartela: Object.freeze({
        es: "Esta pieza no se escaneó de ninguna estatua, porque la estatua ya no"
          + " existe: el León del templo de Al-Lāt en Palmira fue destruido en"
          + " 2015. Lo que se ve es una RECONSTRUCCIÓN digital hecha después,"
          + " por Georges Dahdouh para el proyecto NEWPALMYRA. No es como era:"
          + " es como alguien creyó que era, y cedió al dominio público para que"
          + " al menos quedara eso.",
        en: "This piece was not scanned from any statue, because the statue no"
          + " longer exists: the Lion of the temple of Al-Lāt in Palmyra was"
          + " destroyed in 2015. What you see is a digital RECONSTRUCTION made"
          + " afterwards, by Georges Dahdouh for the NEWPALMYRA project. It is"
          + " not how it was: it is how someone believed it was, and released to"
          + " the public domain so that at least that would remain.",
      }),
      provenance: Object.freeze({
        kind: "cc",
        source: "Georges Dahdouh, optimización de Jim Ellis. NEWPALMYRA / RSSSD",
        license: "CC0 1.0 (revisión de licencia de Commons, 2018-02-22)",
        source_url: "https://commons.wikimedia.org/wiki/File:Asad_Al-Lat.stl",
      }),
    }),
    // Cuadros (#836): obra-propia, pixelart generado por el módulo. Sin procedencia
    // externa que gestionar (la guarda de procedencia de #598 los salta), y sin
    // tipo de ficha nuevo: reusan la acción `cartela` de las piezas sobre pedestal.
    Object.freeze({
      id: "cuadro-1",
      malla: "cuadro-1",
      naturaleza: "obra-propia",
      nombre: Object.freeze({
        es: "Paisaje abstracto I (cuadro generado)",
        en: "Abstract landscape I (generated painting)",
      }),
      cartela: Object.freeze({
        es: "Panel decorativo pintado por el propio módulo, no un escaneo ni una copia"
          + " de nada: un paisaje abstracto de pixelart a veinte celdas por metro, sobre"
          + " el muro lateral con el mismo primitivo que la piel de la sala. No enseña"
          + " nada legible —no es un mapa, no es un diagrama—; está para que el muro no"
          + " quede desnudo.",
        en: "Decorative panel painted by the module itself, not a scan or a copy of"
          + " anything: an abstract pixelart landscape at twenty cells per metre, on the"
          + " side wall with the same primitive as the room's skin. It teaches nothing"
          + " readable —not a map, not a diagram—; it is there so the wall is not bare.",
      }),
      provenance: Object.freeze({
        kind: "original",
        source: "Pixelart generado por el módulo Espaciokoop Lagunak (obra propia, sin fuente externa)",
        license: "CC0 1.0 (obra propia del módulo)",
      }),
    }),
    Object.freeze({
      id: "cuadro-2",
      malla: "cuadro-2",
      naturaleza: "obra-propia",
      nombre: Object.freeze({
        es: "Paisaje abstracto II (cuadro generado)",
        en: "Abstract landscape II (generated painting)",
      }),
      cartela: Object.freeze({
        es: "Segundo panel del módulo en el muro lateral opuesto. Mismo criterio que el"
          + " anterior: paisaje abstracto de pixelart, nada que se lea como instrumento."
          + " La semilla distinta lo hace un cuadro distinto, no una copia del de al lado.",
        en: "Second module panel on the opposite side wall. Same rule as the previous"
          + " one: abstract pixelart landscape, nothing that reads as an instrument. A"
          + " different seed makes it a different painting, not a copy of the other.",
      }),
      provenance: Object.freeze({
        kind: "original",
        source: "Pixelart generado por el módulo Espaciokoop Lagunak (obra propia, sin fuente externa)",
        license: "CC0 1.0 (obra propia del módulo)",
      }),
    }),
  ]),
});

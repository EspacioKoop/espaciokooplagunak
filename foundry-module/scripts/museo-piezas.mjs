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
import { CABALLO_MARCO_AURELIO } from "../data/mallas/caballo-marco-aurelio.mjs";
import { DAVID_CABEZA } from "../data/mallas/david-cabeza.mjs";
import { DORIFORO } from "../data/mallas/doriforo.mjs";
import { HERAKLES_FARNESE } from "../data/mallas/herakles-farnese.mjs";
import { HOMERO } from "../data/mallas/homero.mjs";
import { JABALI } from "../data/mallas/jabali.mjs";
import { JULIO_CESAR } from "../data/mallas/julio-cesar.mjs";
import { KORE_CHITON } from "../data/mallas/kore-chiton.mjs";
import { LAOCOONTE } from "../data/mallas/laocoonte.mjs";
import { LOBA_CAPITOLINA } from "../data/mallas/loba-capitolina.mjs";
import { MARCO_AURELIO } from "../data/mallas/marco-aurelio.mjs";
import { PENELOPE } from "../data/mallas/penelope.mjs";
import { POSEIDON_ARTEMISION } from "../data/mallas/poseidon-artemision.mjs";
import { PRINSESSE_AMARNA } from "../data/mallas/prinsesse-amarna.mjs";
import { VENUS_CAPITOLINA } from "../data/mallas/venus-capitolina.mjs";

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
  "caballo-marco-aurelio": CABALLO_MARCO_AURELIO,
  "david-cabeza": DAVID_CABEZA,
  "doriforo": DORIFORO,
  "herakles-farnese": HERAKLES_FARNESE,
  "homero": HOMERO,
  "jabali": JABALI,
  "julio-cesar": JULIO_CESAR,
  "kore-chiton": KORE_CHITON,
  "laocoonte": LAOCOONTE,
  "loba-capitolina": LOBA_CAPITOLINA,
  "marco-aurelio": MARCO_AURELIO,
  "penelope": PENELOPE,
  "poseidon-artemision": POSEIDON_ARTEMISION,
  "prinsesse-amarna": PRINSESSE_AMARNA,
  "venus-capitolina": VENUS_CAPITOLINA,
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
      // El escaneo llegó mirando hacia +z: sin girar, quien entra por la
      // puerta ve el paño de la espalda y no el torso. Ver `girada180` en
      // `colocarPieza` (museo-escena.mjs).
      girada180: true,
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
    Object.freeze({
      id: "caballo-marco-aurelio",
      malla: "caballo-marco-aurelio",
      naturaleza: "escaneo-de-vaciado",
      // Sin girar, el mirador ve la grupa del caballo y no su cabeza.
      girada180: true,
      nombre: Object.freeze({
        es: "Caballo de la estatua ecuestre de Marco Aurelio",
        en: "Horse from the equestrian statue of Marcus Aurelius",
      }),
      cartela: Object.freeze({
        es: "Este caballo es parte de la estatua ecuestre de Marco Aurelio, un"
          + " símbolo del poder imperial romano. La estatua original, que se"
          + " conserva en Roma, muestra al emperador a caballo. Este vaciado en"
          + " yeso, escaneado y cedido al dominio público, permite apreciar los"
          + " detalles de la escultura sin necesidad de viajar a Italia.",
        en: "This horse is part of the equestrian statue of Marcus Aurelius, a"
          + " symbol of Roman imperial power. The original statue, preserved in"
          + " Rome, shows the emperor on horseback. This plaster cast, scanned"
          + " and released into the public domain, allows us to appreciate the"
          + " details of the sculpture without needing to travel to Italy.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "david-cabeza",
      malla: "david-cabeza",
      naturaleza: "escaneo-de-vaciado",
      // Sin girar, el mirador ve la nuca y no la cara.
      girada180: true,
      nombre: Object.freeze({
        es: "Cabeza del David, de Miguel Ángel",
        en: "Head of David, by Michelangelo",
      }),
      cartela: Object.freeze({
        es: "La cabeza del David de Miguel Ángel, esculpida entre 1501 y 1504,"
          + " es una de las obras más icónicas del Renacimiento. Este vaciado en"
          + " yeso, escaneado de la Colección Real de Vaciados de Copenhague,"
          + " captura la expresión serena y la perfección anatómica del original."
          + " La obra original, en mármol, se encuentra en la Galería de la"
          + " Academia de Florencia.",
        en: "The head of Michelangelo's David, carved between 1501 and 1504, is"
          + " one of the most iconic works of the Renaissance. This plaster cast,"
          + " scanned from the Royal Cast Collection in Copenhagen, captures the"
          + " serene expression and anatomical perfection of the original. The"
          + " original marble work is located in the Accademia Gallery in"
          + " Florence.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "doriforo",
      malla: "doriforo",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Doríforo (el portador de lanza), de Policleto",
        en: "Doryphoros (the spear-bearer), by Polykleitos",
      }),
      cartela: Object.freeze({
        es: "El Doríforo de Policleto, esculpido alrededor del 440 a. C., es una"
          + " de las obras más influyentes de la antigua Grecia. Representa a un"
          + " joven atleta en equilibrio perfecto, un ejemplo del canon de"
          + " proporciones ideales. Este vaciado en yeso, escaneado de la"
          + " Colección Real de Vaciados, permite estudiar la obra sin las"
          + " limitaciones de la distancia o el tiempo.",
        en: "Polykleitos' Doryphoros, carved around 440 BC, is one of the most"
          + " influential works of ancient Greece. It depicts a young athlete in"
          + " perfect balance, an example of the canon of ideal proportions. This"
          + " plaster cast, scanned from the Royal Cast Collection, allows us to"
          + " study the work without the limitations of distance or time.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "herakles-farnese",
      malla: "herakles-farnese",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Heracles Farnesio",
        en: "Farnese Hercules",
      }),
      cartela: Object.freeze({
        es: "El Heracles Farnesio, una copia romana de un original griego del"
          + " siglo IV a. C., muestra al héroe en un momento de descanso tras"
          + " sus trabajos. La escultura, famosa por su dinamismo y detalle"
          + " anatómico, se conserva en el Museo Arqueológico Nacional de"
          + " Nápoles. Este vaciado en yeso permite apreciar la obra desde"
          + " cualquier ángulo.",
        en: "The Farnese Hercules, a Roman copy of a Greek original from the 4th"
          + " century BC, shows the hero at rest after his labors. The sculpture,"
          + " famous for its dynamism and anatomical detail, is preserved in the"
          + " National Archaeological Museum of Naples. This plaster cast allows"
          + " us to appreciate the work from any angle.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "homero",
      malla: "homero",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Retrato de Homero",
        en: "Portrait of Homer",
      }),
      cartela: Object.freeze({
        es: "Este retrato de Homero, el legendario poeta griego autor de la"
          + " Ilíada y la Odisea, es una representación idealizada del siglo II"
          + " d. C. La escultura, basada en tradiciones antiguas, muestra al"
          + " poeta con barba y expresión pensativa. Este vaciado en yeso,"
          + " escaneado de la Colección Real de Vaciados, permite estudiar la"
          + " iconografía clásica.",
        en: "This portrait of Homer, the legendary Greek poet author of the"
          + " Iliad and the Odyssey, is an idealized representation from the 2nd"
          + " century AD. The sculpture, based on ancient traditions, shows the"
          + " poet with a beard and a thoughtful expression. This plaster cast,"
          + " scanned from the Royal Cast Collection, allows us to study classical"
          + " iconography.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "jabali",
      malla: "jabali",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Jabalí sentado (el Porcellino)",
        en: "Seated Boar (the Porcellino)",
      }),
      cartela: Object.freeze({
        es: "El Jabalí sentado, conocido como el Porcellino, es una escultura"
          + " helenística que representa a un jabalí en posición de descanso. La"
          + " obra, famosa por su realismo y detalle, ha sido replicada en"
          + " numerosas fuentes y esculturas decorativas. Este vaciado en yeso,"
          + " escaneado de la Colección Real de Vaciados, captura la textura y"
          + " forma del original.",
        en: "The Seated Boar, known as the Porcellino, is a Hellenistic sculpture"
          + " depicting a boar in a resting position. The work, famous for its"
          + " realism and detail, has been replicated in numerous fountains and"
          + " decorative sculptures. This plaster cast, scanned from the Royal"
          + " Cast Collection, captures the texture and form of the original.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "julio-cesar",
      malla: "julio-cesar",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Retrato de Julio César",
        en: "Portrait of Julius Caesar",
      }),
      cartela: Object.freeze({
        es: "Este retrato de Julio César, el famoso líder romano, muestra al"
          + " dictador con rasgos realistas y una expresión de autoridad. La"
          + " escultura, basada en retratos contemporáneos, es un ejemplo del"
          + " arte retratista romano. Este vaciado en yeso, escaneado de la"
          + " Colección Real de Vaciados, permite estudiar la representación del"
          + " poder en la antigua Roma.",
        en: "This portrait of Julius Caesar, the famous Roman leader, shows the"
          + " dictator with realistic features and an expression of authority. The"
          + " sculpture, based on contemporary portraits, is an example of Roman"
          + " portrait art. This plaster cast, scanned from the Royal Cast"
          + " Collection, allows us to study the representation of power in"
          + " ancient Rome.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "kore-chiton",
      malla: "kore-chiton",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Koré con quitón y epíblema",
        en: "Kore with chiton and epiblema",
      }),
      cartela: Object.freeze({
        es: "Esta koré, una estatua femenina de la antigua Grecia, lleva un"
          + " quitón y un epíblema, prendas típicas de la época arcaica. Las"
          + " korai, a diferencia de los kouroi masculinos, suelen representar a"
          + " doncellas con vestimentas detalladas. Este vaciado en yeso,"
          + " escaneado de la Colección Real de Vaciados, captura los pliegues y"
          + " detalles de la vestimenta.",
        en: "This kore, a female statue from ancient Greece, wears a chiton and"
          + " an epiblema, typical garments of the Archaic period. The korai, unlike"
          + " the male kouroi, often represent maidens with detailed clothing. This"
          + " plaster cast, scanned from the Royal Cast Collection, captures the"
          + " folds and details of the garment.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "laocoonte",
      malla: "laocoonte",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Laocoonte y sus hijos",
        en: "Laocoön and His Sons",
      }),
      cartela: Object.freeze({
        es: "El grupo escultórico de Laocoonte y sus hijos, descubierto en Roma"
          + " en 1506, es una obra maestra del arte helenístico. Representa al"
          + " sacerdote troyano y sus hijos siendo atacados por serpientes, un"
          + " episodio de la Guerra de Troya. Este vaciado en yeso, escaneado de"
          + " la Colección Real de Vaciados, permite apreciar el dramatismo y la"
          + " tensión de la escena.",
        en: "The sculptural group of Laocoön and His Sons, discovered in Rome in"
          + " 1506, is a masterpiece of Hellenistic art. It depicts the Trojan"
          + " priest and his sons being attacked by snakes, an episode from the"
          + " Trojan War. This plaster cast, scanned from the Royal Cast"
          + " Collection, allows us to appreciate the drama and tension of the"
          + " scene.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "loba-capitolina",
      malla: "loba-capitolina",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Loba Capitolina",
        en: "Capitoline Wolf",
      }),
      cartela: Object.freeze({
        es: "La Loba Capitolina es una escultura que representa a la loba que,"
          + " según la leyenda, amamantó a Rómulo y Remo, los fundadores de"
          + " Roma. La obra, un símbolo de la ciudad eterna, se conserva en los"
          + " Museos Capitolinos. Este vaciado en yeso, escaneado de la"
          + " Colección Real de Vaciados, captura la forma y textura del"
          + " original.",
        en: "The Capitoline Wolf is a sculpture depicting the she-wolf that,"
          + " according to legend, nursed Romulus and Remus, the founders of"
          + " Rome. The work, a symbol of the eternal city, is preserved in the"
          + " Capitoline Museums. This plaster cast, scanned from the Royal Cast"
          + " Collection, captures the shape and texture of the original.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "marco-aurelio",
      malla: "marco-aurelio",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Retrato de Marco Aurelio, emperador (161–180 d. C.)",
        en: "Portrait of Emperor Marcus Aurelius (161–180 AD)",
      }),
      cartela: Object.freeze({
        es: "Este retrato de Marco Aurelio, emperador romano y filósofo estoico,"
          + " muestra al gobernante con una expresión serena y pensativa. La"
          + " escultura, un ejemplo del arte retratista romano, captura los"
          + " rasgos del emperador con gran detalle. Este vaciado en yeso,"
          + " escaneado de la Colección Real de Vaciados, permite estudiar la"
          + " representación del poder y la sabiduría en la antigua Roma.",
        en: "This portrait of Marcus Aurelius, Roman emperor and Stoic philosopher,"
          + " shows the ruler with a serene and thoughtful expression. The"
          + " sculpture, an example of Roman portrait art, captures the emperor's"
          + " features in great detail. This plaster cast, scanned from the Royal"
          + " Cast Collection, allows us to study the representation of power and"
          + " wisdom in ancient Rome.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "penelope",
      malla: "penelope",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Penélope sentada",
        en: "Seated Penelope",
      }),
      cartela: Object.freeze({
        es: "Esta escultura representa a Penélope, la fiel esposa de Odiseo, en"
          + " una posición sentada y pensativa. La obra, inspirada en la"
          + " literatura homérica, muestra a Penélope esperando el regreso de su"
          + " esposo. Este vaciado en yeso, escaneado de la Colección Real de"
          + " Vaciados, captura la expresión de esperanza y melancolía de la"
          + " figura.",
        en: "This sculpture depicts Penelope, the faithful wife of Odysseus, in a"
          + " seated and thoughtful position. The work, inspired by Homeric"
          + " literature, shows Penelope waiting for her husband's return. This"
          + " plaster cast, scanned from the Royal Cast Collection, captures the"
          + " expression of hope and melancholy of the figure.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "poseidon-artemision",
      malla: "poseidon-artemision",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Poseidón (o Zeus) de Artemisión",
        en: "Poseidon (or Zeus) of Artemision",
      }),
      cartela: Object.freeze({
        es: "El Poseidón de Artemisión, una escultura de bronce del siglo V a. C.,"
          + " representa al dios del mar en una pose dinámica, como si estuviera"
          + " a punto de lanzar su tridente. La obra, descubierta en el cabo"
          + " Artemisión, es un ejemplo del arte griego clásico. Este vaciado en"
          + " yeso, escaneado de la Colección Real de Vaciados, permite"
          + " apreciar la forma y el movimiento de la escultura.",
        en: "The Poseidon of Artemision, a bronze sculpture from the 5th century"
          + " BC, depicts the sea god in a dynamic pose, as if about to throw his"
          + " trident. The work, discovered at Cape Artemision, is an example of"
          + " classical Greek art. This plaster cast, scanned from the Royal Cast"
          + " Collection, allows us to appreciate the form and movement of the"
          + " sculpture.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "prinsesse-amarna",
      malla: "prinsesse-amarna",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Princesa de Amarna",
        en: "Princess of Amarna",
      }),
      cartela: Object.freeze({
        es: "Esta escultura representa a una princesa de la corte de Akenatón, el"
          + " faraón que introdujo el culto a Atón en el antiguo Egipto. La obra,"
          + " típica del estilo de Amarna, se caracteriza por sus formas"
          + " naturalistas y expresivas. Este vaciado en yeso, escaneado de la"
          + " Colección Real de Vaciados, captura los rasgos distintivos del"
          + " período.",
        en: "This sculpture depicts a princess from the court of Akhenaten, the"
          + " pharaoh who introduced the cult of Aten in ancient Egypt. The work,"
          + " typical of the Amarna style, is characterized by its naturalistic"
          + " and expressive forms. This plaster cast, scanned from the Royal Cast"
          + " Collection, captures the distinctive features of the period.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
    Object.freeze({
      id: "venus-capitolina",
      malla: "venus-capitolina",
      naturaleza: "escaneo-de-vaciado",
      nombre: Object.freeze({
        es: "Venus Capitolina",
        en: "Capitoline Venus",
      }),
      cartela: Object.freeze({
        es: "La Venus Capitolina es una escultura romana que representa a la"
          + " diosa del amor y la belleza. La obra, inspirada en modelos"
          + " griegos, muestra a la diosa en una pose elegante y serena. Este"
          + " vaciado en yeso, escaneado de la Colección Real de Vaciados,"
          + " permite estudiar la representación de la belleza ideal en la"
          + " antigüedad.",
        en: "The Capitoline Venus is a Roman sculpture depicting the goddess of"
          + " love and beauty. The work, inspired by Greek models, shows the"
          + " goddess in an elegant and serene pose. This plaster cast, scanned"
          + " from the Royal Cast Collection, allows us to study the"
          + " representation of ideal beauty in antiquity.",
      }),
      provenance: PROCEDENCIA_SMK,
    }),
  ]),
});

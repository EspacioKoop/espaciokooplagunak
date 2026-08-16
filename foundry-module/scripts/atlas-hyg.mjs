// Adaptador del catálogo estelar HYG al formato de atlas de #213 (#568).
//
// QUÉ RESUELVE. `catalogo-cosmografico.mjs` define un formato de atlas que exige
// procedencia y licencia POR ENTRADA, y no tenía a quién aplicárselo: las
// entradas había que escribirlas a mano, una a una, y un atlas escrito a mano de
// sistemas estelares es contenido inventado con el coste de mantenerlo. HYG trae
// el cielo REAL —Hipparcos, Yale, Gliese, Tycho-2, Gaia DR3— con los nombres
// propios oficiales de la IAU. Esto lo traduce.
//
// NO INVENTA NADA, Y ESA ES LA REGLA. Cada entrada sale de columnas del CSV:
// nombre propio, tipo espectral, distancia y magnitud. No hay descripciones de
// ambientación, ni facciones, ni historia — eso es contenido de campaña y lo
// decide quien juega, no quien importa datos. Un resumen que dijera «antigua
// colonia minera» sería exactamente la infracción de #526 que este proyecto
// lleva evitando en todas las capas.
//
// SOLO ESTRELLAS CON NOMBRE PROPIO DE LA IAU. HYG trae ~120.000 filas y el
// formato admite 2.000 entradas, así que hay que cortar por algún sitio. Se
// corta por «tiene nombre propio» y no por brillo ni por distancia porque es el
// único corte que produce un atlas NOMBRABLE: una mesa de juego dice «vamos a
// Aldebarán», no «vamos a HIP 21421». Son ~450 estrellas, entran de sobra.
//
// EL CSV NO ESTÁ EN EL REPOSITORIO, Y ES A PROPÓSITO. HYG es CC BY-SA-4.0:
// obliga a atribuir y a compartir igual las obras derivadas. Empaquetar el CSV
// dentro de un módulo GPL-2.0 mezcla dos licencias sin necesidad. El patrón es
// el de `contenido-externo/` (#332): si quien juega tiene el fichero, esto lo
// aprovecha; si no, no pasa nada. Lo que sí viaja en cada entrada generada es su
// procedencia y su licencia, que es justo el mecanismo que el formato ya tenía
// previsto — y la forma de cumplir la atribución sin pelearse con la GPL.
//
// Puro: ni Foundry, ni DOM, ni red, ni reloj. Entra texto, sale un catálogo.
// NO valida: validar es de `catalogo-cosmografico.mjs`, y acoplarlos obligaría a
// pagar la validación en cada importación. Que lo que sale de aquí pasa por allí
// lo comprueba la prueba, que es donde se comprueban las cosas.

/** De pársec a año luz. Constante física, no un ajuste. */
const PARSEC_EN_ANIOS_LUZ = 3.26156;

/** HYG marca «distancia desconocida» con este valor, no con un hueco. */
const DISTANCIA_DESCONOCIDA = 100000;

/** Tope del formato (`MAX_ENTRIES`), menos la entrada del plano raíz. */
const MAX_ESTRELLAS = 1999;

/** El plano que cuelga de la raíz. Es la única entrada que NO sale de HYG, y
 * por eso lleva procedencia propia: el formato exige un padre de tipo `plane`
 * para todo sistema estelar, y el cielo real no viene con uno puesto. */
const PLANO_RAIZ = Object.freeze({
  id: "espacio-real",
  type: "plane",
  name: Object.freeze({ es: "Espacio real", en: "Real space" }),
  summary: Object.freeze({
    es: "El cielo observado desde la Tierra, tal y como lo recogen los catálogos astronómicos.",
    en: "The sky as observed from Earth, as recorded by astronomical catalogues.",
  }),
  continuity: "original",
  provenance: Object.freeze({
    kind: "original",
    source: "Espaciokoop Lagunak",
    license: "GPL-2.0",
  }),
});

/** La procedencia que se le pone a cada estrella importada. */
const PROCEDENCIA_HYG = Object.freeze({
  kind: "cc",
  source: "HYG Database (AstroNexus)",
  license: "CC BY-SA-4.0",
  source_url: "https://codeberg.org/astronexus/hyg",
});

/**
 * Pasa un nombre propio a ID portable.
 *
 * El formato exige `^[a-z0-9][a-z0-9_-]{0,63}$`, y los nombres de la IAU traen
 * acentos, espacios y algún apóstrofo («Alpha Centauri», «Zubeneschamali»,
 * «Ain»). Se quitan los diacríticos con normalización Unicode en vez de con una
 * tabla de reemplazos: una tabla se queda corta con el primer nombre que no
 * habíamos visto.
 */
export function idDesdeNombre(nombre) {
  const plano = String(nombre)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  if (plano.length === 0) return null;
  return plano.slice(0, 64);
}

/**
 * Parte una línea de CSV respetando las comillas dobles.
 *
 * HYG trae campos entrecomillados con comas dentro, así que partir por comas a
 * secas corrompe una columna y desplaza TODAS las siguientes — un fallo que no
 * revienta, solo mete datos en el campo equivocado, que es peor.
 */
export function partirLineaCsv(linea) {
  const campos = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i];
    if (entreComillas) {
      if (c === '"') {
        if (linea[i + 1] === '"') {
          actual += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        actual += c;
      }
      continue;
    }
    if (c === '"') {
      entreComillas = true;
    } else if (c === ",") {
      campos.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos;
}

/** Texto que el formato acepta: sin controles, sin `<`/`>` y sin bordes.
 *
 * Los rangos van ESCAPADOS y no tecleados a pelo: un fuente con bytes de
 * control literales dentro de una expresión regular es ilegible en cualquier
 * diff y se corrompe en cuanto una herramienta normaliza el fichero. */
function textoSeguro(valor) {
  return String(valor)
    .replace(/[\u0000-\u001f\u007f<>]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Número o `null`: HYG deja campos vacíos y también escribe basura ocasional. */
function numero(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * El resumen de una estrella, en los dos idiomas que el formato exige.
 *
 * Se construye SOLO con lo que trae el catálogo, y cada dato que falta
 * simplemente no se menciona: inventar un tipo espectral para que la frase
 * quede redonda sería mentir con formato válido.
 */
function resumen({ espectro, aniosLuz, magnitud }) {
  const es = [];
  const en = [];
  if (espectro) {
    es.push(`Tipo espectral ${espectro}`);
    en.push(`Spectral type ${espectro}`);
  }
  if (aniosLuz !== null) {
    es.push(`a ${aniosLuz.toFixed(1)} años luz`);
    en.push(`at ${aniosLuz.toFixed(1)} light years`);
  }
  if (magnitud !== null) {
    es.push(`magnitud aparente ${magnitud.toFixed(2)}`);
    en.push(`apparent magnitude ${magnitud.toFixed(2)}`);
  }
  if (es.length === 0) {
    return {
      es: "Estrella del catálogo HYG sin datos físicos publicados.",
      en: "Star from the HYG catalogue with no published physical data.",
    };
  }
  return { es: `${es.join(", ")}.`, en: `${en.join(", ")}.` };
}

/** Un catálogo con solo el plano raíz: lo que se devuelve cuando no hay datos
 * utilizables. Un catálogo vacío del todo no sería válido —el formato quiere una
 * raíz— y devolver `null` obligaría a comprobarlo en cada consumidor. */
function soloRaiz() {
  return { format: "espaciokoop-cosmography", version: 1, entries: [{ ...PLANO_RAIZ }] };
}

/**
 * Convierte el CSV de HYG en un catálogo cosmográfico.
 *
 * @param {string} csv Contenido del fichero, tal cual lo trae quien juega.
 * @param {{maximo?: number}} opciones `maximo` acota cuántas estrellas entran;
 *   no se puede subir por encima del tope del formato, y bajarlo sirve para
 *   quedarse solo con las más brillantes.
 * @returns {{format: string, version: number, entries: object[]}}
 */
export function atlasDesdeHyg(csv, { maximo = MAX_ESTRELLAS } = {}) {
  const lineas = String(csv ?? "").split(/\r?\n/u).filter((l) => l.trim() !== "");
  if (lineas.length < 2) return soloRaiz();

  // Las columnas se buscan POR NOMBRE. HYG ha cambiado de orden y de número de
  // columnas entre versiones, y leer por índice es cómo un importador se rompe
  // en silencio con la versión siguiente.
  const cabecera = partirLineaCsv(lineas[0]).map((c) => c.trim().toLowerCase());
  const col = (nombre) => cabecera.indexOf(nombre);
  const iProper = col("proper");
  const iDist = col("dist");
  const iMag = col("mag");
  const iSpect = col("spect");
  if (iProper === -1) return soloRaiz();

  const estrellas = [];
  for (let i = 1; i < lineas.length; i += 1) {
    const campos = partirLineaCsv(lineas[i]);
    const propio = textoSeguro(campos[iProper] ?? "");
    if (propio === "") continue; // sin nombre de la IAU no entra: ver cabecera

    const magnitud = iMag === -1 ? null : numero(campos[iMag]);
    const parsecs = iDist === -1 ? null : numero(campos[iDist]);
    const aniosLuz =
      parsecs === null || parsecs >= DISTANCIA_DESCONOCIDA || parsecs <= 0
        ? null
        : parsecs * PARSEC_EN_ANIOS_LUZ;
    const espectro = iSpect === -1 ? "" : textoSeguro(campos[iSpect] ?? "");

    const id = idDesdeNombre(propio);
    if (id === null) continue;

    estrellas.push({ id, propio, magnitud, aniosLuz, espectro });
  }

  // Por brillo, que es el orden en que una mesa las conocería. Las que no traen
  // magnitud van al final en vez de colarse arriba por comparar contra `null`.
  estrellas.sort((a, b) => (a.magnitud ?? Infinity) - (b.magnitud ?? Infinity));

  const tope = Math.max(0, Math.min(MAX_ESTRELLAS, Math.trunc(maximo) || 0));
  const usados = new Set([PLANO_RAIZ.id]);
  const entries = [{ ...PLANO_RAIZ }];
  for (const estrella of estrellas) {
    if (entries.length - 1 >= tope) break;
    // Dos nombres distintos pueden dar el mismo ID («Alpha Centauri» y
    // «alpha-centauri»). Se desempata con un sufijo en vez de descartar: perder
    // una estrella real por un choque de nombres sería peor que un ID feo.
    let id = estrella.id;
    let n = 2;
    while (usados.has(id)) {
      const sufijo = `-${n}`;
      id = `${estrella.id.slice(0, 64 - sufijo.length)}${sufijo}`;
      n += 1;
    }
    usados.add(id);

    entries.push({
      id,
      type: "star_system",
      parent_id: PLANO_RAIZ.id,
      name: { es: estrella.propio, en: estrella.propio },
      summary: resumen(estrella),
      continuity: "original",
      provenance: { ...PROCEDENCIA_HYG },
    });
  }

  return { format: "espaciokoop-cosmography", version: 1, entries };
}

// Idioma propio del módulo (lógica pura, sin Foundry).
//
// POR QUÉ EXISTE. Foundry tiene UN idioma por cliente y lo aplica a todo: si la
// mesa juega con el core en inglés, los textos de Lagunak salen en inglés
// también, aunque la partida se juegue en castellano. Y al revés. Este selector
// desacopla las dos cosas: cada cliente elige en qué idioma quiere LA NAVE, sin
// tocar el idioma de Foundry ni el de nadie más.
//
// Por eso el ajuste es de CLIENTE y no de mundo: el idioma en que alguien lee no
// es una decisión de la partida, es suya. Dos personas en la misma mesa pueden
// leer la misma consola en idiomas distintos y estar viendo lo mismo.
//
// «auto» significa exactamente lo que dice: seguir a Foundry. Es el valor por
// defecto porque es el comportamiento de siempre, y quien no toque nada no debe
// notar que esto existe.

export const IDIOMA_AUTOMATICO = "auto";

// Todas las claves del módulo cuelgan de aquí. Se usa como filtro al fusionar:
// el selector cambia los textos de Lagunak y NADA más. Sin este filtro, un
// fichero de idioma del módulo podría pisar traducciones del core o de otros
// módulos, que es justo lo que un selector propio no debe hacer.
export const PREFIJO_CLAVES = "LAGUNAK.";

/**
 * Idioma con el que hay que cargar los textos del módulo.
 *
 * @param {string} preferido lo elegido en los ajustes ("auto", "es", "en"...).
 * @param {string} idiomaFoundry el idioma activo del cliente en Foundry.
 * @param {string[]} disponibles idiomas que el módulo declara en su manifiesto.
 * @param {string} respaldo idioma con el que se escribe primero el módulo.
 *
 * Se cae al respaldo cuando lo pedido no existe: un idioma que no está no se
 * puede enseñar, y dejar la interfaz en claves crudas sería peor que enseñarla
 * en el idioma de partida.
 */
export function idiomaEfectivo(preferido, idiomaFoundry, disponibles = [], respaldo = "en") {
  const lista = Array.isArray(disponibles) ? disponibles : [];
  const candidatos = [
    preferido === IDIOMA_AUTOMATICO || !preferido ? idiomaFoundry : preferido,
    idiomaFoundry,
    respaldo,
  ];
  for (const candidato of candidatos) {
    if (typeof candidato === "string" && lista.includes(candidato)) return candidato;
  }
  return lista[0] ?? respaldo;
}

/**
 * Se queda solo con las claves del módulo. Devuelve un objeto plano listo para
 * fusionar con las traducciones vivas.
 */
export function clavesDelModulo(traducciones) {
  if (!traducciones || typeof traducciones !== "object") return {};
  return Object.fromEntries(
    Object.entries(traducciones).filter(
      ([clave, valor]) => clave.startsWith(PREFIJO_CLAVES) && typeof valor === "string",
    ),
  );
}

/**
 * Opciones del desplegable: «auto» primero, y después cada idioma declarado por
 * su nombre en su propio idioma, que es como se reconoce un idioma en una lista.
 */
export function opcionesIdioma(idiomasManifiesto = [], etiquetaAuto = "Automático") {
  const opciones = { [IDIOMA_AUTOMATICO]: etiquetaAuto };
  for (const idioma of idiomasManifiesto) {
    if (typeof idioma?.lang !== "string" || idioma.lang === "") continue;
    opciones[idioma.lang] = idioma.name ?? idioma.lang;
  }
  return opciones;
}

/**
 * URL del fichero de idioma a partir de lo que declara el manifiesto.
 *
 * Foundry entrega `path` **ya resuelto desde la raíz de datos**
 * (`modules/<id>/lang/es.json`), no relativo al módulo. Anteponer otra vez la
 * carpeta daba un 404 con la ruta duplicada y el selector no cargaba nada. Se
 * admiten las dos formas: la resuelta se usa tal cual, y una ruta corta se
 * completa.
 */
export function rutaIdioma(ruta, moduleId) {
  if (typeof ruta !== "string" || ruta === "") return null;
  if (ruta.startsWith("modules/") || ruta.startsWith("/") || /^https?:/.test(ruta)) return ruta;
  return `modules/${moduleId}/${ruta}`;
}

/**
 * Aplicador de idioma con guarda de generación.
 *
 * POR QUÉ NO BASTA CON PEDIR EL FICHERO Y FUSIONARLO. La carga es asíncrona, y
 * dos cambios seguidos son dos cargas en vuelo: si la segunda respuesta llega
 * antes que la primera, la última en fusionarse gana, y esa puede ser la vieja.
 * El resultado es una interfaz que contradice a su propio selector —el ajuste
 * dice «en», los textos están en «es»— y que se queda así hasta el cambio
 * siguiente o una recarga. No es teórico: se reproduce resolviendo las dos
 * cargas en orden inverso, que es justo lo que hace la prueba de regresión.
 *
 * La guarda es doble a propósito, porque protegen de cosas distintas:
 *
 * - el número de generación descarta cualquier respuesta que no sea de la
 *   ÚLTIMA petición lanzada;
 * - la relectura del valor vigente descarta además la respuesta que sí es la
 *   última pero cuyo idioma ya no es el elegido (el ajuste pudo volver a su
 *   sitio mientras el fichero viajaba).
 *
 * Todo lo que toca Foundry llega inyectado, así que esto se prueba en Node con
 * cargas resueltas a mano en el orden que haga falta.
 *
 * @param {object} deps
 * @param {() => {pedido: string, idiomaFoundry: string, idiomas: object[]}} deps.leerEstado
 * @param {(ruta: string) => Promise<object>} deps.cargar
 * @param {(traducciones: object) => void} deps.fusionar
 * @param {() => void} [deps.refrescar] repintado de lo que ya está en pantalla.
 * @param {(motivo: string, datos?: object) => void} [deps.alFallar]
 * @param {(info: object) => void} [deps.alAplicar]
 */
export function crearAplicadorIdioma({
  leerEstado,
  cargar,
  fusionar,
  refrescar = () => {},
  alFallar = () => {},
  alAplicar = () => {},
}) {
  let generacion = 0;

  return async function aplicarIdioma({ avisar = false } = {}) {
    const mia = (generacion += 1);
    const { pedido, idiomaFoundry, idiomas = [] } = leerEstado() ?? {};
    const disponibles = idiomas.map((idioma) => idioma.lang);
    const elegido = idiomaEfectivo(pedido, idiomaFoundry, disponibles);
    const ruta = idiomas.find((idioma) => idioma.lang === elegido)?.path;
    if (!ruta) {
      alFallar("sin_fichero", { pedido, elegido, idiomas });
      return null;
    }

    let traducciones = null;
    try {
      traducciones = clavesDelModulo(await cargar(ruta));
    } catch (err) {
      alFallar("no_cargado", { elegido, err, avisar });
      return null;
    }

    // Aquí está la guarda. Entre el `await` de arriba y esta línea ha pasado
    // tiempo, y en ese tiempo el idioma pudo cambiar otra vez.
    if (mia !== generacion) {
      alFallar("obsoleto", { elegido });
      return null;
    }
    const vigente = leerEstado() ?? {};
    const elegidoAhora = idiomaEfectivo(
      vigente.pedido,
      vigente.idiomaFoundry,
      (vigente.idiomas ?? idiomas).map((idioma) => idioma.lang),
    );
    if (elegidoAhora !== elegido) {
      alFallar("obsoleto", { elegido, elegidoAhora });
      return null;
    }

    fusionar(traducciones);
    refrescar();
    alAplicar({ idioma: elegido, textos: Object.keys(traducciones).length });
    return elegido;
  };
}

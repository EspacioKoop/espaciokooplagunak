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

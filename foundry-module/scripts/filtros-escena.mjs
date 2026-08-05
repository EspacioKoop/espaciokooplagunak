/**
 * Tinte y grano de la escena a partir del estado de la nave, delegando el
 * render en FXMaster cuando la mesa lo tenga instalado.
 *
 * POR QUÉ ESTE MÓDULO AJENO Y NO OTRO (ver docs/ECOSISTEMA_MODULOS_FOUNDRY.md).
 * FXMaster publica su componente de software bajo BSD 3-Clause, compatible con
 * el GPL-2.0 de este módulo. Sus *filtros* son shaders sin un solo asset; sus
 * *efectos de partículas* sí traen sprites con licencias mixtas (JB2A bajo
 * CC-BY-NC-SA, iconos bajo EULA de Rexard). De ahí la frontera que este fichero
 * no cruza: **filtros sí, partículas nunca**. No es escrúpulo decorativo — un
 * NC en un proyecto que quiere poder distribuirse es una vía muerta.
 *
 * POR QUÉ NO LO ESCRIBIMOS NOSOTROS. El tinte de alerta ya es nuestro y seguirá
 * siéndolo: `alerta-escena.mjs` lo pinta sobre el `<body>` con su aviso textual
 * accesible, y funciona sin nadie más. Lo que no vamos a escribir es un pase de
 * shaders sobre el lienzo de PIXI con su gestión de ciclo de vida, migraciones y
 * capas. Esa es la rueda; FXMaster ya la tiene redonda.
 *
 * QUÉ NO HACE. No toca contactos ni tokens. La regla de admisión del ecosistema
 * es que una dependencia puede degradar la presentación y nunca la autoridad:
 * aquí se tiñe la escena entera, que es ambiente, y jamás se anima un impacto
 * sobre un token, que sería afirmar una posición que la simulación no respalda
 * (#354). Si FXMaster no está, no pasa nada: la mesa ve el borde de alerta de
 * siempre.
 *
 * Puro salvo el aplicador del final: la decisión de qué filtros tocan es una
 * función de datos a datos, probable desde Node sin Foundry ni FXMaster.
 */

import { AJUSTE_NIVEL_ALERTA, normalizarAviso } from "./alerta-escena.mjs";
import { ALERTA } from "./paleta.mjs";

/** Ajuste de mundo que enciende la integración. Apagado por defecto. */
export const AJUSTE_FILTROS = "filtrosEscena";

/**
 * Ajuste de mundo del grano de consola. Es un EJE APARTE del tinte de alerta y
 * no un interruptor: la época es un parámetro (#362), así que el ajuste elige
 * *cuál*, y «apagado» es una opción más y no un booleano encima.
 */
export const AJUSTE_GRANO = "granoRetroEscena";

/** Valor de `AJUSTE_GRANO` que significa «sin grano». */
export const GRANO_APAGADO = "apagado";

/** Opciones del desplegable, en el orden en que se ofrecen. */
export const OPCIONES_GRANO = Object.freeze([GRANO_APAGADO, "psx", "gamecube"]);

/** Identificador del módulo ajeno. Si no está, todo esto es un no-op. */
export const MODULO_FXMASTER = "fxmaster";

/**
 * Grano por época, para el modo retro. Son los mismos parámetros conceptuales
 * que `retro3d.mjs`: la PSX ensucia y la GameCube no.
 *
 * `sepia` se queda a cero en ambas: el filtro de FXMaster lo llama «old film» y
 * su sepia tira a película antigua, no a pantalla de fósforo. Aquí se quiere el
 * ruido de una consola, no el de un proyector.
 */
export const GRANO = Object.freeze({
  psx: Object.freeze({ sepia: 0, noise: 0.25 }),
  gamecube: Object.freeze({ sepia: 0, noise: 0.08 }),
});

/**
 * Intensidad del tinte por nivel. Deliberadamente flojo: la escena tiene que
 * seguir siendo legible con el filtro puesto. Un rojo que impide leer el mapa
 * no es tensión, es un obstáculo.
 */
const TINTE = Object.freeze({
  amarilla: Object.freeze({ saturation: 1.1, contrast: 1.05, brightness: 0.97 }),
  roja: Object.freeze({ saturation: 1.2, contrast: 1.15, brightness: 0.9 }),
});

/**
 * Traduce estado de nave a descriptores de filtro de FXMaster.
 *
 * Devuelve SIEMPRE un array (vacío = «escena limpia»), porque `setFilters([])`
 * es justamente cómo se retira el efecto al volver a verde.
 *
 * @param {object} opciones
 * @param {string} [opciones.nivel] nivel de alerta vigente (`nivel-alerta.mjs`)
 * @param {boolean} [opciones.retro] añadir el grano de consola (#362)
 * @param {string} [opciones.epoca] época del grano, si `retro`
 */
export function filtrosParaEscena({ nivel = "verde", retro = false, epoca = "psx" } = {}) {
  const filtros = [];

  const tinte = TINTE[nivel];
  // El tono del BORDE y no el del texto: el tinte es una superficie ancha, como
  // el borde, y el rojo del aviso está aclarado para leerse en tamaño pequeño.
  const color = ALERTA.niveles[nivel]?.borde;
  // Ambos o ninguno: un nivel con intensidad pero sin color en la paleta sería
  // un tinte blanco, que se ve como un lavado raro y no como una alerta.
  if (tinte && color) {
    filtros.push({
      type: "color",
      options: { color: { value: color, apply: true }, gamma: 1, ...tinte },
    });
  }

  if (retro) {
    filtros.push({ type: "oldfilm", options: { ...(GRANO[epoca] ?? GRANO.psx) } });
  }

  return filtros;
}

/**
 * ¿Está FXMaster disponible y activo en este cliente?
 *
 * Se comprueba la API de verdad y no solo el módulo activo: un FXMaster futuro
 * que renombre `filters.setFilters` debe degradar a «no está», no reventar a
 * media partida.
 */
export function fxmasterDisponible({ modulos = globalThis.game?.modules, api = globalThis.FXMASTER } = {}) {
  const modulo = modulos?.get?.(MODULO_FXMASTER);
  return Boolean(modulo?.active) && typeof api?.filters?.setFilters === "function";
}

/**
 * Aplica los filtros a la escena activa. Solo el GM: `setFilters` escribe en
 * banderas de la escena, que es documento de mundo.
 *
 * AVISO IMPORTANTE, y el motivo de que esto sea opt-in. `setFilters` de FXMaster
 * REEMPLAZA el conjunto entero de filtros de la escena; no añade el nuestro a
 * los que hubiera. Si el GM tenía puesta su propia niebla, se la llevamos por
 * delante. Por eso el ajuste que enciende esto viene apagado y su descripción lo
 * dice: es una cesión de la escena al módulo, no una capa que convive.
 *
 * Devuelve los filtros aplicados, o `null` si no se hizo nada.
 */
export async function aplicarFiltrosEscena({
  nivel = "verde",
  retro = false,
  epoca = "psx",
  esGM = Boolean(globalThis.game?.user?.isGM),
  api = globalThis.FXMASTER,
  modulos = globalThis.game?.modules,
} = {}) {
  if (!esGM || !fxmasterDisponible({ modulos, api })) return null;
  const filtros = filtrosParaEscena({ nivel, retro, epoca });
  await api.filters.setFilters(filtros);
  return filtros;
}

/**
 * Deja la escena como diga el estado ACTUAL, venga de donde venga el disparo.
 *
 * Existe porque el cambio de nivel no es el único momento en que el tinte puede
 * estar mal: el GM enciende el ajuste en plena alerta roja, cambia de escena, o
 * recarga. Todos esos casos son «el nivel no ha cambiado pero el lienzo sí»,
 * y sin esto la escena se queda limpia mientras la nave arde.
 *
 * Apagar el ajuste limpia de verdad (`setFilters([])`): un tinte rojo que se
 * queda pegado después de desactivar la integración es peor que no haberla
 * tenido, porque ya no hay nada en la interfaz que explique de dónde sale.
 */
export async function sincronizarFiltrosEscena({
  moduleId,
  ajustes = globalThis.game?.settings,
  esGM = Boolean(globalThis.game?.user?.isGM),
  api = globalThis.FXMASTER,
  modulos = globalThis.game?.modules,
} = {}) {
  if (!esGM || !fxmasterDisponible({ modulos, api })) return null;

  // El interruptor general manda sobre los dos ejes: apagarlo devuelve la
  // escena entera al GM, sin tinte y sin grano. Es lo que promete su descripción.
  const encendido = Boolean(ajustes?.get?.(moduleId, AJUSTE_FILTROS));
  const nivel = encendido ? normalizarAviso(ajustes?.get?.(moduleId, AJUSTE_NIVEL_ALERTA)).nivel : "verde";
  const epoca = encendido ? ajustes?.get?.(moduleId, AJUSTE_GRANO) : GRANO_APAGADO;
  const retro = typeof epoca === "string" && epoca !== GRANO_APAGADO && epoca in GRANO;

  return aplicarFiltrosEscena({ nivel, retro, epoca, esGM, api, modulos });
}

/**
 * Conecta los tres momentos en que hay que resincronizar. Devuelve una función
 * para desregistrar, como el resto de cableados del módulo.
 */
export function registrarSincroniaFiltros(moduleId, { hooks = globalThis.Hooks, ...resto } = {}) {
  const sincronizar = () => void sincronizarFiltrosEscena({ moduleId, ...resto }).catch(() => {});

  // 1) Cambia el nivel de alerta. Mismo hook que ya emite `publicarNivelAlerta`,
  //    para que borde y tinte sean la misma verdad y no puedan divergir.
  const alCambiarNivel = () => sincronizar();
  // 2) Se toca en caliente cualquiera de los dos ajustes: el interruptor
  //    general o la época del grano. `updateSetting` se dispara para TODOS los
  //    ajustes del mundo, incluidos los de los otros cien módulos instalados.
  const propios = new Set([`${moduleId}.${AJUSTE_FILTROS}`, `${moduleId}.${AJUSTE_GRANO}`]);
  const alCambiarAjuste = (setting) => {
    if (!propios.has(setting?.key)) return;
    sincronizar();
  };
  // 3) Se abre otra escena: los filtros son banderas POR ESCENA, así que la
  //    recién abierta no sabe nada de la alerta en curso hasta que se le diga.
  const alAbrirLienzo = () => sincronizar();

  hooks.on("lagunakNivelAlerta", alCambiarNivel);
  hooks.on("updateSetting", alCambiarAjuste);
  hooks.on("canvasReady", alAbrirLienzo);
  return () => {
    hooks.off("lagunakNivelAlerta", alCambiarNivel);
    hooks.off("updateSetting", alCambiarAjuste);
    hooks.off("canvasReady", alAbrirLienzo);
  };
}

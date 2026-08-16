/**
 * Injerto de herramientas en el grupo propio de la barra de escena (#448).
 *
 * `puerta-catalogo.mjs` (#495, item 4) extrajo la mitad de este item: cómo se
 * GUARDA una lista de entradas. Esta es la otra mitad, la que quedó sin tocar:
 * cómo se METE un botón en el grupo `lagunak`. Ese trozo estaba copiado
 * VERBATIM en cinco archivos (`station-ui`, `avatar-ui`,
 * `station-workspace-ui`, `asistencia-ui`, `contenido-externo/ventana`) más una
 * sexta variante en `main.mjs` para construir el grupo — y con él estaba
 * copiada seis veces la bifurcación de forma entre generaciones de Foundry, que
 * es justo lo que no se puede permitir repetir: el día que v14 cambie la forma,
 * hay seis sitios donde arreglarlo y ninguna prueba que diga cuáles se
 * olvidaron.
 *
 * La bifurcación, que es TODA la dificultad de este archivo:
 *
 *   - v11/v12 — `controls` es un ARRAY de grupos, y `group.tools` un ARRAY de
 *     herramientas. El orden es la posición.
 *   - v13 — `controls` es un RECORD por nombre, y `group.tools` también. El
 *     orden es explícito (`order`), y el clic se llama `onChange` y no
 *     `onClick`.
 *
 * Puro: ni Foundry, ni DOM, ni `game`. Recibe el `controls` que da el hook y lo
 * muta, que es el contrato del propio hook — así se prueba en Node con objetos
 * planos de las dos formas, sin montar un anfitrión.
 */

/** Nombre del grupo propio del módulo (issue #125: no se mezcla con Token Controls). */
export const GRUPO = "lagunak";

/** Traduce una herramienta a la forma de v13: `order` explícito y `onChange`. */
function comoRegistro(tool, order) {
  return { ...tool, order, onChange: tool.onClick };
}

/**
 * Añade una herramienta al grupo propio, en la forma que corresponda a la
 * generación del anfitrión.
 *
 * No crea el grupo: si no existe, no hace nada. Es deliberado — el grupo lo
 * crea `crearGrupo` desde el hook de `main.mjs`, y una herramienta que se
 * añadiese sola a un grupo inventado aparecería en la barra sin el candado de
 * visibilidad que el grupo declara.
 *
 * @param {object[]|Record<string, object>} controls - lo que pasa el hook.
 * @param {object} tool - herramienta con al menos `name` y `onClick`.
 * @returns {boolean} si se añadió de verdad.
 */
export function anadirHerramienta(controls, tool) {
  if (!tool?.name) return false;

  if (Array.isArray(controls)) {
    const grupo = controls.find?.((group) => group.name === GRUPO);
    if (!grupo || !Array.isArray(grupo.tools)) return false;
    grupo.tools.push(tool);
    return true;
  }

  const grupo = controls?.[GRUPO];
  if (!grupo?.tools || Array.isArray(grupo.tools)) return false;
  grupo.tools[tool.name] = comoRegistro(tool, Object.keys(grupo.tools).length);
  return true;
}

/**
 * Crea el grupo propio con su lote inicial de herramientas, en la forma que
 * corresponda a la generación del anfitrión.
 *
 * El grupo usa la capa `controls` (existe en todas las versiones soportadas)
 * porque sus herramientas son botones puros: activar el grupo no debe tocar
 * ninguna capa de fichas.
 *
 * @param {object[]|Record<string, object>} controls
 * @param {object} args
 * @param {object[]} args.tools - herramientas iniciales, en orden.
 * @param {string} args.activeTool - herramienta activa; quien llama se asegura
 *   de que exista para el rol actual.
 * @param {string} args.title - clave i18n del grupo.
 * @param {string} args.icon - icono del grupo.
 * @returns {boolean} si se creó de verdad.
 */
export function crearGrupo(controls, { tools = [], activeTool, title, icon }) {
  const comun = { name: GRUPO, title, icon, layer: "controls", visible: true, activeTool };

  if (Array.isArray(controls)) {
    controls.push({ ...comun, tools: [...tools] });
    return true;
  }

  if (!controls || typeof controls !== "object") return false;

  const registro = {};
  tools.forEach((tool, order) => {
    registro[tool.name] = comoRegistro(tool, order);
  });
  controls[GRUPO] = {
    ...comun,
    order: Object.keys(controls).length,
    onChange: () => {},
    onToolChange: () => {},
    tools: registro,
  };
  return true;
}

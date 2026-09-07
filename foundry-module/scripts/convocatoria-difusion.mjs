// Cableado de la convocatoria a una estancia (#689, sale de cerrar el PR #675).
//
// `convocatoria-estancia.mjs` es lógica pura y ya sabe decidir si se puede
// llevar a la mesa a la playa o al museo. Esto es el cable, y nada más: capa
// fina sobre globales de Foundry, sin ninguna decisión propia.
//
// ## QUÉ VIAJA, Y POR QUÉ NO VIAJA LA POSICIÓN
//
// Por el canal va el ID DE LA ESTANCIA, y la apertura recibe ese id. La
// posición que `convocar` devuelve se queda en el emisor, donde sirve para lo
// único que hace falta: acreditar que la entrada de esa estancia es pisable
// antes de mandar a nadie. Al otro lado sería redundante —`resolverArranque`
// (`nave-estancias.mjs`) ya deja a quien llega en la `entrada` de la estancia
// pedida, que es exactamente el punto que `convocar` calculó— y redundante en
// el peor sentido: dos fuentes para el mismo dato, una de ellas por red.
//
// Ese es el motivo de que `abrirAndarNave` NO cambie de firma. El día que una
// convocatoria quiera dejar a la gente en un sitio distinto de la entrada, eso
// sí es un cambio de firma explícito, y con su motivo escrito.
//
// ## LA APERTURA SE RECIBE, NO SE SUPONE
//
// `abrirAndarNave` es una función local de `main.mjs`: ni está exportada ni es
// global, y llamarla desde aquí por su nombre es el `ReferenceError` que este
// issue documenta. Quien registra pasa la forma de abrir la ventana. Misma
// regla que el rol en el módulo puro: lo que este archivo no puede saber, se
// lo dan.
//
// ## POR QUÉ UN AJUSTE DE MUNDO, Y NO UN SOCKET CRUDO (revisión de seguridad)
//
// La primera versión de este cable escuchaba `game.socket.on(...)` y abría lo
// que le llegara con solo comprobar que el payload traía un `estancia` no
// vacío. Un socket de Foundry no tiene autoridad: cualquier cliente —jugador
// incluido— puede emitir el mismo mensaje directamente, sin pasar por
// `convocarYTransmitir` ni por el guard de GM del emisor, que solo protege a
// quien coopera. El receptor aceptaba el mensaje viniera de quien viniera, y
// también abría estancias que el catálogo no conoce si el payload las
// inventaba (`"not-a-real-room"`).
//
// La disciplina de #237 (la autoridad se resuelve del lado que puede
// verificarla, nunca de un campo declarativo del mensaje) se traduce aquí
// usando el mismo mecanismo que `alerta-escena.mjs`/`nivel-alerta.mjs`: un
// AJUSTE DE MUNDO (`scope: "world"`). Foundry solo deja escribir un ajuste de
// mundo a quien tiene permiso de modificar los ajustes del juego (el GM, por
// defecto) — lo comprueba el servidor, no este módulo, así que un cliente sin
// ese permiso ni siquiera consigue que el ajuste cambie: `game.settings.set`
// falla en su origen y el hook `updateSetting` nunca llega a dispararse con un
// valor falsificado. Un `userId` declarado dentro del payload (que cualquiera
// puede escribir) NO sería autorización real; un ajuste de mundo sí lo es
// porque la autoridad la impone el propio Foundry al escribir, no al leer.
//
// El receptor, además, vuelve a validar la estancia contra el catálogo real
// antes de abrir nada: ni siquiera un valor de ajuste corrupto o de una
// versión antigua del módulo puede abrir una estancia que no existe.

import { convocar } from "./convocatoria-estancia.mjs";
import { CATALOGO_ANDAR } from "./nave-catalogo-andar.mjs";

/** Nombre del ajuste de mundo dentro del canal del módulo. */
export const AJUSTE_CONVOCATORIA = "convocatoria-estancia";

let registrado = false;

/**
 * Registra el ajuste de mundo que transporta la convocatoria. Idempotente.
 * Debe llamarse una vez, típicamente en `init`, antes de que nadie lea o
 * escriba el ajuste (lo exige Foundry).
 *
 * @param {string} moduleId
 * @param {{register:Function}} [ajustes] inyectable para test sin Foundry.
 */
export function registrarAjusteConvocatoria(moduleId, ajustes = game.settings) {
  if (registrado) return;
  ajustes.register(moduleId, AJUSTE_CONVOCATORIA, {
    scope: "world",
    config: false,
    type: Object,
    default: null,
  });
  registrado = true;
}

let moduloConfigurado = null;
let abrirEstancia = null;
const escuchas = [];

/**
 * Valida una estancia contra el catálogo REAL antes de abrir nada. Rechaza
 * cualquier id que el catálogo no conozca, venga de donde venga el valor del
 * ajuste (otro cliente, una versión antigua, un dato corrupto).
 */
function estanciaValida(idEstancia, catalogo = CATALOGO_ANDAR) {
  return typeof idEstancia === "string" && idEstancia !== "" && catalogo.tiene(idEstancia);
}

/**
 * Engancha la escucha de convocatorias al ajuste de mundo. Idempotente: al
 * volver a llamarse retira la escucha anterior en vez de acumular una
 * segunda.
 *
 * @param {string} moduleId id del módulo, para el nombre del ajuste.
 * @param {{abrir:(idEstancia:string)=>void, hooks?:object, catalogo?:object}} opciones
 *   `abrir` es cómo se abre la ventana de andar por la nave; la trae quien la
 *   tiene a mano. `hooks`/`catalogo` son inyectables para test sin Foundry.
 */
export function registrarConvocatoriaEstancia(moduleId, { abrir, hooks = globalThis.Hooks, catalogo = CATALOGO_ANDAR } = {}) {
  if (typeof abrir !== "function") {
    throw new TypeError("registrarConvocatoriaEstancia necesita una función `abrir`");
  }
  moduloConfigurado = moduleId;
  abrirEstancia = abrir;
  while (escuchas.length) escuchas.pop()();

  const receptor = (setting) => {
    // `updateSetting` se dispara para TODOS los ajustes del mundo; filtra por
    // el propio (namespace del módulo + nombre del ajuste) antes de mirar
    // nada más.
    const namespace = setting?.namespace ?? setting?.module;
    if (namespace !== moduleId || setting?.key !== AJUSTE_CONVOCATORIA) return;
    const valor = setting?.value;
    const idEstancia = valor?.estancia;
    // Autoridad ya verificada por Foundry al ACEPTAR la escritura del
    // ajuste (scope "world" = solo GM); aquí solo queda comprobar que el
    // dato en sí tiene sentido antes de abrir nada.
    if (!estanciaValida(idEstancia, catalogo)) return;
    abrirEstancia(idEstancia);
  };
  hooks?.on("updateSetting", receptor);
  escuchas.push(() => hooks?.off?.("updateSetting", receptor));
}

/**
 * Convoca a la mesa a una estancia y lo difunde. Solo el GM convoca; el módulo
 * puro es quien lo dice, y aquí solo se le pasa el rol. La difusión en sí
 * (escribir el ajuste de mundo) es una segunda barrera: aunque alguien
 * lograra ejecutar esta función sin ser GM, Foundry rechaza la escritura del
 * ajuste igualmente.
 *
 * Quien convoca también abre la suya, pero no con una llamada aparte: escribir
 * el ajuste de mundo dispara `updateSetting` en TODOS los clientes, incluido
 * el propio del GM, así que el mismo receptor de `registrarConvocatoriaEstancia`
 * es quien abre su ventana igual que la de cualquier otro — un GM que manda a
 * todo el mundo a la playa y se queda en el puente es el fallo más aburrido
 * posible, y aquí no puede pasar porque no hay dos caminos distintos.
 *
 * @param {string} idEstancia
 * @param {{ajustes?:object}} [opciones] inyectable para test sin Foundry.
 * @returns {boolean} si se convocó de verdad.
 */
export function convocarYTransmitir(idEstancia, { ajustes = game.settings } = {}) {
  if (!moduloConfigurado || !abrirEstancia) return false;
  if (!game.user?.isGM) return false;
  const posicion = convocar(idEstancia, "GM");
  // `posicion` no viaja: es la acreditación de que la entrada es pisable.
  if (!posicion) return false;

  ajustes.set(moduloConfigurado, AJUSTE_CONVOCATORIA, {
    estancia: idEstancia,
    // Nonce para que dos convocatorias seguidas a la MISMA estancia sigan
    // disparando `updateSetting` (Foundry no notifica si el valor no
    // cambia).
    nonce: Date.now(),
  });
  return true;
}

// Cableado de la convocatoria a una estancia (#689, sale de cerrar el PR #675).
//
// `convocatoria-estancia.mjs` es lógica pura y ya sabe decidir si se puede
// llevar a la mesa a la playa o al museo. Esto es el cable, y nada más: capa
// fina sobre globales de Foundry, sin ninguna decisión propia.
//
// ## QUÉ VIAJA, Y POR QUÉ NO VIAJA LA POSICIÓN
//
// Por el socket va el ID DE LA ESTANCIA, y la apertura recibe ese id. La
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

import { convocar } from "./convocatoria-estancia.mjs";

/** Tipo de mensaje propio dentro del canal del módulo, que es compartido. */
export const MENSAJE_CONVOCATORIA = "convocatoria-estancia";

function canalSocket(moduleId) {
  return `module.${moduleId}`;
}

let moduloConfigurado = null;
let abrirEstancia = null;
const escuchas = [];

/**
 * Engancha la escucha de convocatorias. Idempotente: al volver a llamarse
 * retira la escucha anterior en vez de acumular una segunda.
 *
 * @param {string} moduleId id del módulo, para el canal del socket.
 * @param {{abrir:(idEstancia:string)=>void}} opciones `abrir` es cómo se abre
 *   la ventana de andar por la nave; la trae quien la tiene a mano.
 */
export function registrarConvocatoriaEstancia(moduleId, { abrir } = {}) {
  if (typeof abrir !== "function") {
    throw new TypeError("registrarConvocatoriaEstancia necesita una función `abrir`");
  }
  moduloConfigurado = moduleId;
  abrirEstancia = abrir;
  while (escuchas.length) escuchas.pop()();

  const receptor = (mensaje) => {
    if (mensaje?.tipo !== MENSAJE_CONVOCATORIA) return;
    // Sin id no hay adónde ir. No se cae al comportamiento por defecto de
    // `abrirAndarNave` —volver a donde uno se quedó— porque eso abriría una
    // ventana que nadie pidió y encima en el sitio equivocado.
    if (typeof mensaje.estancia !== "string" || !mensaje.estancia) return;
    abrirEstancia(mensaje.estancia);
  };
  game.socket?.on(canalSocket(moduleId), receptor);
  escuchas.push(() => game.socket?.off?.(canalSocket(moduleId), receptor));
}

/**
 * Convoca a la mesa a una estancia y lo difunde. Solo el GM convoca; el módulo
 * puro es quien lo dice, y aquí solo se le pasa el rol.
 *
 * Quien convoca también abre la suya: el emisor no se escucha a sí mismo por
 * socket, y un GM que manda a todo el mundo a la playa y se queda en el puente
 * es el fallo más aburrido posible.
 *
 * @param {string} idEstancia
 * @returns {boolean} si se convocó de verdad.
 */
export function convocarYTransmitir(idEstancia) {
  if (!moduloConfigurado || !abrirEstancia) return false;
  const posicion = convocar(idEstancia, game.user?.isGM ? "GM" : "jugador");
  // `posicion` no viaja: es la acreditación de que la entrada es pisable.
  if (!posicion) return false;

  game.socket?.emit(canalSocket(moduloConfigurado), {
    tipo: MENSAJE_CONVOCATORIA,
    estancia: idEstancia,
  });
  abrirEstancia(idEstancia);
  return true;
}

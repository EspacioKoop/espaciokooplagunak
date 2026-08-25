/**
 * Cableado de la convocatoria a una estancia (#587, #689).
 *
 * `convocatoria-estancia.mjs` decide SI la tripulación puede ir y a dónde
 * llega; este módulo es lo único que habla con Foundry: difunde la orden del GM
 * por socket y, al recibirla, abre la ventana de Andar en cada cliente.
 *
 * QUE VIAJA Y QUE ABRE. El mensaje lleva `idEstancia` y `posicion`, pero la
 * apertura usa SOLO el id: `abrirAndarNave` ya sabe caminar hasta una estancia
 * por su id (`andarApp.irA(estancia)`), así que hacerle aceptar coordenadas
 * sería una firma nueva para un dato que no necesita. La `posicion` viaja
 * porque es lo que `convocar()` devuelve y lo que distingue «se puede ir» de
 * «no se puede» (null), y para que el día que algo quiera pintar el punto de
 * llegada no haya que cambiar el protocolo. Quien la ignore no pierde nada.
 *
 * POR QUE UN CALLBACK Y NO UN IMPORT. `abrirAndarNave` es una función local de
 * `main.mjs`, no exportada, y exportarla solo para esto ataría este módulo a la
 * ventana concreta. Se recibe como parámetro: main.mjs, que la tiene a mano, es
 * quien la pasa. Nada de globales — el #675 se estrelló justamente por suponer
 * que estaba disponible.
 */

import { convocar } from "./convocatoria-estancia.mjs";

export const TIPO_CONVOCATORIA = "convocatoria-estancia";

function canalSocket(moduleId) {
  return `module.${moduleId}`;
}

let moduloConfigurado = null;
let abrirEstancia = null;
const escuchas = [];

/**
 * Engancha la convocatoria. Idempotente: volver a llamarla retira la escucha
 * anterior antes de poner la nueva, igual que `registrarAsistencia`.
 *
 * @param {string} moduleId id del módulo, para el canal `module.<id>`.
 * @param {{abrir:(idEstancia:string)=>void}} opciones `abrir` es la forma de
 *        abrir la ventana de Andar; la pasa `main.mjs`.
 * @returns {() => void} retira la escucha.
 */
export function registrarConvocatoriaEstancia(moduleId, { abrir } = {}) {
  moduloConfigurado = moduleId;
  abrirEstancia = typeof abrir === "function" ? abrir : null;
  while (escuchas.length) escuchas.pop()();

  const receptor = (mensaje) => {
    if (mensaje?.tipo !== TIPO_CONVOCATORIA) return;
    if (!mensaje?.idEstancia) return;
    // Sin forma de abrir no se puede obedecer, y callarlo es lo que dejó el
    // bug de #689 sin descubrir durante todo un PR.
    if (!abrirEstancia) {
      console.error("[lagunak] convocatoria recibida sin forma de abrir la ventana");
      return;
    }
    abrirEstancia(mensaje.idEstancia);
  };

  game.socket?.on(canalSocket(moduleId), receptor);
  const retirar = () => game.socket?.off?.(canalSocket(moduleId), receptor);
  escuchas.push(retirar);
  return retirar;
}

/**
 * Convoca a la tripulación a `idEstancia` y lo transmite.
 *
 * Devuelve `false` sin transmitir nada cuando no se puede ir —quien llama no es
 * GM, la estancia no existe o su entrada está bloqueada—, que son los tres
 * casos en que `convocar()` devuelve `null`.
 *
 * El GM que convoca también abre su ventana: `game.socket.emit` no se
 * autoentrega, así que sin esto el único que no llegaría es quien convoca.
 *
 * @returns {boolean} si la convocatoria salió.
 */
export function convocarYTransmitir(idEstancia, { catalogo = undefined } = {}) {
  if (!game.user?.isGM) return false;

  const posicion = catalogo
    ? convocar(idEstancia, "GM", { catalogo })
    : convocar(idEstancia, "GM");
  if (!posicion) return false;

  game.socket?.emit(canalSocket(moduloConfigurado), {
    tipo: TIPO_CONVOCATORIA,
    idEstancia,
    posicion,
  });
  abrirEstancia?.(idEstancia);
  return true;
}

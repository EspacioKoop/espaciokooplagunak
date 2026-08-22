// Convocar a la tripulación a una estancia (la playa, el museo, la cantina...).
// Se encarga de difundir el resultado de convocar a todos los clientes cuando
// el GM la convoca, de modo que la ventana de Andar se abra en el punto de
// llegada para cada jugador.
//
// Se basa en el mismo patrón que registrarSesionesMinijuegos y registrarAsistencia.

import { convocar } from "./convocatoria-estancia.mjs";

let moduloConfigurado = null;
let desregistrar = () => {};

// Mensajes del canal de convocatoria de estancias.
const MENSAJE_CONVOCATORIA = "convocatoria-estancia";

function canalSocket(moduleId) {
  return `module.${moduleId}`;
}

/**
 * Convoca a la tripulación a la estancia indicada y, si el resultado es válido,
 * lo difunde a todos los clientes (incluido el propio GM) a través del socket.
 * Sólo el GM activo puede realizar esta acción.
 *
 * @param {string} idEstancia id del catálogo por el que se anda (ej. "playa", "museo").
 */
export function convocarYTransmitir(idEstancia) {
  if (!moduloConfigurado) return;
  if (!game.user?.isGM) return;

  const posicion = convocar(idEstancia, "GM");
  if (!posicion) return;

  // Difundir la posición a todos los clientes del módulo.
  game.socket?.emit(canalSocket(moduloConfigurado), {
    tipo: MENSAJE_CONVOCATORIA,
    posicion,
  });
}

/**
 * Registra los listeners necesarios para recibir la difusión de convocatorias
 * y abrir la ventana de Andar en el punto indicado.
 *
 * @param {string} moduleId el ID del módulo (foundry-module).
 */
export function registrarConvocatoriaEstancia(moduleId) {
  moduloConfigurado = moduleId;
  desregistrar();

  const escuchas = [];

  // Listener para mensajes de convocatoria de estancias.
  const receptor = (mensaje) => {
    if (mensaje?.tipo !== MENSAJE_CONVOCATORIA) return;
    const { posicion } = mensaje;
    if (!posicion) return;

    // Abrir (o re-enfocar) la ventana de Andar en la posición recibida.
    abrirAndarNave(posicion);
  };
  game.socket?.on(canalSocket(moduloConfigurado), receptor);
  escuchas.push(() => game.socket?.off?.(canalSocket(moduloConfigurado), receptor));

  desregistrar = () => {
    for (const parar of escuchas) parar();
    desregistrar = () => {};
  };
}

// No se exporta nada más; el módulo se registra una vez en main.mjs y
// se usa la función exportada `convocarYTransmitir` desde los botones del GM.
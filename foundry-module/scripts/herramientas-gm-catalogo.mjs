/**
 * Catálogo de las herramientas solo-GM del grupo propio de controles de
 * escena (issue #611): quién es cada botón, con qué icono y por qué es
 * solo-GM, en un archivo aparte de `main.mjs` para que añadir o tocar una de
 * estas tres herramientas no toque las mismas líneas que cualquier otro
 * cambio del grupo de controles.
 *
 * Puro a propósito: no importa nada de Foundry ni de `main.mjs`. Los
 * manejadores de clic (`abrirPanelGM`, `abrirAndarNave`) siguen viviendo en
 * `main.mjs` — este módulo los recibe como parámetros explícitos en vez de
 * importarlos, que crearía un ciclo (main.mjs -> catálogo -> main.mjs).
 */

/**
 * @param {{ abrirPanelGM: () => void, abrirAndarNave: (estancia?: string|null) => void }} manejadores
 * @returns {Array<object>} las herramientas solo-GM del grupo, en el mismo
 *   orden y forma que espera `getSceneControlButtons` (rama v11/v12 y v13
 *   comparten esta forma; la bifurcación de array/record vive en
 *   `control-escena.mjs`, #448).
 */
export function construirHerramientasGM({ abrirPanelGM, abrirAndarNave }) {
  return [
    {
      // Puerta única al panel de GM (#448), que sustituye los botones
      // sueltos (consola caliente, token, diagnóstico, música, decorado,
      // ficha) por un catálogo interno — ver `ACCIONES_PANEL_GM` y
      // `panel-gm.mjs`.
      name: "lagunak-panel-gm",
      title: "LAGUNAK.Controles.AbrirPanelGM",
      icon: "fa-solid fa-shuttle-space",
      button: true,
      onClick: () => abrirPanelGM(),
    },
    {
      // La playa de pruebas (#587). SOLO GM, y no por privilegio de
      // información —una playa no revela nada de la partida— sino porque no
      // es contenido: es un banco de pruebas del motor de exteriores, y
      // ofrecérselo a la tripulación en la misma barra que su puesto sería
      // decir que forma parte del juego. Se vuelve a la nave por la cabina
      // de teléfono, que es su único punto de interacción.
      name: "lagunak-playa",
      title: "LAGUNAK.Controles.AbrirPlaya",
      icon: "fa-solid fa-umbrella-beach",
      button: true,
      onClick: () => abrirAndarNave("playa"),
    },
    {
      // La sala del museo (#598). Solo GM por el mismo motivo que la playa:
      // no es contenido de campaña, es un sitio que ENSEÑA piezas con su
      // procedencia. No concede nada y no recuerda la visita.
      name: "lagunak-museo",
      title: "LAGUNAK.Controles.AbrirMuseo",
      icon: "fa-solid fa-landmark",
      button: true,
      onClick: () => abrirAndarNave("museo"),
    },
  ];
}

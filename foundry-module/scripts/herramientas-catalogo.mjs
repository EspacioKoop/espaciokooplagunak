/**
 * Catálogo de herramientas solo-GM para el grupo de controles de escena.
 * Cada herramienta es un objeto con las propiedades necesarias para
 * `Hooks.on("getSceneControlButtons")`.
 *
 * Al separar estas herramientas en su propio archivo, evitamos editar
 * `main.mjs` cada vez que se añade, elimina o modifica una herramienta
 * solo-GM, reduciendo así un punto de colisión estructural.
 *
 * @returns {Array<Object>} Array de herramientas para el GM.
 */
export function obtenerHerramientasGM() {
  return [
    {
      name: "lagunak-panel-gm",
      title: "LAGUNAK.Controles.AbrirPanelGM",
      icon: "fa-solid fa-shuttle-space",
      button: true,
      onClick: () => abrirPanelGM(),
    },
    {
      name: "lagunak-playa",
      title: "LAGUNAK.Controles.AbrirPlaya",
      icon: "fa-solid fa-umbrella-beach",
      button: true,
      onClick: () => abrirAndarNave("playa"),
    },
    {
      name: "lagunak-museo",
      title: "LAGUNAK.Controles.AbrirMuseo",
      icon: "fa-solid fa-landmark",
      button: true,
      onClick: () => abrirAndarNave("museo"),
    },
  ];
}

/**
 * Herramienta activa para el grupo de controles de escena.
 * Devuelve el nombre de la herramienta activa según el rol del usuario.
 * Actualmente, solo el GM tiene una herramienta activa (el panel de GM).
 * Los usuarios no GM no tienen herramienta activa en este grupo (se usan
 * las herramientas de puesto y avatar que se añaden después).
 *
 * @param {boolean} isGM - Indica si el usuario actual es GM.
 * @returns {string|null} Nombre de la herramienta activa o null si no hay.
 */
export function obtenerHerramientaActiva(isGM) {
  return isGM ? "lagunak-panel-gm" : null;
}

/**
 * Difusión del nivel de alerta a toda la mesa y su aplicación visual.
 *
 * Capa fina sobre `nivel-alerta.mjs` (que es puro y tiene las pruebas de la
 * lógica). Aquí solo hay transporte y presentación:
 *
 * - solo el GM recibe `/v1/state`, así que solo él calcula el nivel y lo
 *   **publica** en un ajuste de mundo;
 * - todos los clientes lo **leen** de ese ajuste y tiñen su pantalla. Un ajuste
 *   de mundo se propaga solo y sobrevive a la recarga, así que un jugador que
 *   entra tarde ve la alerta vigente sin esperar al siguiente sondeo;
 * - no se toca ningún documento de escena. La alerta es una capa de
 *   presentación sobre el tablero: al bajar a verde no queda rastro que limpiar
 *   en el mundo del GM.
 *
 * El nivel es información de ambiente, no información oculta: la tripulación
 * sabría perfectamente que su nave está en alerta roja.
 */

import { nivelDeAlerta } from "./nivel-alerta.mjs";

export const AJUSTE_NIVEL_ALERTA = "nivelAlertaNave";
const CLASE_BASE = "lagunak-alerta";

export function registrarAjusteAlerta(moduleId, ajustes = game.settings) {
  ajustes.register(moduleId, AJUSTE_NIVEL_ALERTA, {
    scope: "world",
    config: false,
    type: String,
    default: "verde",
  });
}

/**
 * Aplica el nivel al `<body>` como clase. Puro respecto a Foundry salvo el
 * elemento que se le pasa, para poder probarlo con un doble.
 */
export function aplicarNivelAlBody(nivel, body = document.body) {
  if (!body?.classList) return null;
  for (const clase of [...body.classList]) {
    if (clase.startsWith(`${CLASE_BASE}-`)) body.classList.remove(clase);
  }
  const aplicado = typeof nivel === "string" && nivel !== "verde" ? nivel : null;
  if (aplicado) body.classList.add(`${CLASE_BASE}-${aplicado}`);
  return aplicado;
}

/**
 * Publica el nivel derivado del estado, solo si cambió. Devuelve el nivel
 * vigente. Evitar la escritura redundante importa: un ajuste de mundo se
 * difunde a todos los clientes en cada `set`.
 */
export async function publicarNivelAlerta({
  moduleId,
  nave,
  ajustes = game.settings,
  esGM = Boolean(game.user?.isGM),
  hooks = globalThis.Hooks,
}) {
  const previo = ajustes.get(moduleId, AJUSTE_NIVEL_ALERTA) ?? "verde";
  if (!esGM) return previo;
  const nivel = nivelDeAlerta(nave, previo);
  if (nivel === previo) return previo;
  await ajustes.set(moduleId, AJUSTE_NIVEL_ALERTA, nivel);
  hooks?.callAll?.("lagunakNivelAlerta", nivel, previo);
  return nivel;
}

/**
 * Conecta la lectura en todos los clientes: aplica el nivel vigente al entrar y
 * reacciona a cada cambio del ajuste. Devuelve una función para desregistrar,
 * como el resto de cableados del módulo.
 */
export function registrarEscuchaAlerta(moduleId, { hooks = globalThis.Hooks, ajustes = game.settings, body } = {}) {
  aplicarNivelAlBody(ajustes.get(moduleId, AJUSTE_NIVEL_ALERTA), body ?? document.body);

  const alCambiarAjuste = (setting) => {
    if (setting?.key !== `${moduleId}.${AJUSTE_NIVEL_ALERTA}`) return;
    aplicarNivelAlBody(setting.value, body ?? document.body);
  };
  hooks.on("updateSetting", alCambiarAjuste);
  return () => hooks.off("updateSetting", alCambiarAjuste);
}

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

import { nivelDeAlerta, motivosDeAlerta } from "./nivel-alerta.mjs";

export const AJUSTE_NIVEL_ALERTA = "nivelAlertaNave";
const CLASE_BASE = "lagunak-alerta";
const ID_AVISO = "lagunak-alerta-aviso";

/**
 * Normaliza lo que haya en el ajuste a un aviso `{ nivel, motivos }`. El ajuste
 * guardó una cadena suelta en versiones anteriores, y un mundo ya en marcha la
 * conserva: se acepta y se trata como un nivel sin motivos, en vez de romper.
 */
export function normalizarAviso(valor) {
  if (typeof valor === "string") return { nivel: valor || "verde", motivos: [] };
  const nivel = typeof valor?.nivel === "string" ? valor.nivel : "verde";
  const motivos = Array.isArray(valor?.motivos) ? valor.motivos.filter((m) => typeof m === "string") : [];
  return { nivel, motivos };
}

export function registrarAjusteAlerta(moduleId, ajustes = game.settings) {
  ajustes.register(moduleId, AJUSTE_NIVEL_ALERTA, {
    scope: "world",
    config: false,
    type: Object,
    default: { nivel: "verde", motivos: [] },
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
 * Pinta el aviso TEXTUAL de alerta: el borde de color por sí solo comunicaría
 * por color en solitario, que es justo lo que no debe hacerse (WCAG 1.4.1) y
 * deja fuera a quien use lector de pantalla. Región `role="status"` con el
 * nivel y sus motivos en texto, para toda la mesa y no solo para el GM.
 *
 * Se reutiliza el mismo nodo entre cambios en vez de recrearlo, para que el
 * lector anuncie una actualización y no la aparición de una región nueva.
 */
export function aplicarAvisoAlerta(aviso, { body = document.body, i18n } = {}) {
  if (!body?.classList) return null;
  const { nivel, motivos } = normalizarAviso(aviso);
  // `game` no existe fuera de Foundry: se resuelve al usarlo, no al declarar el
  // parámetro, para que el módulo siga siendo probable desde Node.
  const traduccion = i18n ?? globalThis.game?.i18n;
  const traducir = (clave) => traduccion?.localize?.(clave) ?? clave;

  let nodo = body.querySelector?.(`#${ID_AVISO}`) ?? null;
  if (nivel === "verde") {
    nodo?.remove?.();
    return null;
  }

  if (!nodo) {
    nodo = body.ownerDocument?.createElement?.("div") ?? document.createElement("div");
    nodo.id = ID_AVISO;
    nodo.setAttribute("role", "status");
    nodo.setAttribute("aria-live", "polite");
    body.appendChild(nodo);
  }
  nodo.className = `${CLASE_BASE}-aviso ${CLASE_BASE}-aviso--${nivel}`;

  const etiqueta = traducir(`LAGUNAK.Alerta.Nivel.${nivel}`);
  const detalle = motivos.map(traducir).join(" · ");
  const texto = detalle ? `${etiqueta} · ${detalle}` : etiqueta;
  if (nodo.textContent !== texto) nodo.textContent = texto;
  return texto;
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
  const avisoPrevio = normalizarAviso(ajustes.get(moduleId, AJUSTE_NIVEL_ALERTA));
  if (!esGM) return avisoPrevio.nivel;
  const nivel = nivelDeAlerta(nave, avisoPrevio.nivel);
  const motivos = motivosDeAlerta(nave, nivel);
  // También se escribe si cambian solo los MOTIVOS con el mismo nivel: pasar de
  // «casco dañado» a «casco dañado + sistemas inutilizados» es información que
  // la mesa necesita, aunque el borde siga siendo del mismo color.
  const igual =
    nivel === avisoPrevio.nivel &&
    motivos.length === avisoPrevio.motivos.length &&
    motivos.every((motivo, i) => motivo === avisoPrevio.motivos[i]);
  if (igual) return avisoPrevio.nivel;
  await ajustes.set(moduleId, AJUSTE_NIVEL_ALERTA, { nivel, motivos });
  hooks?.callAll?.("lagunakNivelAlerta", nivel, avisoPrevio.nivel);
  return nivel;
}

/**
 * Conecta la lectura en todos los clientes: aplica el nivel vigente al entrar y
 * reacciona a cada cambio del ajuste. Devuelve una función para desregistrar,
 * como el resto de cableados del módulo.
 */
export function registrarEscuchaAlerta(moduleId, { hooks = globalThis.Hooks, ajustes = game.settings, body, i18n } = {}) {
  const destino = body ?? document.body;
  const pintar = (valor) => {
    const aviso = normalizarAviso(valor);
    aplicarNivelAlBody(aviso.nivel, destino);
    aplicarAvisoAlerta(aviso, { body: destino, i18n });
  };
  pintar(ajustes.get(moduleId, AJUSTE_NIVEL_ALERTA));

  const alCambiarAjuste = (setting) => {
    if (setting?.key !== `${moduleId}.${AJUSTE_NIVEL_ALERTA}`) return;
    pintar(setting.value);
  };
  hooks.on("updateSetting", alCambiarAjuste);
  return () => hooks.off("updateSetting", alCambiarAjuste);
}

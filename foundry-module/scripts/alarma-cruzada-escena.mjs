/**
 * Difusión de la alarma cruzada (#482) y su aplicación por puesto.
 *
 * Capa fina sobre `alarma-cruzada.mjs` (puro, con las pruebas de la lógica).
 * Mismo transporte que `alerta-escena.mjs` y por el mismo motivo documentado
 * en `telemetria-difusion.mjs`: un ajuste de mundo, no un socket —el socket
 * de Foundry no está autenticado por puesto, y el GM ya es quien recibe
 * `/v1/state` y calcula la alarma—. Todos los clientes leen el mismo ajuste;
 * cada uno solo pinta si su puesto está en `PUESTOS_ALARMA_CRUZADA`, y con la
 * variante (causa/efecto) que le corresponde.
 */

import {
  alarmaCruzadaActiva,
  datosAlarmaCruzada,
  textoAlarmaCruzada,
} from "./alarma-cruzada.mjs";
import { localizeSystemName } from "./ship-view/ship-view.mjs";

export const AJUSTE_ALARMA_CRUZADA = "alarmaCruzadaReactorEscudos";
const CLASE_BASE = "lagunak-alarma-cruzada";
const ID_AVISO = "lagunak-alarma-cruzada-aviso";

/** Normaliza lo que haya en el ajuste a `{ activa, datos }`. */
export function normalizarAlarmaCruzada(valor) {
  return { activa: Boolean(valor?.activa), datos: valor?.datos ?? null };
}

export function registrarAjusteAlarmaCruzada(moduleId, ajustes = game.settings) {
  ajustes.register(moduleId, AJUSTE_ALARMA_CRUZADA, {
    scope: "world",
    config: false,
    type: Object,
    default: { activa: false, datos: null },
  });
}

/**
 * Publica el estado derivado del `/v1/state` actual, solo si cambió (entra o
 * sale de la correlación). Solo el GM calcula y escribe —los demás clientes
 * devuelven el valor vigente sin tocar el ajuste—, mismo patrón que
 * `publicarNivelAlerta`.
 */
export async function publicarAlarmaCruzada({
  moduleId,
  nave,
  ajustes = game.settings,
  esGM = Boolean(game.user?.isGM),
  hooks = globalThis.Hooks,
}) {
  const previo = normalizarAlarmaCruzada(ajustes.get(moduleId, AJUSTE_ALARMA_CRUZADA));
  if (!esGM) return previo.activa;
  const activa = alarmaCruzadaActiva(nave, previo.activa);
  if (activa === previo.activa) return previo.activa;
  const datos = activa ? datosAlarmaCruzada(nave) : null;
  await ajustes.set(moduleId, AJUSTE_ALARMA_CRUZADA, { activa, datos });
  hooks?.callAll?.("lagunakAlarmaCruzada", activa, datos);
  return activa;
}

/**
 * Pinta (o retira) el aviso textual de la alarma para EL PUESTO de este
 * cliente. Región `role="status"`, mismo motivo WCAG 1.4.1 que
 * `aplicarAvisoAlerta`: la alarma no puede depender solo de un color o icono.
 * Sin `puesto` en `PUESTOS_ALARMA_CRUZADA` (otro puesto, o sin puesto
 * asignado) no pinta nada — esta alarma no le concierne a ese cliente.
 */
export function aplicarAvisoAlarmaCruzada(valor, { body = document.body, i18n, puesto } = {}) {
  if (!body?.classList) return null;
  const { activa, datos } = normalizarAlarmaCruzada(valor);
  const texto = activa ? textoAlarmaCruzada(datos, puesto) : null;

  let nodo = body.querySelector?.(`#${ID_AVISO}`) ?? null;
  if (!texto) {
    nodo?.remove?.();
    return null;
  }

  const traduccion = i18n ?? globalThis.game?.i18n;
  const traducir = (clave, formato) => traduccion?.format?.(clave, formato) ?? traduccion?.localize?.(clave) ?? clave;

  if (!nodo) {
    nodo = body.ownerDocument?.createElement?.("div") ?? document.createElement("div");
    nodo.id = ID_AVISO;
    nodo.setAttribute("role", "status");
    nodo.setAttribute("aria-live", "polite");
    body.appendChild(nodo);
  }
  nodo.className = `${CLASE_BASE}-aviso`;

  const datosFormato = { ...texto.datos };
  if (typeof datosFormato.sistemaEscudo === "string") {
    datosFormato.sistemaEscudo = localizeSystemName(datosFormato.sistemaEscudo, traduccion);
  }
  const titulo = traducir(texto.tituloKey);
  const resumen = traducir(texto.resumenKey, datosFormato);
  const contenido = `${titulo} · ${resumen}`;
  if (nodo.textContent !== contenido) nodo.textContent = contenido;
  return contenido;
}

/**
 * Conecta la lectura en un cliente: aplica el estado vigente al entrar y
 * reacciona a cada cambio del ajuste. `resolverPuesto()` se evalúa en cada
 * repintado (no una vez al registrar) para que decida la variante correcta
 * incluso si el puesto de este cliente cambia en plena sesión —relevo, #483—
 * sin esperar a que la alarma misma cambie de estado. También se repinta al
 * cambiar el propio documento `User` (donde vive el flag de puesto), por si
 * el relevo llega sin que la alarma cambie mientras tanto. Devuelve una
 * función para desregistrar, como el resto de escuchas del módulo.
 */
export function registrarEscuchaAlarmaCruzada(
  moduleId,
  { hooks = globalThis.Hooks, ajustes = game.settings, body, i18n, resolverPuesto = () => null, game: gameRef = globalThis.game } = {},
) {
  const destino = body ?? document.body;
  const repintar = () =>
    aplicarAvisoAlarmaCruzada(ajustes.get(moduleId, AJUSTE_ALARMA_CRUZADA), {
      body: destino,
      i18n,
      puesto: resolverPuesto(),
    });
  repintar();

  const alCambiarAjuste = (setting) => {
    if (setting?.key !== `${moduleId}.${AJUSTE_ALARMA_CRUZADA}`) return;
    repintar();
  };
  hooks.on("updateSetting", alCambiarAjuste);

  const alCambiarUsuario = (userDoc) => {
    if (userDoc?.id !== gameRef?.user?.id) return;
    repintar();
  };
  hooks.on("updateUser", alCambiarUsuario);

  return () => {
    hooks.off("updateSetting", alCambiarAjuste);
    hooks.off("updateUser", alCambiarUsuario);
  };
}

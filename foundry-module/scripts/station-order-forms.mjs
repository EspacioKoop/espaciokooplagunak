import { esSistemaValido, esNivelValido, esNivelRefrigeranteValido } from "./ingenieria-control.mjs";

// Convierte el texto crudo de un input en número, rechazando ausencia y vacío
// ANTES de convertir: Number("") === 0 colaría una orden a cero como válida
// (rumbo 0, impulso 0, warp 0, nivel 0). Devuelve null si no hay dato utilizable
// —y los predicados `valid`/`esNivelValido` ya rechazan null—.
export function parseOrderValue(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === "") return null;
  const value = Number(text);
  return Number.isNaN(value) ? null : value;
}

function numberFrom(root, id) {
  return parseOrderValue(root?.querySelector?.(`#${id}`)?.value);
}

// Orden de un único campo numérico: valida y devuelve los parámetros o null.
function numericOrder(inputId, param, valid) {
  return (root) => {
    const value = numberFrom(root, inputId);
    return valid(value) ? { [param]: value } : null;
  };
}

// Formularios de orden de puesto: cada acción de UI declara cómo LEE sus
// parámetros del DOM (devolviendo el objeto de params o null si es inválido),
// a qué acción del contrato los emite y qué aviso mostrar si no validan. La
// validación aquí es cortesía de UX; el puente revalida rangos igualmente.
export const ORDER_FORMS = Object.freeze({
  "orden-rumbo": {
    action: "set_target_heading",
    read: numericOrder("lagunak-orden-rumbo", "heading", (n) => Number.isFinite(n) && n >= 0 && n < 360),
    invalidKey: "LAGUNAK.Espacios.Orden.RumboInvalido",
  },
  "orden-impulso": {
    action: "set_impulse",
    read: numericOrder("lagunak-orden-impulso", "value", (n) => Number.isFinite(n) && n >= -1 && n <= 1),
    invalidKey: "LAGUNAK.Espacios.Orden.ImpulsoInvalido",
  },
  "orden-warp": {
    action: "set_warp",
    read: numericOrder("lagunak-orden-warp", "level", (n) => Number.isInteger(n) && n >= 0 && n <= 4),
    invalidKey: "LAGUNAK.Espacios.Orden.WarpInvalido",
  },
  "orden-potencia": {
    action: "set_system_power",
    read: (root) => {
      const system = root?.querySelector?.("#lagunak-orden-sistema")?.value ?? "";
      const level = numberFrom(root, "lagunak-orden-nivel");
      return esSistemaValido(system) && esNivelValido(level) ? { system, level } : null;
    },
    invalidKey: "LAGUNAK.Espacios.Orden.PotenciaInvalida",
  },
  "orden-refrigerante": {
    action: "set_system_coolant",
    read: (root) => {
      const system = root?.querySelector?.("#lagunak-orden-sistema-refrig")?.value ?? "";
      const level = numberFrom(root, "lagunak-orden-nivel-refrig");
      return esSistemaValido(system) && esNivelRefrigeranteValido(level) ? { system, level } : null;
    },
    invalidKey: "LAGUNAK.Espacios.Orden.RefrigeranteInvalida",
  },
  // Auto-reparación: dos acciones con valor fijo (no leen del DOM) que
  // comparten la orden set_auto_repair con `enabled` true/false (#464).
  "orden-reparacion-auto-activar": {
    action: "set_auto_repair",
    read: () => ({ enabled: true }),
    invalidKey: "LAGUNAK.Espacios.Orden.ReparacionAutoInvalido",
  },
  "orden-reparacion-auto-desactivar": {
    action: "set_auto_repair",
    read: () => ({ enabled: false }),
    invalidKey: "LAGUNAK.Espacios.Orden.ReparacionAutoInvalido",
  },
  // Escudos: dos acciones con valor fijo (no leen del DOM) que comparten la
  // orden set_shields con `active` true/false.
  "orden-escudos-subir": {
    action: "set_shields",
    read: () => ({ active: true }),
    invalidKey: "LAGUNAK.Espacios.Orden.EscudosInvalido",
  },
  "orden-escudos-bajar": {
    action: "set_shields",
    read: () => ({ active: false }),
    invalidKey: "LAGUNAK.Espacios.Orden.EscudosInvalido",
  },
  // Comunicaciones (#463): acciones reactivas, calcadas de los globales que el
  // motor ya expone (contestar/cerrar canal ya abierto, elegir diálogo,
  // mandar chat libre) — sin picker de objetivo propio.
  "orden-comms-contestar": {
    action: "answer_comm_hail",
    read: () => ({ accept: true }),
    invalidKey: "LAGUNAK.Espacios.Orden.CommsInvalido",
  },
  "orden-comms-ignorar": {
    action: "answer_comm_hail",
    read: () => ({ accept: false }),
    invalidKey: "LAGUNAK.Espacios.Orden.CommsInvalido",
  },
  "orden-comms-cerrar": {
    action: "close_comm",
    read: () => ({}),
    invalidKey: "LAGUNAK.Espacios.Orden.CommsInvalido",
  },
  "orden-comms-opcion": {
    action: "send_comm_reply",
    read: numericOrder(
      "lagunak-orden-comms-opcion",
      "index",
      (n) => Number.isInteger(n) && n >= 0 && n <= 15,
    ),
    invalidKey: "LAGUNAK.Espacios.Orden.CommsOpcionInvalida",
  },
  "orden-comms-mensaje": {
    action: "send_comm_message",
    read: (root) => {
      const message = root?.querySelector?.("#lagunak-orden-comms-mensaje")?.value?.trim() ?? "";
      return message.length > 0 && message.length <= 256 ? { message } : null;
    },
    invalidKey: "LAGUNAK.Espacios.Orden.CommsMensajeInvalido",
  },
});

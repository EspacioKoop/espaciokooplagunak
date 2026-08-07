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
  // Maniobra de combate (#519). Dos ejes con rangos DISTINTOS a propósito, los
  // del control nativo: el empuje solo va hacia adelante (0..1) y el lateral
  // conserva el signo (−1..1, babor/estribor). Igualarlos "por simetría"
  // inventaría una marcha atrás que la nave no tiene.
  "orden-maniobra-empuje": {
    action: "combat_maneuver_boost",
    read: numericOrder(
      "lagunak-orden-maniobra-empuje",
      "amount",
      (n) => Number.isFinite(n) && n >= 0 && n <= 1,
    ),
    invalidKey: "LAGUNAK.Espacios.Orden.ManiobraEmpujeInvalido",
  },
  "orden-maniobra-lateral": {
    action: "combat_maneuver_strafe",
    read: numericOrder(
      "lagunak-orden-maniobra-lateral",
      "amount",
      (n) => Number.isFinite(n) && n >= -1 && n <= 1,
    ),
    invalidKey: "LAGUNAK.Espacios.Orden.ManiobraLateralInvalido",
  },
  // Atraque (#519). `orden-atracar` elige objetivo por lectura degradada, como
  // escaneo y armas: el timón señala "eso de ahí", no un indicativo que no
  // tiene por qué conocer. Soltar y cancelar no llevan objetivo —el juego sabe
  // de qué atraque habla— y son órdenes distintas: `undock` suelta un atraque
  // consumado, `abort_dock` cancela el acercamiento.
  "orden-atracar": {
    action: "dock",
    read: (root) => leerLecturaSeleccionada(root, "lagunak-orden-objetivo-atraque"),
    invalidKey: "LAGUNAK.Espacios.Orden.AtraqueInvalido",
  },
  "orden-soltar-amarras": {
    action: "undock",
    read: () => ({}),
    invalidKey: "LAGUNAK.Espacios.Orden.AtraqueInvalido",
  },
  "orden-cancelar-atraque": {
    action: "abort_dock",
    read: () => ({}),
    invalidKey: "LAGUNAK.Espacios.Orden.AtraqueInvalido",
  },
  // Escaneo (#462): el valor del <select> no es un indicativo -un eco no
  // tiene uno que el jugador pueda conocer- sino la lectura degradada del
  // contacto elegido (distancia/rumbo con su margen), codificada en JSON por
  // `objetivosDeLectura`/`scanTargetsFor` en station-workspaces.mjs.
  // Resolverla al objeto real ocurre después, en el relé del GM
  // (resolver-objetivo-sensores.mjs), que es quien tiene el sondeo sin
  // degradar.
  "orden-escanear": {
    action: "scan_object",
    read: (root) => leerLecturaSeleccionada(root, "lagunak-orden-objetivo-escaneo"),
    invalidKey: "LAGUNAK.Espacios.Orden.EscaneoInvalido",
  },
  // Armas (#465): mismo problema y misma resolución que el escaneo — el
  // <select> comparte el mismo id entre las dos acciones (un objetivo, dos
  // órdenes posibles sobre él).
  "orden-fijar-objetivo-armas": {
    action: "set_weapon_target",
    read: (root) => leerLecturaSeleccionada(root, "lagunak-orden-objetivo-armas"),
    invalidKey: "LAGUNAK.Espacios.Orden.ObjetivoArmasInvalido",
  },
  "orden-disparar-tubo": {
    action: "fire_tube",
    read: (root) => {
      const lectura = leerLecturaSeleccionada(root, "lagunak-orden-objetivo-armas");
      const index = parseOrderValue(root?.querySelector?.("#lagunak-orden-tubo")?.value);
      if (!lectura || index === null || !Number.isInteger(index) || index < 0 || index > 15) return null;
      return { ...lectura, index };
    },
    invalidKey: "LAGUNAK.Espacios.Orden.DispararTuboInvalido",
  },
  // Autodestrucción (#518). Armar y desarmar no llevan parámetro; confirmar
  // lleva el índice del código Y el código, que el jugador ha tenido que leer
  // en otro sitio —el puente no los conoce y no puede conocerlos—.
  "orden-autodestruccion-armar": {
    action: "activate_self_destruct",
    read: () => ({}),
    invalidKey: "LAGUNAK.Espacios.Orden.AutodestruccionInvalida",
  },
  "orden-autodestruccion-desarmar": {
    action: "cancel_self_destruct",
    read: () => ({}),
    invalidKey: "LAGUNAK.Espacios.Orden.AutodestruccionInvalida",
  },
  "orden-autodestruccion-confirmar": {
    action: "confirm_self_destruct_code",
    read: (root) => {
      const index = parseOrderValue(root?.querySelector?.("#lagunak-orden-codigo-indice")?.value);
      const code = parseOrderValue(root?.querySelector?.("#lagunak-orden-codigo")?.value);
      if (index === null || !Number.isInteger(index) || index < 0 || index > 2) return null;
      if (code === null || !Number.isInteger(code) || code < 0 || code > 4294967295) return null;
      return { index, code };
    },
    invalidKey: "LAGUNAK.Espacios.Orden.CodigoInvalido",
  },
  // Frecuencia de escudos: entero 0..20, el rango del juego.
  "orden-frecuencia-escudos": {
    action: "set_shield_frequency",
    read: numericOrder(
      "lagunak-orden-frecuencia-escudos",
      "frequency",
      (n) => Number.isInteger(n) && n >= 0 && n <= 20,
    ),
    invalidKey: "LAGUNAK.Espacios.Orden.FrecuenciaInvalida",
  },
  // Relay (#517). Los puntos de ruta y las sondas se colocan por RUMBO Y
  // DISTANCIA, no por coordenada: la consola de un puesto no publica las
  // coordenadas del mundo y no debería, así que pedirlas sería pedir que se
  // adivinen. El relé del GM las convierte con la posición exacta de la nave
  // (`resolver-posicion-relay.mjs`), igual que ya traduce un objetivo de
  // escaneo. Es además el vocabulario que la tripulación ya usa para hablar de
  // lo que ve.
  "orden-waypoint-colocar": {
    action: "add_waypoint",
    read: (root) => leerRumboYDistancia(root, "waypoint"),
    invalidKey: "LAGUNAK.Espacios.Orden.WaypointInvalido",
  },
  "orden-waypoint-mover": {
    action: "move_waypoint",
    read: (root) => {
      const posicion = leerRumboYDistancia(root, "waypoint");
      const index = parseOrderValue(root?.querySelector?.("#lagunak-orden-waypoint-indice")?.value);
      if (!posicion || index === null || !Number.isInteger(index) || index < 0 || index > 63) {
        return null;
      }
      return { ...posicion, index };
    },
    invalidKey: "LAGUNAK.Espacios.Orden.WaypointInvalido",
  },
  "orden-waypoint-borrar": {
    action: "remove_waypoint",
    read: numericOrder(
      "lagunak-orden-waypoint-indice",
      "index",
      (n) => Number.isInteger(n) && n >= 0 && n <= 63,
    ),
    invalidKey: "LAGUNAK.Espacios.Orden.WaypointIndiceInvalido",
  },
  "orden-sonda-lanzar": {
    action: "launch_probe",
    read: (root) => leerRumboYDistancia(root, "sonda"),
    invalidKey: "LAGUNAK.Espacios.Orden.SondaInvalida",
  },
  // El enlace sonda→ciencia sí señala un OBJETO (la sonda ya lanzada), así que
  // va por lectura degradada como el escaneo y las armas: la sonda es un
  // contacto más, y Relay no tiene por qué saber qué indicativo le puso el
  // juego a la suya.
  "orden-sonda-enlazar": {
    action: "set_science_link",
    read: (root) => leerLecturaSeleccionada(root, "lagunak-orden-objetivo-sonda"),
    invalidKey: "LAGUNAK.Espacios.Orden.EnlaceSondaInvalido",
  },
  "orden-sonda-desenlazar": {
    action: "clear_science_link",
    read: () => ({}),
    invalidKey: "LAGUNAK.Espacios.Orden.EnlaceSondaInvalido",
  },
  // Condición de alerta: catálogo cerrado y una acción por nivel, no un campo
  // libre. Tres botones dicen lo que hay; un desplegable con "otros" no.
  "orden-alerta-normal": {
    action: "set_alert_level",
    read: () => ({ level: "normal" }),
    invalidKey: "LAGUNAK.Espacios.Orden.AlertaInvalida",
  },
  "orden-alerta-amarilla": {
    action: "set_alert_level",
    read: () => ({ level: "yellow" }),
    invalidKey: "LAGUNAK.Espacios.Orden.AlertaInvalida",
  },
  "orden-alerta-roja": {
    action: "set_alert_level",
    read: () => ({ level: "red" }),
    invalidKey: "LAGUNAK.Espacios.Orden.AlertaInvalida",
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

/**
 * Decodifica la lectura degradada (distancia/rumbo con su margen) que un
 * `<select>` de objetivo dejó en su `value` como JSON — compartido por
 * escaneo (#462) y armas (#465): mismo formato, mismo origen
 * (`objetivosDeLectura` en station-workspaces.mjs).
 */
function leerLecturaSeleccionada(root, selectId) {
  const raw = root?.querySelector?.(`#${selectId}`)?.value ?? "";
  if (!raw) return null;
  let lectura;
  try {
    lectura = JSON.parse(raw);
  } catch {
    return null;
  }
  const distancia = parseOrderValue(lectura?.distancia);
  const rumboDeg = parseOrderValue(lectura?.rumboDeg);
  if (distancia === null || rumboDeg === null) return null;
  return {
    distancia,
    rumboDeg,
    precision: parseOrderValue(lectura?.precision) ?? 0,
    rumboPrecision: parseOrderValue(lectura?.rumboPrecision) ?? 0,
  };
}

/**
 * Lee el par rumbo/distancia de un bloque de Relay (#517). Devuelve la misma
 * forma que una lectura degradada para que el relé del GM la convierta con
 * `resolver-posicion-relay.mjs` sin tratar este caso aparte.
 *
 * La distancia admite el cero —marcar la propia posición es algo que un relay
 * hace— pero no valores negativos: "hacia atrás" se dice con el rumbo.
 */
function leerRumboYDistancia(root, prefijo) {
  const rumboDeg = parseOrderValue(root?.querySelector?.(`#lagunak-orden-${prefijo}-rumbo`)?.value);
  const distancia = parseOrderValue(root?.querySelector?.(`#lagunak-orden-${prefijo}-distancia`)?.value);
  if (rumboDeg === null || distancia === null) return null;
  if (!Number.isFinite(rumboDeg) || rumboDeg < 0 || rumboDeg >= 360) return null;
  if (!Number.isFinite(distancia) || distancia < 0 || distancia > 500000) return null;
  return { rumboDeg, distancia };
}

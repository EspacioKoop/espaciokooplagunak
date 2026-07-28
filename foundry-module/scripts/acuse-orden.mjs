// Acuse de orden y delta ordenado/real (#331, paso 2).
//
// El problema. Hoy `submitStationOrder` emite y muere en un «Orden enviada». El
// jugador no sabe si llegó, si el GM la aceptó, ni si la nave hizo caso. Ese
// delta ES el juego: es la diferencia entre un timón y un formulario. Una nave
// pesada tarda en girar, y ver «ordenado 090 / real 073» convergiendo es lo que
// hace sentir que se pilota algo con masa.
//
// De dónde sale cada mitad, que no es el mismo sitio:
//
// - **Ordenado** viene del ACUSE del GM. El relé ya recibía el resultado del
//   puente en `onResult`/`onError` con el `userId` de quien la emitió; hasta
//   ahora se tiraba a la basura. Vuelve a la consola que la emitió y a ninguna
//   otra: la orden de Navegación no es asunto de Armas.
// - **Real** viene de la TELEMETRÍA, que desde #331 llega a toda la tripulación.
//   Por eso este paso depende de aquel: sin telemetría abierta, la mitad derecha
//   del delta no existiría para quien más la necesita.
//
// Puro: ni Foundry, ni DOM, ni red.

export const TIPO_ACUSE = "lagunak:acuse-orden";

export const ACUSE_ESTADOS = Object.freeze(["enviada", "aceptada", "rechazada"]);

/**
 * De qué lectura de telemetría es reflejo cada orden.
 *
 * `null` significa **el puente no publica esa lectura**, y es un dato honesto y
 * no un hueco por rellenar: `/v1/state` trae rumbo, energía, casco, escudos y el
 * detalle por sistema, pero NO el impulso ni el warp vigentes. Para esas dos, la
 * consola enseña lo ordenado y dice que no hay lectura, en vez de inventarse un
 * «real» que sería el mismo número que se acaba de pedir — que es justo la
 * mentira que este paso viene a quitar.
 */
export const LECTURA_REAL = Object.freeze({
  set_target_heading: "heading",
  set_impulse: null,
  set_warp: null,
  set_system_power: "sistema.power",
  set_system_coolant: "sistema.coolant",
  set_shields: "shields_active",
});

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Sobre de acuse, dirigido al usuario que emitió la orden. */
export function sobreAcuse({ userId, order, ok, codigo = null }) {
  if (!userId || !order?.action) return null;
  return {
    tipo: TIPO_ACUSE,
    destinatarioId: userId,
    accion: order.action,
    params: order.params ?? {},
    estado: ok ? "aceptada" : "rechazada",
    codigo: ok ? null : codigo,
    sello: Date.now(),
  };
}

/**
 * Acepta un acuse dirigido a mí. Cada cliente descarta lo que no va a su
 * usuario: es la misma privacidad de interfaz que las manos del póker, y por el
 * mismo canal.
 */
export function aceptarAcuse(mensaje, miUserId) {
  if (mensaje?.tipo !== TIPO_ACUSE) return null;
  if (!miUserId || mensaje.destinatarioId !== miUserId) return null;
  return mensaje;
}

/**
 * Lectura real vigente para una orden, sacada de la telemetría.
 *
 * Devuelve `{ disponible, valor }` y no un número suelto: `null` tendría que
 * significar a la vez «el puente no lo publica» y «todavía no ha llegado nada»,
 * y en una consola de mando esas dos cosas se explican distinto.
 */
export function lecturaReal(accion, params, ship) {
  const ruta = LECTURA_REAL[accion];
  if (ruta === undefined || ruta === null) return { disponible: false, valor: null };
  if (!ship) return { disponible: false, valor: null };

  if (ruta === "heading") return { disponible: true, valor: numero(ship.heading) };
  if (ruta === "shields_active") return { disponible: true, valor: Boolean(ship.shields_active) };

  // Órdenes por sistema: la lectura vive dentro del sistema que nombra la orden.
  const [, campo] = ruta.split(".");
  const sistema = ship.systems?.[params?.system];
  if (!sistema) return { disponible: false, valor: null };
  return { disponible: true, valor: numero(sistema[campo]) };
}

/** Valor pedido por la orden, sea cual sea el nombre del parámetro. */
export function valorOrdenado(accion, params) {
  if (accion === "set_target_heading") return numero(params?.heading);
  if (accion === "set_impulse") return numero(params?.impulse);
  if (accion === "set_warp") return numero(params?.warp);
  if (accion === "set_system_power") return numero(params?.value);
  if (accion === "set_system_coolant") return numero(params?.value);
  if (accion === "set_shields") return Boolean(params?.active);
  return null;
}

/**
 * Estado de la última orden de este puesto, listo para pintar.
 *
 * `convergido` no es «son iguales»: un rumbo de 359 y uno de 001 distan dos
 * grados, no trescientos cincuenta y ocho. Compararlos a lo bruto marcaría como
 * «no obedecida» una nave que ya está donde se le pidió.
 */
export function estadoOrden({ acuse, ship, toleranciaRumbo = 2 } = {}) {
  if (!acuse?.accion) return null;
  const ordenado = valorOrdenado(acuse.accion, acuse.params);
  const { disponible, valor: real } = lecturaReal(acuse.accion, acuse.params, ship);

  let convergido = null;
  if (disponible && typeof ordenado === "number" && typeof real === "number") {
    if (acuse.accion === "set_target_heading") {
      const diferencia = Math.abs(((ordenado - real + 540) % 360) - 180);
      convergido = diferencia <= toleranciaRumbo;
    } else {
      convergido = Math.abs(ordenado - real) < 0.01;
    }
  } else if (disponible && typeof ordenado === "boolean") {
    convergido = ordenado === real;
  }

  return {
    accion: acuse.accion,
    estado: ACUSE_ESTADOS.includes(acuse.estado) ? acuse.estado : "enviada",
    codigo: acuse.codigo ?? null,
    ordenado,
    real,
    hayLecturaReal: disponible,
    convergido,
    sistema: acuse.params?.system ?? null,
  };
}

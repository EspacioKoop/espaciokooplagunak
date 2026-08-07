/**
 * Nivel de alerta de la nave (verde / amarilla / roja) derivado del `/v1/state`
 * que el módulo ya recibe. Lógica pura: sin Foundry, sin red, sin reloj.
 *
 * Complementa a `alertas-nave.mjs` sin solaparse con él. Aquel detecta **flancos**
 * —el instante en que se cruza un umbral— y los anota una vez en la bitácora.
 * Este describe el **estado sostenido** de la nave, que es lo que la mesa
 * necesita ver de un vistazo mientras dura.
 *
 * Autoridad: la simulación es dueña de los valores; esto solo los traduce a una
 * lectura de presentación. No escribe de vuelta a la simulación ni acciona nada.
 *
 * NO CONFUNDIR CON LA CONDICIÓN DE ALERTA DE RELAY (#517). Desde que el puesto
 * de Relay puede fijar `alert_level` en la simulación, hay dos cosas en esta
 * mesa que se llaman «alerta», y conviene tener clarísimo que no son la misma:
 *
 * - Lo de aquí es un **diagnóstico**: lo deduce el módulo del casco, la energía
 *   y los sistemas caídos. Nadie lo decide; describe cómo está la nave.
 * - La condición de Relay es una **declaración**: la tripulación pone la nave
 *   en amarilla o roja porque ha decidido hacerlo. La publica `/v1/state` en
 *   `alert_level` y la consola de Relay la muestra tal cual.
 *
 * Conviven a propósito y no se sincronizan: una nave intacta puede estar en
 * alerta roja porque viene algo, y una hecha trizas puede seguir en normal
 * porque nadie ha dado la orden. Derivar una de la otra borraría justamente la
 * decisión que hace de Relay un puesto. Lo que sí se cuida es que no se
 * confundan en pantalla: los textos de la consola dicen «condición declarada»
 * y este diagnóstico se presenta como aviso de la escena.
 */

export const NIVELES = Object.freeze(["verde", "amarilla", "roja"]);

// Umbrales de entrada y salida por nivel, como fracción [0,1] del máximo.
// Son de presentación, se ajustan aquí sin tocar puente ni simulación.
export const UMBRALES = Object.freeze({
  // Se entra en roja por debajo de `entrar` y no se sale hasta recuperar
  // `salir`. La banda entre ambos es la histéresis.
  rojaCasco: Object.freeze({ entrar: 0.3, salir: 0.4 }),
  rojaEnergia: Object.freeze({ entrar: 0.1, salir: 0.2 }),
  amarillaCasco: Object.freeze({ entrar: 0.7, salir: 0.8 }),
  amarillaEnergia: Object.freeze({ entrar: 0.35, salir: 0.45 }),
});

function fraccion(valor, max) {
  return Number.isFinite(valor) && Number.isFinite(max) && max > 0 ? valor / max : null;
}

// Un sistema con salud <= 0 está inutilizado (convención de EmptyEpsilon).
function sistemasInutilizados(nave) {
  return Object.values(nave?.systems ?? {}).filter((sistema) => {
    const salud = Number(sistema?.health);
    return Number.isFinite(salud) && salud <= 0;
  }).length;
}

// Con histéresis: el umbral aplicable depende de si YA estábamos en ese nivel.
// Sin esto, una nave oscilando en el borde del 30 % de casco haría parpadear la
// escena entre roja y amarilla en cada sondeo, que es peor que no tener aviso.
function porDebajo(fraccionActual, umbral, yaActivo) {
  if (fraccionActual === null) return false;
  return fraccionActual < (yaActivo ? umbral.salir : umbral.entrar);
}

/**
 * Nivel sostenido de la nave. `nivelPrevio` habilita la histéresis; con un valor
 * desconocido o ausente se evalúa como si viniéramos de verde, que es la lectura
 * conservadora (exige cruzar el umbral de entrada, más exigente, para escalar).
 *
 * Devuelve siempre uno de `NIVELES`, y `"verde"` ante un estado inutilizable:
 * sin datos no se inventa una alarma.
 */
export function nivelDeAlerta(nave, nivelPrevio = "verde") {
  if (!nave || typeof nave !== "object") return "verde";
  const previo = NIVELES.includes(nivelPrevio) ? nivelPrevio : "verde";

  const casco = fraccion(nave.hull, nave.hull_max);
  const energia = fraccion(nave.energy, nave.energy_max);
  const inutilizados = sistemasInutilizados(nave);

  const eraRoja = previo === "roja";
  if (
    porDebajo(casco, UMBRALES.rojaCasco, eraRoja) ||
    porDebajo(energia, UMBRALES.rojaEnergia, eraRoja) ||
    // Dos o más sistemas caídos es roja por sí solo: la nave ya no puede
    // operar con normalidad aunque casco y energía aguanten.
    inutilizados >= 2
  ) {
    return "roja";
  }

  const eraAmarillaOPeor = previo !== "verde";
  if (
    porDebajo(casco, UMBRALES.amarillaCasco, eraAmarillaOPeor) ||
    porDebajo(energia, UMBRALES.amarillaEnergia, eraAmarillaOPeor) ||
    inutilizados >= 1
  ) {
    return "amarilla";
  }

  return "verde";
}

/**
 * Motivos legibles del nivel actual, en claves de i18n. La UI los muestra para
 * que el nivel no sea un color inexplicado; devolver la causa es lo que
 * convierte el aviso en información accionable para el GM.
 */
export function motivosDeAlerta(nave, nivel) {
  if (nivel === "verde" || !nave) return [];
  const motivos = [];
  const casco = fraccion(nave.hull, nave.hull_max);
  const energia = fraccion(nave.energy, nave.energy_max);
  const inutilizados = sistemasInutilizados(nave);

  const limiteCasco = nivel === "roja" ? UMBRALES.rojaCasco.salir : UMBRALES.amarillaCasco.salir;
  const limiteEnergia =
    nivel === "roja" ? UMBRALES.rojaEnergia.salir : UMBRALES.amarillaEnergia.salir;

  if (casco !== null && casco < limiteCasco) motivos.push("LAGUNAK.Alerta.Motivo.Casco");
  if (energia !== null && energia < limiteEnergia) motivos.push("LAGUNAK.Alerta.Motivo.Energia");
  if (inutilizados >= 1) motivos.push("LAGUNAK.Alerta.Motivo.Sistemas");
  return motivos;
}

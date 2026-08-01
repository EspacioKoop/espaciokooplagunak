// Qué hace la ventana del mapa con un lote de respuestas a medio llegar
// (#276, paso 0).
//
// El mapa pide `state` y `contacts` JUNTOS a propósito, para que la nave y lo
// que la rodea sean la misma fotografía del simulador y no dos instantes
// distintos. Lo que hacía mal era el after: un `Promise.allSettled` cuyo primer
// rechazo se relanzaba, que es un `all` con pasos de más. Si `contacts` caía se
// tiraba también un `state` que había llegado bien, y la ventana entera se iba
// a «error de conexión».
//
// La regla que aplica este módulo, y que la consola fusionada heredará por
// pestañas:
//
//   1. Lo que llegó bien SE USA. Nunca se descarta un dato bueno porque su
//      compañero de lote fallase.
//   2. Lo que no llegó NO se rellena con lo anterior. Unos contactos de hace
//      tres sondeos pintados como si fueran de ahora no se distinguen de los
//      buenos, y eso es peor que no pintarlos: es la única forma de que el GM
//      dirija sobre algo que ya no está ahí.
//   3. La jerarquía no es simétrica. Sin `state` no hay centro, y sin centro no
//      hay mapa: los contactos se dibujan RELATIVOS a la nave propia, así que
//      unos contactos huérfanos no son media verdad, son coordenadas sin
//      origen. Por eso `state` sí tumba la vuelta y `contacts` no.
//
// Puro: ni Foundry, ni DOM, ni reloj. La ventana es el cascarón; la decisión
// vive aquí y se prueba en Node.

/**
 * Resuelve un lote `[state, contacts]` de `Promise.allSettled`.
 *
 * @param {PromiseSettledResult} resultadoEstado
 * @param {PromiseSettledResult} resultadoContactos
 * @returns {{estado: object|null, contactosCrudos: Array|null, falloContactos: unknown}}
 * @throws el motivo del rechazo de `state` — sin centro no hay vuelta que pintar.
 */
export function resolverLoteMapa(resultadoEstado, resultadoContactos) {
  if (resultadoEstado?.status === "rejected") throw resultadoEstado.reason;
  const estado = resultadoEstado?.value ?? null;
  if (resultadoContactos?.status === "rejected") {
    return { estado, contactosCrudos: [], falloContactos: resultadoContactos.reason };
  }
  return {
    estado,
    contactosCrudos: resultadoContactos?.value?.contacts ?? [],
    falloContactos: null,
  };
}

// Sobre el backoff, que es la otra mitad de la regla y no necesita función:
// como un `contacts` caído ya NO lanza, tampoco incrementa el contador de
// fallos de la ventana. Es deliberado. El backoff frena el ciclo entero, y el
// ciclo lo frena que el puente no conteste —eso lo dicen `healthz` y `state`—;
// un `contacts` con hipo no debe ralentizar la lectura de posición y rumbo, que
// es justo la que más se mira mientras se pilota.

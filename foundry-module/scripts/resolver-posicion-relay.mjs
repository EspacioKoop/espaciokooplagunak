// Traduce "a este rumbo y a esta distancia" a la coordenada del mundo que las
// órdenes de Relay necesitan (#517). Puro: ni Foundry, ni red.
//
// EL PROBLEMA. `add_waypoint`, `move_waypoint` y `launch_probe` piden `x`/`y`
// del mundo del juego. Un tripulante no tiene forma de conocer esas
// coordenadas: su consola no las publica, y no debería —el mapa vivo sin
// degradar es recurso del GM (#331)—. Pedirle que teclee un par de flotantes
// sería pedirle que adivine.
//
// LA FORMA EN QUE SE PIENSA UN PUNTO DE RUTA es la que ya usa toda la
// tripulación para hablar de lo que ve: una marcación y una distancia. Es la
// misma pareja de números que `contactos-degradados.mjs` publica por contacto,
// así que el puesto no aprende un vocabulario nuevo para esto.
//
// LA CONVERSIÓN VIVE EN EL RELÉ DEL GM, igual que la de escaneo
// (`resolver-objetivo-sensores.mjs`) y por el mismo motivo: hace falta la
// posición exacta de la nave propia, que sale del sondeo sin degradar. La
// diferencia con aquel es que este NO resuelve a qué objeto se refiere nadie
// —no busca candidatos ni puede equivocarse de contacto—: es aritmética sobre
// un punto vacío del espacio, que es justo lo que un punto de ruta es.
//
// CONVENCIÓN DE RUMBO: 0 grados es el norte del mapa y crece en sentido
// horario, la misma de `contactos-degradados.mjs` y `resolver-objetivo-
// sensores.mjs`. Que las tres coincidan no es casualidad ni se puede tocar en
// una sola: un desfase de 90 grados aquí pondría los puntos de ruta en el sitio
// equivocado sin que nada fallara.

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{x: number, y: number}} centro posición de la nave propia (`/v1/state`).
 * @param {{distancia: number, rumboDeg: number}} lectura lo que el puesto señaló.
 * @returns {{x: number, y: number}|null} la coordenada, o `null` si falta o no
 *   es utilizable alguno de los datos — nunca se aproxima al centro ni se
 *   inventa un punto por defecto: colocar un punto de ruta en la propia nave
 *   porque no se supo leer el rumbo es peor que no colocar ninguno.
 */
export function resolverPosicionRelativa({ centro, lectura }) {
  const cx = numero(centro?.x);
  const cy = numero(centro?.y);
  const distancia = numero(lectura?.distancia);
  const rumboDeg = numero(lectura?.rumboDeg);
  if (cx === null || cy === null || distancia === null || rumboDeg === null) return null;
  // Una distancia negativa no es "hacia atrás" —para eso está el rumbo— sino
  // una entrada rota. Cero sí vale: es la posición de la nave, y marcarla es
  // una cosa que un relay hace ("desde aquí").
  if (distancia < 0) return null;

  const radianes = (rumboDeg * Math.PI) / 180;
  return {
    x: cx + Math.sin(radianes) * distancia,
    y: cy - Math.cos(radianes) * distancia,
  };
}

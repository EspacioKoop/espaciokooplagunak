// Funde en la escena de una sala la figura de cada jugador remoto presente en
// ella (#453) — la contraparte de render de `nave-jugadores-red.mjs`.
//
// NO SABE DE RED NI DE ESTANCIAS: recibe ya resuelto, vía `obtenerJugadores`,
// a quién hay que pintar (misma estancia, muestra no caducada — eso lo decide
// `nave-jugadores-red.enEstancia`). Esta función solo compone lo que le dan,
// igual que `nave-movimiento-lienzo.arrancarAndar` no sabe qué sala es la que
// pinta.
//
// MISMA TÉCNICA QUE `nave-movimiento-sala-prueba.mjs`: cada pieza se traslada
// restando la cámara y se compone con `posicion:[0,0,0]` y el mismo `yaw` de
// cámara que ya usó la sala, para que el fundido por pintor (orden por
// profundidad) sea coherente entre la geometría de la sala y las figuras. La
// única diferencia es que una figura, a diferencia de un muro, tiene ADEMÁS
// su propia orientación (`jugador.yaw`, hacia dónde mira ESE jugador): se
// aplica girando la malla local antes de trasladarla, con el mismo convenio
// de rotación que `retro3d.transformar`.
//
// Sin color propio (#351): la figura se pinta con `SECCION.tripulante`, el
// mismo crema ya reservado para "una persona" en el plano de sección.

import { componerEscena } from "./retro3d.mjs";
import { ALTURA_OJOS } from "./nave-movimiento-sala-prueba.mjs";
import { mallaPersonaje } from "./nave-personaje-malla.mjs";
import { SECCION } from "./paleta.mjs";

/** Ritmo del vaivén de zancada, en radianes de fase por segundo — puramente
 *  visual, no viaja por red (ver cabecera de `nave-jugadores-wiring.mjs`). */
const VELOCIDAD_ZANCADA = 6;

function trasladar(malla, [dx, dy, dz]) {
  return { ...malla, vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]) };
}

/** Gira una malla alrededor de Y, mismo convenio de signo que
 *  `retro3d.transformar` (para que "girar a la derecha" signifique lo mismo
 *  en la figura que en la cámara que la mira). */
function rotarY(malla, angulo) {
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  return { ...malla, vertices: malla.vertices.map(([x, y, z]) => [x * c + z * s, y, -x * s + z * c]) };
}

/**
 * Envuelve el `componer(x, y, z, yaw, opciones)` de una sala (mismo contrato
 * que pide `arrancarAndar`) para además pintar a los jugadores remotos que
 * `obtenerJugadores()` devuelva. Sin jugadores, la escena de la sala sale sin
 * tocar — coste cero cuando nadie más comparte la estancia.
 *
 * @param {(x:number,y:number,z:number,yaw:number,opciones?:object)=>object} componerSala
 * @param {() => Array<{x:number,y:number,z:number,yaw:number}>} obtenerJugadores
 * @param {{ahora?: () => number}} opciones
 */
export function componerConJugadores(componerSala, obtenerJugadores, { ahora = () => globalThis.performance?.now?.() ?? Date.now() } = {}) {
  return function componer(x, y, z, yaw, opciones = {}) {
    const escenaSala = componerSala(x, y, z, yaw, opciones);
    const jugadores = obtenerJugadores?.() ?? [];
    if (!jugadores.length) return escenaSala;

    const { ancho: anchoLienzo = escenaSala.ancho, alto: altoLienzo = escenaSala.alto, fov = 62 } = opciones;
    const camaraX = x;
    const camaraY = ALTURA_OJOS + y;
    const camaraZ = z;
    const faseCaminar = (ahora() / 1000) * VELOCIDAD_ZANCADA;

    const poligonosJugadores = jugadores.flatMap((jugador) => {
      const malla = mallaPersonaje({
        agachado: jugador.y < 0,
        saltando: jugador.y > 0,
        faseCaminar,
      });
      const orientada = rotarY(malla, jugador.yaw);
      const enMundo = trasladar(orientada, [jugador.x - camaraX, -camaraY, jugador.z - camaraZ]);
      const escenaJugador = componerEscena(enMundo, {
        ancho: anchoLienzo,
        alto: altoLienzo,
        epoca: escenaSala.epoca,
        fov,
        color: SECCION.tripulante,
        posicion: [0, 0, 0],
        yaw: -yaw,
      });
      return escenaJugador.poligonos;
    });

    // Mismo fundido y reordenado global que ya hace `nave-movimiento-sala-
    // prueba.componer`: concatenar dos listas ya ordenadas por su cuenta no da
    // una lista ordenada.
    const poligonos = [...escenaSala.poligonos, ...poligonosJugadores].sort((a, b) => b.profundidad - a.profundidad);
    return { ...escenaSala, poligonos };
  };
}

/**
 * Render de los avatares de otros jugadores al andar por la nave (#498,
 * follow-up de #453/PR #497). Ese PR dejó los DATOS listos
 * (`nave-movimiento-red.mjs`: posición interpolada, filtrada por sala,
 * agnóstica a cómo se dibuje) pero sin pintar nada — este módulo es el
 * "cómo se dibuja".
 *
 * REUTILIZA el mismo cuerpo que ya usa la cantina sentada (`piezasAvatar` de
 * `cantina-avatar.mjs`, estilo FF7, #423/#450): mismo aspecto tanto sentado
 * en la cantina como andando por la nave, y ni una malla nueva que
 * mantener. Cada sala (`nave-movimiento-sala-prueba.mjs`,
 * `cantina-andar.mjs`) sigue siendo la única que sabe traducir su propio
 * espacio nativo — este módulo solo recibe posiciones YA en ese espacio y
 * una cámara YA calculada, y hace lo mismo con ellas que la sala hace con
 * sus propios muebles: colocar, proyectar, devolver polígonos para que la
 * sala los funda con los suyos y reordene junto con el resto.
 *
 * Simplificación deliberada, documentada y no escondida: el cuerpo NO gira
 * con el yaw propio de cada jugador (mismo límite que ya tienen los
 * avatares sentados de la cantina, que tampoco rotan). Girar el cuerpo
 * exigiría rotar la malla entera por vértice antes de proyectarla, no solo
 * mover dónde se coloca — encaja mejor en un PR de pulido visual aparte una
 * vez que la posición en sí ya esté verificada en vivo.
 *
 * Puro: ni Foundry, ni DOM, ni red, ni reloj.
 */

import { piezasAvatar } from "./cantina-avatar.mjs";
import { componerEscena } from "./retro3d.mjs";

/**
 * Polígonos de los avatares de otros jugadores, en el mismo espacio de
 * cámara que ya usa la sala que llama.
 *
 * @param {Array<{x:number, y:number, z:number, avatar?:object}>} jugadores
 *   Posiciones YA en espacio nativo de la sala (la sala es quien traduce, si
 *   su espacio nativo no coincide con el de la planta — ver `cantina-
 *   andar.mjs` y `aNativo`). `avatar` es la descripción que ya consume
 *   `piezasAvatar`/`normalizarAvatar`; ausente se normaliza a un cuerpo
 *   genérico, nunca revienta por un jugador sin avatar elegido.
 * @param {{camara:[number,number,number], yaw:number, ancho:number,
 *   alto:number, epoca?:string, fov?:number}} opciones
 *   `camara` es la posición de cámara YA en el mismo espacio nativo que
 *   `jugadores` — la resta a cada jugador la hace este módulo, igual que la
 *   sala la resta a sus propios muebles antes de componer. `yaw` es el que
 *   la propia sala ya pasa a `componerEscena` para su geometría (con el
 *   signo invertido de #427 ya aplicado por quien llama).
 * @returns {Array<object>} polígonos, mismo contrato que
 *   `componerEscena(...).poligonos` — listos para fundir con los de la sala
 *   y reordenar juntos por profundidad.
 */
export function poligonosOtrosJugadores(jugadores, { camara, yaw, ancho, alto, epoca, fov }) {
  if (!Array.isArray(jugadores) || jugadores.length === 0) return [];
  const [camX, camY, camZ] = camara;

  const piezas = jugadores.flatMap((jugador, indice) =>
    piezasAvatar(jugador?.avatar ?? {}, {
      pies: [jugador.x - camX, jugador.y - camY, jugador.z - camZ],
      indice,
    }),
  );

  return piezas
    .map((pieza) =>
      componerEscena(desplazar(pieza.malla, pieza.centro), {
        ancho,
        alto,
        epoca,
        fov,
        color: pieza.color,
        posicion: [0, 0, 0],
        yaw,
        // Recorte de frustum completo (#510): un avatar visto de cerca —cruzarse
        // con otro jugador en un pasillo estrecho— dispara el mismo vértice
        // fuera de cuadro que ya se arregló para la geometría de la sala y para
        // los planos fijos de la cantina; sin esto, la caja resultante se infla
        // a miles de píxeles y tapa la pantalla.
        recorteLateral: true,
      }),
    )
    .flatMap((parte) => parte.poligonos);
}

function desplazar(malla, [dx, dy, dz]) {
  return {
    vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]),
    caras: malla.caras,
  };
}

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
 * EL CUERPO SÍ GIRA con el rumbo de cada jugador (#897). Durante mucho tiempo
 * no lo hacía, y la explicación era que «girar exigiría rotar la malla entera
 * por vértice antes de proyectarla»: cierto, y resultó costar ocho vértices y
 * dos multiplicaciones por caja (`cajaGirada`, en `escena-primitivas.mjs`).
 * Lo que faltaba de verdad era dónde ponerlo.
 *
 * El dato NO es nuevo: `yaw` viaja en la muestra de red desde #453 y
 * `nave-movimiento-red.mjs` lo interpola con cuidado de ángulos. Llegaba hasta
 * aquí dentro de cada jugador y se descartaba en la última línea. Los avatares
 * sentados de la cantina siguen sin girar, y ahí sigue estando bien: están
 * colocados de cara a la barra a propósito (ver `SITIOS`).
 *
 * Puro: ni Foundry, ni DOM, ni red, ni reloj.
 */

import { mallaDePieza } from "./escena-primitivas.mjs";
import { piezasAvatar } from "./cantina-avatar.mjs";
import { componerEscena } from "./retro3d.mjs";

/**
 * Polígonos de los avatares de otros jugadores, en el mismo espacio de
 * cámara que ya usa la sala que llama.
 *
 * @param {Array<{x:number, y:number, z:number, yaw?:number, avatar?:object}>} jugadores
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
      // Mismo convenio que `moverXZ`: 0 mira a +z. Sin rumbo declarado se queda
      // en 0, que es exactamente lo que se dibujaba antes.
      yaw: Number.isFinite(jugador?.yaw) ? jugador.yaw : 0,
    }),
  );

  return piezas
    .map((pieza) =>
      componerEscena(mallaDePieza(pieza, { giro: pieza.giro }), {
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

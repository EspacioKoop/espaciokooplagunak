// Render en cámara libre de la cantina real (#427), para poder andar por
// ella con `nave-movimiento-lienzo.mjs`.
//
// REUTILIZA LA MISMA GEOMETRÍA QUE `cantina-escena.mjs` (`MUEBLES`, `caja`):
// ni un mueble nuevo, ni un color nuevo, ni una línea de rasterizador nueva.
// Lo único que aporta este archivo es OTRA CÁMARA sobre los mismos datos.
//
// NO TOCA `componerCantina` NI `cantina-planos.mjs`. Esa cámara es la de
// #423 —cortes secos entre encuadres fijos, "nunca travelling", a
// propósito— y sigue sirviendo a la cantina tal como está. Esta es la cámara
// de #427: se está en un sitio y se mira en una dirección, y las dos
// coexisten sobre la misma sala sin que ninguna sepa de la otra.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj, ni Math.random().
//
// Frontera de arte (#351): no declara ni un color — los toma de `MUEBLES`,
// que ya los tomó de `paleta.mjs`.

import { caja, MUEBLES } from "./cantina-escena.mjs";
import { componerEscena } from "./retro3d.mjs";
import { aNativo } from "./cantina-planta.mjs";
import { poligonosOtrosJugadores } from "./nave-avatares-render.mjs";

/** A qué altura mira quien anda, de pie. Misma cifra que la sala de pruebas
 *  (`nave-movimiento-sala-prueba.mjs`): no hay razón para que la cantina
 *  tenga un tripulante más alto o más bajo que el banco de pruebas. El
 *  salto/agachado (#446) suma su propio offset por encima — ver `y` abajo. */
export const ALTURA_OJOS = 1.6;

const FOV = 62;

/** Las piezas ya convertidas a malla, una vez: `MUEBLES` no cambia en
 *  tiempo de ejecución y recalcular sus vértices en cada fotograma sería
 *  trabajo tirado. */
const PIEZAS = Object.freeze(MUEBLES.map((mueble) => ({ malla: caja(mueble.centro, mueble.medidas), color: mueble.color })));

function trasladarMalla(malla, [dx, dy, dz]) {
  return { ...malla, vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]) };
}

/**
 * Compone la cantina vista desde `(x, z)` de la PLANTA (no nativas: la
 * traducción la hace este archivo, quien llama no tiene por qué conocer el
 * desplazamiento de `cantina-planta.mjs`) mirando a `yaw`, con `y` el offset
 * de salto/agachado (#446) sobre `ALTURA_OJOS`. Misma firma que pide
 * `nave-movimiento-lienzo.mjs`.
 */
export function componerCantinaAndar(x, y, z, yaw, opciones = {}) {
  const { ancho = 480, alto = 270, epoca, fov = FOV, otrosJugadores = [] } = opciones;
  const nativo = aNativo(x, z);
  const camara = [nativo.x, ALTURA_OJOS + y, nativo.z];
  const yawCamara = -yaw; // ver el comentario de `yaw` más abajo

  const partes = PIEZAS.map(({ malla, color }) =>
    componerEscena(trasladarMalla(malla, [-camara[0], -camara[1], -camara[2]]), {
      ancho,
      alto,
      epoca,
      fov,
      color,
      posicion: [0, 0, 0],
      // Mismo signo que `nave-movimiento-sala-prueba.mjs`: la cámara de
      // `retro3d.mjs` gira en sentido contrario al que usa el motor de
      // movimiento para "adelante" (#427).
      yaw: yawCamara,
      // Recorte de frustum completo (#510): a diferencia de los encuadres
      // fijos de `cantina-planos.mjs` (#423, "nunca travelling", afinados a
      // ojo contando con el recorte laxo), esta es la cámara LIBRE de #427 —
      // nadie la ha afinado todavía para depender de ese comportamiento, y
      // sin el recorte, un mueble ancho visto de cerca dispara un vértice
      // fuera de pantalla igual que el pasillo de #508.
      recorteLateral: true,
    }),
  );

  // Otros jugadores andando por la cantina (#498, follow-up de #453): sus
  // x/z llegan en coordenadas de PLANTA, igual que las de la propia cámara
  // —se traducen a nativas con el mismo `aNativo` que ya usa la cámara, no
  // con uno inventado aquí.
  const jugadoresNativos = otrosJugadores.map((jugador) => {
    const posicionNativa = aNativo(jugador.x, jugador.z);
    return { x: posicionNativa.x, y: jugador.y, z: posicionNativa.z, avatar: jugador.avatar };
  });
  const poligonosJugadores = poligonosOtrosJugadores(jugadoresNativos, {
    camara,
    yaw: yawCamara,
    ancho,
    alto,
    epoca,
    fov,
  });

  const poligonos = [...partes.flatMap((parte) => parte.poligonos), ...poligonosJugadores]
    .sort((a, b) => b.profundidad - a.profundidad);
  return { ancho, alto, epoca: partes[0]?.epoca, poligonos };
}

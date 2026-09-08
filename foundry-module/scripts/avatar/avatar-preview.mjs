// Vista previa de un avatar de cantina, fuera de la sala (#450 sobre #423).
//
// Reutiliza el mismo motor y las mismas piezas que ya pintan a la gente en la
// cantina —`piezasAvatar` en `cantina-avatar.mjs`— y el mismo patrón que
// `componerIcono` en `cantina-icono.mjs`: cada pieza aporta una malla con su
// color y su centro, y la escena final es la unión de sus polígonos ordenados
// por profundidad. Ni un rasterizador nuevo ni una cámara nueva.
//
// Puro: ni Foundry, ni DOM, ni reloj. Recibe una descripción y unas medidas de
// lienzo y devuelve polígonos; quien los pinta vive fuera (`retro3d-lienzo.mjs`,
// como el resto del módulo).
//
// Frontera de arte (#351): no declara ni un color.

import { componerEscena, fundirEscenas } from "../retro3d.mjs";
import { piezasAvatar } from "../cantina-avatar.mjs";

/** Sin giro de reposo: aquí no hay que reconocer un objeto al otro lado de la
 * sala, hay que EDITARLO, y una figura que gira sola es una figura difícil de
 * mirar mientras se cambia el color del pelo. Quien quiera darle la vuelta
 * tiene el `yaw` de las opciones para eso. */
export function componerAvatarPreview(descripcion, opciones = {}) {
  const { ancho = 200, alto = 260, epoca, fondo = null, yaw = 0.5, pitch = 0.08 } = opciones;

  // Pies medio cuerpo por debajo del origen: así la figura queda centrada en
  // el lienzo en vez de crecer hacia arriba desde el borde inferior.
  const piezas = piezasAvatar(descripcion, { pies: [0, -0.95, 0] });

  const partes = piezas.map((pieza) =>
    componerEscena(desplazar(pieza.malla, pieza.centro), {
      ancho,
      alto,
      epoca,
      color: pieza.color,
      fondo,
      yaw,
      pitch,
      // Cámara retrasada lo justo para encuadrar a una persona entera: la
      // misma idea de plano que usa `componerIcono`, solo que aquí hay un
      // cuerpo humano y no un objeto de mesa, así que necesita más distancia.
      posicion: [0, 0, 5.4],
    }),
  );

  // Un solo orden de pintor global para todas las piezas (`fundirEscenas`,
  // #510): concatenar dos listas ya ordenadas da una lista incorrecta en cuanto
  // dos piezas se solapan, y hasta #510 cada consumidor repetía este mismo
  // fundido a mano.
  const { poligonos } = fundirEscenas(partes);

  return { ancho, alto, epoca: partes[0]?.epoca, poligonos };
}

/** Mueve una malla sin tocar la original — misma función que `cantina-icono.mjs`,
 * duplicada porque ninguna de las dos la expone y son piezas independientes. */
function desplazar(malla, [dx, dy, dz] = [0, 0, 0]) {
  return {
    vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]),
    caras: malla.caras,
  };
}

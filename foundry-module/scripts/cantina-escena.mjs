// El local de la cantina en 3D retro de consola (#423 sobre #362).
//
// QUÉ SALA ES ESTA. No es una taberna con una nave alrededor: es una sala de
// nave donde alguien ha puesto una barra. Las referencias son declaradas y no
// ambientales — la cantina de Mos Eisley (penumbra cálida, siluetas en la
// sombra), la estación de Solaris (metal cansado pero habitado) y el interior de
// la Discovery de 2001 (luz que sale de los paneles, no de bombillas) — y se
// traducen a tres decisiones concretas: el mamparo es frío y aburrido a
// propósito, la barra es el único foco cálido de la sala, y hay un ventanal al
// vacío para que nunca se olvide dónde está esto.
//
// REUTILIZA EL MOTOR, NO LO TOCA. Toda la proyección, el recorte, el sombreado,
// la niebla y el temblor de vértices son `retro3d.mjs` tal cual, igual que hace
// `dados-3d.mjs`. Este módulo aporta mallas y su colocación; ni una línea de
// rasterizador nueva.
//
// UNA LLAMADA POR MATERIAL. `componerEscena` pinta una malla con UN color, que
// es justo lo que le hace falta a un casco de nave. Una sala tiene madera, metal
// y luz a la vez, así que se compone una vez por material y se funden las listas
// de polígonos reordenando por profundidad. Fundir es correcto porque el orden
// por pintor es global: mezclar dos escenas ya ordenadas y volver a ordenar da
// exactamente lo mismo que si hubieran salido juntas.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj, ni Math.random().
//
// Frontera de arte (#351): no declara ni un color. Todos entran de `paleta.mjs`.

import { CANTINA } from "./paleta.mjs";
import { componerEscena } from "./retro3d.mjs";

/**
 * Caja alineada a los ejes, dada por su centro y sus medidas. Es la única
 * primitiva del módulo: una cantina de consola de los noventa se construía con
 * cajas y no hay razón para más aquí, donde cada pieza es un mueble.
 *
 * Las caras se listan en sentido antihorario vistas desde fuera, que es lo que
 * `componerEscena` necesita para descartar las de espaldas.
 */
export function caja([cx, cy, cz], [ancho, alto, fondo]) {
  const x = ancho / 2;
  const y = alto / 2;
  const z = fondo / 2;
  const vertices = [
    [cx - x, cy - y, cz - z],
    [cx + x, cy - y, cz - z],
    [cx + x, cy + y, cz - z],
    [cx - x, cy + y, cz - z],
    [cx - x, cy - y, cz + z],
    [cx + x, cy - y, cz + z],
    [cx + x, cy + y, cz + z],
    [cx - x, cy + y, cz + z],
  ];
  const caras = [
    [0, 3, 2, 1], // frente (−z)
    [4, 5, 6, 7], // fondo (+z)
    [0, 4, 7, 3], // izquierda
    [1, 2, 6, 5], // derecha
    [3, 7, 6, 2], // techo
    [0, 1, 5, 4], // suelo
  ];
  return { vertices, caras };
}

/**
 * Los muebles del local, con su material. El orden de la lista no importa —lo
 * decide después la profundidad— pero se escribe de fuera hacia dentro porque
 * así se lee como una descripción de la sala y no como una lista de cajas.
 *
 * Las medidas están en las mismas unidades que usa el motor para los cascos: la
 * cámara se coloca fuera, en `componerCantina`, y no hay ninguna escala oculta.
 */
export const MUEBLES = Object.freeze([
  // El vacío al otro lado, lo más lejano de la sala: es lo que se ve por el hueco del
  // mamparo, y va primero para que nada dependa de que se pinte antes.
  Object.freeze({ nombre: "ventana", color: CANTINA.ventana, centro: [0, 0.6, 7.4], medidas: [7, 2.6, 0.2] }),
  Object.freeze({ nombre: "mamparoIzq", color: CANTINA.mamparo, centro: [-4.2, 0.4, 6.6], medidas: [2.6, 4.4, 0.6] }),
  Object.freeze({ nombre: "mamparoDer", color: CANTINA.mamparo, centro: [4.2, 0.4, 6.6], medidas: [2.6, 4.4, 0.6] }),
  Object.freeze({ nombre: "dintel", color: CANTINA.mamparo, centro: [0, 2.3, 6.6], medidas: [6, 0.8, 0.6] }),
  Object.freeze({ nombre: "suelo", color: CANTINA.suelo, centro: [0, -1.9, 4], medidas: [12, 0.3, 10] }),
  // La barra: cuerpo cálido y un canto más claro encima. Dos cajas y no una
  // porque el canto es lo que recoge la luz de la lámpara, y con un solo color
  // la barra se lee como un bloque de madera sin volumen.
  Object.freeze({ nombre: "barra", color: CANTINA.barra, centro: [0, -1.1, 3.2], medidas: [7.5, 1.3, 1.6] }),
  Object.freeze({ nombre: "barraCanto", color: CANTINA.barraCanto, centro: [0, -0.4, 3.2], medidas: [7.9, 0.2, 1.9] }),
  // La lámpara cuelga por delante y ARRIBA del encuadre: casi no se ve entera,
  // y es la intención. Lo que importa es que exista una fuente de calor en la
  // parte alta de la sala, no mirarla de frente.
  Object.freeze({ nombre: "lampara", color: CANTINA.lampara, centro: [0, 2.1, 2.2], medidas: [2.2, 0.25, 0.9] }),
  // El rótulo de neón, en el mamparo del fondo y descentrado: un local con el
  // cartel centrado parece un decorado, y este tiene que parecer usado.
  Object.freeze({ nombre: "neon", color: CANTINA.neon, centro: [-2.6, 1.5, 6.2], medidas: [1.6, 0.3, 0.15] }),
]);

/**
 * Cuánto puede asomarse quien mira, como mucho. La cámara se MUEVE pero no
 * VIAJA: es alguien de pie en la puerta que se inclina a un lado y a otro, no
 * un personaje que cruza el local.
 *
 * El tope existe porque la sala está construida para verse desde la puerta —no
 * tiene techo, ni pared trasera, ni nada detrás de la barra—; dejar salir la
 * cámara de aquí es enseñar el decorado por fuera. Y el vaivén es lo que hace
 * que un decorado se lea como un espacio: el paralaje entre la barra cercana y
 * el mamparo lejano da la profundidad que una imagen fija nunca da.
 */
export const ASOMO = Object.freeze({
  lado: 1.6, // unidades a izquierda y derecha
  alto: 0.55, // agacharse o estirarse un poco
  giro: 0.26, // radianes: la cabeza sigue al cuerpo
});

/** Acota a [−limite, limite] y convierte lo que no es número en 0: un `NaN`
 * en la cámara no deja una sala torcida, deja una sala sin geometría. */
function asomo(valor, limite) {
  if (!Number.isFinite(valor)) return 0;
  return Math.max(-limite, Math.min(limite, valor));
}

/**
 * Compone el local entero desde donde esté mirando quien entra.
 *
 * `mirada` va en −1..1 por eje (`x` lateral, `y` altura), tal como sale de un
 * ratón normalizado sobre el visor o de las flechas del teclado; se traduce aquí
 * a unidades de mundo para que quien llame no tenga que conocer la escala de la
 * sala. Fuera de rango se acota en vez de rechazarse: el ratón se sale del
 * lienzo constantemente y eso no es un error, es usar el ratón.
 *
 * @returns {{ancho:number, alto:number, epoca:string, poligonos:Array}} misma
 *   forma que devuelve `componerEscena`, para que el pintor no distinga.
 */
export function componerCantina(opciones = {}) {
  const { ancho = 320, alto = 180, epoca, fondo = CANTINA.ventana, mirada = {} } = opciones;

  const desvioX = asomo(mirada.x, 1) * ASOMO.lado;
  const desvioY = asomo(mirada.y, 1) * ASOMO.alto;
  // La cabeza gira CONTRA el desplazamiento: al asomarse por la izquierda se
  // sigue mirando al centro de la sala, que es lo que hace el cuello de
  // cualquiera. Girando a favor, la sala se sale del encuadre y marea.
  const yaw = asomo(opciones.yaw, Math.PI) - asomo(mirada.x, 1) * ASOMO.giro;

  const partes = MUEBLES.map((mueble) =>
    componerEscena(caja(mueble.centro, mueble.medidas), {
      ancho,
      alto,
      epoca,
      color: mueble.color,
      fondo,
      yaw,
      // La cámara está a la altura de quien entra por la puerta: por encima de
      // la barra y por debajo del dintel. Bajarla convierte la barra en un muro.
      // El asomo se suma aquí, que es lo que produce el paralaje.
      posicion: [desvioX, -0.35 + desvioY, 0],
    }),
  );

  // Fundido y reordenado global. Cada parte ya viene ordenada por su cuenta, y
  // el orden por pintor no es componible: dos listas correctas concatenadas dan
  // una lista incorrecta, y la barra acabaría dibujada detrás del mamparo.
  const poligonos = partes
    .flatMap((parte) => parte.poligonos)
    .sort((a, b) => b.profundidad - a.profundidad);

  return { ancho, alto, epoca: partes[0]?.epoca, poligonos };
}

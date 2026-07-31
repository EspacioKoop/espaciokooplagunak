// Lo que se ve por el ojo de buey de la cantina (#423, camino a #427).
//
// LA REGLA. Por esa ventana se ve EL ESPACIO QUE TENEMOS, no un cielo inventado:
// los contactos que la nave lleva delante, los mismos que pinta el mapa vivo y
// que salen de la simulación. Una cantina con estrellas decorativas es un
// decorado; una cantina desde la que ves pasar la nave que os persigue es parte
// del juego. Es la diferencia entre ambientar y jugar.
//
// NO ES UN RADAR. El mapa vivo es la lectura del sensor —cenital, con alcance y
// leyenda—; esto es una VENTANA: se ve lo que cae delante, del tamaño que
// aparenta a esa distancia, y nada más. Lo que queda a popa no se ve, y eso no
// es una carencia sino la diferencia entre mirar por un cristal y leer una
// pantalla.
//
// COMPOSICIÓN. Lo que hay fuera se coloca con proporción áurea y no centrado:
// una masa grande justo en el medio es una diana, y lo que se busca es un plano
// que se pueda mirar un rato. Kubrick encuadraba simétrico cuando quería
// inquietar y descentrado cuando quería que el ojo recorriese; aquí interesa lo
// segundo, porque la sala es un sitio donde se está, no un pasillo.
//
// Puro: ni Foundry, ni DOM, ni red, ni reloj. Recibe el estado y devuelve
// puntos; quien lo pinta y quien lo consulta viven fuera.
//
// Frontera de arte (#351): no declara ni un color.

import { FACCIONES, PIXEL } from "./paleta.mjs";

/** Proporción áurea. Se escribe una vez y se usa para todo lo que se coloca. */
export const PHI = 1.6180339887;

/**
 * El punto áureo de un encuadre: ni el centro ni un tercio. Devuelve las cuatro
 * intersecciones para que quien coloca elija, en vez de fijar una y que todo
 * acabe en la misma esquina.
 */
export function puntosAureos(ancho, alto) {
  const x1 = ancho / PHI;
  const x0 = ancho - x1;
  const y1 = alto / PHI;
  const y0 = alto - y1;
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x0, y: y1 },
    { x: x1, y: y1 },
  ];
}

/** Rumbo de EmptyEpsilon: 0° es norte y crece en sentido horario. */
function radianes(grados) {
  return ((Number.isFinite(grados) ? grados : 0) * Math.PI) / 180;
}

/** Color estable por facción, por hash del nombre — el mismo reparto que el
 * mapa vivo, para que un contacto no cambie de color al mirarlo por la ventana
 * en vez de por el radar. */
function colorDe(faccion) {
  if (!faccion) return PIXEL.sinFaccion;
  let hash = 0;
  for (let i = 0; i < faccion.length; i += 1) hash = (hash * 31 + faccion.charCodeAt(i)) >>> 0;
  return FACCIONES[hash % FACCIONES.length];
}

/**
 * Proyecta los contactos de la simulación sobre el cristal.
 *
 * @param {object} estado `{ contactos, rumbo, centro }` tal como los tiene el
 *   mapa vivo: posiciones de mundo y el rumbo de la nave propia.
 * @param {object} opciones `{ ancho, alto, campo }` — `campo` es el semiángulo
 *   visible por la ventana, en grados.
 * @returns {Array<{x:number,y:number,tam:number,color:string}>} en el mismo
 *   formato que las estrellas, para que el pintor no distinga uno de otro.
 */
export function cuerposPorLaVentana(estado = {}, opciones = {}) {
  const ancho = Number.isFinite(opciones.ancho) ? opciones.ancho : 480;
  const alto = Number.isFinite(opciones.alto) ? opciones.alto : 270;
  const campo = Number.isFinite(opciones.campo) ? opciones.campo : 45;
  const contactos = Array.isArray(estado.contactos) ? estado.contactos : [];
  const centro = estado.centro ?? { x: 0, y: 0 };
  const rumbo = radianes(estado.rumbo);

  const salida = [];
  for (const contacto of contactos) {
    const px = Number(contacto?.x ?? contacto?.posicion?.[0]);
    const py = Number(contacto?.y ?? contacto?.posicion?.[1]);
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;

    const dx = px - (centro.x ?? 0);
    const dy = py - (centro.y ?? 0);
    const distancia = Math.hypot(dx, dy);
    if (distancia < 1e-6) continue;

    // Ángulo del contacto respecto a la proa. Norte es 0 y crece horario, así
    // que el eje se toma desde +Y y hacia +X, no el atan2 de toda la vida.
    const rumboContacto = Math.atan2(dx, dy);
    let relativo = rumboContacto - rumbo;
    // A [−π, π]: sin esto, un contacto a 350° se dibujaría en el borde opuesto.
    while (relativo > Math.PI) relativo -= Math.PI * 2;
    while (relativo < -Math.PI) relativo += Math.PI * 2;

    const limite = radianes(campo);
    // Lo que queda fuera del cristal no se ve. Por una ventana no se ve a popa,
    // y fingir lo contrario la convertiría en un radar con marco.
    if (Math.abs(relativo) > limite) continue;

    // Tamaño aparente: mengua con la distancia y nunca baja de un píxel, que es
    // lo mínimo que se puede pintar sin desaparecer del todo.
    const tam = Math.max(1, Math.round(6 - Math.log10(Math.max(10, distancia))));
    salida.push({
      x: Math.round(ancho / 2 + (relativo / limite) * (ancho / 2)),
      // Sin elevación en los datos: la simulación es plana, así que los
      // contactos se reparten en una banda a la altura del horizonte en vez de
      // formar una línea recta, que se leería como una regla y no como espacio.
      y: Math.round(alto * 0.42 + ((distancia % 7) - 3) * 2),
      tam,
      color: colorDe(contacto?.faccion),
    });
  }
  return salida;
}

/**
 * Un cuerpo grande —planeta, luna, la estación de la que salís— colocado en un
 * punto áureo. Es lo que da escala al vacío: sin nada grande fuera, la ventana
 * es un cristal negro con motas y la nave podría estar parada en un garaje.
 *
 * Se devuelve como una lista de puntos y no como un círculo porque el pintor
 * solo sabe de puntos; el disco se rellena aquí, en píxeles, que además es
 * exactamente como se dibujaba entonces.
 */
export function cuerpoMayor({ ancho = 480, alto = 270, radio = 46, cuadrante = 0 } = {}) {
  const punto = puntosAureos(ancho, alto)[cuadrante % 4];
  const puntos = [];
  for (let y = -radio; y <= radio; y += 2) {
    const media = Math.floor(Math.sqrt(Math.max(0, radio * radio - y * y)));
    for (let x = -media; x <= media; x += 2) {
      // Terminador: la mitad que no da al sol se deja a oscuras. Un disco
      // plano y uniforme es una pegatina; la sombra es lo que lo hace un cuerpo.
      const iluminado = x + y * 0.35 > -radio * 0.25;
      if (!iluminado) continue;
      puntos.push({
        x: Math.round(punto.x + x),
        y: Math.round(punto.y + y),
        tam: 2,
        color: PIXEL.estrella,
      });
    }
  }
  return puntos;
}

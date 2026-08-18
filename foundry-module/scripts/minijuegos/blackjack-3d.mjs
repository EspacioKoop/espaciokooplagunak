// La mesa de blackjack en 3D retro de consola (#308 sobre #362, tercer
// vertical de minijuegos, junto a la de póker y el dado de #413).
//
// QUÉ PROBLEMA RESUELVE. El blackjack no enfrenta a los jugadores entre sí:
// enfrenta a cada uno con LA BANCA. Copiar el tapete circular de póker —donde
// el rival importante es quien tienes al lado— pintaría la mesa equivocada:
// aquí lo que hay que ver de un vistazo es la mano de la banca al fondo,
// tapada mientras juega la mesa y revelada de golpe cuando le toca, y cada
// jugador con SU fila de cartas creciendo hacia la derecha, porque a
// diferencia del póker una mano de blackjack no tiene un número fijo de
// cartas: pedir una más tiene que verse como una carta más en la fila, no
// como una ranura que ya estaba prevista.
//
// REUTILIZA EL MOTOR Y EL ARTE QUE YA HAY. El 3D es `retro3d.mjs` tal cual
// —ni una línea de rasterizador nueva—, los colores salen de `paleta.mjs`
// y el fondo estelar es el mismo de la mesa de póker (#384): toda mesa de la
// cantina ve el mismo cielo. Las primitivas de caja y disco se repiten desde
// `poker-3d.mjs` a propósito: ese módulo no las exporta —son de su mesa
// circular, con sus propios números— y una mesa rectangular de banca necesita
// los suyos; forzar un import compartido acoplaría dos tapetes que no se
// parecen por las cartas que reciben, sino por el material del que están
// hechas.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj, ni Math.random(). Este
// módulo solo conoce CUÁNTAS cartas hay y de quién son, nunca qué cartas son
// — eso lo pinta encima `cartas-pixelart.mjs`, igual que en póker.

import { FICHA, PIXEL } from "../paleta.mjs";
import { componerEscena, fundirEscenas } from "../retro3d.mjs";
import { caja, disco } from "../escena-primitivas.mjs";
import { campoEstelar, proyectarEstrellas } from "../retro3d-estrellas.mjs";

/** Medidas de una carta tumbada. Mismas proporciones que en póker: canto
 * visible y grosor exagerado a propósito, para que se lea como un objeto
 * con peso y no como una calcomanía sobre el fieltro. */
const CARTA = Object.freeze({ ancho: 0.62, alto: 0.16, largo: 0.9 });
const CANTO_CARTA = 0.02;
const LADOS_FICHA = 10;

/** La cámara de la mesa: baja y cercana, para que el tapete tenga volumen en
 * vez de leerse como un plano visto desde arriba.
 *
 * EL PITCH VA EN NEGATIVO, Y NO ES UN DETALLE (#559). En `transformar` la
 * rotación se aplica ANTES de la traslación, así que la cámara ORBITA el
 * origen: con `pitch` positivo orbita por DEBAJO del tapete. Eso es exactamente
 * lo que el issue describe como «la mesa es un plano verde» — no era que
 * faltaran las cartas, es que se estaba mirando el fieltro por su cara
 * inferior, con toda la mesa entre el ojo y las manos. Desde ahí ninguna carta
 * podía verse, y las de la banca asomaban como una losa oscura porque lo que se
 * colaba por el borde era su canto, nunca su cara.
 *
 * Con el pitch en negativo la cámara sube por encima del tapete, pero orbitar
 * por arriba también la cruza al otro lado de la mesa: sin más, la banca queda
 * en primer término y tú al fondo, justo del revés que el arco de `ASIENTOS`.
 * `yaw: Math.PI` la devuelve a su sitio sin mover ni una coordenada de la mesa:
 * tú delante, la banca al fondo. La altura y la distancia se reajustan a la
 * vista nueva (0.2 y 5.6) porque desde arriba los números de antes dejaban el
 * reparto de la banca fuera de cuadro.
 *
 * La mesa de póker tiene el pitch positivo por lo mismo y con el mismo efecto
 * en sus comunitarias; no se toca aquí porque reencuadrar otro minijuego ya
 * publicado merece su propio issue. */
export const VISTA = Object.freeze({ pitch: -0.75, yaw: Math.PI, altura: 0.2, atras: 5.6, fov: 52 });

// `caja` y `disco` viven ahora en `escena-primitivas.mjs` (#589): estaban
// copiadas en los dos minijuegos y en la cantina. `disco` era, sin decirlo, un
// prisma de N lados — el mismo generador que le faltaba al resto del módulo para
// que un poste dejara de leerse como una viga. Se reexportan las dos para no
// romper a quien ya las importaba de aquí.
export { caja, disco };


function mover(malla, [dx, dy, dz]) {
  return {
    vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]),
    caras: malla.caras,
  };
}


/**
 * Los sitios de los jugadores: un arco delantero, no un círculo. Al contrario
 * que en póker no hay "rivales" que rodeen la mesa —todos juegan contra la
 * banca, nadie contra el de al lado—, así que todos caben mirando al mismo
 * sitio: el fondo, donde reparte la banca. El propio jugador va SIEMPRE en el
 * primer hueco de este arco, igual que en póker.
 */
const ASIENTOS = Object.freeze([
  Object.freeze([0, 0.1, 2.35]), // tú, en primer término
  Object.freeze([-1.9, 0.1, 1.75]),
  Object.freeze([1.9, 0.1, 1.75]),
  Object.freeze([-3.3, 0.1, 0.75]),
  Object.freeze([3.3, 0.1, 0.75]),
]);

export function plazas(cuantos) {
  const total = Math.max(1, Math.min(ASIENTOS.length, Math.trunc(cuantos) || 1));
  return ASIENTOS.slice(0, total).map((asiento) => [...asiento]);
}

/** Dónde se planta la banca: al fondo del tapete, de frente a la mesa. */
const PUESTO_BANCA = Object.freeze([0, 0.1, -1.6]);

/** Máximo de cartas que se dibujan en una fila antes de que se solaparían
 * entre ellas sin dejar leer el grosor: una mano no crece infinito, y ocho
 * cartas boca arriba ya es una mesa perdiendo por pedir de más. */
const CARTAS_MAX_FILA = 8;

/** Coloca una fila de cartas centrada en `centro`, creciendo hacia +x. */
function filaDeCartas(centro, cuantas, { dorso = false } = {}) {
  const piezas = [];
  const total = Math.max(0, Math.min(CARTAS_MAX_FILA, Math.trunc(cuantas) || 0));
  const paso = CARTA.ancho * 0.55;
  const inicio = -((total - 1) * paso) / 2;
  for (let i = 0; i < total; i += 1) {
    const [cx, cy, cz] = centro;
    const posicion = [cx + inicio + i * paso, cy, cz];
    piezas.push({ malla: caja(posicion, [CARTA.ancho, CARTA.alto, CARTA.largo]), color: PIXEL.borde });
    piezas.push({
      malla: caja(
        [posicion[0], posicion[1] + CANTO_CARTA, posicion[2]],
        [CARTA.ancho - CANTO_CARTA * 2, CARTA.alto, CARTA.largo - CANTO_CARTA * 2],
      ),
      color: dorso ? PIXEL.dorsoFondo : PIXEL.cara,
    });
  }
  return piezas;
}

/**
 * La mesa de blackjack entera en 3D: tapete, banca al fondo y un jugador por
 * hueco con su fila de cartas y su pila de fichas.
 *
 * @param {object} mesa `{ banca, jugadores }`.
 *   `banca`: `{ cartas, oculta }` — mientras `oculta` es verdad se pintan
 *   SIEMPRE dos cartas (la banca reparte exactamente dos antes de que le
 *   toque jugar y no pide mientras está tapada): la primera boca arriba, la
 *   segunda de dorso. Revelada, se pintan `cartas` boca arriba — puede haber
 *   pedido más al plantarse la mesa.
 *   `jugadores`: `[{ cartas, fichas, apuesta, propio, terminado }]` — `cartas`
 *   es cuántas tiene la mano (crece al pedir), `apuesta` levanta una pila
 *   propia delante de la fila para que se vea lo que hay en juego sin leer
 *   ninguna cifra.
 */
export function componerMesa(mesa = {}, opciones = {}) {
  const { ancho = 320, alto = 200, epoca, fondo = null, semillaCielo = 20260731 } = opciones;
  const banca = mesa.banca ?? {};
  const jugadores = Array.isArray(mesa.jugadores) ? mesa.jugadores.slice(0, ASIENTOS.length) : [];

  const piezas = [
    // El tapete, con reborde: dos cajas y ya tiene canto, igual que en póker.
    { malla: caja([0, -0.12, 0.2], [6.4, 0.22, 4.8]), color: FICHA.tapete },
    { malla: caja([0, -0.02, 0.2], [6.0, 0.06, 4.4]), color: FICHA.tapete },
  ];

  // La banca. Mientras está oculta se pintan sus dos cartas de reparto —una
  // cara, una dorso—; nunca más de dos, porque el motor no la deja pedir
  // hasta que se destapa.
  const cartasBanca = banca.oculta ? 2 : Math.max(1, Math.trunc(banca.cartas) || 1);
  if (banca.oculta) {
    const [bx, by, bz] = PUESTO_BANCA;
    const paso = CARTA.ancho * 0.55;
    piezas.push(...filaDeCartas([bx - paso / 2, by, bz], 1, { dorso: false }));
    piezas.push(...filaDeCartas([bx + paso / 2, by, bz], 1, { dorso: true }));
  } else {
    piezas.push(...filaDeCartas(PUESTO_BANCA, cartasBanca, { dorso: false }));
  }

  // Los jugadores. Cada uno con su fila —boca arriba siempre, el blackjack no
  // esconde manos ajenas— y su pila si tiene apuesta viva.
  plazas(jugadores.length).forEach((plaza, i) => {
    const jugador = jugadores[i] ?? {};
    const [jx, jy, jz] = plaza;
    const propio = Boolean(jugador.propio);

    piezas.push(...filaDeCartas([jx, jy + 0.06, jz - 0.65], jugador.cartas ?? 0, { dorso: false }));

    const cuantas = Math.max(0, Math.min(10, Math.round((jugador.apuesta ?? 0) / 5)));
    const denominacion = FICHA.valores[5] ?? Object.values(FICHA.valores)[0];
    for (let f = 0; f < cuantas; f += 1) {
      piezas.push({
        malla: mover(disco(), [jx, jy + f * 0.185, jz + 0.55]),
        color: denominacion,
      });
    }

    // El busto de quien está sentado, salvo el propio: la cámara está donde
    // estás tú, y pintarte ahí sería pintarte la nuca — mismo criterio que en
    // la mesa de póker.
    if (!propio) {
      piezas.push({ malla: caja([jx, jy + 0.45, jz + 0.95], [0.85, 0.6, 0.4]), color: FICHA.valores[100] });
      piezas.push({ malla: caja([jx, jy + 1.0, jz + 0.99], [0.5, 0.48, 0.44]), color: PIXEL.cara });
    }
  });

  const partes = piezas.map((pieza) =>
    componerEscena(pieza.malla, {
      ancho,
      alto,
      epoca,
      color: pieza.color,
      fondo,
      fov: VISTA.fov,
      pitch: VISTA.pitch,
      yaw: VISTA.yaw,
      posicion: [0, VISTA.altura, VISTA.atras],
    }),
  );

  // Un solo orden de pintor global para todas las piezas (`fundirEscenas`,
  // #510): concatenar dos listas ya ordenadas da una lista incorrecta en cuanto
  // dos piezas se solapan, y hasta #510 cada consumidor repetía este mismo
  // fundido a mano.
  const { poligonos } = fundirEscenas(partes);

  // El mismo cielo sembrado que ven las demás mesas de la cantina (#384): se
  // juega dentro de una nave en vuelo, no en un sótano recortado sobre negro.
  const estrellas = proyectarEstrellas(campoEstelar(semillaCielo, { cantidad: 70 }), {
    ancho,
    alto,
    epoca,
    fov: VISTA.fov,
    pitch: VISTA.pitch,
  });

  return { ancho, alto, epoca: partes[0]?.epoca, poligonos, estrellas };
}

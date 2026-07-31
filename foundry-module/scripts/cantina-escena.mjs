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
import { campoEstelar, proyectarEstrellas } from "./retro3d-estrellas.mjs";

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
/** Fila de piezas iguales repartidas por un eje. La botellería, las costillas
 * del mamparo y los taburetes son lo mismo repetido, y escribir doce cajas a
 * mano invita a que la trece salga descuadrada. */
function fila(cuantas, hacer) {
  return Array.from({ length: cuantas }, (_, i) => Object.freeze(hacer(i)));
}

/** Los tres tonos de botella, alternados. Una fila del mismo color es un peine
 * y no una barra surtida; tres tonos bastan para que parezca contada. */
const TONOS_BOTELLA = [CANTINA.botellaVerde, CANTINA.botellaAmbar, CANTINA.botellaAzul];

/**
 * Los muebles del local, con su material. El orden de la lista no importa —lo
 * decide después la profundidad— pero se escribe de fuera hacia dentro porque
 * así se lee como una descripción de la sala y no como una lista de cajas.
 *
 * Las medidas están en las mismas unidades que usa el motor para los cascos: la
 * cámara se coloca fuera, en `componerCantina`, y no hay ninguna escala oculta.
 *
 * NO HAY CAJA DE VENTANA. El hueco del mamparo se deja VACÍO a propósito: por
 * ahí se ven las estrellas, que las pinta el mismo campo estelar de #384 que usa
 * el resto del 3D. Taparlo con una caja azul oscuro era más fácil y convertía el
 * vacío en un cartón pintado.
 */
export const MUEBLES = Object.freeze([
  // --- La caja de la sala, POR TRAMOS --------------------------------------
  //
  // Un suelo de doce metros en una sola caja es EL fallo de un rasterizador por
  // pintor: la profundidad de una cara es su media, y la media de una losa que
  // cruza la sala entera cae en el centro, así que se pinta delante de lo que
  // tiene detrás y detrás de lo que tiene delante — a la vez, y cambiando de
  // criterio en cuanto la cámara se mueve. Eso era el temblor de la sala.
  //
  // Partido en tramos, cada uno tiene su profundidad de verdad y el orden deja
  // de ser una lotería. Y de paso el suelo tiene juntas, que es lo que hace que
  // se lea como plancha de nave y no como moqueta.
  ...fila(6, (i) => ({
    nombre: `suelo${i}`,
    // Alternar dos tonos convierte la corrección en dibujo: se ven las planchas.
    color: i % 2 === 0 ? CANTINA.suelo : CANTINA.techo,
    centro: [0, -1.9, 0.2 + i * 1.7],
    medidas: [12, 0.3, 1.6],
  })),
  ...fila(6, (i) => ({
    nombre: `techo${i}`,
    color: i % 2 === 0 ? CANTINA.techo : CANTINA.mamparo,
    centro: [0, 2.9, 0.2 + i * 1.7],
    medidas: [12, 0.3, 1.6],
  })),
  ...fila(6, (i) => ({
    nombre: `paredIzq${i}`,
    color: CANTINA.mamparo,
    centro: [-5.2, 0.5, 0.2 + i * 1.7],
    medidas: [0.4, 5, 1.6],
  })),
  ...fila(6, (i) => ({
    nombre: `paredDer${i}`,
    color: CANTINA.mamparo,
    centro: [5.2, 0.5, 0.2 + i * 1.7],
    medidas: [0.4, 5, 1.6],
  })),

  // --- El fondo, con el hueco del ventanal ---------------------------------
  // EL VENTANAL MANDA. Es lo único que dice que esto vuela, así que se lleva el
  // centro del encuadre y todo lo demás se aparta: la primera versión lo tenía
  // tapado por la estantería y la sala pasaba a ser una taberna con costillas.
  Object.freeze({ nombre: "mamparoIzq", color: CANTINA.mamparo, centro: [-4.3, 0.6, 6.8], medidas: [2, 5, 0.6] }),
  Object.freeze({ nombre: "mamparoDer", color: CANTINA.mamparo, centro: [4.3, 0.6, 6.8], medidas: [2, 5, 0.6] }),
  Object.freeze({ nombre: "dintel", color: CANTINA.mamparo, centro: [0, 2.6, 6.8], medidas: [6.6, 1.2, 0.6] }),
  Object.freeze({ nombre: "antepecho", color: CANTINA.mamparo, centro: [0, -1.5, 6.8], medidas: [6.6, 1.2, 0.6] }),
  // Montantes del ventanal: un cristal de seis metros sin nada que lo sujete no
  // es una nave, es un escaparate.
  ...fila(2, (i) => ({
    nombre: `montante${i}`,
    color: CANTINA.nervio,
    centro: [-1.7 + i * 3.4, 0.6, 6.75],
    medidas: [0.22, 3.4, 0.5],
  })),

  // --- Costillas: lo que hace que una pared plana parezca una nave ---------
  ...fila(4, (i) => ({
    nombre: `nervioIzq${i}`,
    color: CANTINA.nervio,
    centro: [-4.95, 0.5, 1.2 + i * 1.5],
    medidas: [0.25, 4.6, 0.35],
  })),
  ...fila(4, (i) => ({
    nombre: `nervioDer${i}`,
    color: CANTINA.nervio,
    centro: [4.95, 0.5, 1.2 + i * 1.5],
    medidas: [0.25, 4.6, 0.35],
  })),

  // --- La barra y su trastienda --------------------------------------------
  // Cuerpo cálido y un canto más claro encima. Dos cajas y no una porque el
  // canto es lo que recoge la luz de la lámpara, y con un solo color la barra se
  // lee como un bloque de madera sin volumen.
  Object.freeze({ nombre: "barra", color: CANTINA.barra, centro: [0, -1.45, 4.2], medidas: [6.4, 0.9, 1.2] }),
  Object.freeze({ nombre: "barraCanto", color: CANTINA.barraCanto, centro: [0, -0.97, 4.2], medidas: [6.8, 0.16, 1.5] }),
  // La estantería del fondo y su botellería: es lo que dice que aquí se sirve
  // algo. Sin ella, la barra es un mostrador de recepción.
  // La botellería va a los LADOS, contra los mamparos ciegos. Estaba en el
  // centro y tapaba justo el vacío, que es lo único irremplazable de la sala.
  ...[-1, 1].flatMap((lado) => [
    Object.freeze({
      nombre: `estanteBajo${lado}`,
      color: CANTINA.estante,
      centro: [lado * 4.1, 0.1, 6.3],
      medidas: [2, 0.18, 0.6],
    }),
    Object.freeze({
      nombre: `estanteAlto${lado}`,
      color: CANTINA.estante,
      centro: [lado * 4.1, 1.1, 6.3],
      medidas: [2, 0.18, 0.6],
    }),
    ...fila(4, (i) => ({
      nombre: `botellaBaja${lado}${i}`,
      color: TONOS_BOTELLA[i % TONOS_BOTELLA.length],
      centro: [lado * 4.1 - 0.66 + i * 0.44, 0.45, 6.3],
      medidas: [0.2, 0.6, 0.2],
    })),
    ...fila(4, (i) => ({
      nombre: `botellaAlta${lado}${i}`,
      // Desfasadas respecto a la fila de abajo: dos filas alineadas se leen
      // como una rejilla, y una estantería de verdad nunca lo está.
      color: TONOS_BOTELLA[(i + 2) % TONOS_BOTELLA.length],
      centro: [lado * 4.1 - 0.44 + i * 0.44, 1.45, 6.3],
      medidas: [0.2, 0.6, 0.2],
    })),
  ]),

  // --- Quien se sienta ------------------------------------------------------
  // Taburetes de metal frente a la barra: frío contra la madera, y dan la
  // escala de la sala mejor que ningún otro mueble.
  ...fila(4, (i) => ({
    nombre: `taburete${i}`,
    color: CANTINA.taburete,
    centro: [-2.4 + i * 1.6, -1.45, 2.1],
    medidas: [0.5, 0.9, 0.5],
  })),
  // Dos mesas al fondo, descentradas: el local sigue existiendo lejos de la
  // barra, que es lo que separa una cantina de un mostrador.
  Object.freeze({ nombre: "mesaIzq", color: CANTINA.mesa, centro: [-3.4, -1.2, 5.2], medidas: [1.6, 0.2, 1.6] }),
  Object.freeze({ nombre: "mesaIzqPie", color: CANTINA.mesa, centro: [-3.4, -1.6, 5.2], medidas: [0.3, 0.7, 0.3] }),
  Object.freeze({ nombre: "mesaDer", color: CANTINA.mesa, centro: [3.4, -1.2, 5.2], medidas: [1.6, 0.2, 1.6] }),
  Object.freeze({ nombre: "mesaDerPie", color: CANTINA.mesa, centro: [3.4, -1.6, 5.2], medidas: [0.3, 0.7, 0.3] }),

  // --- La luz ---------------------------------------------------------------
  // Las lámparas cuelgan por delante y ARRIBA del encuadre: casi no se ven
  // enteras, y es la intención. Importa que haya calor en la parte alta de la
  // sala, no mirarlas de frente.
  ...fila(3, (i) => ({
    nombre: `lampara${i}`,
    color: CANTINA.lampara,
    centro: [-2.6 + i * 2.6, 2.35, 2.4 + (i % 2) * 1.4],
    medidas: [1.4, 0.22, 0.7],
  })),
  // --- Que se note que esto vuela ------------------------------------------
  // Tubería vista cruzando el techo de lado a lado. Es el detalle más barato
  // que existe y el que más dice: en una taberna los tubos van escondidos.
  ...fila(3, (i) => ({
    nombre: `conducto${i}`,
    color: CANTINA.conducto,
    centro: [0, 2.62 - i * 0.16, 2.2 + i * 1.9],
    medidas: [10.4, 0.22, 0.22],
  })),
  // Bajantes por donde los tubos entran en el mamparo lateral.
  ...[-1, 1].map((lado) =>
    Object.freeze({
      nombre: `bajante${lado}`,
      color: CANTINA.conducto,
      centro: [lado * 4.7, 1, 1.4],
      medidas: [0.28, 3.2, 0.28],
    }),
  ),
  // Pantallas de servicio en los mamparos ciegos, apagadas. Encendidas serían
  // una promesa de información que la sala no da; apagadas son mobiliario de
  // nave, que es lo que hacen falta.
  ...[-1, 1].flatMap((lado) =>
    fila(2, (i) => ({
      nombre: `pantalla${lado}${i}`,
      color: CANTINA.pantalla,
      centro: [lado * 4.98, 1.4 - i * 1.1, 2.6 + i * 1.6],
      medidas: [0.12, 0.7, 1.1],
    })),
  ),
  // Balizas de suelo: la línea de emergencia por la que se sale a oscuras.
  ...fila(5, (i) => ({
    nombre: `baliza${i}`,
    color: CANTINA.baliza,
    centro: [-4.7, -1.72, 0.6 + i * 1.5],
    medidas: [0.3, 0.06, 0.5],
  })),
  ...fila(5, (i) => ({
    nombre: `balizaDer${i}`,
    color: CANTINA.baliza,
    centro: [4.7, -1.72, 0.6 + i * 1.5],
    medidas: [0.3, 0.06, 0.5],
  })),

  // --- El goblin ciego -----------------------------------------------------
  //
  // Sirve cervezas a la mesa del fondo, y lleva haciéndolo toda la vida: por eso
  // no necesita ver. Es el único habitante de la sala, y está de espaldas —a lo
  // suyo— porque una figura mirando a cámara convierte un local en un escenario
  // con un actor esperando su turno.
  //
  // Cajas, como todo lo demás: a esta resolución una silueta de seis cajas se
  // lee como alguien de pie mejor que una malla de doscientos polígonos.
  Object.freeze({ nombre: "goblinCuerpo", color: CANTINA.goblinRopa, centro: [-2.9, -0.95, 5.2], medidas: [0.55, 1.1, 0.4] }),
  Object.freeze({ nombre: "goblinCabeza", color: CANTINA.goblinPiel, centro: [-2.9, -0.25, 5.2], medidas: [0.4, 0.4, 0.38] }),
  // Las orejas, que es lo que lo hace un goblin y no un tabernero bajito.
  Object.freeze({ nombre: "goblinOrejaIzq", color: CANTINA.goblinPiel, centro: [-3.18, -0.2, 5.2], medidas: [0.22, 0.14, 0.12] }),
  Object.freeze({ nombre: "goblinOrejaDer", color: CANTINA.goblinPiel, centro: [-2.62, -0.2, 5.2], medidas: [0.22, 0.14, 0.12] }),
  // La venda: una banda clara a la altura de los ojos. Es el detalle que cuenta
  // la historia entera sin una línea de texto.
  Object.freeze({ nombre: "goblinVenda", color: CANTINA.goblinVenda, centro: [-2.9, -0.22, 5.02], medidas: [0.42, 0.12, 0.06] }),
  // El brazo extendido con la bandeja, hacia la mesa de la izquierda.
  Object.freeze({ nombre: "goblinBrazo", color: CANTINA.goblinPiel, centro: [-3.2, -0.7, 5.0], medidas: [0.5, 0.12, 0.12] }),
  Object.freeze({ nombre: "goblinBandeja", color: CANTINA.taburete, centro: [-3.45, -0.62, 4.95], medidas: [0.42, 0.05, 0.35] }),
  // Y las jarras que está sirviendo, en la bandeja y en la mesa del fondo.
  ...fila(2, (i) => ({
    nombre: `jarraBandeja${i}`,
    color: CANTINA.cerveza,
    centro: [-3.55 + i * 0.2, -0.48, 4.95],
    medidas: [0.14, 0.22, 0.14],
  })),
  ...fila(3, (i) => ({
    nombre: `jarraMesa${i}`,
    color: CANTINA.cerveza,
    centro: [-3.7 + i * 0.3, -1.0, 5.2],
    medidas: [0.13, 0.2, 0.13],
  })),

  // El rótulo de neón, descentrado: un local con el cartel centrado parece un
  // decorado, y este tiene que parecer usado.
  Object.freeze({ nombre: "neon", color: CANTINA.neon, centro: [-4.2, 1.95, 6.45], medidas: [1.6, 0.28, 0.15] }),
]);



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
/**
 * Campo de visión de la sala, en grados. Más cerrado que el del motor (60°) a
 * propósito: un interior con gran angular exagera la profundidad y deforma todo
 * lo que se aleja del centro, que es lo que hacía parecer rota la sala al
 * asomarse. Un objetivo más largo es además lo que se usa para filmar
 * interiores, y por eso esto se parece más a una nave y menos a una cámara de
 * seguridad.
 */
export const FOV = 42;

/**
 * Dónde puede estar quien anda por la cantina. La sala está construida para
 * verse desde la puerta, así que el paseo se acota a la mitad delantera: detrás
 * de la barra no hay nada modelado, y dejar entrar ahí es enseñar el decorado
 * por dentro. El tope de `z` es además la barra: no se atraviesa.
 */
export const PASEO = Object.freeze({
  minX: -3.4,
  maxX: 3.4,
  minZ: -1.5, // pegado a la puerta
  maxZ: 2.6, // justo antes de la barra
  alto: 0.55, // altura de los ojos sobre el suelo de la sala
});

/** Cuánto se mira a los lados y arriba/abajo con el ratón, en radianes. */
export const MIRA = Object.freeze({ yaw: 0.55, pitch: 0.22 });

/**
 * Sitúa a quien mira dentro de la sala, acotado al paseo. Es lo que convierte
 * el «asomarse» anterior en estar de pie en un sitio: la posición y la mirada
 * son cosas distintas, como en cualquier juego en primera persona, y por eso el
 * ratón MIRA y las teclas ANDAN en vez de compartir un único vaivén.
 */
export function acotarCamara(camara = {}) {
  const x = Number.isFinite(camara.x) ? camara.x : 0;
  const z = Number.isFinite(camara.z) ? camara.z : 0;
  return {
    x: Math.max(PASEO.minX, Math.min(PASEO.maxX, x)),
    z: Math.max(PASEO.minZ, Math.min(PASEO.maxZ, z)),
    yaw: Number.isFinite(camara.yaw) ? camara.yaw : 0,
    pitch: Number.isFinite(camara.pitch) ? camara.pitch : 0,
  };
}

export function componerCantina(opciones = {}) {
  const {
    ancho = 480,
    alto = 270,
    epoca,
    fondo = CANTINA.ventana,
    camara,
    // El cielo se siembra: la misma semilla da siempre la misma ventana, y dos
    // personas de la misma mesa ven el mismo vacío.
    semillaCielo = 20260731,
  } = opciones;
  const cielo = campoEstelar(semillaCielo, { cantidad: 90 });

  // UNA sola cámara, la de un walking simulator: se está en un sitio (`x`, `z`)
  // y se mira en una dirección (`yaw`, `pitch`). El «asomo» anterior mezclaba
  // las dos cosas en un vaivén y por eso no se leía como moverse: desplazarse y
  // girar a la vez, siempre atado, es un travelling de cine, no andar.
  const puesto = acotarCamara(camara);
  const desvioX = puesto.x;
  const yaw = puesto.yaw;

  const partes = MUEBLES.map((mueble) =>
    // `transformar` gira alrededor del origen y DESPUÉS traslada, así que la
    // posición de la cámara se resta aquí, en coordenadas de mundo:
    // v' = R(yaw)·(v − cámara). Pasarla como `posicion` la aplicaría después de
    // girar, que es una cámara orbitando un punto en vez de andando por la sala.
    componerEscena(caja(
      [
        mueble.centro[0] - desvioX,
        mueble.centro[1] - PASEO.alto,
        mueble.centro[2] - puesto.z,
      ],
      mueble.medidas,
    ), {
      ancho,
      alto,
      epoca,
      fov: FOV,
      color: mueble.color,
      fondo,
      yaw,
      pitch: puesto.pitch,
      posicion: [0, 0, 0],
    }),
  );

  // Fundido y reordenado global. Cada parte ya viene ordenada por su cuenta, y
  // el orden por pintor no es componible: dos listas correctas concatenadas dan
  // una lista incorrecta, y la barra acabaría dibujada detrás del mamparo.
  const poligonos = partes
    .flatMap((parte) => parte.poligonos)
    .sort((a, b) => b.profundidad - a.profundidad);

  // Lo que se ve por el hueco del mamparo. El pintor dibuja las estrellas ANTES
  // que los polígonos, así que el propio mamparo las recorta: no hace falta
  // recortarlas a mano contra el hueco, y por eso el ventanal no lleva cristal.
  //
  // Hacia dónde va esto (#427): por esa ventana debería verse el MAPA VIVO —los
  // contactos que la nave tiene delante— y no un cielo cualquiera. La forma ya
  // está preparada para ello: la escena devuelve `estrellas` y quien pinta no
  // pregunta de dónde salen, así que sustituir el campo por la lectura del
  // puente no toca ni la sala ni el pintor.
  const estrellas = proyectarEstrellas(cielo, {
    ancho,
    alto,
    epoca,
    fov: FOV,
    yaw,
    pitch: puesto.pitch,
    // Sin paralaje propio: están infinitamente lejos, que es lo que las hace
    // leerse como cielo y no como confeti pegado al cristal.
  });

  return { ancho, alto, epoca: partes[0]?.epoca, poligonos, estrellas };
}

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

import { CACHARROS, CANTINA } from "./paleta.mjs";
import { componerEscena, fundirEscenas, focal, proyectar, transformar } from "./retro3d.mjs";
import { campoEstelar, proyectarEstrellas } from "./retro3d-estrellas.mjs";
import { cuerpoMayor, cuerposPorLaVentana } from "./cantina-ventana.mjs";
import { anclasHumoDeLaGente, piezasDeLaGente } from "./cantina-avatar.mjs";
import { PLANO_INICIAL, planoPorId } from "./cantina-planos.mjs";
import { caja, mallaDePieza } from "./escena-primitivas.mjs";

// `caja` vive ahora en `escena-primitivas.mjs` (#589). Estaba copiada aquí, en
// el póker y en el blackjack, y la playa la importaba DE ESTE MÓDULO — un
// exterior dependiendo del bar de la nave. Se reexporta para no romper a quien
// ya la traía de aquí, y porque este sigue siendo su sitio natural de lectura.
//
// Y ya no es «la única primitiva del módulo», que es lo que decía este
// comentario: hay prisma, esfera, anillo, losa y rampa. Una cantina se construye
// con cajas porque una barra y un armario SON cajas, no porque no hubiera más.
export { caja };


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
  // El tramo `i===2` se sustituye más abajo por el hueco real de la puerta
  // hacia el vestíbulo (#427/#508) — ver `PUERTA_CANTINA_HACIA_VESTIBULO`.
  ...fila(6, (i) => ({
    nombre: `paredIzq${i}`,
    color: CANTINA.mamparo,
    centro: [-5.2, 0.5, 0.2 + i * 1.7],
    medidas: [0.4, 5, 1.6],
  })).filter((_, i) => i !== 2),
  // El dintel que queda sobre el hueco de la puerta: mismo tramo de muro que
  // `paredIzq2`, pero solo por ENCIMA de la altura de puerta (1.6, misma
  // proporción sobre la altura de la sala que `ALTURA_PUERTA`/`ALTURA` en
  // `nave-sala-caja.mjs`) — por debajo queda libre de verdad, no una malla
  // que se atraviesa por colisión sin verse. QA: hasta ahora este muro no
  // tenía ningún hueco y la única puerta real de la cantina era invisible
  // —un muro sólido que teletransportaba por debajo—, la única sala de la
  // nave sin la puerta corredera que ya tienen el resto (#508 QA: "estilo
  // Star Trek"). Las hojas correderas las pone `cantina-andar.mjs` (la
  // cámara libre de #427); los planos fijos de #423 no miran nunca a este
  // muro, así que para ellos es simplemente un hueco abierto, como una
  // ventana sin cristal.
  Object.freeze({ nombre: "dintelPuertaOeste", color: CANTINA.mamparo, centro: [-5.2, 2.3, 3.6], medidas: [0.4, 1.4, 1.6] }),
  ...fila(6, (i) => ({
    nombre: `paredDer${i}`,
    color: CANTINA.mamparo,
    centro: [5.2, 0.5, 0.2 + i * 1.7],
    medidas: [0.4, 5, 1.6],
  })),

  // --- La entrada, a la espalda de quien llega -----------------------------
  //
  // Sin esto, girarse era asomarse al vacío: la sala se construyó para verse
  // desde la puerta y no tenía puerta. Ahora al darte la vuelta ves de dónde
  // vienes, que es lo que cierra un sitio — un local con una pared que no
  // existe no es acogedor, es un decorado visto por detrás.
  ...fila(4, (i) => ({
    nombre: `paredEntrada${i}`,
    color: CANTINA.mamparo,
    // Dos tramos a cada lado del hueco de la puerta, que queda en el centro.
    centro: [i < 2 ? -3.6 + i * 1.4 : 2.2 + (i - 2) * 1.4, 0.5, -2.6],
    medidas: [1.3, 5, 0.5],
  })),
  Object.freeze({ nombre: "dintelEntrada", color: CANTINA.mamparo, centro: [0, 2.3, -2.6], medidas: [3.2, 1.4, 0.5] }),
  // Luz que se cuela por encima del dintel, desde el pasillo: da una segunda
  // fuente de calor al fondo opuesto sin fingir una puerta que no lo es.
  //
  // QA (#508): esto medía 3.0×3.4 de suelo a dintel —EXACTAMENTE la silueta
  // de una puerta abierta— y con la nave ya andable (#427) el hueco real por
  // el que se sale está en el muro OESTE, no aquí. Una franja alta y delgada
  // que no llega al suelo no se puede confundir con un hueco por el que
  // caminar: es luz colándose por ARRIBA de una pared cerrada, no un vano.
  Object.freeze({ nombre: "vanoEntrada", color: CANTINA.lampara, centro: [0, 1.55, -2.75], medidas: [2.4, 0.5, 0.12] }),
  // Costillas de la pared de entrada, para que no sea una plancha lisa.
  ...fila(2, (i) => ({
    nombre: `nervioEntrada${i}`,
    color: CANTINA.nervio,
    centro: [i === 0 ? -1.7 : 1.7, 0.5, -2.35],
    medidas: [0.25, 4.6, 0.3],
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
  // Descolocada respecto a la de babor, y más cerca: dos mesas enfrentadas a la
  // misma distancia son un comedor de catálogo.
  Object.freeze({ nombre: "mesaDer", color: CANTINA.mesa, centro: [3.9, -1.2, 3.9], medidas: [1.6, 0.2, 1.6] }),
  Object.freeze({ nombre: "mesaDerPie", color: CANTINA.mesa, centro: [3.9, -1.6, 3.9], medidas: [0.3, 0.7, 0.3] }),

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
  // --- Lo que alguien dejó ahí ---------------------------------------------
  //
  // Un local habitado tiene cosas que nadie colocó a propósito. Esto no es
  // decoración de más: es la diferencia entre una sala construida y una sala
  // usada, y sale barato porque son cajas.

  // La TELE del bar, colgada en alto a estribor. Va aquí, en el 3D, para que
  // exista como objeto de la sala; el vídeo por enlace irá encima, anclado a
  // este rectángulo, cuando se cablee (#423).
  Object.freeze({ nombre: "teleMarco", color: CACHARROS.teleMarco, centro: [4.6, 1.35, 3.2], medidas: [0.28, 1.15, 1.9] }),
  Object.freeze({ nombre: "telePantalla", color: CACHARROS.telePantalla, centro: [4.42, 1.35, 3.2], medidas: [0.06, 0.95, 1.65] }),
  Object.freeze({ nombre: "teleSoporte", color: CACHARROS.cajaFleje, centro: [4.85, 1.9, 3.2], medidas: [0.5, 0.12, 0.12] }),

  // La GRAMOLA, contra la pared de babor. Granate de local de carretera: el
  // único mueble que no es ni madera ni metal de nave.
  Object.freeze({ nombre: "gramola", color: CACHARROS.gramola, centro: [-4.6, -1.05, 1.2], medidas: [0.5, 1.4, 1.1] }),
  Object.freeze({ nombre: "gramolaLuz", color: CACHARROS.gramolaLuz, centro: [-4.32, -0.7, 1.2], medidas: [0.06, 0.3, 0.8] }),

  // CAJAS de suministro apiladas, con sus flejes. Nadie las ha subido todavía.
  ...fila(3, (i) => ({
    nombre: `caja${i}`,
    color: CACHARROS.cajaSuministro,
    centro: [-4.3 + (i % 2) * 0.8, -1.45 + Math.floor(i / 2) * 0.62, 5.6],
    medidas: [0.7, 0.6, 0.7],
  })),
  ...fila(3, (i) => ({
    nombre: `fleje${i}`,
    color: CACHARROS.cajaFleje,
    centro: [-4.3 + (i % 2) * 0.8, -1.45 + Math.floor(i / 2) * 0.62, 5.6],
    medidas: [0.74, 0.08, 0.74],
  })),

  // La PLANTA de la esquina: lo único vivo de la sala que no habla, y lo que
  // más dice que aquí vive gente y no solo trabaja.
  Object.freeze({ nombre: "maceta", color: CACHARROS.maceta, centro: [4.4, -1.5, 5.9], medidas: [0.5, 0.5, 0.5] }),
  ...fila(4, (i) => ({
    nombre: `hoja${i}`,
    color: CACHARROS.planta,
    centro: [4.4 + (i % 2 === 0 ? -0.22 : 0.22), -0.95 + (i > 1 ? 0.35 : 0), 5.9 + (i > 1 ? 0.18 : -0.18)],
    medidas: [0.34, 0.5, 0.16],
  })),

  // El TRAPO sobre la barra. Una caja de nada, y es el detalle más humano del
  // local: alguien estaba limpiando y lo dejó ahí.
  Object.freeze({ nombre: "trapo", color: CACHARROS.trapo, centro: [1.5, -0.95, 4.0], medidas: [0.4, 0.05, 0.3] }),
  // Dos jarras servidas esperando en la barra.
  ...fila(2, (i) => ({
    nombre: `jarraBarra${i}`,
    color: CANTINA.cerveza,
    centro: [-1.2 + i * 0.35, -0.83, 4.0],
    medidas: [0.14, 0.22, 0.14],
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
  // Las pantallas van SOLO a babor. La sala era un espejo perfecto en X
  // —paredes, costillas, estantes, pantallas, balizas, mesas— y una simetría
  // total vista desde fuera del eje no se lee como Kubrick: se lee como papel
  // pintado repetido. La simetría de Kubrick es un plano de un punto de fuga
  // DESDE UN SITIO CONCRETO, no un decorado idéntico a los dos lados.
  //
  // Lo único que se mantiene simétrico es lo que enmarca el ojo de buey:
  // mamparo de fondo, dintel y montantes. Ahí la simetría sí trabaja.
  ...fila(2, (i) => ({
    nombre: `pantalla${i}`,
    color: CANTINA.pantalla,
    centro: [-4.98, 1.4 - i * 1.1, 2.6 + i * 1.6],
    medidas: [0.12, 0.7, 1.1],
  })),
  // Balizas de suelo: la línea de emergencia por la que se sale a oscuras.
  ...fila(5, (i) => ({
    nombre: `baliza${i}`,
    color: CANTINA.baliza,
    centro: [-4.7, -1.72, 0.6 + i * 1.5],
    medidas: [0.3, 0.06, 0.5],
  })),
  // Las balizas, solo a estribor: la vía de evacuación es una, no dos.
  ...fila(3, (i) => ({
    nombre: `balizaDer${i}`,
    color: CANTINA.baliza,
    centro: [4.7, -1.72, 1.4 + i * 1.8],
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
 * El hueco de la puerta oeste, en el formato que pide `piezasHojaPuerta` de
 * `nave-sala-caja.mjs` (mismo `base`/`y0`/`y1`/`alongX` que ya resuelve
 * `abrirHuecosEnMuros` para las salas nuevas) — reutilizado por
 * `cantina-andar.mjs` para dibujar sus hojas correderas SIN duplicar la
 * geometría del hueco a mano en dos archivos.
 */
export const PUERTA_CANTINA_HACIA_VESTIBULO = Object.freeze({
  base: Object.freeze({ x: -5.4, z: 2.8, ancho: 0.4, profundidad: 1.6 }),
  y0: -2.0,
  y1: 1.6,
  alongX: false,
});



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
 * Dónde flota el humo y de dónde caen los haces, en coordenadas de MUNDO.
 *
 * Estaban dibujados en coordenadas de pantalla y por eso «no se notaba el 3D»:
 * un velo que no se mueve con la sala es un filtro, no aire. Anclados, pasan por
 * delante de lo cercano y por detrás de lo lejano, menguan con la distancia y
 * salen del cuadro al girarse — que es el 90% de la sensación de volumen sin
 * pagar el precio de un volumétrico de verdad (el rasterizador ordena por
 * pintor y no tiene mezcla alfa; añadírsela sería otro proyecto).
 */
export const ANCLAS_AIRE = Object.freeze([
  // Vetas de humo a media altura, repartidas por la sala en profundidad.
  Object.freeze({ punto: [-2.2, -0.2, 1.6], tipo: "humo", largo: 3.2 }),
  Object.freeze({ punto: [1.4, 0.1, 2.4], tipo: "humo", largo: 4.0 }),
  Object.freeze({ punto: [-0.6, -0.35, 3.4], tipo: "humo", largo: 3.6 }),
  Object.freeze({ punto: [2.6, 0.25, 4.2], tipo: "humo", largo: 3.0 }),
  Object.freeze({ punto: [-3.0, 0.05, 5.0], tipo: "humo", largo: 2.6 }),
  // Los haces, colgando de cada lámpara: el punto es el foco, no el suelo.
  Object.freeze({ punto: [-2.6, 2.2, 2.4], tipo: "haz", largo: 3.6 }),
  Object.freeze({ punto: [0, 2.2, 3.8], tipo: "haz", largo: 3.6 }),
  Object.freeze({ punto: [2.6, 2.2, 2.4], tipo: "haz", largo: 3.6 }),
]);

/**
 * Dónde están atornillados los trastos electrónicos, en coordenadas de MUNDO.
 * Antes vivían en píxeles de pantalla y por eso flotaban como un HUD: un panel
 * es un objeto de la pared, no una capa de interfaz.
 */
export const ANCLAS_CACHIVACHE = Object.freeze([
  Object.freeze({ punto: [-4.9, 1.3, 2.0], tipo: "pilotos" }),
  Object.freeze({ punto: [-4.9, 0.2, 3.6], tipo: "barras" }),
  Object.freeze({ punto: [-4.9, 1.5, 5.0], tipo: "pilotos" }),
  Object.freeze({ punto: [4.9, 1.3, 2.0], tipo: "barras" }),
  Object.freeze({ punto: [4.9, 0.2, 3.6], tipo: "pilotos" }),
  Object.freeze({ punto: [4.9, 1.5, 5.0], tipo: "barras" }),
  Object.freeze({ punto: [-2.2, 2.0, 6.7], tipo: "pilotos" }),
  Object.freeze({ punto: [2.2, 2.0, 6.7], tipo: "barras" }),
]);

/**
 * Lleva los puntos de un cuerpo lejano —que vienen en un plano, centrados en su
 * punto áureo— a una dirección del mundo, y los proyecta con la misma cámara que
 * la sala. Así el planeta se queda QUIETO ahí fuera mientras tú te mueves, que
 * es lo que hace que exista un fuera.
 */
function proyectarCuerpo(puntos, { ancho, alto, yaw, pitch, fov = FOV, distancia = 90 }) {
  const f = focal(alto, fov);
  const salida = [];
  for (const punto of puntos) {
    // El plano del cuerpo se coloca a `distancia` delante, escalando lo que en
    // pantalla eran píxeles a unidades de mundo por la misma focal.
    const v = transformar(
      [((punto.x - ancho / 2) * distancia) / f, ((alto / 2 - punto.y) * distancia) / f, distancia],
      { yaw, pitch, posicion: [0, 0, 0] },
    );
    if (!(v[2] > 0.1)) continue;
    const { x, y } = proyectar(v, { ancho, alto, f, rejilla: 1 });
    if (x < 0 || y < 0 || x >= ancho || y >= alto) continue;
    salida.push({ x, y, tam: punto.tam, color: punto.color });
  }
  return salida;
}

export function componerCantina(opciones = {}) {
  const {
    ancho = 640,
    alto = 360,
    epoca,
    fondo = CANTINA.ventana,
    // Desde qué plano se mira. Es un id del catálogo de `cantina-planos.mjs`:
    // la cámara ya no la pone quien llama, la pone el encuadre autorado.
    plano = PLANO_INICIAL,
    // Quién está en la cantina ahora mismo. Las personas entran en la MISMA
    // lista que los muebles: para el pintor un avatar es un taburete con más
    // cajas, y así no hay ni un pintor nuevo ni una rama por tipo de cosa.
    gente = [],
    yo = null,
    // Lo que la nave tiene delante de verdad (`{ contactos, rumbo, centro }`,
    // tal como los tiene el mapa vivo). Sin esto la ventana enseña solo cielo,
    // que es lo que hay cuando el puente no responde.
    espacio = null,
    // El cielo se siembra: la misma semilla da siempre la misma ventana, y dos
    // personas de la misma mesa ven el mismo vacío.
    semillaCielo = 20260731,
    // Cuándo es "ahora": mueve la calada de quien fuma (#439). Sin reloj —
    // `tiempo: 0`— la brasa sale apagada y ya está, que es una escena válida y
    // no un error.
    tiempo = 0,
  } = opciones;
  const cielo = campoEstelar(semillaCielo, { cantidad: 90 });

  // UNA sola cámara, la de un walking simulator: se está en un sitio (`x`, `z`)
  // y se mira en una dirección (`yaw`, `pitch`). El «asomo» anterior mezclaba
  // las dos cosas en un vaivén y por eso no se leía como moverse: desplazarse y
  // girar a la vez, siempre atado, es un travelling de cine, no andar.
  const encuadre = planoPorId(plano);
  const [camX, camY, camZ] = encuadre.posicion;
  const yaw = encuadre.yaw;
  // Cada plano trae su objetivo: un general de sala y un primer plano de barra
  // no se filman con la misma lente, y usar una sola los aplana a los dos.
  const fovPlano = Number.isFinite(encuadre.fov) ? encuadre.fov : FOV;

  const habitantes = piezasDeLaGente(gente, { omitirId: yo, tiempo });
  const partes = [...MUEBLES, ...habitantes].map((mueble) =>
    // `transformar` gira alrededor del origen y DESPUÉS traslada, así que la
    // posición de la cámara se resta aquí, en coordenadas de mundo:
    // v' = R(yaw)·(v − cámara). Pasarla como `posicion` la aplicaría después de
    // girar, que es una cámara orbitando un punto en vez de andando por la sala.
    componerEscena(mallaDePieza(mueble, { desplazamiento: [camX, camY, camZ] }), {
      ancho,
      alto,
      epoca,
      fov: fovPlano,
      color: mueble.color,
      fondo,
      yaw,
      pitch: encuadre.pitch,
      posicion: [0, 0, 0],
      // Recorte de frustum completo (#510, QA: "no se veía nada a través de
      // la ventana"): sin esto, un mueble visto de cerca en algunos planos
      // dispara un vértice fuera del cuadro, y el polígono resultante infla
      // sus coordenadas a decenas de miles de píxeles — tapando toda la
      // pantalla, estrellas incluidas, aunque el hueco del ventanal esté
      // vacío. Mismo arreglo que ya lleva la cámara libre de #427
      // (`cantina-andar.mjs`, `nave-sala-caja.mjs`), aplicado aquí a los
      // encuadres fijos.
      recorteLateral: true,
    }),
  );

  // Un solo orden de pintor global para todas las piezas (`fundirEscenas`,
  // #510): concatenar dos listas ya ordenadas da una lista incorrecta en cuanto
  // dos piezas se solapan, y hasta #510 cada consumidor repetía este mismo
  // fundido a mano.
  const { poligonos } = fundirEscenas(partes);

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
    fov: fovPlano,
    yaw,
    pitch: encuadre.pitch,
    // Sin paralaje propio: están infinitamente lejos, que es lo que las hace
    // leerse como cielo y no como confeti pegado al cristal.
  });

  // Por el ojo de buey se ve EL ESPACIO QUE TENEMOS, y en este orden: primero
  // el cuerpo mayor —que es lo que da escala al vacío—, luego el cielo, y encima
  // los contactos, que son lo único que se mueve y lo que hay que poder ver.
  //
  // Todo entra en la MISMA lista que las estrellas a propósito: el pintor las
  // dibuja antes que los polígonos, así que el mamparo las recorta solo y el
  // ojo de buey no necesita ni cristal ni máscara.
  // El cuerpo mayor se proyecta como todo lo demás y NO se clava en un punto de
  // pantalla: estaba puesto en un punto áureo fijo y por eso se quedaba pegado
  // al cristal como una pegatina mientras la sala se movía detrás. La proporción
  // áurea sigue mandando, pero sobre su DIRECCIÓN en el mundo, no sobre el
  // píxel: se coloca fuera, en el espacio, y cae donde tenga que caer.
  const fuera = [
    ...proyectarCuerpo(cuerpoMayor({ ancho, alto }), {
      ancho,
      alto,
      yaw,
      pitch: encuadre.pitch,
      fov: fovPlano,
    }),
    ...estrellas,
    ...cuerposPorLaVentana(espacio ?? {}, { ancho, alto }),
  ];

  // Dónde caen en pantalla los trastos de los mamparos. Se proyectan CON la
  // cámara y viajan a la capa 2D: dibujados en coordenadas fijas parecían un
  // HUD pegado al cristal, que es justo lo que no son — son objetos atornillados
  // a una pared, y tienen que moverse con ella.
  const anclas = [];
  const f = focal(alto, fovPlano);
  for (const ancla of ANCLAS_CACHIVACHE) {
    const v = transformar(
      [ancla.punto[0] - camX, ancla.punto[1] - camY, ancla.punto[2] - camZ],
      { yaw, pitch: encuadre.pitch, posicion: [0, 0, 0] },
    );
    if (!(v[2] > 0.4)) continue;
    const { x, y } = proyectar(v, { ancho, alto, f, rejilla: 1 });
    if (x < -40 || y < -40 || x > ancho + 40 || y > alto + 40) continue;
    // La escala mengua con la distancia, como cualquier cosa que se aleja.
    anclas.push({ x, y, escala: Math.max(0.35, Math.min(2.2, 6 / v[2])), tipo: ancla.tipo });
  }

  // El aire, proyectado igual que los trastos. Se ordena de lejos a cerca para
  // que quien pinte lo haga en ese orden y las vetas cercanas tapen a las
  // lejanas, como haría cualquier cosa con volumen.
  const aire = [];
  // El humo de la sala y el de cada cigarro encendido (#439) son la misma
  // clase de cosa para el pintor —vetas ancladas al mundo— así que entran en
  // la MISMA lista y se proyectan con el mismo bucle: nadie tiene que enseñar
  // a `pintarHumo` a distinguir un cigarro de un cenicero de pared.
  for (const ancla of [...ANCLAS_AIRE, ...anclasHumoDeLaGente(gente, { omitirId: yo })]) {
    const v = transformar(
      [ancla.punto[0] - camX, ancla.punto[1] - camY, ancla.punto[2] - camZ],
      { yaw, pitch: encuadre.pitch, posicion: [0, 0, 0] },
    );
    if (!(v[2] > 0.5)) continue;
    const { x, y } = proyectar(v, { ancho, alto, f, rejilla: 1 });
    if (x < -ancho || x > ancho * 2) continue;
    // Ancho aparente: lo que mide de largo en el mundo, llevado a pantalla por
    // la misma focal que todo lo demás. Sin esto, el humo del fondo saldría tan
    // grande como el de delante y delataría que es una calcomanía.
    aire.push({
      x,
      y,
      tipo: ancla.tipo,
      largo: Math.max(4, (ancla.largo * f) / v[2]),
      profundidad: v[2],
    });
  }
  aire.sort((a, b) => b.profundidad - a.profundidad);

  // Y dónde cae en pantalla cada cosa que se puede hacer desde este plano. Es
  // lo que hace que las opciones sean OBVIAS —modelo GTA/RDR2— en vez de tener
  // que barrer la sala con el ratón a ver qué responde.
  const opcionesVisibles = [];
  const margen = Math.round(Math.min(ancho, alto) * 0.08);
  for (const accion of encuadre.acciones ?? []) {
    const v = transformar(
      [accion.ancla[0] - camX, accion.ancla[1] - camY, accion.ancla[2] - camZ],
      { yaw, pitch: encuadre.pitch, posicion: [0, 0, 0] },
    );
    // Una opción NUNCA se descarta por caer fuera del cuadro: se pega al borde
    // por el que se sale, como el marcador de un objetivo a tu espalda en un
    // juego de mundo abierto. Descartarla sería esconder una salida — y la
    // regla de este plano es que lo que se puede hacer se VE, sin barrer la
    // pantalla con el ratón a ver qué responde.
    const detras = !(v[2] > 0.4);
    const proyectado = detras ? null : proyectar(v, { ancho, alto, f, rejilla: 1 });
    const acotar = (valor, tope) => Math.max(margen, Math.min(tope - margen, valor));
    opcionesVisibles.push({
      ...accion,
      // A la espalda: abajo, y por el lado hacia el que habría que girarse.
      x: detras ? (v[0] < 0 ? margen : ancho - margen) : acotar(proyectado.x, ancho),
      y: detras ? alto - margen : acotar(proyectado.y, alto),
      // `fuera` deja que quien pinta lo dibuje distinto: una cosa es «está
      // ahí» y otra «está por ahí».
      fuera: detras || proyectado.x < 0 || proyectado.y < 0 || proyectado.x > ancho || proyectado.y > alto,
      profundidad: detras ? Infinity : v[2],
    });
  }

  return {
    ancho,
    alto,
    epoca: partes[0]?.epoca,
    poligonos,
    estrellas: fuera,
    anclas,
    plano: encuadre.id,
    opciones: opcionesVisibles,
    aire,
  };
}

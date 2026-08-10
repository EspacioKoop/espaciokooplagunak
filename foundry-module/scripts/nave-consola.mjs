// La consola de puesto de una sala (#557, sobre #509).
//
// ANTES NO HABÍA NINGUNA. `nave-catalogo-andar` declaraba `consolas: [{ rect,
// puesto }]` y ahí acababa la cosa: un cuadrado de 1,6 m que abre el espacio de
// puesto al pisarlo, sin nada dibujado encima. La consola de #509 era un trozo
// de suelo vacío. Y `detalleConsola` —que dibuja botones y palanca, con su test
// en verde— no la llamaba nadie: no un módulo huérfano, sino un export huérfano
// dentro de un módulo bien cableado, que es la variante que la guarda de #523 no
// ve.
//
// SE PONE CONTRA LA PARED, NO EN MEDIO DE SU ZONA. El rect de la consola es
// donde te PONES tú; un cuerpo sólido plantado ahí bloquearía su propio
// disparador y nadie podría activarla. Así que el mueble va pegado al borde de
// la zona que da a la pared más cercana, mirando hacia dentro, y lo que queda
// libre es justo el sitio donde uno se planta a usarla.
//
// ES EL OBJETO QUE MÁS DE CERCA SE MIRA DE LA NAVE, porque se camina hasta él a
// propósito. Por eso lleva la piel de objeto entera (#550) en el cuerpo, y por
// eso tiene monitor: a un metro, un cajón liso con tres botones se queda corto.
//
// LA PANTALLA VA ENCENDIDA Y VACÍA. Con `emisivo` (#555) se puede pintar un
// monitor encendido, y ahí acaba: ni barras, ni cifras, ni forma de onda. Un
// monitor iluminado no afirma nada; uno con un gráfico afirma una lectura que
// nadie ha calculado, y sería la infracción más creíble posible de #526 —
// precisamente porque una consola es el único sitio donde un dato tendría
// sentido. El dato de verdad está en el espacio de puesto que se abre al llegar.
//
// Puro y sin color propio (#351). Devuelve piezas con la forma `mobiliario` que
// ya acepta `crearSalaCaja`, así que la sala no necesita saber qué es una
// consola: recibe muebles.

import { LUZ_FOSFORO, MURAL, SECCION } from "./paleta.mjs";
import { detalleConsola } from "./nave-sala-caja.mjs";

/** Medidas del cuerpo, en metros. Altura de mesa de trabajo de pie. */
const CUERPO = Object.freeze({ ancho: 1.1, alto: 0.95, fondo: 0.62 });
// 0,62 de fondo y no 0,55: `piezasPielObjeto` exige `MINIMO_LADO` = 0,6 en el
// lado menor para vestir un objeto (#550), y con 0,55 el cuerpo se quedaba liso
// —una caja negra en la sala más trabajada de la nave—. Antes de bajar el mínimo
// hay que preguntarse si la pieza es lo bastante grande: una mesa de trabajo de
// 62 cm de fondo lo es, y sigue siendo una medida de mesa.
/** El monitor que se levanta por detrás de la tapa. */
const MONITOR = Object.freeze({ ancho: 0.85, alto: 0.5, fondo: 0.09 });

/**
 * Contra qué lado de la zona se arrima la consola.
 *
 * Se decide por la pared más cercana, medida desde el centro de la zona. Es una
 * decisión geométrica y no una tabla por sala: `nave-catalogo-andar` coloca la
 * zona al 72% de cada sala, así que la pared próxima cambia con las medidas y
 * escribirla a mano sería otra lista que se desincroniza.
 *
 * @returns {{eje: "x"|"z", sentido: 1|-1}} hacia dónde está la pared.
 */
export function ladoDeApoyo(zona, sala) {
  const cx = zona.x + zona.ancho / 2;
  const cz = zona.z + zona.profundidad / 2;
  const distancias = [
    { eje: "x", sentido: -1, d: cx },
    { eje: "x", sentido: 1, d: sala.ancho - cx },
    { eje: "z", sentido: -1, d: cz },
    { eje: "z", sentido: 1, d: sala.profundidad - cz },
  ];
  return distancias.reduce((mejor, actual) => (actual.d < mejor.d ? actual : mejor));
}

/**
 * Las piezas de una consola, en el formato `mobiliario` de `crearSalaCaja`.
 *
 * @param {{zona: object, sala: {ancho:number, profundidad:number}}} opciones
 * @returns {Array<{centro:number[], medidas:number[], color:string, colision?:boolean, piel?:boolean, emisivo?:boolean}>}
 */
export function piezasConsola({ zona, sala }) {
  const lado = ladoDeApoyo(zona, sala);
  const alLargoDeX = lado.eje === "z"; // pared al norte o al sur → el mueble se extiende en x
  const cx = zona.x + zona.ancho / 2;
  const cz = zona.z + zona.profundidad / 2;

  // El cuerpo se empuja hasta el borde de la zona que da a la pared. Lo que
  // queda de zona es el hueco donde uno se pone, que es el que NO puede tener
  // nada sólido encima.
  const empuje = (zona[lado.eje === "x" ? "ancho" : "profundidad"] - CUERPO.fondo) / 2;
  const centroX = lado.eje === "x" ? cx + lado.sentido * empuje : cx;
  const centroZ = lado.eje === "z" ? cz + lado.sentido * empuje : cz;

  const medidas = (ancho, alto, fondo) => (alLargoDeX ? [ancho, alto, fondo] : [fondo, alto, ancho]);

  const yCuerpo = CUERPO.alto / 2;
  const piezas = [
    // El cuerpo: lo único con colisión. Lleva piel de objeto (#550) porque es lo
    // que se mira a un metro.
    {
      nombre: "consolaCuerpo",
      centro: [centroX, yCuerpo, centroZ],
      medidas: medidas(CUERPO.ancho, CUERPO.alto, CUERPO.fondo),
      color: SECCION.casco,
    },
    // La tapa, un dedo más ancha que el cuerpo: el vuelo es lo que hace que se
    // lea como una mesa y no como un bloque cortado a ras.
    {
      nombre: "consolaTapa",
      centro: [centroX, CUERPO.alto + 0.02, centroZ],
      medidas: medidas(CUERPO.ancho + 0.08, 0.05, CUERPO.fondo + 0.08),
      color: MURAL.medio,
      colision: false,
      // Sin piel: es una pieza de cinco centímetros y la piel de objeto pide un
      // mínimo por algo (#550). Vestirla sería poner remaches en un canto.
      piel: false,
    },
  ];

  // El monitor, levantado por detrás de la tapa y arrimado a la pared: si fuera
  // al centro, taparía los mandos desde donde se está de pie.
  const retranqueo = (CUERPO.fondo - MONITOR.fondo) / 2;
  const monitorX = lado.eje === "x" ? centroX + lado.sentido * retranqueo : centroX;
  const monitorZ = lado.eje === "z" ? centroZ + lado.sentido * retranqueo : centroZ;
  const yMonitor = CUERPO.alto + 0.05 + MONITOR.alto / 2;
  piezas.push({
    nombre: "consolaMonitor",
    centro: [monitorX, yMonitor, monitorZ],
    medidas: medidas(MONITOR.ancho, MONITOR.alto, MONITOR.fondo),
    // El marco, un paso por encima del mamparo: sobre una sala oscura, un marco
    // del color del fondo deja la pantalla flotando sin aparato que la sostenga.
    color: MURAL.medio,
    colision: false,
    piel: false,
  });
  // La pantalla, un pelo por delante del marco y mirando hacia el hueco donde se
  // está de pie. Emisiva y VACÍA.
  const saliente = MONITOR.fondo / 2 + 0.01;
  piezas.push({
    nombre: "consolaPantalla",
    centro: [
      lado.eje === "x" ? monitorX - lado.sentido * saliente : monitorX,
      yMonitor,
      lado.eje === "z" ? monitorZ - lado.sentido * saliente : monitorZ,
    ],
    medidas: medidas(MONITOR.ancho - 0.1, MONITOR.alto - 0.1, 0.02),
    color: LUZ_FOSFORO,
    colision: false,
    piel: false,
    emisivo: true,
  });

  // Botones y palanca sobre la tapa. Reusa `detalleConsola`, que llevaba desde
  // #509 escrita y probada sin que la llamara nadie.
  piezas.push(
    ...detalleConsola([centroX, yCuerpo, centroZ], [CUERPO.ancho, CUERPO.alto], {
      colorPalanca: SECCION.entrable,
    }).map((pieza) => ({ ...pieza, piel: false })),
  );

  return piezas;
}

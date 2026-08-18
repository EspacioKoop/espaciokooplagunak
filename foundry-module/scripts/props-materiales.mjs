// Los MATERIALES de los props (#584, #589): textura en vez de color plano.
//
// DE DÓNDE VIENE. El motor sabe texturar desde #573 y el matte del horizonte
// (#584) fue la primera superficie que lo usó. Los props seguían siendo cajas de
// un color: una caja de madera y una caja de hormigón se distinguían solo por el
// tono, y a media distancia ni eso. Un material es lo que dice DE QUÉ ESTÁ HECHO
// algo sin añadir un polígono.
//
// UN MATERIAL NO ES UNA IMAGEN, ES UNA FUNCIÓN DEL COLOR. Y esta es la decisión
// que sostiene el módulo entero. Guardar «madera.png» obligaría a tener una
// imagen por cada tono de madera de la escena —la tablazón gris de intemperie,
// el casco desconchado de la barca, el poste descortezado— o a renunciar a que
// cada pieza tenga su color, que es de lo que vive la paleta de #351. Un
// material toma el color de la pieza y saca sus tonos DE ÉL: la veta de un
// tablón gris sale gris y la del casco rojo sale roja, con el mismo generador y
// sin una imagen más.
//
// Y ESO PERMITE QUE SEAN DIMINUTAS. Al no guardar color, un material solo guarda
// PATRÓN, y un patrón de 16×16 tileado a medio metro ya da un grano de tres
// centímetros — más fino que lo que la época movía de verdad. Las texturas se
// generan al vuelo y se cachean por (material, color): en una escena entera son
// unas pocas decenas de imágenes de 256 téxeles.
//
// EL GRANO SE MIDE EN METROS, no en caras. Está en `METROS_POR_TEXTURA`, en
// `escena-primitivas.mjs`, y es lo que impide que la veta de un listón salga
// treinta veces más gorda que la de un tablón.
//
// NADA QUE SE PUEDA LEER (#526): son vetas, remaches y motas. Ni letras ni
// símbolos.

import { METROS_POR_TEXTURA } from "./escena-primitivas.mjs";
import { canales } from "./paleta.mjs";
import { mezclar } from "./retro3d.mjs";
import { rngSemilla } from "./ventana-nave.mjs";

/** El lado de la rejilla de un material, en téxeles. */
export const LADO = 16;

/** Blancos y negros de referencia para aclarar y oscurecer un color. */
const LUZ = "#ffffff";
const SOMBRA = "#101418";

/** Aclara `color` un tanto por uno hacia el blanco. */
function claro(color, t) {
  return mezclar(color, LUZ, t);
}

/** Y lo oscurece hacia el negro de sombra, que no es negro puro: un negro real
 *  mata el tono y lo que se quiere es el MISMO color con menos luz. */
function oscuro(color, t) {
  return mezclar(color, SOMBRA, t);
}

/**
 * VETA: madera. Rayas largas en un eje, con nudos sueltos.
 *
 * Las rayas van todas en el mismo sentido y de anchos distintos, que es lo que
 * separa una veta de un rayado: la madera crece en anillos y los anillos no son
 * regulares. Los nudos son lo que dice que es madera y no cartón — un tablón sin
 * un solo nudo se lee como material industrial.
 */
function veta(base, azar) {
  const rejilla = Array.from({ length: LADO }, () => new Array(LADO).fill(base));
  const tonos = [oscuro(base, 0.22), oscuro(base, 0.1), claro(base, 0.12)];
  let u = 0;
  while (u < LADO) {
    const grueso = 1 + Math.floor(azar() * 3);
    const tono = tonos[Math.floor(azar() * tonos.length)];
    // Una raya de cada tres se salta: si todas llevan tono, no hay fondo contra
    // el que leerlas y la pieza se ve sucia en vez de vetada.
    if (azar() < 0.62) {
      for (let du = 0; du < grueso && u + du < LADO; du += 1) {
        for (let v = 0; v < LADO; v += 1) rejilla[v][u + du] = tono;
      }
    }
    u += grueso;
  }
  const nudos = 1 + Math.floor(azar() * 2);
  for (let i = 0; i < nudos; i += 1) {
    const cu = Math.floor(azar() * LADO);
    const cv = Math.floor(azar() * LADO);
    for (let dv = -1; dv <= 1; dv += 1) {
      for (let du = -1; du <= 1; du += 1) {
        if (Math.abs(du) + Math.abs(dv) > 1) continue;
        rejilla[(cv + dv + LADO) % LADO][(cu + du + LADO) % LADO] = oscuro(base, 0.34);
      }
    }
  }
  return rejilla;
}

/**
 * CHAPA: metal en planchas, con junta y remaches.
 *
 * La junta lleva canto claro arriba y oscuro abajo, no una raya sola: es el
 * mismo bisel que sostiene el mural de la nave (#548), y por el mismo motivo —la
 * luz del motor viene de arriba, así que el canto de arriba es el que la coge, y
 * sin esa pareja la plancha se lee hundida en vez de montada.
 */
function chapa(base, azar) {
  const rejilla = Array.from({ length: LADO }, () => new Array(LADO).fill(base));
  const junta = Math.floor(LADO / 2);
  for (let u = 0; u < LADO; u += 1) {
    rejilla[junta][u] = oscuro(base, 0.3);
    rejilla[junta + 1][u] = claro(base, 0.18);
  }
  for (let v = 0; v < LADO; v += 1) {
    rejilla[v][0] = oscuro(base, 0.3);
    rejilla[v][1] = claro(base, 0.14);
  }
  // Remaches: dos filas, y NO alineados con la junta. Puestos justo encima se
  // leerían como parte de ella; separados, se leen como lo que sujeta la plancha.
  for (const v of [junta - 3, junta + 4]) {
    for (let u = 2; u < LADO; u += 4) {
      rejilla[v][u] = claro(base, 0.3);
      rejilla[(v + 1) % LADO][u] = oscuro(base, 0.22);
    }
  }
  // Un par de manchas de uso, que es lo que impide que dos planchas contiguas se
  // vean como la misma imagen repetida.
  for (let i = 0; i < 3; i += 1) {
    rejilla[Math.floor(azar() * LADO)][Math.floor(azar() * LADO)] = oscuro(base, 0.16);
  }
  return rejilla;
}

/**
 * HORMIGÓN: mota fina y uniforme, y algún hueco de árido.
 *
 * Es el material más aburrido de dibujar y el que más se nota cuando falta: sin
 * mota, una peana de hormigón es un bloque de color, y un bloque de color a
 * ras de suelo se lee como un hueco en el terreno.
 */
function hormigon(base, azar) {
  const rejilla = Array.from({ length: LADO }, () => new Array(LADO).fill(base));
  const claros = claro(base, 0.1);
  const oscuros = oscuro(base, 0.12);
  for (let v = 0; v < LADO; v += 1) {
    for (let u = 0; u < LADO; u += 1) {
      const d = azar();
      if (d < 0.16) rejilla[v][u] = oscuros;
      else if (d < 0.3) rejilla[v][u] = claros;
    }
  }
  for (let i = 0; i < 2; i += 1) {
    const cu = Math.floor(azar() * LADO);
    const cv = Math.floor(azar() * LADO);
    rejilla[cv][cu] = oscuro(base, 0.28);
    rejilla[cv][(cu + 1) % LADO] = oscuro(base, 0.24);
  }
  return rejilla;
}

/**
 * PIEDRA: manchas grandes e irregulares.
 *
 * A diferencia del hormigón, la escala del ruido es GRANDE: lo que distingue una
 * roca de un bloque de árido es que sus manchas se ven de lejos. Con mota fina,
 * una roca de dos metros parece de hormigón.
 */
function piedra(base, azar) {
  const rejilla = Array.from({ length: LADO }, () => new Array(LADO).fill(base));
  // MUY POCO CONTRASTE, y la primera versión lo tenía al triple: las rocas
  // salían moteadas como un camuflaje, que es el fallo clásico de una textura de
  // piedra —el patrón se lee ANTES que la forma, y entonces la roca deja de ser
  // una roca y pasa a ser un objeto con dibujos—. Una piedra real tiene manchas
  // apenas más claras o más oscuras que ella misma; el volumen lo pone la luz.
  const tonos = [oscuro(base, 0.09), oscuro(base, 0.15), claro(base, 0.07)];
  for (let i = 0; i < 5; i += 1) {
    const cu = Math.floor(azar() * LADO);
    const cv = Math.floor(azar() * LADO);
    const radio = 2 + Math.floor(azar() * 3);
    const tono = tonos[Math.floor(azar() * tonos.length)];
    for (let dv = -radio; dv <= radio; dv += 1) {
      for (let du = -radio; du <= radio; du += 1) {
        // Manchas de canto quebrado y no círculos: un círculo se lee como una
        // pegatina, y la piedra no tiene un solo borde suave.
        if (Math.abs(du) + Math.abs(dv) > radio + azar() * 1.5) continue;
        rejilla[(cv + dv + LADO) % LADO][(cu + du + LADO) % LADO] = tono;
      }
    }
  }
  return rejilla;
}

/**
 * TELA: trama cruzada, muy suave.
 *
 * Un damero de un téxel, con un tono apenas distinto. La tentación es marcarlo
 * más; a la distancia a la que se ve una manga de viento o el toldo de un
 * puesto, un contraste alto no se lee como trama sino como cuadros pintados.
 */
function tela(base) {
  const rejilla = Array.from({ length: LADO }, () => new Array(LADO).fill(base));
  const hilo = claro(base, 0.08);
  const trama = oscuro(base, 0.07);
  for (let v = 0; v < LADO; v += 1) {
    for (let u = 0; u < LADO; u += 1) {
      if ((u + v) % 2 === 0) rejilla[v][u] = (u % 4 < 2) === (v % 4 < 2) ? hilo : trama;
    }
  }
  return rejilla;
}

/**
 * El catálogo. Corto por la misma regla que el de props: un catálogo largo es la
 * vía rápida a que cada objeto parezca de otro juego. Se amplía cuando una pieza
 * real lo necesita.
 */
const GENERADORES = Object.freeze({ veta, chapa, hormigon, piedra, tela });

/**
 * A cuántos metros tilea cada material, cuando no es el medio metro de serie.
 *
 * NO ES UN AJUSTE FINO, ES PARTE DE QUÉ ES EL MATERIAL. Una plancha de chapa
 * mide lo que mide —medio metro es una plancha— y una veta de madera también.
 * Pero las manchas de una piedra no tienen un tamaño «de fábrica»: son tan
 * grandes como la piedra. A medio metro, una roca de metro y medio enseñaba el
 * patrón dos veces y media y salía MOTEADA COMO UN CAMUFLAJE, con el dibujo
 * leyéndose antes que la forma. A metro y medio, la roca enseña una sola mancha
 * grande, que es lo que se ve en una piedra de verdad.
 *
 * El hormigón va al revés por el mismo razonamiento: su árido es fino y fijo, y
 * a medio metro salía demasiado gordo para una peana.
 */
const ESCALAS = Object.freeze({ piedra: 1.5, hormigon: 0.3 });

/** A cuántos metros tilea un material. */
export function metrosPorTextura(material) {
  return ESCALAS[material] ?? METROS_POR_TEXTURA;
}

/** Los nombres válidos, para que quien declare un material se entere pronto de
 *  haberlo escrito mal. */
export const MATERIALES = Object.freeze(Object.keys(GENERADORES));

/**
 * Convierte una rejilla de colores en la forma `{ancho, alto, indices, paleta}`
 * que consume el rasterizador.
 *
 * Un material NO tiene huecos: es la superficie de una cara opaca, y un téxel
 * transparente en mitad de una caja sería un agujero por el que se ve el fondo.
 */
function texturaDeRejilla(rejilla) {
  const alto = rejilla.length;
  const ancho = rejilla[0].length;
  const paleta = [];
  const indiceDe = new Map();
  const indices = new Uint8Array(ancho * alto);
  for (let v = 0; v < alto; v += 1) {
    for (let u = 0; u < ancho; u += 1) {
      const color = rejilla[v][u];
      let i = indiceDe.get(color);
      if (i === undefined) {
        i = paleta.length;
        paleta.push(color);
        indiceDe.set(color, i);
      }
      indices[v * ancho + u] = i;
    }
  }
  return { ancho, alto, indices, paleta };
}

/**
 * La caché. Clave `material|color`, que es exactamente lo que determina el
 * resultado: el mismo material sobre el mismo color da la misma imagen siempre,
 * porque la semilla sale de la propia clave y no de un contador.
 *
 * Un `Map` normal y no un `WeakMap`: la clave es una cadena, no un objeto, y las
 * texturas de material tienen que sobrevivir entre fotogramas — son POCAS y se
 * comparten entre todas las piezas del mismo material y color, que es de donde
 * sale el ahorro.
 */
const cache = new Map();

/** Una semilla estable a partir de la clave: mismo material y color, mismo
 *  dibujo, siempre y en cualquier máquina. */
function semillaDe(clave) {
  let h = 2166136261;
  for (let i = 0; i < clave.length; i += 1) {
    h ^= clave.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * La textura de un material sobre un color, generada una vez y reutilizada.
 *
 * Devuelve `null` si el material no existe o el color no se puede leer, y no
 * lanza: una pieza sin textura se pinta de su color plano, que es exactamente la
 * degradación que el rasterizador ya aplica ante una textura inservible. Un prop
 * mal declarado tiene que salir liso, no tumbar la escena.
 */
export function texturaMaterial(material, color) {
  if (!GENERADORES[material] || !canales(color)) return null;
  const clave = `${material}|${color}`;
  let textura = cache.get(clave);
  if (!textura) {
    textura = texturaDeRejilla(GENERADORES[material](color, rngSemilla(semillaDe(clave))));
    cache.set(clave, textura);
  }
  return textura;
}

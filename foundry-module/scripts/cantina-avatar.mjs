// Avatares de la cantina (#423 sobre #362): quién está en la sala.
//
// ESTILO: FF7 ORIGINAL, Y NO ES NOSTALGIA. Aquellos muñecos eran cajas con
// manos como guantes y sin cara, y funcionaban por una razón técnica que aquí
// se repite igual: con pocos polígonos y sin texturas, una figura ESTILIZADA se
// lee y una realista se deshace. Proporción de unas cuatro cabezas —no ocho—,
// manos exageradas para que se vea qué hace, y ni ojos ni boca: la cara la pone
// quien mira. Intentar una figura proporcionada con doce cajas da un espantajo.
//
// LO QUE SE PUEDE USAR SIN PAGAR. Las clases salen del SRD 5.1, publicado bajo
// CC-BY-4.0: las doce están ahí y se pueden nombrar con atribución. Las RAZAS
// son otra historia — el SRD solo trae unas pocas, y las que faltan (dragonborn,
// tiefling, gnome, half-orc, half-elf) NO están bajo esa licencia. Aquí no se
// nombran: quien quiera una escribe la suya en el campo libre, y el catálogo
// ofrece solo lo licenciado más un genérico. Ver `reference_srd_5e_cc_by`.
//
// Puro: ni Foundry, ni DOM, ni red, ni reloj. Recibe una descripción y devuelve
// mallas; quien las pinta y quien las guarda viven fuera.
//
// Frontera de arte (#351): no declara ni un color.

import { AVATAR, FACCIONES, PIXEL, RETRATO } from "./paleta.mjs";
import { caja } from "./cantina-escena.mjs";
import { ANCLAS, anclasAvatar, dimensionesCuerpo, puntosAvatar } from "./avatar/avatar-rig.mjs";
import { normalizarPorte, sostener } from "./avatar/avatar-porte.mjs";
import { mezclar } from "./retro3d.mjs";

/**
 * Clases del SRD 5.1 (CC-BY-4.0). Se nombran por su clave y la traducción vive
 * en `lang/`, que es donde puede decirse en castellano sin pelearse con el
 * nombre propio en inglés de la licencia.
 */
export const CLASES = Object.freeze([
  "barbaro",
  "bardo",
  "clerigo",
  "druida",
  "guerrero",
  "monje",
  "paladin",
  "explorador",
  "picaro",
  "hechicero",
  "brujo",
  "mago",
]);

/**
 * Razas que SÍ podemos nombrar. El SRD 5.1 trae estas; las demás son marca
 * registrada y no entran en el catálogo, ni siquiera "por defecto". `otra` es
 * la salida honesta: quien juega una raza que no está escribe su nombre y el
 * avatar usa el cuerpo genérico.
 */
export const RAZAS = Object.freeze(["humano", "enano", "elfo", "mediano", "otra"]);

/**
 * Gestos de cuerpo. NO hay gestos de cara y no es un olvido: estos avatares no
 * tienen ojos ni boca —es lo que los hace legibles a esta resolución, como en
 * FF7— así que un guiño no tiene dónde ocurrir. Lo que sí tienen es cuerpo, y un
 * cuerpo dice mucho: alguien encogido de hombros, alguien brindando, alguien
 * dando una calada.
 *
 * Cada gesto es una POSTURA, no una animación: cambia dónde están las manos y
 * qué lleva encima, y el bucle de la sala lo pinta como pinta todo lo demás.
 * Animar interpolando entre posturas sería un motor de esqueletos, y esto son
 * seis cajas.
 */
export const GESTOS = Object.freeze(["quieto", "saludo", "brindis", "fumar", "hombros", "pensar"]);

/** Presencia, no género biológico: lo que cambia es la silueta, y hay tres
 * porque una silueta neutra es una opción de verdad y no un descarte. */
export const SILUETAS = Object.freeze(["ancha", "estrecha", "neutra"]);

/** Cuánto altera cada raza el cuerpo base. Solo estatura y anchura: el resto
 * es ropa y pelo, que se eligen aparte. Nada de rasgos "propios de raza", que
 * es por donde se cuela la caricatura. */
const CUERPO_POR_RAZA = Object.freeze({
  humano: { alto: 1, ancho: 1 },
  enano: { alto: 0.78, ancho: 1.25 },
  elfo: { alto: 1.06, ancho: 0.92 },
  mediano: { alto: 0.66, ancho: 0.95 },
  otra: { alto: 1, ancho: 1 },
});

const SILUETA_ANCHO = Object.freeze({ ancha: 1.18, estrecha: 0.88, neutra: 1 });

/** Alto total del avatar en unidades de sala, antes de la raza. Una persona
 * junto a una barra de 0.75: esto la deja mirando por encima de ella. */
export const ALTO_BASE = 1.72;

/** Normaliza una descripción venga de donde venga, sin rechazar nada: un avatar
 * mal descrito tiene que aparecer igual, porque no aparecer es peor que
 * aparecer raro. */
export function normalizarAvatar(descripcion = {}) {
  const raza = RAZAS.includes(descripcion.raza) ? descripcion.raza : "humano";
  return {
    nombre: typeof descripcion.nombre === "string" ? descripcion.nombre : "",
    raza,
    clase: CLASES.includes(descripcion.clase) ? descripcion.clase : "guerrero",
    silueta: SILUETAS.includes(descripcion.silueta) ? descripcion.silueta : "neutra",
    pelo: indiceValido(descripcion.pelo, AVATAR.pelos.length),
    piel: indiceValido(descripcion.piel, RETRATO.cascos.length),
    ropa: indiceValido(descripcion.ropa, FACCIONES.length),
    gesto: GESTOS.includes(descripcion.gesto) ? descripcion.gesto : "quieto",
  };
}

function indiceValido(valor, cuantos) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? ((n % cuantos) + cuantos) % cuantos : 0;
}

/**
 * Las medidas de un cuerpo: cuánto mide y cuánto ocupa de ancho, ya resueltas
 * desde la raza y la silueta.
 *
 * Es la frontera con `avatar/avatar-rig.mjs`: aquí se sabe QUIÉN es alguien
 * —las tablas del SRD, la silueta que ha elegido—, y allí solo se saben
 * MEDIDAS. Así el rig puede colocar un cuerpo sin conocer ni una raza, y las
 * dos mitades no se importan la una a la otra.
 */
export function medidasDeAvatar(descripcion, pies = [0, 0, 0]) {
  const av = normalizarAvatar(descripcion);
  const cuerpo = CUERPO_POR_RAZA[av.raza];
  return Object.freeze({
    escala: ALTO_BASE * cuerpo.alto,
    ancho: cuerpo.ancho * SILUETA_ANCHO[av.silueta],
    pies,
  });
}

/**
 * Las piezas de un avatar, ya colocadas alrededor de `[x, y, z]` (los pies).
 * Devuelve la misma forma que los muebles de la sala —`{nombre, color, centro,
 * medidas}`— para que la escena no distinga a una persona de un taburete y no
 * haga falta ni un pintor nuevo ni una rama en `componerCantina`.
 */
export function piezasAvatar(descripcion, { pies = [0, 0, 0], indice = 0, tiempo = 0, yaw = 0, porte = {} } = {}) {
  const av = normalizarAvatar(descripcion);
  const medidas = medidasDeAvatar(av, pies);

  const piel = RETRATO.cascos[av.piel];
  const pelo = AVATAR.pelos[av.pelo];
  const ropa = FACCIONES[av.ropa];
  const prefijo = `avatar${indice}`;

  // Las medidas del cuerpo y DÓNDE cae cada parte salen del mismo rig
  // (`avatar/avatar-rig.mjs`): las cajas de abajo y los anclajes de los que
  // cuelgan el cigarro o la jarra ya no pueden separarse, porque son la misma
  // jerarquía resuelta una sola vez. El gesto es una POSE parcial sobre ese
  // rig —dónde llevas las manos—, no una lista de posiciones absolutas.
  const d = dimensionesCuerpo(medidas);
  const pose = poseDelGesto(av.gesto, d);
  const p = puntosAvatar(medidas, { pose, yaw });
  const anclas = anclasAvatar(medidas, { pose, yaw });
  const { ancho, altoCabeza, altoTorso, altoPiernas } = d;
  const llevado = normalizarPorte(porte);

  return [
    { nombre: `${prefijo}Pierna`, color: piel, centro: p.piernas, medidas: [0.3 * ancho, altoPiernas, 0.26] },
    { nombre: `${prefijo}Torso`, color: ropa, centro: p.torso, medidas: [0.46 * ancho, altoTorso, 0.3] },
    { nombre: `${prefijo}Cabeza`, color: piel, centro: p.cabeza, medidas: [0.38 * ancho, altoCabeza, 0.36] },
    // El pelo es una tapa, no una peluca: a esta resolución basta para leerse.
    {
      nombre: `${prefijo}Pelo`,
      color: pelo,
      centro: sobreCuerpo(p.cabeza, [0, altoCabeza * 0.42, -0.02], yaw),
      medidas: [0.42 * ancho, altoCabeza * 0.34, 0.4],
    },
    // Manos como guantes, a los lados y grandes: es la firma de aquel estilo y
    // además es lo único que deja ver a distancia qué está haciendo alguien.
    // Por eso el gesto vive en las manos y no en la cara.
    { nombre: `${prefijo}ManoDer`, color: piel, centro: p.manoDer, medidas: [0.16, 0.16, 0.16] },
    { nombre: `${prefijo}ManoIzq`, color: piel, centro: p.manoIzq, medidas: [0.16, 0.16, 0.16] },
    // Lo que llevan las manos, colgado de su anclaje y no recalculado aquí.
    // Lo que se LLEVA va antes que lo que sale del gesto, y gana: llevar algo
    // es un dato de la persona (#897), no una consecuencia de lo que esté
    // haciendo. Sin porte declarado no cambia nada, así que la jarra sigue
    // saliendo con «brindis» y el cigarro con «fumar» exactamente como antes.
    ...piezasDelPorte(porte, { anclas, prefijo, yaw }),
    ...atrezoDelGesto(av.gesto, { anclas, altoTorso, prefijo, indice, tiempo, yaw, porte: llevado }),
    // Y lo que lleva encima, que es lo que dice la clase de un vistazo.
    ...distintivoDeClase(av.clase, { anclas, altoTorso, prefijo }),
  ].map((pieza) => Object.freeze({ ...pieza, giro: yaw }));
}

/**
 * El gesto, como POSE sobre el rig: dónde llevas las manos respecto a donde te
 * caerían solas. Lo que no se nombra se queda en reposo, así que «quieto» es la
 * pose vacía y no una lista de brazos caídos — y añadir un gesto no obliga a
 * repetir el resto del cuerpo.
 *
 * Los desplazamientos son los mismos valores que estaban escritos a mano en
 * `manosDelGesto`, expresados ahora respecto al reposo en vez de en absoluto:
 * las manos caen exactamente donde caían, y hay una prueba que lo exige.
 */
function poseDelGesto(gesto, { ancho, yTorso, yCabeza, altoTorso, yReposo }) {
  const der = (dx, y, dz) => ({ manoDer: { desplazamiento: [dx * ancho, y - yReposo, dz] } });
  switch (gesto) {
    // Una mano en alto. El saludo es el gesto que más se usa y por eso es el más
    // claro de leer: mano por encima del hombro y separada del cuerpo.
    case "saludo":
      return der(0.12, yCabeza, 0.04);
    // Brindis: la jarra en alto, hacia delante. Se brinda CON alguien, así que
    // el brazo va adelantado y no pegado al costado.
    case "brindis":
      return der(0.04, yTorso + altoTorso * 0.35, 0.18);
    // Fumar: la mano junto a la cara y el cigarro asomando.
    case "fumar":
      return der(-0.04, yCabeza - 0.12, 0.16);
    // Hombros: las dos manos abiertas hacia fuera y arriba. «Yo qué sé».
    case "hombros":
      return {
        manoDer: { desplazamiento: [0.16 * ancho, yTorso - yReposo, 0.1] },
        manoIzq: { desplazamiento: [-0.16 * ancho, yTorso - yReposo, 0.1] },
      };
    // Pensar: una mano en la barbilla. En un juego de faroleo es el gesto más
    // útil de todos, porque dice «me lo estoy pensando» sin decir qué.
    case "pensar":
      return der(-0.18, yCabeza - 0.16, 0.2);
    default:
      return {};
  }
}

/**
 * Brillo de la brasa en `[0, 1]` para el instante `tiempoMs` (#439): una
 * calada es una subida y bajada breve —inhalar, ver el punto avivarse,
 * soltarlo— con una pausa larga detrás, no una respiración senoidal continua
 * que temblaría todo el rato y no leería como "dar una calada".
 *
 * `offset` desincroniza a cada fumador de los demás: es el `indice` de su
 * sitio, no un reloj propio, así que dos capturas del mismo instante siguen
 * dando el mismo resultado para la misma persona.
 */
export function intensidadCalada(tiempoMs = 0, offset = 0) {
  const ciclo = 4200; // una calada completa, de una pausa a la siguiente
  const pico = 520; // cuánto dura el propio tirón, al principio del ciclo
  const ms = Number.isFinite(tiempoMs) ? tiempoMs : 0;
  const desfase = (Number.isFinite(offset) ? offset : 0) * 733; // primo: sin resonancias entre sitios
  const fase = (((ms + desfase) % ciclo) + ciclo) % ciclo;
  if (fase > pico) return 0;
  return Math.sin((fase / pico) * Math.PI);
}

/**
 * Un punto pegado al cuerpo: su base más un desplazamiento que gira CON la
 * persona. Un cigarro diez centímetros «por detrás de la punta» tiene que
 * quedarse detrás de la punta también cuando alguien se da la vuelta; sumar el
 * desplazamiento en ejes de mundo lo dejaría cruzándole la cara.
 */
function sobreCuerpo([x, y, z], [dx, dy, dz], yaw = 0) {
  if (!Number.isFinite(yaw) || yaw === 0) return [x + dx, y + dy, z + dz];
  const sen = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return [x + dx * cos + dz * sen, y + dy, z - dx * sen + dz * cos];
}

/**
 * Qué lleva encima el gesto, colgado de un ANCLAJE y no recalculado.
 *
 * Cada pieza es su anclaje más un desplazamiento pequeño y declarado: el cigarro
 * asoma diez centímetros por detrás de su punta, la jarra va un poco por encima
 * de la mano que la sostiene. Ese desplazamiento es lo único propio del prop;
 * dónde está la mano o la boca lo sabe el rig, que es el punto de #897 — antes
 * esta cuenta estaba escrita tres veces y la tercera copia (la del humo) ya
 * había hecho falta rescatarla en #439.
 *
 * A esta resolución no hace falta modelar el humo del cigarro porque la sala ya
 * tiene humo, y quien fuma lo alimenta (ver `ANCLAS_AIRE` en `cantina-escena.mjs`).
 */
/**
 * Lo que se lleva en cada mano, colgado de su anclaje. Cada mano por separado,
 * porque son dos anclajes independientes: llevar algo en las dos no es una
 * función distinta, es llamar dos veces a la misma.
 */
function piezasDelPorte(porte, { anclas, prefijo, yaw }) {
  const llevado = normalizarPorte(porte);
  return [
    ...sostener(llevado.manoDerecha, anclas.manoDerecha.punto, { prefijo: `${prefijo}Der`, yaw }),
    ...sostener(llevado.manoIzquierda, anclas.manoIzquierda.punto, { prefijo: `${prefijo}Izq`, yaw }),
  ];
}

function atrezoDelGesto(gesto, { anclas, altoTorso, prefijo, indice = 0, tiempo = 0, yaw = 0, porte = {} }) {
  const sobre = ({ punto }, desplazamiento) => sobreCuerpo(punto, desplazamiento, yaw);
  // Una mano ocupada no saca además la jarra del gesto: se brinda CON lo que
  // se lleve. El cigarro no entra aquí porque cuelga de la boca, no de la mano.
  if (porte.manoDerecha && gesto === "brindis") return [];
  switch (gesto) {
    case "brindis":
      return [{
        nombre: `${prefijo}Jarra`,
        color: AVATAR.jarra,
        centro: sobre(anclas.manoDerecha, [0, altoTorso * 0.2, 0]),
        medidas: [0.18, 0.24, 0.18],
      }];
    case "fumar": {
      // La brasa sube de brillo en la calada y se apaga entre una y la
      // siguiente (#439): cada avatar tira en un momento distinto —de ahí el
      // desfase por `indice`— porque una sala entera dando la calada a la vez
      // se lee como un parpadeo de escenario, no como gente fumando.
      const calada = intensidadCalada(tiempo, indice);
      return [
        {
          nombre: `${prefijo}Cigarro`,
          color: AVATAR.cigarro,
          centro: sobre(anclas.boca, [0, 0, -0.1]),
          medidas: [0.05, 0.05, 0.18],
        },
        // La brasa va EN el anclaje: es la punta, y es lo único claro de la
        // silueta de alguien fumando en la penumbra.
        {
          nombre: `${prefijo}Brasa`,
          color: mezclar(AVATAR.brasa, AVATAR.brasaCalada, calada),
          centro: sobre(anclas.boca, [0, 0, 0]),
          medidas: [0.06, 0.06, 0.06],
        },
      ];
    }
    default:
      return [];
  }
}

/**
 * El distintivo de la clase: una pieza, no un equipo completo. Lo que se busca
 * es reconocer a alguien al otro lado de la sala, no inventariar su mochila —y
 * a esta resolución dos cajas más ya son una mancha.
 *
 * Va colgado del anclaje `hombro`, que es un hueso: no hay aquí ni una cuenta
 * de proporción de cuerpo.
 */
function distintivoDeClase(clase, { anclas, altoTorso, prefijo }) {
  const alHombro = (color, medidas) => [
    { nombre: `${prefijo}Distintivo`, color, centro: anclas.hombro.punto, medidas },
  ];
  switch (clase) {
    // Armas al hombro: la silueta de un mandoble asomando por encima es
    // exactamente cómo se reconocía a un personaje en aquellos juegos.
    case "guerrero":
    case "paladin":
    case "barbaro":
      return alHombro(AVATAR.acero, [0.09, altoTorso * 1.5, 0.09]);
    case "picaro":
    case "explorador":
      return alHombro(AVATAR.acero, [0.07, altoTorso * 0.9, 0.07]);
    // Báculos y varas, más largos y de madera.
    case "mago":
    case "hechicero":
    case "brujo":
    case "druida":
      return alHombro(AVATAR.madera, [0.08, altoTorso * 1.8, 0.08]);
    case "clerigo":
      return alHombro(AVATAR.simbolo, [0.16, 0.22, 0.06]);
    case "bardo":
      return alHombro(AVATAR.madera, [0.28, altoTorso * 0.7, 0.1]);
    // El monje no lleva nada, y eso también es un distintivo.
    default:
      return [];
  }
}

/**
 * Dónde se coloca cada quien en la cantina. Los sitios son fijos y en orden
 * estable: quien entra ocupa el primero libre y no baila de sitio entre
 * fotogramas, que es lo que convertiría a la tripulación en un parpadeo.
 *
 * Están de cara a la barra o de cara a las mesas, nunca mirando a cámara.
 */
export const SITIOS = Object.freeze([
  Object.freeze({ pies: [-2.4, -1.75, 2.4] }),
  Object.freeze({ pies: [-0.8, -1.75, 2.4] }),
  Object.freeze({ pies: [0.8, -1.75, 2.4] }),
  Object.freeze({ pies: [2.4, -1.75, 2.4] }),
  Object.freeze({ pies: [-3.6, -1.75, 4.6] }),
  Object.freeze({ pies: [3.9, -1.75, 3.2] }),
]);

/**
 * Empareja gente con sitio, en el mismo orden estable que usa el pintor. Vive
 * aparte porque tanto `piezasDeLaGente` como `anclasHumoDeLaGente` (#439)
 * necesitan saber quién se sienta dónde, y repetir el bucle en los dos sitios
 * es la forma segura de que un día se desincronicen.
 */
function gentePorSitio(gente, { omitirId = null } = {}) {
  if (!Array.isArray(gente)) return [];
  const asientos = [];
  let sitio = 0;
  for (const persona of gente) {
    if (!persona) continue;
    if (omitirId && persona.id === omitirId) continue;
    if (sitio >= SITIOS.length) break;
    asientos.push({ persona, pies: SITIOS[sitio].pies, indice: sitio });
    sitio += 1;
  }
  return asientos;
}

/**
 * Las piezas de toda la gente que hay en la sala.
 *
 * @param {Array<object>} gente descripciones de avatar, en orden estable.
 * @param {{omitirId?: string, tiempo?: number}} opciones `omitirId` es quien
 *   mira: no se pinta a sí mismo, porque la cámara está en sus ojos y solo
 *   vería su propia nuca. `tiempo` mueve la calada de quien fuma (#439).
 */
export function piezasDeLaGente(gente = [], { omitirId = null, tiempo = 0 } = {}) {
  const piezas = [];
  for (const { persona, pies, indice } of gentePorSitio(gente, { omitirId })) {
    piezas.push(...piezasAvatar(persona, { pies, indice, tiempo }));
  }
  return piezas;
}

/**
 * Dónde flota el humo de cada cigarro encendido, en el mismo formato que
 * `ANCLAS_AIRE` de `cantina-escena.mjs` — así el pintor no distingue el humo
 * de una persona del humo de la sala y no hace falta ni una rama nueva en
 * `pintarHumo` (#439). Solo fuma quien tiene el gesto `fumar`: el resto de la
 * gente no alimenta el aire.
 */
export function anclasHumoDeLaGente(gente = [], { omitirId = null } = {}) {
  const anclas = [];
  for (const { persona, pies, indice } of gentePorSitio(gente, { omitirId })) {
    const av = normalizarAvatar(persona);
    if (av.gesto !== "fumar") continue;
    // El humo sale de la punta del cigarro, que es el anclaje `boca` del rig.
    // Antes esta cuenta estaba repetida aquí entera —proporción de cuerpo
    // incluida— y era la copia que #439 ya tuvo que rescatar una vez.
    const { punto } = anclasAvatar(medidasDeAvatar(av, pies)).boca;
    anclas.push(
      Object.freeze({ punto: [...punto], tipo: "humo", largo: 1.4, indice }),
    );
  }
  return anclas;
}

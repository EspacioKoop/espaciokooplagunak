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

import { AVATAR, FACCIONES, RETRATO } from "./paleta.mjs";
import { prisma } from "./escena-primitivas.mjs";
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
 * seis volúmenes sencillos.
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

function volumenAvatar([ancho, alto, fondo], { radioAbajo = 0.46, radioArriba = 0.54 } = {}) {
  const radioX = ancho / 2;
  const radioZ = fondo / 2;
  return prisma([0, -alto / 2, 0], {
    radioAbajo: Math.min(radioX, radioZ) * radioAbajo,
    radioArriba: Math.min(radioX, radioZ) * radioArriba,
    alto,
    lados: 8,
    tapaAbajo: true,
  });
}

function piezaAvatar(nombre, color, centro, medidas, opciones) {
  return { nombre, color, centro, medidas, malla: volumenAvatar(medidas, opciones) };
}

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
 * Las piezas de un avatar, ya colocadas alrededor de `[x, y, z]` (los pies).
 * Devuelve la misma forma que los muebles de la sala —`{nombre, color, centro,
 * medidas}`— para que la escena no distinga a una persona de un taburete y no
 * haga falta ni un pintor nuevo ni una rama en `componerCantina`.
 */
export function piezasAvatar(descripcion, { pies = [0, 0, 0], indice = 0, tiempo = 0 } = {}) {
  const av = normalizarAvatar(descripcion);
  const cuerpo = CUERPO_POR_RAZA[av.raza];
  const escala = ALTO_BASE * cuerpo.alto;
  const ancho = cuerpo.ancho * SILUETA_ANCHO[av.silueta];
  const [px, py, pz] = pies;

  const piel = RETRATO.cascos[av.piel];
  const pelo = AVATAR.pelos[av.pelo];
  const ropa = FACCIONES[av.ropa];
  const prefijo = `avatar${indice}`;

  // Cuatro cabezas de alto, repartidas: piernas, torso y una cabeza enorme.
  const altoCabeza = escala * 0.26;
  const altoTorso = escala * 0.36;
  const altoPiernas = escala - altoCabeza - altoTorso;

  const yPiernas = py + altoPiernas / 2;
  const yTorso = py + altoPiernas + altoTorso / 2;
  const yCabeza = py + altoPiernas + altoTorso + altoCabeza / 2;

  return [
    piezaAvatar(`${prefijo}Pierna`, piel, [px, yPiernas, pz], [0.3 * ancho, altoPiernas, 0.26], { radioAbajo: 0.62, radioArriba: 0.46 }),
    piezaAvatar(`${prefijo}Torso`, ropa, [px, yTorso, pz], [0.46 * ancho, altoTorso, 0.3], { radioAbajo: 0.58, radioArriba: 0.42 }),
    piezaAvatar(`${prefijo}Cabeza`, piel, [px, yCabeza, pz], [0.38 * ancho, altoCabeza, 0.36], { radioAbajo: 0.5, radioArriba: 0.7 }),
    // El pelo es una tapa, no una peluca: a esta resolución basta para leerse.
    piezaAvatar(`${prefijo}Pelo`, pelo, [px, yCabeza + altoCabeza * 0.42, pz - 0.02], [0.42 * ancho, altoCabeza * 0.34, 0.4], { radioAbajo: 0.7, radioArriba: 0.45 }),
    ...rasgoDeRaza(av.raza, { px, pz, yCabeza, altoCabeza, ancho, piel, prefijo }),
    // Manos como guantes, a los lados y grandes: es la firma de aquel estilo y
    // además es lo único que deja ver a distancia qué está haciendo alguien.
    // Por eso el gesto vive en las manos y no en la cara.
    ...manosDelGesto(av.gesto, { px, pz, yTorso, altoTorso, yCabeza, ancho, piel, prefijo, indice, tiempo }),
    // Y lo que lleva encima, que es lo que dice la clase de un vistazo.
    ...distintivoDeClase(av.clase, { px, py: yTorso, pz, ancho, altoTorso, prefijo }),
  ].map((pieza) => Object.freeze(pieza));
}

/** Dónde queda la punta del cigarro en el mundo, junto a la boca. Un único
 * sitio para esta cuenta: lo usa tanto la brasa (#439) como el humo que sube
 * desde ella, y escribirla dos veces es la forma segura de que un día
 * diverjan. */
function puntaDelCigarro({ px, pz, yCabeza, ancho }) {
  return [px + 0.26 * ancho, yCabeza - 0.06, pz + 0.4];
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
 * Dónde caen las manos —y qué llevan— según el gesto. Un cigarro es una caja
 * clara junto a la cabeza; una jarra, una caja ámbar en alto. A esta resolución
 * eso basta: no hace falta modelar el humo del cigarro porque la sala ya tiene
 * humo, y quien fuma lo alimenta (ver `ANCLAS_AIRE` en `cantina-escena.mjs`).
 */
function manosDelGesto(gesto, { px, pz, yTorso, altoTorso, yCabeza, ancho, piel, prefijo, indice = 0, tiempo = 0 }) {
  const mano = (lado, [dx, dy, dz], nombre = "Mano") => ({
    nombre: `${prefijo}${nombre}${lado}`,
    color: piel,
    centro: [px + dx * ancho, dy, pz + dz],
    medidas: [0.16, 0.16, 0.16],
    malla: volumenAvatar([0.16, 0.16, 0.16], { radioAbajo: 0.75, radioArriba: 0.5 }),
  });
  const reposo = yTorso - altoTorso * 0.2;

  switch (gesto) {
    // Una mano en alto. El saludo es el gesto que más se usa y por eso es el más
    // claro de leer: mano por encima del hombro y separada del cuerpo.
    case "saludo":
      return [mano("Izq", [-0.3, reposo, 0.06]), mano("Der", [0.42, yCabeza, 0.1])];
    // Brindis: la jarra en alto, hacia delante. Se brinda CON alguien, así que
    // el brazo va adelantado y no pegado al costado.
    case "brindis":
      return [
        mano("Izq", [-0.3, reposo, 0.06]),
        mano("Der", [0.34, yTorso + altoTorso * 0.35, 0.24]),
        piezaAvatar(`${prefijo}Jarra`, AVATAR.jarra, [px + 0.34 * ancho, yTorso + altoTorso * 0.55, pz + 0.24], [0.18, 0.24, 0.18], { radioAbajo: 0.65, radioArriba: 0.8 }),
      ];
    // Fumar: la mano junto a la cara y el cigarro asomando. La brasa es un píxel
    // y es lo único claro de la silueta, que es exactamente cómo se ve a alguien
    // fumando en la penumbra.
    case "fumar": {
      // La brasa sube de brillo en la calada y se apaga entre una y la
      // siguiente (#439): cada avatar tira en un momento distinto —de ahí el
      // desfase por `indice`— porque una sala entera dando la calada a la vez
      // se lee como un parpadeo de escenario, no como gente fumando.
      const calada = intensidadCalada(tiempo, indice);
      return [
        mano("Izq", [-0.3, reposo, 0.06]),
        mano("Der", [0.26, yCabeza - 0.12, 0.22]),
        piezaAvatar(`${prefijo}Cigarro`, AVATAR.cigarro, [px + 0.26 * ancho, yCabeza - 0.06, pz + 0.3], [0.05, 0.05, 0.18], { radioAbajo: 0.8, radioArriba: 0.55 }),
        piezaAvatar(`${prefijo}Brasa`, mezclar(AVATAR.brasa, AVATAR.brasaCalada, calada), puntaDelCigarro({ px, pz, yCabeza, ancho }), [0.06, 0.06, 0.06], { radioAbajo: 0.8, radioArriba: 0.45 }),
      ];
    }
    // Hombros: las dos manos abiertas hacia fuera y arriba. «Yo qué sé».
    case "hombros":
      return [mano("Izq", [-0.46, yTorso, 0.16]), mano("Der", [0.46, yTorso, 0.16])];
    // Pensar: una mano en la barbilla. En un juego de faroleo es el gesto más
    // útil de todos, porque dice «me lo estoy pensando» sin decir qué.
    case "pensar":
      return [mano("Izq", [-0.3, reposo, 0.06]), mano("Der", [0.12, yCabeza - 0.16, 0.26])];
    default:
      return [mano("Izq", [-0.3, reposo, 0.06]), mano("Der", [0.3, reposo, 0.06])];
  }
}

function rasgoDeRaza(raza, { px, pz, yCabeza, altoCabeza, ancho, piel, prefijo }) {
  if (raza === "enano") {
    return [piezaAvatar(`${prefijo}Barba`, piel, [px, yCabeza - altoCabeza * 0.22, pz + 0.17], [0.24 * ancho, altoCabeza * 0.5, 0.2], { radioAbajo: 0.15, radioArriba: 0.75 })];
  }
  if (raza === "elfo") {
    return [
      piezaAvatar(`${prefijo}OrejaIzq`, piel, [px - 0.25 * ancho, yCabeza + altoCabeza * 0.06, pz], [0.2 * ancho, altoCabeza * 0.16, 0.1], { radioAbajo: 0.8, radioArriba: 0.05 }),
      piezaAvatar(`${prefijo}OrejaDer`, piel, [px + 0.25 * ancho, yCabeza + altoCabeza * 0.06, pz], [0.2 * ancho, altoCabeza * 0.16, 0.1], { radioAbajo: 0.8, radioArriba: 0.05 }),
    ];
  }
  if (raza === "mediano") {
    return [piezaAvatar(`${prefijo}CabezaGrande`, piel, [px, yCabeza + altoCabeza * 0.08, pz], [0.42 * ancho, altoCabeza * 0.25, 0.4], { radioAbajo: 0.65, radioArriba: 0.85 })];
  }
  return [];
}

/**
 * El distintivo de la clase: una pieza, no un equipo completo. Lo que se busca
 * es reconocer a alguien al otro lado de la sala, no inventariar su mochila —y
 * a esta resolución dos cajas más ya son una mancha.
 */
function distintivoDeClase(clase, { px, py, pz, ancho, altoTorso, prefijo }) {
  const alHombro = (color, medidas, opciones) => [piezaAvatar(`${prefijo}Distintivo`, color, [px + 0.34 * ancho, py + altoTorso * 0.35, pz - 0.16], medidas, opciones)];
  switch (clase) {
    // Armas al hombro: la silueta de un mandoble asomando por encima es
    // exactamente cómo se reconocía a un personaje en aquellos juegos.
    case "guerrero":
    case "paladin":
    case "barbaro":
      return alHombro(AVATAR.acero, [0.18, altoTorso * 1.5, 0.18], { radioAbajo: 0.7, radioArriba: 0.35 });
    case "picaro":
    case "explorador":
      return alHombro(AVATAR.acero, [0.14, altoTorso * 0.9, 0.14], { radioAbajo: 0.7, radioArriba: 0.35 });
    // Báculos y varas, más largos y de madera.
    case "mago":
    case "hechicero":
    case "brujo":
    case "druida":
      return alHombro(AVATAR.madera, [0.16, altoTorso * 1.8, 0.16], { radioAbajo: 0.7, radioArriba: 0.35 });
    case "clerigo":
      return alHombro(AVATAR.simbolo, [0.16, 0.22, 0.06], { radioAbajo: 0.7, radioArriba: 0.35 });
    case "bardo":
      return alHombro(AVATAR.madera, [0.28, altoTorso * 0.7, 0.1], { radioAbajo: 0.7, radioArriba: 0.35 });
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
    const cuerpo = CUERPO_POR_RAZA[av.raza];
    const escala = ALTO_BASE * cuerpo.alto;
    const ancho = cuerpo.ancho * SILUETA_ANCHO[av.silueta];
    const altoCabeza = escala * 0.26;
    const altoTorso = escala * 0.36;
    const altoPiernas = escala - altoCabeza - altoTorso;
    const [px, py, pz] = pies;
    const yCabeza = py + altoPiernas + altoTorso + altoCabeza / 2;
    const [hx, hy, hz] = puntaDelCigarro({ px, pz, yCabeza, ancho });
    anclas.push(
      Object.freeze({ punto: [hx, hy, hz], tipo: "humo", largo: 1.4, indice }),
    );
  }
  return anclas;
}

// Música procedural de a bordo (#318). Genera eventos de nota deterministas a
// partir de una semilla, en DOS registros inspirados en Bach y en Mahler.
//
// Decisión legal, y es de diseño, no de trámite: aunque las obras de Bach
// (†1750) y Mahler (†1911) están en dominio público, una **edición crítica
// moderna** y una **grabación** llevan derechos propios (los de edición y los
// conexos del productor fonográfico). Transcribir compases de una partitura
// moderna arrastraría esos derechos. Aquí NO se transcribe nada: se generan
// notas propias siguiendo procedimientos de estilo —contrapunto imitativo,
// marcha lenta— que son técnica, y la técnica no es de nadie. Por eso el
// módulo no contiene ni una melodía citable, y por eso no hay ficheros .mid ni
// muestras de audio en el repositorio.
//
// Salida neutra: lista de `{ inicioMs, duracionMs, midi, intensidad, voz }`.
// Quien la reproduzca (Web Audio, un sintetizador, un test) es cosa aparte:
// aquí no se toca ni audio, ni Foundry, ni el reloj, ni Math.random().

import { crearAleatorio } from "../../minijuegos/aleatorio.mjs";

// Escalas como grados sobre la tónica, en semitonos.
const MENOR_NATURAL = [0, 2, 3, 5, 7, 8, 10];
const MENOR_ARMONICA = [0, 2, 3, 5, 7, 8, 11];

export const REGISTROS = Object.freeze([
  "bach",
  "mahler",
  "bandura",
  "bordon",
  "paganini",
  "txalaparta",
]);

/**
 * Timbres como ESPECTRO, no como muestras. Un instrumento se reconoce por la
 * amplitud relativa de sus armónicos y por su envolvente; con eso, un
 * sintetizador aditivo lo evoca sin que exista ni un byte de audio grabado —
 * que es lo que mantiene el repositorio limpio de obra ajena.
 *
 * `parciales[i]` es la amplitud del armónico i+1 respecto al fundamental.
 */
export const TIMBRES = Object.freeze({
  // Cuerda frotada/sostenida: pocos armónicos, ataque lento. Es el timbre por
  // defecto de los registros orquestales.
  arco: { parciales: [1, 0.5, 0.28, 0.14, 0.08], ataqueMs: 90, decaimientoMs: 900 },
  // Bandura ucraniana: cuerda pulsada de tapa brillante, muchas cuerdas al
  // aire. Ataque inmediato, cola larga y armónicos altos vivos — de ahí su
  // sonido cristalino en cascada.
  bandura: { parciales: [1, 0.62, 0.45, 0.34, 0.26, 0.18, 0.12], ataqueMs: 4, decaimientoMs: 2200 },
  // Cuerda con resonancia simpática (familia del sitar): el puente plano hace
  // que los armónicos superiores zumben y duren, no que se apaguen.
  simpatica: { parciales: [1, 0.7, 0.55, 0.5, 0.42, 0.36, 0.3, 0.24], ataqueMs: 8, decaimientoMs: 3200 },
  // Bordón continuo (familia de la tanpura): fundamental grueso y quinta
  // presente. No es melodía: es el suelo sobre el que todo lo demás se apoya.
  bordon: { parciales: [1, 0.8, 0.3, 0.22, 0.16, 0.1], ataqueMs: 400, decaimientoMs: 6000 },
  // Percusión de parche afinada (familia de la tabla): golpe con altura
  // definida y cola corta.
  parche: { parciales: [1, 0.35, 0.2, 0.1], ataqueMs: 2, decaimientoMs: 260 },
  // Cuerda frotada con arco corto y mordiente (spiccato): ataque rápido y
  // nota breve, para que las notas veloces se distingan una de otra.
  mordiente: { parciales: [1, 0.66, 0.42, 0.3, 0.2, 0.12], ataqueMs: 12, decaimientoMs: 420 },
  // Flauta: tubo casi sin armónicos pares, entrada suave. Es el timbre que se
  // mezcla sin pelear, porque su espectro apenas solapa con el de las cuerdas.
  flauta: { parciales: [1, 0.08, 0.22, 0.05, 0.09], ataqueMs: 140, decaimientoMs: 700 },
  // Tabla de madera golpeada (txalaparta): parciales INARMÓNICOS —no múltiplos
  // enteros del fundamental— porque una tabla no vibra como una cuerda. De ahí
  // que suene a madera y no a nota. Ataque instantáneo y cola muy corta.
  madera: {
    parciales: [1, 0.45, 0.6, 0.28, 0.18],
    inarmonicos: [1, 2.76, 5.4, 8.9, 13.3],
    ataqueMs: 1,
    decaimientoMs: 180,
  },
});

// Rango MIDI sensato para que nada quede inaudible ni estridente.
const MIDI_MIN = 36; // Do1
const MIDI_MAX = 91; // Sol6

function acotarMidi(nota) {
  return Math.max(MIDI_MIN, Math.min(MIDI_MAX, Math.round(nota)));
}

function grado(escala, indice, tonica) {
  const octava = Math.floor(indice / escala.length);
  const paso = ((indice % escala.length) + escala.length) % escala.length;
  return tonica + escala[paso] + octava * 12;
}

/**
 * Registro «bach»: contrapunto imitativo a dos voces. Una voz propone un sujeto
 * corto y la otra lo repite desplazado en el tiempo y transportado —el
 * procedimiento de una invención—, sobre un bajo que camina por grados.
 *
 * Se usa para lo cotidiano: guardia tranquila, la partida de cartas de #308.
 * Es música que ocupa sin exigir atención, que es justo lo que hace falta
 * cuando la mesa está hablando.
 */
function generarBach(aleatorio, { compases, tonica, msPorNegra }) {
  const escala = MENOR_NATURAL;
  const notas = [];
  const corchea = msPorNegra / 2;

  // Pedal cálido: una nota grave sostenida bajo todo el pasaje. Es lo que hace
  // que el contrapunto se sienta ACOGEDOR en vez de mecánico — el oído tiene
  // dónde apoyarse y la música deja de exigir seguimiento.
  notas.push({
    inicioMs: 0,
    duracionMs: compases * msPorNegra * 4,
    midi: acotarMidi(tonica - 12),
    intensidad: 0.18,
    voz: "pedal",
    timbre: "bordon",
  });

  // Sujeto: cuatro corcheas por grados cercanos, sin saltos grandes.
  const sujeto = [0];
  for (let i = 1; i < 4; i += 1) {
    const salto = Math.round(aleatorio.siguiente() * 4) - 2;
    sujeto.push(sujeto[i - 1] + (salto === 0 ? 1 : salto));
  }

  for (let compas = 0; compas < compases; compas += 1) {
    const base = compas * msPorNegra * 4;
    // Un compás de cada cuatro respira: la voz guía calla. El silencio es la
    // diferencia entre música de fondo agradable y goteo insistente.
    const respira = compas % 4 === 3;
    if (!respira) {
      sujeto.forEach((g, i) => {
        notas.push({
          inicioMs: base + i * corchea,
          duracionMs: corchea * 0.9,
          midi: acotarMidi(grado(escala, g + 7, tonica)),
          intensidad: 0.32,
          voz: "guia",
          timbre: "arco",
        });
      });
    }
    // Respuesta: el mismo sujeto una cuarta más abajo y a media distancia, que
    // es lo que produce la sensación de diálogo entre voces.
    sujeto.forEach((g, i) => {
      notas.push({
        inicioMs: base + msPorNegra * 2 + i * corchea,
        duracionMs: corchea * 0.9,
        midi: acotarMidi(grado(escala, g + 3, tonica)),
        intensidad: 0.26,
        voz: "respuesta",
        timbre: "arco",
      });
    });
    // Bajo que camina: una negra por tiempo, por grados contiguos.
    for (let t = 0; t < 4; t += 1) {
      notas.push({
        inicioMs: base + t * msPorNegra,
        duracionMs: msPorNegra * 0.95,
        midi: acotarMidi(grado(escala, -7 + ((compas + t) % 4), tonica)),
        intensidad: 0.22,
        voz: "bajo",
        timbre: "arco",
      });
    }
  }
  return notas;
}

/**
 * Registro «mahler»: marcha lenta. Acordes sostenidos y separados, intervalos
 * anchos, sexta menor añadida y un pulso de timbal cada dos tiempos. No hay
 * melodía que seguir: hay masa que pesa.
 *
 * Se usa para la tensión y la pérdida — alerta sostenida, una baja, el
 * derelicto. El contraste con el registro «bach» es el punto: la misma mesa
 * pasa de contrapunto ordenado a bloque inmóvil.
 */
function generarMahler(aleatorio, { compases, tonica, msPorNegra }) {
  const escala = MENOR_ARMONICA;
  const notas = [];
  const paso = msPorNegra * 2; // Marcha: dos tiempos por acorde.

  for (let compas = 0; compas < compases; compas += 1) {
    const base = compas * paso * 2;
    // Acorde de tres voces bien separadas: la distancia entre ellas es lo que
    // da la amplitud orquestal.
    const raiz = Math.round(aleatorio.siguiente() * 2) * 2; // grados 0, 2 o 4
    const voces = [
      { desplazamiento: raiz - 14, intensidad: 0.45, voz: "bajo", timbre: "arco" },
      { desplazamiento: raiz, intensidad: 0.4, voz: "medio", timbre: "arco" },
      { desplazamiento: raiz + 5, intensidad: 0.3, voz: "alto", timbre: "arco" },
    ];
    for (const { desplazamiento, intensidad, voz, timbre } of voces) {
      notas.push({
        inicioMs: base,
        duracionMs: paso * 1.6,
        midi: acotarMidi(grado(escala, desplazamiento, tonica)),
        intensidad,
        voz,
        timbre,
      });
    }
    // Pulso grave a contratiempo: el paso de la marcha.
    notas.push({
      inicioMs: base + paso,
      duracionMs: msPorNegra * 0.5,
      midi: acotarMidi(tonica - 24),
      intensidad: 0.55,
      voz: "pulso",
      timbre: "parche",
    });
  }
  return notas;
}


/**
 * Registro «bandura»: cascada de cuerda pulsada. La bandura ucraniana tiene
 * decenas de cuerdas al aire, así que su idiomatismo natural es el arpegio
 * rápido que se desgrana y se deja resonar, no la melodía cantada.
 *
 * Aquí es el registro de la **belleza tranquila**: descubrimiento, un planeta
 * nuevo a la vista, el momento en que nadie está en peligro.
 */
function generarBandura(aleatorio, { compases, tonica, msPorNegra }) {
  const escala = MENOR_NATURAL;
  const notas = [];
  const semicorchea = msPorNegra / 4;

  for (let compas = 0; compas < compases; compas += 1) {
    const base = compas * msPorNegra * 4;
    // Cada compás desgrana una figura ascendente y la deja sonar. La longitud
    // varía para que la cascada no caiga siempre igual.
    const largo = 5 + Math.round(aleatorio.siguiente() * 4);
    const arranque = Math.round(aleatorio.siguiente() * 3);
    for (let i = 0; i < largo; i += 1) {
      notas.push({
        inicioMs: base + i * semicorchea,
        // Cola larga: las cuerdas siguen sonando mientras entran las siguientes.
        duracionMs: msPorNegra * 2.5,
        midi: acotarMidi(grado(escala, arranque + i, tonica + 12)),
        // La cascada se apaga hacia el final, como una mano que suelta.
        intensidad: Number((0.34 - (i / largo) * 0.16).toFixed(3)),
        voz: "cascada",
        timbre: "bandura",
      });
    }
  }
  return notas;
}

/**
 * Registro «bordon»: bordón continuo con frase modal lenta encima.
 *
 * Toma prestado el PROCEDIMIENTO —tónica sostenida bajo una melodía que se
 * mueve por grados de un modo fijo, sin modulación— que es común a muchas
 * tradiciones y que en la música clásica de la India se organiza en ragas. No
 * se reproduce ninguna raga concreta ni repertorio tradicional alguno: sería
 * pretender un conocimiento que este módulo no tiene, y además innecesario,
 * porque lo que aporta es la estructura, no la cita.
 *
 * Es el registro más acogedor de los cuatro: sin pulso marcado y sin armonía
 * que resolver, no pide nada al oyente.
 */
function generarBordon(aleatorio, { compases, tonica, msPorNegra }) {
  const escala = MENOR_NATURAL;
  const notas = [];
  const duracionTotal = compases * msPorNegra * 4;

  // Bordón: tónica y quinta sostenidas de principio a fin.
  for (const [desplazamiento, intensidad] of [[-12, 0.22], [-5, 0.16]]) {
    notas.push({
      inicioMs: 0,
      duracionMs: duracionTotal,
      midi: acotarMidi(tonica + desplazamiento),
      intensidad,
      voz: "bordon",
      timbre: "bordon",
    });
  }

  // Frase que sube y baja por grados contiguos, con notas de duración
  // irregular: la respiración de una melodía tocada, no un secuenciador.
  let g = 0;
  let t = 0;
  let subiendo = true;
  while (t < duracionTotal) {
    const largo = msPorNegra * (1 + Math.round(aleatorio.siguiente() * 2));
    notas.push({
      inicioMs: Number(t.toFixed(2)),
      duracionMs: Number(Math.min(largo, duracionTotal - t).toFixed(2)),
      midi: acotarMidi(grado(escala, g, tonica)),
      intensidad: 0.3,
      voz: "frase",
      timbre: "simpatica",
    });
    if (g >= 7) subiendo = false;
    if (g <= 0) subiendo = true;
    g += subiendo ? 1 : -1;
    t += largo;
  }
  return notas;
}

/**
 * Registro «paganini»: virtuosismo. Carreras rápidas por grados, arpegios que
 * cruzan cuerdas y dobles cuerdas ocasionales.
 *
 * Cubre un estado que ningún otro registro cubría: la **urgencia con agencia**.
 * Mahler es lo que te pasa —peso, pérdida, nada que hacer—; esto es lo que
 * HACES: la persecución, la evasión, la reparación contrarreloj. Que la mesa
 * distinga por el oído entre «vamos a morir» y «corre» es información de juego,
 * no decoración.
 */
function generarPaganini(aleatorio, { compases, tonica, msPorNegra }) {
  const escala = MENOR_ARMONICA;
  const notas = [];
  const semicorchea = msPorNegra / 4;

  for (let compas = 0; compas < compases; compas += 1) {
    const base = compas * msPorNegra * 4;
    // Alterna carrera por grados y arpegio a saltos: es el contraste que hace
    // que suene a instrumento tocado y no a escala de ejercicio.
    const esArpegio = aleatorio.siguiente() > 0.5;
    const direccion = aleatorio.siguiente() > 0.5 ? 1 : -1;
    const inicio = Math.round(aleatorio.siguiente() * 5);
    for (let i = 0; i < 16; i += 1) {
      const paso = esArpegio ? i * 2 : i;
      notas.push({
        inicioMs: base + i * semicorchea,
        duracionMs: semicorchea * 0.85,
        midi: acotarMidi(grado(escala, inicio + direccion * paso, tonica + 12)),
        // Acento en el primer tiempo de cada grupo de cuatro: da pulso sin
        // necesidad de percusión.
        intensidad: i % 4 === 0 ? 0.5 : 0.34,
        voz: "carrera",
        timbre: "mordiente",
      });
    }
    // Doble cuerda al cierre del compás: dos notas a la vez, marca de la casa.
    if (compas % 2 === 1) {
      for (const desplazamiento of [0, 4]) {
        notas.push({
          inicioMs: base + msPorNegra * 3.5,
          duracionMs: msPorNegra * 0.5,
          midi: acotarMidi(grado(escala, inicio + desplazamiento, tonica)),
          intensidad: 0.42,
          voz: "doble",
          timbre: "mordiente",
        });
      }
    }
  }
  return notas;
}

/**
 * Registro «txalaparta»: percusión vasca a dos ejecutantes.
 *
 * No es un timbre más, y por eso está aquí: la txalaparta se toca ENTRE DOS
 * sobre la misma tabla. Uno hace *ttakun* (golpe doble) y el otro *herrena*
 * (golpe simple), y se turnan; el ritmo resultante no existe en ninguna de las
 * dos partes por separado, solo en su encaje. Es un instrumento cooperativo en
 * un juego cooperativo vasco: la estructura del instrumento ES el tema.
 *
 * Se usa para la faena compartida —maniobra coordinada, reparación a varias
 * manos— y para los cierres de sesión.
 */
function generarTxalaparta(aleatorio, { compases, tonica, msPorNegra }) {
  const notas = [];
  const golpe = msPorNegra / 2;
  // Dos tablas de altura distinta: la conversación se oye como pregunta y
  // respuesta aunque ninguna toque una melodía.
  const tablaA = acotarMidi(tonica + 7);
  const tablaB = acotarMidi(tonica);

  let t = 0;
  // Empieza quien empieza; a partir de ahí, el turno se alterna SIEMPRE. Ese
  // encaje estricto es la regla del instrumento, no una elección estética.
  let turnoDeA = aleatorio.siguiente() > 0.5;
  const fin = compases * msPorNegra * 4;

  while (t < fin) {
    if (turnoDeA) {
      // ttakun: dos golpes seguidos, el segundo un poco más flojo.
      notas.push(
        { inicioMs: t, duracionMs: golpe * 0.6, midi: tablaA, intensidad: 0.5, voz: "ttakun", timbre: "madera" },
        {
          inicioMs: t + golpe * 0.5,
          duracionMs: golpe * 0.6,
          midi: tablaA,
          intensidad: 0.38,
          voz: "ttakun",
          timbre: "madera",
        },
      );
    } else {
      // herrena: un solo golpe, que es el que deja el hueco.
      notas.push({
        inicioMs: t,
        duracionMs: golpe * 0.6,
        midi: tablaB,
        intensidad: 0.45,
        voz: "herrena",
        timbre: "madera",
      });
    }
    t += golpe;
    turnoDeA = !turnoDeA;
  }
  return notas;
}

/**
 * Capa de flautas: contracanto DISCRETO que acompaña a cualquier registro.
 *
 * Discreto quiere decir tres cosas concretas, no un adjetivo: entra tarde (no
 * en el primer compás), suena por debajo de la voz principal, y deja huecos
 * largos. Una flauta que toca todo el rato deja de acompañar y pasa a
 * competir; el efecto buscado es que se note que estaba cuando calla.
 */
function capaDeFlautas(aleatorio, { compases, tonica, msPorNegra, densidad = 0.35 }) {
  const escala = MENOR_NATURAL;
  const notas = [];
  const fuerza = Math.max(0, Math.min(1, Number(densidad) || 0));
  if (fuerza === 0) return notas;

  // Nunca desde el principio: la flauta se suma a algo que ya estaba sonando.
  for (let compas = 2; compas < compases; compas += 1) {
    if (aleatorio.siguiente() > fuerza) continue;
    const base = compas * msPorNegra * 4;
    // Dos o tres notas largas por aparición, en el registro agudo, donde no
    // estorban a las cuerdas ni al bordón.
    const cuantas = 2 + Math.round(aleatorio.siguiente());
    let g = Math.round(aleatorio.siguiente() * 4);
    for (let i = 0; i < cuantas; i += 1) {
      notas.push({
        inicioMs: base + i * msPorNegra * 1.5,
        duracionMs: msPorNegra * 1.35,
        midi: acotarMidi(grado(escala, g + 14, tonica)),
        // Por debajo de cualquier voz principal de los otros registros.
        intensidad: 0.16,
        voz: "flauta",
        timbre: "flauta",
      });
      g += aleatorio.siguiente() > 0.5 ? 1 : -1;
    }
  }
  return notas;
}

/**
 * Genera una pieza. Misma semilla y mismos parámetros ⇒ misma pieza, para que
 * la mesa entera oiga lo mismo sin sincronizar audio por red.
 */
export function generarPieza(
  semilla,
  { registro = "bach", compases = 8, tonica = 57, bpm = 58, flautas = true } = {},
) {
  if (!REGISTROS.includes(registro)) {
    throw new RangeError(`generarPieza: registro desconocido (${registro})`);
  }
  const compasesSeguros = Math.max(1, Math.min(64, Math.round(Number(compases) || 1)));
  const bpmSeguro = Math.max(30, Math.min(200, Number(bpm) || 58));
  const tonicaSegura = acotarMidi(Number(tonica) || 57);
  const msPorNegra = 60000 / bpmSeguro;
  const aleatorio = crearAleatorio(semilla);

  const opciones = { compases: compasesSeguros, tonica: tonicaSegura, msPorNegra };
  const generadores = {
    bach: generarBach,
    mahler: generarMahler,
    bandura: generarBandura,
    bordon: generarBordon,
    paganini: generarPaganini,
    txalaparta: generarTxalaparta,
  };
  const notas = generadores[registro](aleatorio, opciones);
  // Las flautas acompañan a cualquier registro salvo al de virtuosismo, donde
  // no cabrían: ahí ya hay dieciséis notas por compás.
  if (flautas && registro !== "paganini") {
    notas.push(...capaDeFlautas(aleatorio, opciones));
  }

  notas.sort((a, b) => a.inicioMs - b.inicioMs || a.midi - b.midi);
  const duracionMs = notas.reduce((fin, n) => Math.max(fin, n.inicioMs + n.duracionMs), 0);
  return { registro, bpm: bpmSeguro, tonica: tonicaSegura, duracionMs, notas };
}

/** Frecuencia en Hz de una nota MIDI (La4 = 69 = 440 Hz). */
export function frecuencia(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Qué registro pide un estado de nave. La música sigue a la ficción: verde es
 * cotidianidad (contrapunto), amarilla y roja son peso (marcha).
 */
export function registroParaAlerta(nivel) {
  return nivel === "amarilla" || nivel === "roja" ? "mahler" : "bach";
}

// ---- Variación en el tiempo ------------------------------------------------

/**
 * Encadena varios tramos que DERIVAN lentamente, en vez de repetir un bucle.
 *
 * Un bucle idéntico cansa a la tercera vuelta y delata que es música de
 * relleno. Aquí cada tramo cambia un poco respecto al anterior —la tónica se
 * mueve por grados del modo, el tempo respira, la densidad de flautas sube y
 * baja— pero nunca de golpe, así que la mesa percibe que «sigue sonando lo
 * mismo» sin poder señalar dos tramos iguales.
 *
 * Sigue siendo determinista: misma semilla, misma deriva para todos.
 */
export function encadenarTramos(semilla, { registro = "bach", tramos = 4, compasesPorTramo = 8, bpm = 58, tonica = 57 } = {}) {
  const cuantos = Math.max(1, Math.min(32, Math.round(Number(tramos) || 1)));
  const deriva = crearAleatorio(`${semilla}-deriva`);
  const piezas = [];
  let desplazamiento = 0;
  let tonicaActual = tonica;
  let bpmActual = bpm;

  for (let i = 0; i < cuantos; i += 1) {
    const pieza = generarPieza(`${semilla}-t${i}`, {
      registro,
      compases: compasesPorTramo,
      tonica: tonicaActual,
      bpm: bpmActual,
    });
    piezas.push({
      indice: i,
      inicioMs: desplazamiento,
      tonica: tonicaActual,
      bpm: bpmActual,
      notas: pieza.notas.map((n) => ({ ...n, inicioMs: n.inicioMs + desplazamiento })),
    });
    desplazamiento += pieza.duracionMs;

    // Deriva para el tramo siguiente: pasos pequeños y acotados. La tónica se
    // mueve como mucho una tercera arriba o abajo del punto de partida, para
    // que la pieza no se vaya de tesitura ni cambie de carácter.
    const salto = deriva.siguiente() > 0.5 ? 2 : -2;
    tonicaActual = acotarMidi(Math.max(tonica - 4, Math.min(tonica + 4, tonicaActual + salto)));
    bpmActual = Math.max(30, Math.min(200, Math.round(bpmActual + (deriva.siguiente() - 0.5) * 6)));
  }

  const notas = piezas.flatMap((t) => t.notas).sort((a, b) => a.inicioMs - b.inicioMs);
  return { registro, tramos: piezas, duracionMs: desplazamiento, notas };
}

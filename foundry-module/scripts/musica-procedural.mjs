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

import { crearAleatorio } from "./minijuegos/aleatorio.mjs";

// Escalas como grados sobre la tónica, en semitonos.
const MENOR_NATURAL = [0, 2, 3, 5, 7, 8, 10];
const MENOR_ARMONICA = [0, 2, 3, 5, 7, 8, 11];

export const REGISTROS = Object.freeze(["bach", "mahler"]);

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
      { desplazamiento: raiz - 14, intensidad: 0.45, voz: "bajo" },
      { desplazamiento: raiz, intensidad: 0.4, voz: "medio" },
      { desplazamiento: raiz + 5, intensidad: 0.3, voz: "alto" },
    ];
    for (const { desplazamiento, intensidad, voz } of voces) {
      notas.push({
        inicioMs: base,
        duracionMs: paso * 1.6,
        midi: acotarMidi(grado(escala, desplazamiento, tonica)),
        intensidad,
        voz,
      });
    }
    // Pulso grave a contratiempo: el paso de la marcha.
    notas.push({
      inicioMs: base + paso,
      duracionMs: msPorNegra * 0.5,
      midi: acotarMidi(tonica - 24),
      intensidad: 0.55,
      voz: "pulso",
    });
  }
  return notas;
}

/**
 * Genera una pieza. Misma semilla y mismos parámetros ⇒ misma pieza, para que
 * la mesa entera oiga lo mismo sin sincronizar audio por red.
 */
export function generarPieza(semilla, { registro = "bach", compases = 8, tonica = 57, bpm = 58 } = {}) {
  if (!REGISTROS.includes(registro)) {
    throw new RangeError(`generarPieza: registro desconocido (${registro})`);
  }
  const compasesSeguros = Math.max(1, Math.min(64, Math.round(Number(compases) || 1)));
  const bpmSeguro = Math.max(30, Math.min(200, Number(bpm) || 58));
  const tonicaSegura = acotarMidi(Number(tonica) || 57);
  const msPorNegra = 60000 / bpmSeguro;
  const aleatorio = crearAleatorio(semilla);

  const opciones = { compases: compasesSeguros, tonica: tonicaSegura, msPorNegra };
  const notas = registro === "bach" ? generarBach(aleatorio, opciones) : generarMahler(aleatorio, opciones);

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

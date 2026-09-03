/**
 * Reproductor de la música procedural (#347) sobre Web Audio.
 *
 * Sintetiza en el navegador los eventos de nota de `musica-procedural.mjs` por
 * **síntesis aditiva**: un oscilador por armónico, con las amplitudes relativas
 * que declara `TIMBRES` y una envolvente de ganancia. Por eso el repositorio no
 * contiene ni un byte de audio grabado — el timbre es una descripción, no una
 * muestra (la razón legal completa está en `musica-procedural.mjs`).
 *
 * Todo lo que toca el mundo exterior entra por parámetro —el contexto de audio,
 * el temporizador— para poder probar el reproductor desde Node con dobles, sin
 * navegador. La lógica de QUÉ suena es de `musica-mando.mjs`; aquí solo está el
 * CÓMO suena.
 */

import { TIMBRES, generarPieza, frecuencia } from "./musica-procedural.mjs";

// Un tramo corto: encadenar tramos cortos permite cambiar de registro sin que
// la mesa espere a que acabe una pieza larga.
const COMPASES_POR_TRAMO = 8;
// Margen antes de encadenar el tramo siguiente, para que no se oiga la costura.
const ANTICIPO_MS = 400;

/**
 * Programa una nota: un oscilador por parcial, todos bajo una envolvente común.
 *
 * La envolvente es lo que convierte una suma de senos en algo que parece un
 * instrumento: sin ataque y caída, todo suena a órgano de juguete.
 */
function programarNota(contexto, destino, nota, tiempoBase) {
  const timbre = TIMBRES[nota.timbre] ?? TIMBRES.arco;
  const f0 = frecuencia(nota.midi);
  const inicio = tiempoBase + nota.inicioMs / 1000;
  const ataque = Math.max(0.001, timbre.ataqueMs / 1000);
  const sosten = nota.duracionMs / 1000;
  const cola = timbre.decaimientoMs / 1000;

  const sobre = contexto.createGain();
  sobre.gain.setValueAtTime(0, inicio);
  sobre.gain.linearRampToValueAtTime(nota.intensidad, inicio + ataque);
  sobre.gain.setValueAtTime(nota.intensidad, inicio + Math.max(ataque, sosten));
  // Exponencial, que es como se apaga una cuerda de verdad; nunca a cero
  // exacto, porque `exponentialRampToValueAtTime(0)` es inválido.
  sobre.gain.exponentialRampToValueAtTime(0.0001, inicio + Math.max(ataque, sosten) + cola);
  sobre.connect(destino);

  const fin = inicio + Math.max(ataque, sosten) + cola;
  const nodos = [];
  timbre.parciales.forEach((amplitud, i) => {
    // Los parciales inarmónicos (la tabla de la txalaparta) no son múltiplos
    // enteros del fundamental: una tabla no vibra como una cuerda.
    const razon = timbre.inarmonicos ? timbre.inarmonicos[i] : i + 1;
    const hz = f0 * razon;
    // Por encima de Nyquist solo habría aliasing: chirridos que no están en la
    // partitura.
    if (hz >= (contexto.sampleRate ?? 44100) / 2) return;
    const osc = contexto.createOscillator();
    osc.frequency.value = hz;
    const ganancia = contexto.createGain();
    ganancia.gain.value = amplitud / timbre.parciales.length;
    osc.connect(ganancia);
    ganancia.connect(sobre);
    osc.start(inicio);
    osc.stop(fin);
    nodos.push(osc);
  });
  return nodos;
}

/**
 * Crea el reproductor. No suena nada hasta `habilitar()`: los navegadores
 * exigen un gesto del usuario antes de dejar sonar audio, y forzarlo solo
 * consigue una consola llena de avisos y una mesa en silencio.
 */
export function crearReproductor({
  contexto,
  semilla = "lagunak",
  programar = (fn, ms) => setTimeout(fn, ms),
  cancelar = (id) => clearTimeout(id),
} = {}) {
  let salida = null;
  let registroActual = null;
  let temporizador = null;
  let vivos = [];
  let tramo = 0;
  // Dos cosas distintas que antes estaban confundidas en una sola bandera, y de
  // ahí el bug: el GESTO del usuario se concede una vez y no se revoca —el
  // navegador ya nos dejó sonar—, mientras que el audio local se enciende y se
  // apaga tantas veces como el usuario quiera. Con una bandera única, cortar
  // dejaba el reproductor «habilitado» y el siguiente clic volvía a cortar: la
  // música no se podía recuperar sin recargar la página.
  let gestoConcedido = false;
  let activo = false;

  function pararNodos() {
    for (const osc of vivos) {
      try {
        osc.stop();
      } catch {
        // Ya estaba parado: nada que hacer.
      }
    }
    vivos = [];
    if (temporizador !== null) cancelar(temporizador);
    temporizador = null;
  }

  function sonarTramo() {
    if (!activo || !registroActual) return;
    // Semilla por tramo: la mesa entera oye lo mismo sin sincronizar audio por
    // red, y cada tramo suena distinto del anterior sin repetir un bucle.
    const pieza = generarPieza(`${semilla}-${registroActual}-${tramo}`, {
      registro: registroActual,
      compases: COMPASES_POR_TRAMO,
    });
    const base = contexto.currentTime + 0.1;
    for (const nota of pieza.notas) vivos.push(...programarNota(contexto, salida, nota, base));
    tramo += 1;
    temporizador = programar(() => {
      vivos = [];
      sonarTramo();
    }, Math.max(ANTICIPO_MS, pieza.duracionMs - ANTICIPO_MS));
  }

  return {
    /** ¿Está sonando el audio en este cliente? Es lo que alterna el botón. */
    get habilitado() {
      return activo;
    },
    get registro() {
      return registroActual;
    },

    /**
     * Enciende el audio en ESTE cliente. Idempotente, y **reanudable**: sirve
     * igual para el primer gesto del usuario que para volver a activar después
     * de haber cortado, que es el uso normal de un botón alternante.
     */
    async habilitar() {
      if (activo) return true;
      await contexto.resume?.();
      if (!gestoConcedido) {
        salida = contexto.createGain();
        // Música de ambiente: por debajo de las voces de la mesa, siempre.
        salida.gain.value = 0.25;
        salida.connect(contexto.destination);
        gestoConcedido = true;
      }
      activo = true;
      if (registroActual) sonarTramo();
      return true;
    },

    /**
     * Pone un registro, o `null` para callar. Repetir el registro que ya suena
     * no reinicia nada: la orden del GM puede llegar dos veces y la música no
     * debe dar un salto por eso.
     */
    poner(registro) {
      if (registro === registroActual) return registroActual;
      pararNodos();
      registroActual = registro ?? null;
      tramo = 0;
      if (activo && registroActual) sonarTramo();
      return registroActual;
    },

    /**
     * Corta el audio local. El gesto del usuario no se pierde —no hay que
     * volver a pedirlo—, pero el reproductor queda INACTIVO, así que el
     * siguiente `habilitar()` vuelve a programar notas de verdad.
     */
    detener() {
      pararNodos();
      registroActual = null;
      activo = false;
    },
  };
}

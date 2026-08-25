// Reproducción del sonido del mar en la playa (#571).
// Se usa el reproductor de ficheros de audio junto con la síntesis procedural.
// El fichero de audio es una ola del mar bajo licencia CC0, con su ficha de
// procedencia en `docs/PROCEDENCIA_ASSETS.md`.

import { declararSonidos, crearReproductorDeFicheros } from "./audio-ficheros.mjs";

export const CATALOGO = declararSonidos({
  mar: {
    ruta: "data/audio/mar.wav",
    bucle: true,
    volumen: 0.4,
    procedencia: {
      fuente: "OpenGameArt.org (Jasinski)",
      licencia: "CC0 1.0",
      enlace: "https://opengameart.org/content/beach-ocean-waves",
    }
  }
});

/**
 * Crea el reproductor de ficheros de audio para la escena de la playa.
 * El contexto de audio, el cargador y el volumen general deben ser provistos
 * por el llamante (por ejemplo, la escena de la playa).
 *
 * @param {Object} options
 * @param {AudioContext} options.contexto - Contexto de audio de Web Audio API.
 * @param {(ruta:string)=>Promise<ArrayBuffer>} options.cargar - Función que
 *        devuelve los datos del fichero de audio dado su ruta.
 * @param {number} [options.volumenGeneral=0.6] - Volumen maestro (0 a 1).
 * @returns {Object} El reproductor con métodos `sonar`, `pararTodo`, etc.
 */
export function crearReproductorDePlaya({ contexto, cargar, volumenGeneral = 0.6 } = {}) {
  return crearReproductorDeFicheros({ contexto, catalogo: CATALOGO, cargar, volumenGeneral });
}
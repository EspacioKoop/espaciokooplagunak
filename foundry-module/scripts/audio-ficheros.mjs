// Reproducción de ficheros de audio (#571), al lado de la síntesis.
//
// POR QUÉ EXISTE, Y POR QUÉ NO CONTRADICE A #318. La música de a bordo se
// SINTETIZA, y la razón está escrita en `musica-procedural.mjs`: no se
// transcriben ediciones modernas ni se llevan grabaciones ajenas, porque una
// edición crítica y un fonograma tienen derechos propios aunque la obra sea de
// dominio público. Esa decisión no dice «nunca sonará un fichero»: dice «no
// entra obra ajena sin permiso». Un fichero CC0 con su ficha de procedencia
// entra por la misma puerta que entró una malla en #590, y esa puerta ya existe.
//
// QUÉ RESUELVE. Hay cosas que la síntesis aditiva no hace y que una escena
// necesita: el mar, el viento, una puerta, una alarma con carácter. Un espectro
// de armónicos evoca un instrumento; no evoca una ola rompiendo. Para ambiente y
// efectos, una grabación corta es la herramienta, y sin consumidor no tenía
// sentido siquiera listar fuentes de audio en `docs/ASSETS_LIBRES.md`.
//
// LO QUE NO ES. No es un reproductor de música: la música sigue siendo
// procedural y sigue siendo la de #318. Esto es ambiente y efectos.
//
// TODO LO EXTERNO ENTRA POR PARÁMETRO —el contexto de audio, el cargador, el
// reloj—, igual que en `musica-reproductor.mjs`, para poder probarlo desde Node
// con dobles y sin navegador.

/** Cuánto tarda un sonido en entrar y en salir, para que no chasquee. Un corte
 *  seco en una forma de onda se oye como un clic, y es el fallo que delata un
 *  reproductor casero antes que ningún otro. */
const RAMPA_MS = 40;

/** Tope de sonidos a la vez. Sin él, una escena con un fallo de lógica puede
 *  encadenar cientos y saturar la salida hasta el recorte. */
export const MAXIMO_SIMULTANEOS = 8;

/**
 * Declara un catálogo de sonidos, con su procedencia OBLIGATORIA.
 *
 * SIN FICHA NO ENTRA, y por eso la comprobación está aquí y no en una prueba: un
 * sonido sin procedencia comprobable no debe llegar a sonar ni en desarrollo,
 * porque en desarrollo es donde se cuela. Es la misma regla que
 * `docs/PROCEDENCIA_ASSETS.md` aplica a las mallas, y la que permite publicar
 * este repositorio sin miedo.
 *
 * `bucle` marca los que se encadenan solos —mar, viento— frente a los que suenan
 * una vez.
 */
export function declararSonidos(definiciones) {
  const entradas = Object.entries(definiciones).map(([clave, sonido]) => {
    const { procedencia } = sonido;
    for (const campo of ["fuente", "licencia", "enlace"]) {
      if (!procedencia?.[campo]) {
        throw new Error(
          `El sonido "${clave}" no declara ${campo} en su procedencia. ` +
            "Un asset sin procedencia comprobable no entra, por bueno que sea.",
        );
      }
    }
    return [
      clave,
      Object.freeze({
        ruta: sonido.ruta,
        bucle: sonido.bucle === true,
        volumen: Number.isFinite(sonido.volumen) ? sonido.volumen : 1,
        procedencia: Object.freeze({ ...procedencia }),
      }),
    ];
  });
  return Object.freeze(Object.fromEntries(entradas));
}

/**
 * Crea el reproductor de ficheros.
 *
 * `cargar(ruta)` devuelve un `ArrayBuffer`: se inyecta para que la prueba no
 * necesite red ni ficheros, y para que en Foundry se pueda pasar el camino que
 * el anfitrión prefiera.
 *
 * LOS BÚFERES SE CACHEAN POR RUTA. Decodificar audio es caro y el mismo sonido
 * se pide muchas veces —cada ola, cada puerta—; decodificar en cada disparo se
 * oiría como un tirón en el hilo principal.
 */
export function crearReproductorDeFicheros({
  contexto,
  catalogo,
  cargar,
  volumenGeneral = 0.6,
} = {}) {
  const buferes = new Map();
  const sonando = new Set();
  let maestro = null;

  const salida = () => {
    if (!maestro) {
      maestro = contexto.createGain();
      maestro.gain.value = volumenGeneral;
      maestro.connect(contexto.destination);
    }
    return maestro;
  };

  async function bufer(ruta) {
    let guardado = buferes.get(ruta);
    if (!guardado) {
      // Se guarda la PROMESA y no el búfer: si dos disparos piden el mismo
      // sonido a la vez, el segundo espera al primero en vez de descargar otra.
      guardado = Promise.resolve(cargar(ruta)).then((datos) => contexto.decodeAudioData(datos));
      buferes.set(ruta, guardado);
    }
    return guardado;
  }

  return {
    /** ¿Está declarado? Preguntarlo antes evita que un nombre mal escrito
     *  reviente en mitad de una escena en vez de al escribirla. */
    conoce(clave) {
      return Boolean(catalogo[clave]);
    },

    /**
     * Suena `clave`. Devuelve un mando para pararlo, que es lo que un ambiente
     * en bucle necesita — un efecto de una vez se puede olvidar.
     */
    async sonar(clave, { volumen = 1 } = {}) {
      const sonido = catalogo[clave];
      if (!sonido) throw new RangeError(`sonar: "${clave}" no está en el catálogo`);
      if (sonando.size >= MAXIMO_SIMULTANEOS) return null;

      const datos = await bufer(sonido.ruta);
      const fuente = contexto.createBufferSource();
      fuente.buffer = datos;
      fuente.loop = sonido.bucle;

      const ganancia = contexto.createGain();
      const objetivo = sonido.volumen * volumen;
      const ahora = contexto.currentTime;
      // Entrada en rampa: a volumen pleno desde el primer instante, una forma de
      // onda que empieza lejos del cero chasquea.
      ganancia.gain.setValueAtTime(0, ahora);
      ganancia.gain.linearRampToValueAtTime(objetivo, ahora + RAMPA_MS / 1000);

      fuente.connect(ganancia);
      ganancia.connect(salida());
      fuente.start(ahora);

      const mando = {
        parar() {
          const t = contexto.currentTime;
          ganancia.gain.cancelScheduledValues(t);
          ganancia.gain.setValueAtTime(ganancia.gain.value, t);
          ganancia.gain.linearRampToValueAtTime(0, t + RAMPA_MS / 1000);
          try {
            fuente.stop(t + RAMPA_MS / 1000);
          } catch {
            // Ya estaba parado: nada que hacer.
          }
          sonando.delete(mando);
        },
      };
      sonando.add(mando);
      // Un sonido de una vez se descuenta solo al acabar; si no, el tope se
      // llenaría de sonidos que ya no suenan y la escena se quedaría muda.
      if (!sonido.bucle) fuente.onended = () => sonando.delete(mando);
      return mando;
    },

    /** Corta todo. Lo pide cualquier cambio de escena: los sonidos de un sitio
     *  no pueden seguir oyéndose en otro. */
    pararTodo() {
      for (const mando of [...sonando]) mando.parar();
    },

    /** Cuántos suenan ahora, para que una prueba pueda comprobar el tope. */
    get activos() {
      return sonando.size;
    },
  };
}

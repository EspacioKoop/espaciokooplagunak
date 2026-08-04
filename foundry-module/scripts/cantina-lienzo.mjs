// Lo único de la cantina que toca un <canvas> y un reloj (#423 sobre #362).
//
// La sala (`cantina-escena.mjs`) y los objetos que giran (`cantina-icono.mjs`)
// son geometría pura y no saben pintar; el pintor es `retro3d-lienzo.mjs`. Aquí
// está lo que falta entre las dos cosas: un bucle que pregunta la escena del
// instante y la vuelca, y el asomo de la cámara.
//
// NO IMPORTA FOUNDRY. Recibe elementos de lienzo y ya está, igual que hace
// `retro3d-lienzo.mjs`. Eso lo deja probable en Node con lienzos de mentira, que
// es como está cubierto — la ventana (`cantina-app.mjs`) solo le pasa el DOM.
//
// EL MOVIMIENTO ES OPCIONAL, NO DECORATIVO. Bajo `prefers-reduced-motion` no hay
// bucle: se pinta UN fotograma y se acabó. La sala sigue estando y las puertas
// siguen abriendo — lo que desaparece es el giro, no la información. Es la misma
// regla que el resto del módulo (#227), y por eso el bucle está construido para
// poder no existir en vez de para poder pararse.

import { componerCantina } from "./cantina-escena.mjs";
import { PLANO_INICIAL, destinoValido } from "./cantina-planos.mjs";
import { componerIcono } from "./cantina-icono.mjs";
import { CANTINA } from "./paleta.mjs";
import { pintarCapa2D } from "./cantina-2d.mjs";
import { pintarEscena } from "./retro3d-lienzo.mjs";

/**
 * Arranca la sala en un lienzo y devuelve el mando para pararla.
 *
 * @param {{sala: object, objetos: Array<{lienzo: object, objeto: string}>}} piezas
 * @param {{epoca?: string, reducirMovimiento?: boolean, ahora?: () => number,
 *   pedirFotograma?: (cb: Function) => number, cancelarFotograma?: (id: number) => void}} opciones
 * @returns {{detener: Function, mirar: Function, pintarUnaVez: Function}}
 */
export function arrancarCantina(piezas, opciones = {}) {
  const {
    epoca,
    reducirMovimiento = false,
    ahora = () => Date.now(),
    pedirFotograma,
    cancelarFotograma,
  } = opciones;

  const sala = piezas?.sala ?? null;
  const gente = Array.isArray(piezas?.gente) ? piezas.gente : [];
  // Quien mira la sala no se pinta a sí mismo: la cámara es su punto de vista,
  // no un cuerpo más en la escena.
  const yo = piezas?.yo ?? null;
  const objetos = Array.isArray(piezas?.objetos) ? piezas.objetos : [];
  // Se enfoca a lo sumo un objeto, y se guarda por su nombre y no por su
  // lienzo: dos puertas del mismo juego enfocarían las dos a la vez.
  let enfocado = null;
  let plano = PLANO_INICIAL;
  let resaltada = null;
  let ultimasOpciones = [];
  let avisoDeCorte = null;
  let fotograma = null;
  let vivo = true;
  const inicio = ahora();

  function pintarUnaVez() {
    const ms = ahora() - inicio;
    const ctx = sala?.getContext?.("2d");
    if (ctx) {
      const escena = componerCantina({ ancho: sala.width, alto: sala.height, epoca, plano, gente, yo, tiempo: ms });
      ultimasOpciones = escena.opciones;
      pintarEscena(ctx, escena, { fondo: CANTINA.ventana });
      // Y encima, el pixel-art plano: halo de las lámparas, filo del ventanal,
      // polvo, líneas y viñeta. Va DESPUÉS del 3D a propósito — es lo que tapa
      // las costuras que deja el pintor entre caras vecinas, y lo que pone la
      // luz que un sombreado por normal no puede dar.
      // Las anclas vienen proyectadas por la MISMA cámara que la sala: es lo
      // que hace que los trastos estén en la pared y no encima del cristal.
      pintarCapa2D(ctx, {
        ancho: sala.width,
        alto: sala.height,
        ms,
        anclas: escena.anclas,
        aire: escena.aire,
        opciones: escena.opciones,
        resaltada,
      });
    }
    for (const { lienzo, objeto } of objetos) {
      const ctxObjeto = lienzo?.getContext?.("2d");
      if (!ctxObjeto) continue;
      pintarEscena(
        ctxObjeto,
        componerIcono(objeto, {
          ancho: lienzo.width,
          alto: lienzo.height,
          epoca,
          // Sin movimiento, el objeto se congela en una pose y no en el
          // fotograma cero: a t=0 la pila de fichas se ve de perfil.
          ms: reducirMovimiento ? 1200 : ms,
          enfocado: enfocado === objeto,
        }),
        // Fondo transparente: el objeto va DENTRO del botón, y pintarle un
        // fondo propio le dibujaría un recuadro dentro de otro.
        { fondo: null },
      );
    }
  }

  function tic() {
    if (!vivo) return;
    pintarUnaVez();
    fotograma = pedirFotograma?.(tic) ?? null;
  }

  pintarUnaVez();
  // El bucle solo existe si hay movimiento que hacer Y alguien que dé
  // fotogramas. Sin `pedirFotograma` esto es un pintor de un solo disparo, que
  // es justo lo que necesita una prueba.
  if (!reducirMovimiento && pedirFotograma) fotograma = pedirFotograma(tic);

  return {
    /** Corta a otro plano. CORTE SECO, nunca travelling: interpolar entre dos
     * encuadres compuestos deja una tirada de fotogramas sin componer. */
    cortarA(id) {
      if (!destinoValido(id)) return false;
      plano = id;
      resaltada = null;
      // Se repinta SIEMPRE al cortar, haya bucle o no: las opciones del plano
      // nuevo tienen que existir antes de que nadie pregunte por ellas.
      pintarUnaVez();
      avisoDeCorte?.(plano);
      return true;
    },
    /** En qué plano estamos. */
    donde() {
      return plano;
    },
    /** Lo que se puede hacer desde aquí, ya proyectado. */
    opciones() {
      return ultimasOpciones;
    },
    /** Avisa cuando se corta a otro plano, para repintar lo que hay fuera del
     * lienzo (los botones de acción). */
    alCortar(callback) {
      avisoDeCorte = typeof callback === "function" ? callback : null;
    },
    /** Resalta la opción bajo el puntero (o ninguna). */
    resaltar(opcion) {
      resaltada = opcion ?? null;
      if (!fotograma) pintarUnaVez();
    },
    /** Enfoca un objeto (o ninguno con `null`). */
    enfocar(objeto) {
      enfocado = objeto ?? null;
      if (!fotograma) pintarUnaVez();
    },
    pintarUnaVez,
    detener() {
      vivo = false;
      if (fotograma !== null) cancelarFotograma?.(fotograma);
      fotograma = null;
    },
  };
}

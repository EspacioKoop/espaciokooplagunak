// Bucle de andar (#427): lo único de "moverse por la nave" que toca un
// <canvas> y un reloj. `nave-movimiento.mjs` sabe colisionar y desplazar un
// punto; esto es la otra mitad —pedir fotogramas, leer qué teclas están
// pulsadas AHORA y pintar—, igual que `cantina-lienzo.mjs` es la otra mitad
// de `cantina-escena.mjs`.
//
// NO SABE DE NINGUNA SALA CONCRETA. Recibe `componer(x, z, yaw) -> escena` ya
// inyectado: quien llama decide qué geometría hay y con qué cámara se compone
// (mismo contrato que devuelve `retro3d.componerEscena`). Así este módulo es
// el runtime compartido de "andar" y cada sala/módulo de la nave aporta su
// propia composición sin que esto necesite saber que existen — la misma idea
// que `registrarJuego` en minijuegos o `crearCatalogo` en asistencia, pero
// para render en vez de para reglas.
//
// NO IMPORTA FOUNDRY. Recibe el lienzo y ya está, igual que `cantina-lienzo.
// mjs`: se prueba en Node con un lienzo de mentira y un `pedirFotograma` que
// el test dispara a mano.
//
// PINTA CON Z-BUFFER REAL (`pintarEscenaConProfundidad`, #510), no por
// orden: es justo el bucle donde se reportó el parpadeo (caras que
// intercambiaban su orden de dibujo con el temblor de cámara de un
// fotograma al siguiente), y un z-buffer no tiene ese problema porque no
// depende de en qué orden lleguen los polígonos. Las cámaras fijas de la
// cantina (#423) y el resto de superficies del módulo siguen con el pintor
// por orden de siempre (`pintarEscena`) — este cambio es de este bucle, no
// del motor entero.
//
// EL MOVIMIENTO ES OPCIONAL, NO DECORATIVO (mismo contrato que #227 y que
// `cantina-lienzo.mjs`): bajo `prefers-reduced-motion` no hay bucle continuo,
// pero aquí "movimiento" es la respuesta a pulsar una tecla, no un giro
// ambiental — apagar el bucle apagaría el propio andar. Por eso la preferencia
// no para el juego: solo evita CUALQUIER interpolación que no dependa
// directamente de una tecla mantenida (hoy no hay ninguna). Queda documentado
// aquí porque es la primera superficie del módulo donde `reducirMovimiento`
// NO es la respuesta correcta, y conviene que quien la toque sepa por qué.

import { alternarModo, PRIMERA } from "./nave-camara.mjs";

/**
 * Radio de colisión de quien anda.
 *
 * Se EXPORTA porque quien decide dónde aparece alguien necesita el mismo número
 * para comprobar que ahí cabe: con dos copias, un checkpoint podía validarse
 * contra un radio y luego moverse con otro (QA 2026-08-08).
 */
export const RADIO_ANDAR = 0.35;
import { interaccionAlAlcance } from "./nave-interaccion.mjs";
import { mover, puertaTocada } from "./nave-movimiento.mjs";
import { pintarEscenaConProfundidad } from "./retro3d-lienzo.mjs";

/** Ritmo al que gira la cámara mientras se mantiene "girar-izq"/"girar-der". */
const VELOCIDAD_GIRO = Math.PI * 0.6; // radianes por segundo

/**
 * Arranca el andar en un lienzo. Devuelve el mando: pulsar/soltar dirección,
 * girar, leer la posición y parar.
 *
 * @param {HTMLCanvasElement} lienzo
 * @param {{
 *   componer: (x:number, y:number, z:number, yaw:number, opciones?:{otrosJugadores?:Array}) => object,
 *   planta: object,
 *   puertas?: Array<{rect:object, destino:object}>,
 *   alTocarPuerta?: (destino:object) => void,
 *   interacciones?: Array<object>,
 *   alAlcanzarInteraccion?: (interaccion:object) => void,
 *   alSalirDeInteraccion?: () => void,
 *   x?: number, z?: number, y?: number, yaw?: number,
 *   velocidad?: number, radio?: number, velocidadGiro?: number,
 *   fondo?: string|null,
 *   ahora?: () => number,
 *   pedirFotograma?: (cb: (ms:number) => void) => number,
 *   cancelarFotograma?: (id: number) => void,
 *   otrosJugadores?: () => Array<{x:number, y:number, z:number, avatar?:object}>,
 *   aviso?: () => *,
 *   saludSistemas?: () => Record<string, {health?:number}>|null,
 * }} opciones
 */
export function arrancarAndar(lienzo, opciones = {}) {
  const {
    velocidad = 2.2,
    radio = RADIO_ANDAR,
    velocidadGiro = VELOCIDAD_GIRO,
    fondo: fondoInicial = null,
    ahora = () => globalThis.performance?.now?.() ?? Date.now(),
    pedirFotograma,
    cancelarFotograma,
    // Función y no array a propósito: se evalúa en cada fotograma pintado,
    // nunca una sola vez al arrancar — igual que `ahora`, este bucle no
    // conoce el reloj/red por su cuenta, solo pide el dato fresco cuando le
    // toca pintar (#498, follow-up de #453).
    otrosJugadores = () => [],
    // Punto de vista (QA 2026-08-08). El bucle solo lo TRANSPORTA: la regla de
    // dónde va la cámara vive en `nave-camara.mjs` y la aplica quien compone.
    modoCamara: modoCamaraInicial = PRIMERA,
    avatarPropio = () => ({}),
    // #541: lo que se ve por las ventanas. Se pasan como FUNCIONES y no como
    // valores porque cambian con cada telemetría, y el bucle solo las transporta:
    // qué hacer con ellas —incluida la persiana cuando no hay lectura— lo decide
    // `nave-ventana-espacio.mjs`.
    sensores = () => null,
    rumboNave = () => null,
    // Alerta de la nave y salud por sistema (#765): igual que `sensores`, se
    // piden frescas en cada fotograma pintado — el bucle solo las transporta,
    // qué tono le dan a la luminaria lo decide `nave-luminaria.mjs`.
    aviso = () => null,
    saludSistemas = () => null,
  } = opciones;

  if (typeof opciones.componer !== "function") {
    throw new TypeError("arrancarAndar requiere `componer(x, y, z, yaw)`");
  }

  // `planta`, `componer`, `puertas` y `alTocarPuerta` son mutables a
  // propósito: `cambiarEstancia` los reemplaza sin reiniciar el bucle de
  // fotogramas ni la ventana que lo contiene — es la costura entre salas.
  let planta = opciones.planta;
  let componer = opciones.componer;
  let puertas = Array.isArray(opciones.puertas) ? opciones.puertas : [];
  let alTocarPuerta = typeof opciones.alTocarPuerta === "function" ? opciones.alTocarPuerta : null;
  let interacciones = Array.isArray(opciones.interacciones) ? opciones.interacciones : [];
  let alAlcanzarInteraccion =
    typeof opciones.alAlcanzarInteraccion === "function" ? opciones.alAlcanzarInteraccion : null;
  // El flanco de SALIDA, y va aparte del de entrada a propósito (#598). La
  // mayoría de las interacciones no lo necesitan —abrir la consola de un puesto
  // no se "cierra" al dar dos pasos atrás— pero una cartela de museo sí: es un
  // cartel que se lee estando delante, y que siguiera puesto al otro lado de la
  // sala sería un rótulo pegado a la cámara. Callback separado y no
  // `alAlcanzarInteraccion(null)`, porque eso obligaría a todos los consumidores
  // a defenderse de un nulo para dar servicio a un caso que no usan.
  let alSalirDeInteraccion =
    typeof opciones.alSalirDeInteraccion === "function" ? opciones.alSalirDeInteraccion : null;
  // Flanco de entrada, no nivel (#509): una interacción no teletransporta, así
  // que seguir de pie delante de ella no puede seguir disparando el aviso en
  // cada fotograma —abriría el espacio de puesto sesenta veces por
  // segundo—. Solo cambia de `null` a un punto, o de un punto a otro.
  let interaccionAlcanzadaAntes = null;
  // Mutable como la planta y el `componer`: cruzar a un exterior cambia lo que
  // hay DETRÁS de la geometría, no solo la geometría (#587).
  let fondo = fondoInicial;
  // Mismo flanco de entrada para las puertas (QA: andar hacia atrás cerca de
  // una puerta teletransportaba una y otra vez sin parar). Antes se
  // comprobaba a NIVEL —`cambiarEstancia` en cada fotograma que el círculo
  // siguiera dentro del rectángulo—, y si el punto de llegada de la sala
  // destino cae cerca de su propia puerta de vuelta (o si el jugador sigue
  // empujando hacia la puerta de la que viene), el primer fotograma en la
  // sala nueva podía volver a tocarla y cruzar de vuelta de inmediato: un
  // vaivén sin que nadie soltara ninguna tecla. El flanco (`null` → puerta)
  // hace que cruzar sea un evento discreto, no un nivel que se compruebe
  // sesenta veces por segundo.
  let puertaTocadaAntes = null;
  // Ventana de gracia tras cruzar (QA: manteniendo "atrás" pulsado de forma
  // continua se podía cruzar la MISMA puerta en los dos sentidos sin parar —
  // el flanco de entrada evita repetir en el sitio, pero no evita que el
  // primer paso ya dentro de la sala nueva vuelva a tocar la puerta de
  // vuelta, que suele caer cerca del punto de llegada). Mientras dura, no se
  // dispara NINGÚN cruce: es más simple y más robusto que intentar excluir
  // solo la puerta por la que se acaba de entrar (#237 no está en juego, es
  // pura cinemática).
  const GRACIA_PUERTA_MS = 400;
  let bloqueadoPuertaHasta = 0;

  let x = Number.isFinite(opciones.x) ? opciones.x : planta.ancho / 2;
  let z = Number.isFinite(opciones.z) ? opciones.z : planta.profundidad / 2;
  let y = Number.isFinite(opciones.y) ? opciones.y : 0;
  let velocidadY = 0;
  let yaw = Number.isFinite(opciones.yaw) ? opciones.yaw : 0;

  const activas = new Set();
  // Sentado (asientos, sobre el raíl de #582). Es un estado del BUCLE y no de la
  // escena: mientras dura, no se integra movimiento —una silla no te lleva a
  // ningún sitio— pero el giro sigue vivo, porque mirar alrededor es la mitad de
  // por qué alguien se sienta en una terraza abierta al espacio.
  let sentado = false;
  // En QUÉ está sentado, si el mueble tiene pose (`nave-pose.mjs`). El bucle no
  // sabe qué es una silla: solo guarda el id que le dieron para poder
  // devolvérselo a quien levante, que es quien tiene que volver a ponerla en su
  // sitio. Sin esto, levantarse dejaría la silla retirada para siempre.
  let asientoOcupado = null;
  let modoCamara = modoCamaraInicial;
  let girando = 0; // -1 izquierda, 0 quieto, +1 derecha
  let vivo = true;
  let fotograma = null;
  let anterior = ahora();

  function pintarUnaVez() {
    const ctx = lienzo?.getContext?.("2d");
    if (!ctx) return;
    pintarEscenaConProfundidad(
      ctx,
      componer(x, y, z, yaw, {
        otrosJugadores: otrosJugadores(),
        modoCamara,
        avatarPropio: avatarPropio(),
        sensores: sensores(),
        rumboNave: rumboNave(),
        aviso: aviso(),
        saludSistemas: saludSistemas(),
        // Reloj de la escena (#587). El bucle YA sabe qué hora es —lo necesita
        // para integrar el movimiento— y hasta ahora se lo guardaba. Sin él una
        // escena solo puede dibujar cosas quietas, y hay ambiente que no se
        // puede contar quieto: un viento que no mueve nada no es viento, es una
        // hierba torcida. Las trece salas de la nave lo ignoran y no cambian.
        tiempo: ahora(),
      }),
      { fondo },
    );
  }

  function paso(ms) {
    if (!vivo) return;
    const ahoraMs = Number.isFinite(ms) ? ms : ahora();
    const dt = Math.max(0, (ahoraMs - anterior) / 1000);
    anterior = ahoraMs;

    if (girando !== 0) yaw += girando * velocidadGiro * dt;

    // Te levantas ANDANDO, y no con la misma tecla con la que te sentaste. Sin
    // esto, pulsar "adelante" sentado no hace nada y la ventana parece colgada:
    // el modo de fallo de cualquier estado que capture los controles es que
    // quien no sabe cómo salir cree que el programa se ha roto. Cualquier
    // dirección vale —incluidos saltar y agacharse—, porque todas significan lo
    // mismo aquí: quiero mover el cuerpo.
    if (sentado && activas.size > 0) sentado = false;
    if (sentado) {
      pintarUnaVez();
      fotograma = pedirFotograma?.(paso) ?? null;
      return;
    }

    const siguiente = mover({ x, z, y, velocidadY, yaw, activas, dt, planta, velocidad, radio });
    x = siguiente.x;
    z = siguiente.z;
    y = siguiente.y;
    velocidadY = siguiente.velocidadY;

    // Se comprueba DESPUÉS de mover, con la posición ya resuelta: una puerta
    // no bloquea (`mover` no la conoce), así que su detección no puede
    // adelantarse al desplazamiento sin leer una posición que todavía no es
    // la real de este fotograma. Flanco de entrada, igual que los puntos de
    // interacción: cruzar es un evento discreto, no algo que se compruebe
    // por segundo mientras el círculo siga solapando el rectángulo.
    if (alTocarPuerta && ahoraMs >= bloqueadoPuertaHasta) {
      const puerta = puertaTocada(x, z, radio, puertas);
      if (puerta !== puertaTocadaAntes) {
        if (puerta) alTocarPuerta(puerta.destino);
        puertaTocadaAntes = puerta;
      }
    }

    // Los puntos de interacción de la sala (#582): quién está al alcance lo
    // decide `nave-interaccion.mjs` —incluido el desempate cuando hay dos—, y
    // aquí solo se avisa en el flanco de entrada. Este bucle no sabe qué es una
    // consola ni qué es una caña de pescar: transporta la `accion` declarada.
    if (alAlcanzarInteraccion || alSalirDeInteraccion) {
      const interaccion = interaccionAlAlcance(x, z, radio, interacciones);
      if (interaccion !== interaccionAlcanzadaAntes) {
        if (interaccion) alAlcanzarInteraccion?.(interaccion);
        else alSalirDeInteraccion?.();
        interaccionAlcanzadaAntes = interaccion;
      }
    }

    pintarUnaVez();
    fotograma = pedirFotograma?.(paso) ?? null;
  }

  pintarUnaVez();
  if (pedirFotograma) fotograma = pedirFotograma(paso);

  return {
    /** Mantiene una dirección activa ("adelante"/"atras"/"izquierda"/"derecha"). */
    pulsar(direccion) {
      activas.add(direccion);
    },
    /** Suelta una dirección. Soltar una que no estaba activa no hace nada. */
    soltar(direccion) {
      activas.delete(direccion);
    },
    /**
     * Alterna entre primera y tercera persona y devuelve el modo resultante.
     *
     * Repinta al instante en vez de esperar al siguiente fotograma: sin bucle de
     * animación (`prefers-reduced-motion`, o un anfitrión sin rAF) el cambio no
     * se vería hasta que alguien se moviera.
     */
    alternarCamara() {
      modoCamara = alternarModo(modoCamara);
      pintarUnaVez();
      return modoCamara;
    },
    /** Qué punto de vista está activo, para rotularlo fuera. */
    camara() {
      return modoCamara;
    },
    /**
     * Sienta a quien anda en la pose ya resuelta por `nave-asiento.mjs`.
     *
     * Aquí no se calcula nada: el bucle no sabe a qué altura queda un taburete,
     * igual que no sabe qué es una consola. Recibe `{x, z, yaw, y}` y lo aplica.
     */
    sentarse({ x: sx, z: sz, yaw: sYaw, y: sy }, prop = null) {
      if (Number.isFinite(sx)) x = sx;
      if (Number.isFinite(sz)) z = sz;
      if (Number.isFinite(sYaw)) yaw = sYaw;
      y = Number.isFinite(sy) ? sy : 0;
      velocidadY = 0;
      sentado = true;
      asientoOcupado = typeof prop === "string" ? prop : null;
      pintarUnaVez();
    },
    /**
     * Cambia la GEOMETRÍA de la estancia actual sin cambiar de estancia.
     *
     * Es lo que necesita un mueble con pose (`nave-pose.mjs`): al retirarse una
     * silla cambian lo que se pinta y lo que estorba, pero no dónde estás, ni
     * qué punto de interacción tienes al alcance, ni por qué puerta acabas de
     * pasar. Va aparte de `cambiarEstancia` justo por eso — esa reinicia los
     * flancos, y reiniciarlos aquí volvería a disparar el punto que tienes
     * delante: sentarte pondría la silla en pose y el fotograma siguiente
     * volvería a sentarte, para siempre.
     */
    recomponer({ planta: nuevaPlanta, componer: nuevoComponer } = {}) {
      if (nuevaPlanta) planta = nuevaPlanta;
      if (typeof nuevoComponer === "function") componer = nuevoComponer;
      pintarUnaVez();
    },
    /** Levanta, si estaba sentado. Llamarla de pie no hace nada. */
    levantarse() {
      if (!sentado) return;
      sentado = false;
      asientoOcupado = null;
      y = 0;
      velocidadY = 0;
      pintarUnaVez();
    },
    /** Si está sentado, para que la ventana pueda rotularlo. */
    estaSentado() {
      return sentado;
    },
    /** En qué mueble con pose está sentado, o `null`. Lo necesita quien tenga
     *  que devolverlo a su sitio al levantarse. */
    asientoOcupado() {
      return asientoOcupado;
    },
    /** Gira mientras se mantenga: -1 izquierda, 0 quieto, 1 derecha. */
    girar(sentido) {
      girando = Math.sign(sentido) || 0;
    },
    /** Posición y orientación actuales, para quien necesite leerlas (p. ej.
     *  para guardarlas en un flag al cerrar la ventana). `y` es la altura de
     *  salto/agachado, no la de ojos —ver `nave-movimiento.mover`. */
    posicion() {
      return { x, z, y, yaw };
    },
    /**
     * Cambia de estancia SIN reiniciar el bucle de fotogramas: sustituye la
     * planta de colisión, la composición de render, sus puertas y la
     * posición/orientación de llegada. Es la costura entre salas — quien
     * decide CUÁNDO llamarla (típicamente al recibir `alTocarPuerta`) es capa
     * de arriba (el catálogo de estancias o quien lo consulte), nunca este
     * módulo: aquí solo se aplica el cambio ya decidido.
     */
    cambiarEstancia({
      planta: nuevaPlanta,
      componer: nuevoComponer,
      puertas: nuevasPuertas,
      interacciones: nuevasInteracciones,
      fondo: nuevoFondo,
      x: nx,
      z: nz,
      yaw: nYaw,
    }) {
      if (nuevaPlanta) planta = nuevaPlanta;
      if (typeof nuevoComponer === "function") componer = nuevoComponer;
      puertas = Array.isArray(nuevasPuertas) ? nuevasPuertas : [];
      interacciones = Array.isArray(nuevasInteracciones) ? nuevasInteracciones : [];
      // `null` NO borra el fondo: significa «esta estancia no opina», y quien no
      // opina se queda con el de la ventana.
      if (typeof nuevoFondo === "string") fondo = nuevoFondo;
      else if (nuevoFondo === null) fondo = fondoInicial;
      // La sala nueva empieza sin nadie tocando ningún punto ni ninguna
      // puerta: si el punto de llegada cayera sobre uno por casualidad, el
      // flanco de entrada de ESA sala tiene que poder dispararse, no darse
      // por ya visto.
      interaccionAlcanzadaAntes = null;
      // Y lo que hubiera puesto la interacción anterior se retira con ella: la
      // cartela de una pieza no puede seguir en pantalla en la sala siguiente.
      alSalirDeInteraccion?.();
      puertaTocadaAntes = null;
      // Ningún cruce de puerta puede dispararse hasta pasado `GRACIA_PUERTA_MS`:
      // el punto de llegada suele caer cerca de la puerta de vuelta (ver
      // comentario de `bloqueadoPuertaHasta`), y sin esta ventana un "atrás"
      // mantenido pulsado la cruzaría de nuevo en el primer paso ya dentro de
      // la sala nueva.
      bloqueadoPuertaHasta = anterior + GRACIA_PUERTA_MS;
      if (Number.isFinite(nx)) x = nx;
      if (Number.isFinite(nz)) z = nz;
      if (Number.isFinite(nYaw)) yaw = nYaw;
      // Cruzar una puerta siempre aterriza de pie: ni un salto ni una silla
      // sobreviven al corte de estancia, igual que ninguna otra inercia.
      sentado = false;
      asientoOcupado = null;
      y = 0;
      velocidadY = 0;
      // Sin bucle propio (lienzo de prueba), quien llama necesita ver el
      // cambio reflejado de inmediato y no esperar a un `avanzar` posterior.
      pintarUnaVez();
    },
    /** Sin bucle (lienzo de prueba o `pedirFotograma` ausente), avanza un
     *  paso a mano — es lo que usa un test para no depender de un reloj real. */
    pintarUnaVez,
    avanzar(dtMs) {
      paso(anterior + dtMs);
    },
    detener() {
      vivo = false;
      if (fotograma !== null) cancelarFotograma?.(fotograma);
      fotograma = null;
    },
  };
}

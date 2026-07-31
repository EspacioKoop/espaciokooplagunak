// Los planos de la cantina (#423): desde dónde se mira, y qué se puede hacer.
//
// POR QUÉ PLANOS Y NO PASEO LIBRE. La sala tenía cámara libre y por eso ninguna
// decisión de encuadre significaba nada: colocar el planeta en un punto áureo
// solo tiene sentido respecto a una cámara CONOCIDA, y con cámara libre es ruido
// matemático. Además el paseo obligaba a poner una valla —detrás de la barra no
// hay decorado— y una valla es la señal de que el espacio no quería ser
// navegable. La cantina es el vestíbulo de dos juegos, no el juego.
//
// LO QUE SE CONSERVA DEL PASEO. Que se pueda ir de un sitio a otro y que se vea
// QUÉ hay: es el modelo de GTA V, RDR2 o The Witcher — la cámara está autorada,
// pero lo que puedes hacer desde donde estás está señalado y no hay que
// adivinarlo barriendo la pantalla con el ratón. Cada plano declara sus salidas
// y sus acciones, y cada una tiene un ancla en coordenadas de MUNDO para poder
// dibujar su rótulo donde está la cosa, no en una esquina de la interfaz.
//
// CORTE SECO, NUNCA TRAVELLING. Interpolar entre dos encuadres compuestos
// reintroduce por la puerta de atrás justo lo que los planos resuelven: durante
// la interpolación ningún fotograma está compuesto.
//
// Puro: ni Foundry, ni DOM, ni red, ni reloj.

/**
 * Altura de los ojos, en `y` absoluta, para quien está DE PIE. El suelo tiene su
 * cara superior en −1.75, así que esto deja la mirada a 1.09 sobre el suelo: la
 * proporción de una persona ante una barra de 0.75 de alto.
 */
export const OJOS_DE_PIE = -0.66;

/** Y sentado, que es medio metro más abajo. Sentarse tiene que NOTARSE en el
 * encuadre; si la cámara no baja, «sentarse» es una palabra y no un sitio. */
export const OJOS_SENTADO = -1.06;

/**
 * Los planos. Cada uno es un cuadro compuesto a mano: posición, hacia dónde se
 * mira y con qué objetivo. El `fov` cambia por plano a propósito — un plano
 * general de sala y un primer plano de barra no se filman con la misma lente.
 *
 * `acciones` es lo que se puede hacer DESDE AQUÍ. `destino` lleva a otro plano;
 * `puerta` abre una mesa de minijuego (el id del catálogo de `cantina.mjs`).
 * `ancla` es dónde vive esa opción en el mundo, para rotularla en su sitio.
 */
export const PLANOS = Object.freeze([
  Object.freeze({
    id: "entrada",
    // EL PLANO KUBRICK: centrado, un punto de fuga, el ojo de buey de frente y
    // el planeta desplazado a su punto áureo dentro del cristal. Es el primero
    // que se ve al abrir la cantina, y es el que tiene que vender la sala.
    posicion: [0, OJOS_DE_PIE, -1.4],
    yaw: 0,
    pitch: 0,
    fov: 38,
    acciones: Object.freeze([
      Object.freeze({ tipo: "ir", destino: "barra", etiqueta: "LAGUNAK.Cantina.Ir.Barra", ancla: [0, -0.6, 3.2] }),
      Object.freeze({ tipo: "ir", destino: "mesaPoker", etiqueta: "LAGUNAK.Cantina.Ir.MesaPoker", ancla: [-3.4, -0.9, 5.2] }),
      Object.freeze({ tipo: "ir", destino: "mesaDados", etiqueta: "LAGUNAK.Cantina.Ir.MesaDados", ancla: [3.9, -0.9, 3.9] }),
    ]),
  }),
  Object.freeze({
    id: "barra",
    // Sentado al taburete, descentrado y en escorzo: calor dominante, el goblin
    // al fondo en el tercio opuesto. Asimétrico a propósito, que es lo contrario
    // del plano de entrada — dos cuadros iguales no son dos planos.
    posicion: [1.1, OJOS_SENTADO, 2.1],
    yaw: -0.34,
    pitch: 0.05,
    fov: 46,
    acciones: Object.freeze([
      Object.freeze({ tipo: "ir", destino: "entrada", etiqueta: "LAGUNAK.Cantina.Ir.Entrada", ancla: [0, -0.4, -2.2] }),
      Object.freeze({ tipo: "ir", destino: "ventanal", etiqueta: "LAGUNAK.Cantina.Ir.Ventanal", ancla: [0, 0.4, 6.6] }),
    ]),
  }),
  Object.freeze({
    id: "mesaPoker",
    // Sentado a la mesa de babor. El ojo de buey entra por un borde: frío
    // contra cálido, que es lo que hace que la mesa se sienta un rincón.
    posicion: [-3.4, OJOS_SENTADO, 4.0],
    yaw: 0.5,
    pitch: 0.06,
    fov: 50,
    acciones: Object.freeze([
      Object.freeze({ tipo: "jugar", puerta: "poker", etiqueta: "LAGUNAK.Cantina.Puerta.Poker", ancla: [-3.4, -1.1, 5.2] }),
      Object.freeze({ tipo: "ir", destino: "entrada", etiqueta: "LAGUNAK.Cantina.Ir.Entrada", ancla: [0, -0.4, -2.2] }),
    ]),
  }),
  Object.freeze({
    id: "mesaDados",
    posicion: [3.9, OJOS_SENTADO, 2.7],
    yaw: -0.42,
    pitch: 0.06,
    fov: 50,
    acciones: Object.freeze([
      Object.freeze({ tipo: "jugar", puerta: "dados", etiqueta: "LAGUNAK.Cantina.Puerta.Dados", ancla: [3.9, -1.1, 3.9] }),
      Object.freeze({ tipo: "ir", destino: "entrada", etiqueta: "LAGUNAK.Cantina.Ir.Entrada", ancla: [0, -0.4, -2.2] }),
    ]),
  }),
  Object.freeze({
    id: "ventanal",
    // De pie contra el cristal, mirando fuera. Es el plano que existe para no
    // hacer nada: en un sitio acogedor tiene que poder no hacerse nada.
    posicion: [0, OJOS_DE_PIE, 4.6],
    yaw: 0,
    pitch: 0.1,
    fov: 34,
    acciones: Object.freeze([
      Object.freeze({ tipo: "ir", destino: "barra", etiqueta: "LAGUNAK.Cantina.Ir.Barra", ancla: [0, -0.6, 3.2] }),
      Object.freeze({ tipo: "ir", destino: "entrada", etiqueta: "LAGUNAK.Cantina.Ir.Entrada", ancla: [0, -0.4, -2.2] }),
    ]),
  }),
]);

/** El plano por el que se entra. */
export const PLANO_INICIAL = "entrada";

/** El plano con ese id, o el inicial si no existe: una cantina sin cámara no se
 * puede pintar, así que aquí no se devuelve `undefined` nunca. */
export function planoPorId(id) {
  return PLANOS.find((plano) => plano.id === id) ?? PLANOS.find((p) => p.id === PLANO_INICIAL);
}

/** Adónde lleva una acción de tipo `ir`, validado contra el catálogo. */
export function destinoValido(id) {
  return PLANOS.some((plano) => plano.id === id);
}

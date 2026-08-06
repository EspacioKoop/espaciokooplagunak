// Sala de ingeniería (#508): la primera sala REAL de la nave hecha con la
// fábrica de sala-caja (`nave-sala-caja.mjs`), conectada al vestíbulo
// (`nave-vestibulo.mjs`) por su muro sur.
//
// POR QUÉ INGENIERÍA PRIMERO. Ya tiene sitio propio en la planta 2D de la
// sección de la nave (`seccion-nave.mjs`, sala "ingenieria", destino
// "puesto") y en el relé de puesto (`engineering`): no hay que inventar un
// puesto nuevo para darle una sala, solo construirla.
//
// UNA VENTANA, COMO PIDE #508. En el muro norte, opuesto a la entrada: quien
// entra ve el espacio al fondo de la sala, no nada más cruzar la puerta.
//
// Puro: solo compone `crearSalaCaja`, que ya es pura.

import { SECCION } from "./paleta.mjs";
import { crearSalaCaja } from "./nave-sala-caja.mjs";

/** Puerta hacia el vestíbulo, en el muro sur: el mismo rectángulo que
 *  `PUERTA_VESTIBULO_HACIA_INGENIERIA` describe desde el otro lado, pero en
 *  el sistema de coordenadas PROPIO de esta sala. */
export const PUERTA_INGENIERIA_HACIA_VESTIBULO = { x: 3, z: 0, ancho: 2, profundidad: 1.2 };

/** Ventana al espacio en el muro norte, enfrente de la entrada: casi todo el
 *  ancho de la sala (margen de 1 a cada lado), como pidió el feedback de
 *  #508 — un ojo de buey se perdía en un muro de 8. */
const VENTANA_NORTE = { x: 1, z: 8, ancho: 6, profundidad: 1.2 };

const SALA = crearSalaCaja({
  ancho: 8,
  profundidad: 8,
  puertas: [{ rect: PUERTA_INGENIERIA_HACIA_VESTIBULO }],
  ventanas: [{ rect: VENTANA_NORTE }],
  colorMuro: SECCION.casco,
  colorColumna: SECCION.mamparo,
  // Semilla propia: dos salas con ventana no tienen por qué mirar exactamente
  // el mismo cielo que la cantina (misma idea que `semillaCielo` en
  // `cantina-escena.mjs`, un número distinto por sala).
  semillaCielo: 20260806,
});

export const PLANTA_INGENIERIA = SALA.planta;
export const componerIngenieria = SALA.componer;

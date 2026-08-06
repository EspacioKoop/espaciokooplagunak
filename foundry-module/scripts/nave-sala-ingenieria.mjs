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
// LA CONSOLA (#509): un mueble con pantalla entre la entrada y la ventana,
// con una zona de pie delante que dispara el aviso de acercarse — separada
// del punto de entrada a propósito, para que sea un gesto y no algo que ya
// haya pasado al cruzar la puerta. Ver la cabecera de `nave-salas-puente.mjs`
// para el reparto completo de responsabilidades (la sala no abre nada).
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

/** El mueble de la consola, con la pantalla mirando hacia la puerta (sur). */
const MOBILIARIO_CONSOLA = [
  { nombre: "consolaCuerpo", centro: [4, 0.5, 5], medidas: [1.2, 1.0, 1.0], color: SECCION.mamparo },
  {
    nombre: "consolaPantalla",
    centro: [4, 1.0, 4.45],
    medidas: [0.7, 0.6, 0.08],
    color: SECCION.entrable,
    colision: false,
  },
];

/** Zona de pie delante de la consola (#509): entre la entrada (z=2) y el
 *  cuerpo de la consola (z:4.5-5.5), sin tocar ninguna de las dos. */
export const ZONA_CONSOLA_INGENIERIA = { x: 3.5, z: 3.2, ancho: 1.0, profundidad: 1.0 };

const SALA = crearSalaCaja({
  ancho: 8,
  profundidad: 8,
  puertas: [{ rect: PUERTA_INGENIERIA_HACIA_VESTIBULO }],
  ventanas: [{ rect: VENTANA_NORTE }],
  mobiliario: MOBILIARIO_CONSOLA,
  colorMuro: SECCION.casco,
  colorColumna: SECCION.mamparo,
  // Semilla propia: dos salas con ventana no tienen por qué mirar exactamente
  // el mismo cielo que la cantina (misma idea que `semillaCielo` en
  // `cantina-escena.mjs`, un número distinto por sala).
  semillaCielo: 20260806,
});

export const PLANTA_INGENIERIA = SALA.planta;
export const componerIngenieria = SALA.componer;
